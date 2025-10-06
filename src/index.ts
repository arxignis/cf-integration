import { captcha } from './lib/captcha';
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers';
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { getIPType } from './lib/helper';
import { log } from './lib/log';
import { metrics } from './lib/metrics';
import { getLogBufferStatus, getMetricsBufferStatus, ArxignisLogBufferDO, ArxignisMetricsBufferDO } from './lib/durable-buffer';
import version from './lib/version';
import { ThreatResult, AccessRuleResult } from './lib/types';
import { threat } from './lib/threat';
import { accessRules } from './lib/access-rules';
import { buildFilterEvent, generateIdempotencyKey, sendFilterRequest } from './lib/filter';
interface ArxignisEnv extends Omit<Env, 'MODE'> {
	MODE: 'block' | 'monitor';
}

const handler = {
  async fetch(
    request: Request,
    env: ArxignisEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    // Create a tracer for explicit span creation
    const tracer = trace.getTracer('cf-ax-proxy', version);

    return tracer.startActiveSpan('cf-ax-proxy.request', {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.user_agent': request.headers.get('user-agent') || '',
      }
    }, async (span) => {
      try {
        const clientIP = request.headers.get('CF-Connecting-IP') || '';

        // Check access rules first (if ruleId is provided)
        const ruleId = request.headers.get('X-Access-Rule-ID') || env.ARXIGNIS_ACCESS_CONTROL_LIST_ID;
        let accessRuleResult: AccessRuleResult | null = null;

        if (ruleId) {
          accessRuleResult = await accessRules(request, env as Env, ctx, ruleId);
        }

        // Only check threat if access rules don't already decide
        let threatResult: ThreatResult | null = null;
        if (!accessRuleResult || !accessRuleResult.decision) {
          threatResult = await threat(request, env as Env, ctx);
        }

        // Determine final decision - access rules take precedence
        let decision: string | null = null;
        let decisionCached = false;
        let ruleIdUsed: string | undefined;

        if (accessRuleResult && accessRuleResult.decision) {
          decision = accessRuleResult.decision;
          decisionCached = accessRuleResult.cached || false;
          ruleIdUsed = accessRuleResult.ruleId;
        } else if (threatResult) {
          decision = threatResult.decision === 'challenge' ? 'captcha' : threatResult.decision;
          decisionCached = threatResult.cached || false;
          ruleIdUsed = threatResult.ruleId;
        }

        // Set span attributes for tracing
        try {
          span.setAttribute('origin_url', request.url);
          span.setAttribute('client.ip', clientIP);
          if (clientIP) {
            try {
              span.setAttribute('client.ip_type', getIPType(clientIP));
            } catch (error) {
              span.setAttribute('client.ip_type', 'unknown');
            }
          } else {
            span.setAttribute('client.ip_type', 'none');
          }
          span.setAttribute('decision', decision || 'none');
          span.setAttribute(
            'decision_cached',
            decisionCached ? 'true' : 'false'
          );
          span.setAttribute('rule_id', ruleIdUsed || 'none');
          span.setAttribute('source', accessRuleResult ? 'access_rule' : 'threat');
          span.setAttribute('timestamp', new Date().toISOString());
          span.setAttribute('ax.version', version);
        } catch (error) {
          console.warn('Failed to set tracing attributes:', error);
        }

        // Add buffer status to span for monitoring (non-blocking, cached)
        // Only check buffer status every 10 requests to reduce overhead
        if (Math.random() < 0.1) {
          Promise.all([getLogBufferStatus(env), getMetricsBufferStatus(env)])
            .then(([logStatus, metricsStatus]) => {
              try {
                span.setAttribute('log_buffer.size', logStatus.size);
                span.setAttribute('log_buffer.is_flushing', logStatus.isFlushing);
                span.setAttribute('metrics_buffer.size', metricsStatus.size);
                span.setAttribute(
                  'metrics_buffer.is_flushing',
                  metricsStatus.isFlushing
                );
              } catch (error) {
                console.warn('Failed to set buffer status attributes:', error);
              }
            })
            .catch((error) => {
              console.warn('Failed to get buffer status:', error);
            });
        }

        let response: Response;

        switch (decision) {
          case 'block':
            try {
              if (env.MODE != 'block') {
                response = await fetch(request);
              } else {
                // Use the appropriate result for metrics
                const resultForMetrics = accessRuleResult || threatResult;
                if (resultForMetrics) {
                  metrics(request, env as Env, resultForMetrics as ThreatResult);
                }
                console.log(
                  JSON.stringify({
                    ipAddress: clientIP,
                    decision: decision,
                    decisionCached: decisionCached || false,
                    ruleId: ruleIdUsed
                  })
                );
                response = await env.ASSETS.fetch(
                  new URL('block.html', request.url)
                );
              }
            } catch (error) {
              console.warn('Something went wrong with the block:', error);
              span.recordException(error as Error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Block processing failed' });
              response = await fetch(request);
            }
            break;
          case 'captcha':
          case 'challenge':
            try {
              if (env.MODE != 'block') {
                response = await fetch(request);
              } else {
                // Use the appropriate result for metrics
                const resultForMetrics = accessRuleResult || threatResult;
                if (resultForMetrics) {
                  metrics(request, env as Env, resultForMetrics as ThreatResult);
                }
                console.log(
                  JSON.stringify({
                    ipAddress: clientIP,
                    decision: decision,
                    decisionCached: decisionCached || false,
                    ruleId: ruleIdUsed
                  })
                );
                response = await captcha(request, env as Env);
              }
            } catch (error) {
              console.warn('Something went wrong with the captcha:', error);
              span.recordException(error as Error);
              span.setStatus({ code: SpanStatusCode.ERROR, message: 'Captcha processing failed' });
              response = await fetch(request);
            }
            break;
          default:
            log(request, env as Env);
            console.log(
              JSON.stringify({
                ipAddress: clientIP,
                decision: decision,
                decisionCached: decisionCached || false,
                ruleId: ruleIdUsed
              })
            );
            
            // Call filter service if configured
            let filterAction: string | null = null;
            if (env.ARXIGNIS_API_URL && env.ARXIGNIS_API_KEY && env.ARXIGNIS_TENANT_ID) {
              try {
                const filterEvent = await buildFilterEvent(request, {
                  requestId: request.headers.get('CF-Request-ID') || undefined,
                  tenantId: env.ARXIGNIS_TENANT_ID,
                });
                
                const idempotencyKey = await generateIdempotencyKey(request);
                const filterResult = await sendFilterRequest(env as Env, filterEvent, {
                  idempotencyKey,
                  originalEvent: false,
                });
                
                if (filterResult.error) {
                  console.warn('Filter request error:', filterResult.error);
                } else if (filterResult.response?.json) {
                  filterAction = filterResult.response.json.action || null;
                  span.setAttribute('filter.action', filterAction || 'none');
                  span.setAttribute('filter.reason', filterResult.response.json.reason || 'none');
                  if (filterResult.response.json.details) {
                    span.setAttribute('filter.files_scanned', filterResult.response.json.details.files_scanned || 0);
                    span.setAttribute('filter.files_infected', filterResult.response.json.details.files_infected || 0);
                  }
                  
                  console.log('Filter result:', JSON.stringify({
                    action: filterAction,
                    reason: filterResult.response.json.reason,
                    details: filterResult.response.json.details
                  }));
                }
              } catch (error) {
                console.warn('Filter processing failed:', error);
                span.recordException(error as Error);
              }
            }
            
            // If filter returned block, return block page
            if (filterAction === 'block' && env.MODE === 'block') {
              console.log('Blocked by filter service');
              response = await env.ASSETS.fetch(new URL('block.html', request.url));
            } else {
              // Proxy to origin if allowed or filter not configured
              response = await fetch(request);
            }
        }

        // Set response attributes
        span.setAttribute('http.status_code', response.status);
        span.setAttribute('http.response_size', response.headers.get('content-length') || '0');

        // Set span status based on response
        if (response.status >= 400) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` });
        } else {
          span.setStatus({ code: SpanStatusCode.OK });
        }

        return response;
      } catch (error) {
        console.error('Handler error:', error);
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: 'Internal server error' });
        return new Response('Internal Server Error', { status: 500 });
      } finally {
        span.end();
      }
    });
  },
} satisfies ExportedHandler<Env>;

export const config: ResolveConfigFn = (env: Env, _trigger) => {
	try {
		// More explicit check for enabled metrics
		if (env.PERFORMANCE_METRICS && env.PROMETHEUS_URL) {
			console.log('Configuring OpenTelemetry with exporter:', env.PROMETHEUS_URL);
			return {
        exporter: {
          url: env.PROMETHEUS_URL,
          headers: env.PROMETHEUS_HEADERS || {},
        },
        service: {
          name: 'cf-ax-proxy',
          version: version
        },
        batch: {
          maxSize: 50,
          maxWaitTime: 5000,
        },
        // Ensure spans are created and exported
        trace: {
          enabled: true,
        },
      };
		}
	} catch (error) {
		console.warn('Failed to configure OpenTelemetry exporter:', error);
	}

	// When PERFORMANCE_METRICS is false, use a minimal config that won't export
	console.log('Disabling OpenTelemetry export - using console exporter');
	return {
		exporter: {
			url: 'console://', // Use a valid but non-functional URL
			headers: {},
		},
		service: {
      name: 'cf-ax-proxy',
      version: version
    },
    // Still enable tracing even with console exporter for debugging
    trace: {
      enabled: true,
    },
	};
};

export default instrument(handler, config);

// Export Durable Object classes for Wrangler
export { ArxignisLogBufferDO, ArxignisMetricsBufferDO };

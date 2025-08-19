import { remediation } from './lib/remediation';
import { captcha } from './lib/captcha';
import { instrument, instrumentDO, ResolveConfigFn } from '@microlabs/otel-cf-workers';
import { trace } from '@opentelemetry/api';
import { getIPType } from './lib/helper';
import { log } from './lib/log';
import { metrics } from './lib/metrics';
import { getLogBufferStatus, getMetricsBufferStatus, LogBufferDO, MetricsBufferDO } from './lib/durable-buffer';
import version from './lib/version';


const handler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		try {
			const clientIP = request.headers.get('CF-Connecting-IP') || '';

			const remediationResult = await remediation(request, env);
			const decision = remediationResult.decision;
			const decisionCached = remediationResult.cached;

			// Set span attributes for tracing (with error handling)
			try {
				const span = trace.getActiveSpan();
				if (span) {
					span.setAttribute('origin_url', request.url);
					span.setAttribute('client.ip', clientIP);
					span.setAttribute('client.ip_type', getIPType(clientIP));
					span.setAttribute('remediation.decision', decision || 'none');
					span.setAttribute('remediation.cached', decisionCached ? 'true' : 'false');
					span.setAttribute('timestamp', new Date().toISOString());
					span.setAttribute('ax.version', version);
				}
			} catch (error) {
				console.warn('Failed to set tracing attributes:', error);
			}

			// Add buffer status to span for monitoring (non-blocking)
			Promise.all([
				getLogBufferStatus(env),
				getMetricsBufferStatus(env)
			]).then(([logStatus, metricsStatus]) => {
				try {
					const span = trace.getActiveSpan();
					if (span) {
						span.setAttribute('log_buffer.size', logStatus.size);
						span.setAttribute('log_buffer.is_flushing', logStatus.isFlushing);
						span.setAttribute('metrics_buffer.size', metricsStatus.size);
						span.setAttribute('metrics_buffer.is_flushing', metricsStatus.isFlushing);
					}
				} catch (error) {
					console.warn('Failed to set buffer status attributes:', error);
				}
			}).catch(() => {
				// Ignore buffer status errors to avoid blocking request processing
			});

			switch (decision) {
				case 'block':
					try {
					metrics(request, env, {
						decision,
						cached: decisionCached || false,
						ruleId: remediationResult.ruleId || '',
					});
					if (env.MODE != 'block') {
						return fetch(request);
					}
					console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
						const assetResponse = await env.ASSETS.fetch(new URL('block.html', request.url));
						return assetResponse;
					} catch (error) {
						console.warn('Something went wrong with the block:', error);
						return fetch(request);
					}
				case 'captcha':
					try {
					metrics(request, env, {
						decision,
						cached: decisionCached || false,
						ruleId: remediationResult.ruleId || '',
					});
					if (env.MODE != 'block') {
						return fetch(request);
					}
					console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
					return captcha(request, env);
					} catch (error) {
						console.warn('Something went wrong with the captcha:', error);
						return fetch(request);
					}
				default:
					log(request, env);
					console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
					return fetch(request);
			}
		} catch (error) {
			console.error('Handler error:', error);
			return new Response('Internal Server Error', { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

export const config: ResolveConfigFn = (env: Env, _trigger) => {
	// Debug logging to see what values we're getting
	console.log('PERFORMANCE_METRICS:', env.PERFORMANCE_METRICS);
	console.log('PROMETHEUS_URL:', env.PROMETHEUS_URL);

	try {
		// More explicit check for enabled metrics
		if (env.PERFORMANCE_METRICS && env.PROMETHEUS_URL) {
			console.log('Enabling OpenTelemetry export to:', env.PROMETHEUS_URL);
			return {
        exporter: {
          url: env.PROMETHEUS_URL,
          headers: env.PROMETHEUS_HEADERS || {},
        },
        service: { name: 'cf-ax-proxy' },
        batch: {
          maxSize: 50,
          maxWaitTime: 5000,
        },
      };
		}
	} catch (error) {
		console.warn('Failed to configure OpenTelemetry exporter:', error);
	}

	// When PERFORMANCE_METRICS is false, use a minimal config that won't export
	console.log('Disabling OpenTelemetry export');
	return {
		exporter: {
			url: 'console://', // Use a valid but non-functional URL
			headers: {},
		},
		service: { name: 'cf-ax-proxy' },
	};
};

export default instrument(handler, config);

// Export Durable Object classes for Wrangler
export { LogBufferDO, MetricsBufferDO };

import { remediation } from './lib/remediation';
import { captcha } from './lib/captcha';
import { getErrorPage } from './lib/error_page';
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers';
import { trace } from '@opentelemetry/api';
import { getIPType } from './lib/helper';
import { log } from './lib/log';
import { telemetry } from './lib/telemetry';
import version from './lib/version';

interface EnvWithErrorPage extends Env {
	ERROR_PAGE_TYPE?: 'html' | 'json' | 'external';
}

const errorPageRenderer = (request: Request, env: EnvWithErrorPage) => {
	let contentType = 'text/html;charset=UTF-8';
	const errorPageType = env.ERROR_PAGE_TYPE || 'html';
	switch (errorPageType) {
		case 'html':
			contentType = 'text/html;charset=UTF-8';
			break;
		case 'json':
			contentType = 'application/json;charset=UTF-8';
			break;
		case 'external':
			contentType = 'text/html;charset=UTF-8';
			break;
	}
	return {
		content: getErrorPage(
			{
				errorCode: 403,
				errorTitle: 'Forbidden',
				errorMessage: 'You are not authorized to access this resource.',
				userIPAddress: request.headers.get('CF-Connecting-IP') || '',
				originalUrl: request.url,
				timestamp: new Date().toISOString(),
				requestId: request.headers.get('CF-Request-ID') || '',
				ray: request.headers.get('CF-Ray') || '',
			},
			errorPageType
		),
		contentType,
	};
};

const handler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const clientIP = request.headers.get('CF-Connecting-IP') || '';
		const remediationResult = await remediation(request, env);
		const decision = remediationResult.decision;
		const decisionCached = remediationResult.cached;

		// Set span attributes for tracing
		trace.getActiveSpan()?.setAttribute('origin_url', request.url);
		trace.getActiveSpan()?.setAttribute('client.ip', clientIP);
		trace.getActiveSpan()?.setAttribute('client.ip_type', getIPType(clientIP));
		trace.getActiveSpan()?.setAttribute('remediation.decision', decision || 'none');
		trace.getActiveSpan()?.setAttribute('remediation.cached', decisionCached ? 'true' : 'false');
		trace.getActiveSpan()?.setAttribute('timestamp', new Date().toISOString());
		trace.getActiveSpan()?.setAttribute('ax.version', version);

		switch (decision) {
			case 'block':
				if (env.MODE != 'block') {
					return fetch(request);
				}
				telemetry(request, env, { decision, cached: decisionCached || false });
				console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
				const errorPage = errorPageRenderer(request, env);
				return new Response(errorPage.content as string, {
					headers: {
						'Content-Type': errorPage.contentType,
					},
				});
			case 'captcha':
				if (env.MODE != 'block') {
					return fetch(request);
				}
				telemetry(request, env, { decision, cached: decisionCached || false });
				console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
				return captcha(request, { ...env, ERROR_PAGE_TYPE: 'html' } as EnvWithErrorPage);
			default:
				log(request, env);
				console.log(JSON.stringify({ ipAddress: clientIP, remediation: decision, remediationCached: decisionCached || false }));
				return fetch(request);
		}
	},
} satisfies ExportedHandler<Env>;

export const config: ResolveConfigFn = (env: Env, _trigger) => {
	if (env.PROMETHEUS_URL) {
		return {
			exporter: {
				url: env.PROMETHEUS_URL,
				headers: env.PROMETHEUS_HEADERS,
			},
			service: { name: 'cf-ax-proxy' },
		};
	}
	return {
		exporter: {
			url: '',
			headers: {
				Authorization: '',
				'Content-Type': 'application/json',
			},
		},
		service: { name: 'cf-ax-proxy' },
		batch: {
			maxSize: 50,
			maxWaitTime: 5000,
		},
	};
};

export default instrument(handler, config);

import { makeApiRequest } from "./helper";
import { RemediationResult, TelemetryTemplate } from "./types";

export function telemetry(request: Request, env: Env, result: RemediationResult) {

	const telemetryTemplate: TelemetryTemplate = {
		timestamp: new Date().toISOString(),
		clientIp: request.headers.get('CF-Connecting-IP') || '',
		hostName: request.headers.get('Host') || '',
		remediation: result.decision,
		score: result.score,
		cached: result.cached,
	}

	// Fire and forget - don't block the response
	makeApiRequest('telemetry', 'POST', telemetryTemplate, env.ARXIGNIS_API_KEY);
}

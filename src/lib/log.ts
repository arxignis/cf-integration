import { addToLogBuffer } from "./durable-buffer";
import { LogTemplate } from "./types";
import version from "./version";

export function log(request: Request, env: Env) {
	try {
	// Extract request body if present
	let requestBody: object | string | null = null;
	if (request.body) {
		const contentType = request.headers.get('content-type') || '';
		if (contentType.includes('application/json')) {
			// For JSON requests, we'll need to clone to read body
			request.clone().json().then(body => {
				requestBody = body as object;
			}).catch(() => {
				requestBody = null;
			});
		} else if (contentType.includes('text/') || contentType.includes('application/')) {
			request.clone().text().then(body => {
				requestBody = body;
			}).catch(() => {
				requestBody = null;
			});
		}
	}

	const logTemplate: LogTemplate = {
		timestamp: new Date().toISOString(),
		version: version,
		clientIp: request.headers.get('CF-Connecting-IP') || '',
		hostName: request.headers.get('Host') || '',
		http: {
			method: request.method,
			url: request.url,
			headers: Object.fromEntries(request.headers.entries()),
			body: requestBody
		},
		tls: {
			version: String(request.cf?.tlsVersion || ''),
			cipher: String(request.cf?.tlsCipher || '')
		},
		additional: {
			colo: String(request.cf?.colo || ''),
			botManagement: request.cf?.botManagement || Object.create(null),
		}
	};

	// Add to Durable Object buffer instead of immediate API call
	addToLogBuffer(env, logTemplate);
	} catch (error) {
		console.warn('Failed to send log:', error);
	}
}




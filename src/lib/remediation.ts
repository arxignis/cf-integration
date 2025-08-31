import { makeApiRequestAsync } from './helper';
import { CacheManager } from './cache';
import { RemediationCache, RemediationResponse } from './types';
import { LogTemplate } from './types';
import { log } from './log';
import version from './version';

export async function remediation(request: Request, env: Env): Promise<{ decision: string | null; cached?: boolean; ruleId?: string }> {

	try {
		const clientIP = request.headers.get('CF-Connecting-IP');
		if (!clientIP) {
			return { decision: null };
		}

		// Initialize cache manager
		const cacheManager = new CacheManager(env.AX_CACHE);

		// Try to get from cache (L1 first, then L2)
		const cachedData = await cacheManager.get(clientIP);
		if (cachedData) {
			try {
				const data = JSON.parse(cachedData) as RemediationCache;

				// Validate the cached data structure
				if (!data.action || !['block', 'captcha', 'none'].includes(data.action)) {
					console.error('Invalid cached data - missing or invalid action:', data);
					await cacheManager.delete(clientIP);
				} else {
					console.log('Using cached remediation action:', data.action);
					return { decision: data.action, cached: true, ruleId: data.ruleId };
				}
			} catch (error) {
				console.error('Failed to parse cached data:', error);
				// If cache is corrupted, delete it and continue with fresh API call
				await cacheManager.delete(clientIP);
			}
		}

		// Read request body if present
		let requestBody: object | string | null = null;
		if (request.body) {
			const contentType = request.headers.get('content-type') || '';
			if (contentType.includes('application/json')) {
				try {
					const clonedRequest = request.clone();
					requestBody = await clonedRequest.json();
				} catch {
					requestBody = null;
				}
			} else if (contentType.includes('text/') || contentType.includes('application/')) {
				try {
					const clonedRequest = request.clone();
					requestBody = await clonedRequest.text();
				} catch {
					requestBody = null;
				}
			}
		}

		// Create log template for the request
		const logTemplate: LogTemplate = {
			timestamp: new Date().toISOString(),
			version: version,
			clientIp: clientIP,
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

		// Log the request with body data
		log(request, env);

		const data = await makeApiRequestAsync<RemediationResponse>(env, `remediation/${clientIP}`, 'POST', logTemplate, env.ARXIGNIS_API_KEY);
		if (!data) {
			console.error(`Failed to get remediation data for IP: ${clientIP}`);
			return { decision: null };
		}

		// Validate response structure
		if (!data.success || !data.remediation) {
			console.error('Invalid response structure:', data);
			return { decision: null };
		}

		// Check if the remediation action is for the current IP
		if (data.remediation.ip === clientIP) {
			const action = data.remediation.action;
			if (['block', 'captcha', 'none'].includes(action)) {
				let ttl = data.remediation.expired;
				if (ttl <= 0) {
					ttl = 300; // 5 minutes
				}

				if (action === 'none') {
					ttl = 60;
				}

				// Store in both L1 and L2 caches
				await cacheManager.set(clientIP, JSON.stringify(data.remediation), ttl);

				return { decision: action, cached: true, ruleId: data.remediation.ruleId };
			}
		}

		return { decision: null };
	} catch (error) {
		console.error('Error in remediation:', error);
		return { decision: null };
	}
}

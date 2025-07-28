import { makeApiRequestAsync } from './helper';
import { CacheManager } from './cache';
import { RemediationCache, RemediationResponse } from './types';

export async function remediation(request: Request, env: Env): Promise<{ decision: string | null; cached?: boolean; score?: number }> {

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
					return { decision: data.action, cached: true, score: data.score };
				}
			} catch (error) {
				console.error('Failed to parse cached data:', error);
				// If cache is corrupted, delete it and continue with fresh API call
				await cacheManager.delete(clientIP);
			}
		}

		const data = await makeApiRequestAsync<RemediationResponse>(`remediation/${clientIP}`, 'GET', undefined, env.ARXIGNIS_API_KEY);
		if (!data) {
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

				return { decision: action, cached: true, score: data.remediation.score };
			}
		}

		return { decision: null };
	} catch (error) {
		console.error('Error in remediation:', error);
		return { decision: null };
	}
}

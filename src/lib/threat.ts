import { makeApiRequestAsync } from './helper';
import { CacheManager } from './cache';
import { ThreatResponse } from './types';
import { log } from './log';

export async function threat(request: Request, env: Env, ctx: ExecutionContext): Promise<{ decision: string | null; cached?: boolean; ruleId?: string }> {

	try {
		const clientIP = request.headers.get('CF-Connecting-IP');
		if (!clientIP) {
			return { decision: null };
		}

		// Initialize cache manager
		const cacheManager = new CacheManager(env.AX_CACHE, ctx.waitUntil.bind(ctx));

		// Try to get from cache (L1 first, then L2)
		const cachedData = await cacheManager.get(clientIP);
		if (cachedData) {
			try {
				const data = JSON.parse(cachedData) as ThreatResponse;

				// Validate the cached data structure
				if (!data.advice || !['block', 'challenge', 'allow'].includes(data.advice)) {
					console.error('Invalid cached data - missing or invalid action:', data);
					await cacheManager.delete(clientIP);
				} else {
					console.log('Using cached threat action:', data.advice);
					return { decision: data.advice, cached: true, ruleId: data.intel?.rule_id };
				}
			} catch (error) {
				console.error('Failed to parse cached data:', error);
				// If cache is corrupted, delete it and continue with fresh API call
				await cacheManager.delete(clientIP);
			}
		}

		const response = await makeApiRequestAsync<ThreatResponse>(env, `threat?ip=${clientIP}`, 'GET', null, env.ARXIGNIS_API_KEY);
		if (!response) {
			console.error(`Failed to get remediation data for IP: ${clientIP}`);
			return { decision: null };
		}

		// Validate response structure
		if (!response.ip) {
			console.error('Invalid response structure:', response);
			return { decision: null };
		}

		// Check if the remediation action is for the current IP
		if (response.ip === clientIP) {
			const action = response.advice;
			if (action && ['block', 'captcha', 'allow'].includes(action)) {
				let ttl = response.ttl_s;
				if (ttl <= 0) {
					ttl = 300; // 5 minutes
				}

				if (action === 'allow') {
					ttl = 60;
				}

				// Store in both L1 and L2 caches
				await cacheManager.set(clientIP, JSON.stringify(response), ttl);

				return { decision: action, cached: true, ruleId: response.intel?.rule_id };
			}
		}

		return { decision: null };
	} catch (error) {
		console.error('Error in threat:', error);
		return { decision: null };
	}
}

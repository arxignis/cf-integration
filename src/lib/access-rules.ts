import { makeApiRequestAsync } from './helper';
import { CacheManager } from './cache';
import { AccessRuleResponse, AccessRuleResult, AccessRule } from './types';
import { isValidIP } from './helper';
import { isIPInList, initializeList } from './ip-handler';

export async function accessRules(
	request: Request,
	env: Env,
	ctx: ExecutionContext,
	ruleId: string
): Promise<AccessRuleResult> {
	try {
		const clientIP = request.headers.get('CF-Connecting-IP');
		if (!clientIP) {
			return { decision: null };
		}

		// Validate IP address
		if (!isValidIP(clientIP)) {
			console.error(`Invalid IP address: ${clientIP}`);
			return { decision: null };
		}

		// Initialize cache manager
		const cacheManager = new CacheManager(env.AX_CACHE, ctx.waitUntil.bind(ctx));

		// Try to get access rule data from cache first
		const ruleCacheKey = `access-rule-data-${ruleId}`;
		let accessRule: AccessRule | null = null;

		const cachedRuleData = await cacheManager.get(ruleCacheKey);
		if (cachedRuleData) {
			try {
				accessRule = JSON.parse(cachedRuleData) as AccessRule;
				console.log('Using cached access rule data');
			} catch (error) {
				console.error('Failed to parse cached access rule data:', error);
				await cacheManager.delete(ruleCacheKey);
			}
		}

		// If no cached rule data, fetch from API
		if (!accessRule) {
			const response = await makeApiRequestAsync<AccessRuleResponse>(
				env,
				`access-rules/${ruleId}`,
				'GET',
				null,
				env.ARXIGNIS_API_KEY
			);

			if (!response || !response.success || !response.data) {
				console.error(`Failed to get access rule data for rule ID: ${ruleId}`);
				return { decision: null };
			}

			accessRule = response.data;

			// Cache the rule data for 5 minutes (rule data changes less frequently)
			await cacheManager.set(
        ruleCacheKey,
        JSON.stringify(accessRule),
        parseInt(env.ARXIGNIS_ACCESS_CONTROL_LIST_CACHE_TTL) || 300
      );
		}

		// Check if rule is active
		if (!accessRule.is_active) {
			console.log(`Access rule ${ruleId} is not active`);
			return { decision: null };
		}

		// Get client's country and ASN from request headers
		const clientCountry = request.headers.get('CF-IPCountry') || '';
		const clientASN = request.headers.get('CF-ASN') || '';

		// Initialize IP lists for efficient lookup
		initializeList(accessRule.block.ips);
		const blockIPs = accessRule.block.ips;
		const allowIPs = accessRule.allow.ips;

		// Check if IP should be blocked first (block takes precedence over allow)
		const blockDecision = checkAccessRule(clientIP, clientCountry, clientASN, accessRule.block, blockIPs);
		if (blockDecision) {
			return { decision: 'block', cached: false, ruleId: accessRule.id };
		}

		// Check if IP should be allowed
		const allowDecision = checkAccessRule(clientIP, clientCountry, clientASN, accessRule.allow, allowIPs);
		if (allowDecision) {
			return { decision: 'allow', cached: false, ruleId: accessRule.id };
		}

		// No matching rule found
		return { decision: null };

	} catch (error) {
		console.error('Error in accessRules:', error);
		return { decision: null };
	}
}

function checkAccessRule(
	clientIP: string,
	clientCountry: string,
	clientASN: string,
	rule: { country: string[]; asn: string[]; ips: string[] },
	ipList: string[]
): boolean {
	// Check IP addresses using optimized ip-handler
	if (ipList && ipList.length > 0) {
		// Initialize the IP list for this rule
		initializeList(ipList);
		if (isIPInList(clientIP)) {
			return true;
		}
	}

	// Check country
	if (rule.country && rule.country.length > 0) {
		if (clientCountry && rule.country.includes(clientCountry)) {
			return true;
		}
	}

	// Check ASN
	if (rule.asn && rule.asn.length > 0) {
		if (clientASN && rule.asn.includes(clientASN)) {
			return true;
		}
	}

	return false;
}


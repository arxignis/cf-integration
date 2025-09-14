export interface RemediationResult {
	decision: string;
	cached: boolean;
	ruleId: string;
	action: string;
}

export interface ThreatResult {
	decision: string | null; // maps to advice from Threat type
	cached?: boolean;
	ruleId?: string;
}

export interface MetricsTemplate {
	timestamp: string;
	clientIp: string;
	hostName: string;
	remediation: string;
	ruleId: string;
}

export type RemediationResponse = {
	success: boolean;
	remediation: {
		action: string;
		ruleId: string;
		expired: number;
		ip: string;
	};
};

export type RemediationCache = {
	action: string;
	ruleId: string;
	expired: number;
	ip: string;
};

export type LogTemplate = {
	timestamp: string;
	version: string;
	clientIp: string;
	hostName: string;
	http: {
		method: string;
		url: string;
		headers: Record<string, string>;
		body: object | string | null;
	};
	tls: {
		version: string;
		cipher: string;
	};
	additional?: Record<string, unknown> | null;
}

export interface ThreatIntel {
	score: number;
	confidence: number;
	score_version: string;
	categories: string[];
	tags: string[];
	first_seen: string;
	last_seen: string;
	source_count: number;
	reason_code: string;
	reason_summary: string;
	rule_id: string;
}

export interface ThreatContext {
	asn: number;
	org: string;
	ip_version: number;
	geo: {
		country: string;
	};
}

export interface ThreatResponse {
	schema_version: string;
	tenant_id: string;
	ip: string;
	intel: ThreatIntel;
	context: ThreatContext;
	advice: string;
	ttl_s: number;
	generated_at: string;
}

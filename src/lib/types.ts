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
	response?: ThreatResponse | null;
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

export interface AccessRuleAllowBlock {
	country: string[];
	asn: string[];
	ips: string[];
}

export interface AccessRule {
	id: string;
	name: string;
	description: string;
	allow: AccessRuleAllowBlock;
	block: AccessRuleAllowBlock;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

export interface AccessRuleResponse {
	success: boolean;
	data: AccessRule;
}

export interface AccessRuleResult {
	decision: string | null; // 'allow', 'block', or null
	cached?: boolean;
	ruleId?: string;
}

export interface FilterAdditionalData {
	remediation?: string | null;
	threat_score?: number | null;
	threat_rule?: string | null;
	mode?: string | null;
	[key: string]: unknown;
}

export interface FilterHttpSection {
	method?: string | null;
	path?: string | null;
	query?: string | null;
	query_hash?: string | null;
	host?: string | null;
	scheme?: string | null;
	port?: number | null;
	remote_ip?: string | null;
	user_agent?: string | null;
	content_type?: string | null;
	content_length?: number | null;
	headers: Record<string, string | string[]>;
	body?: string;
	body_sha256?: string | null;
}

export interface FilterEvent {
	event_type: string;
	schema_version: string;
	timestamp: string;
	request_id?: string | null;
	tenant_id?: string | null;
	additional?: FilterAdditionalData | Record<string, unknown>;
	http: FilterHttpSection;
}

export interface FilterApiResponse {
	status: number;
	headers: Record<string, string>;
	body: string;
	json?: any;
}

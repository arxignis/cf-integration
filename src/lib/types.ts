export interface RemediationResult {
	decision: string;
	cached: boolean;
	ruleId: string;
	action: string;
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

export interface RemediationResult {
	decision: string;
	cached: boolean;
	score: number;
}

export interface MetricsTemplate {
	timestamp: string;
	clientIp: string;
	hostName: string;
	remediation: string;
	cached: boolean;
	score: number;
}

export type RemediationResponse = {
	success: boolean;
	remediation: {
		action: string;
		score: number;
		expired: number;
		ip: string;
	};
};

export type RemediationCache = {
	action: string;
	score: number;
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

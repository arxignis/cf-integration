export interface RemediationResult {
	decision: string;
	cached: boolean;
	score: number;
}

export interface TelemetryTemplate {
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
	headers: Record<string, string>;
	tls: {
		version: string;
		cipher: string;
		clientRandom: string;
		clientCiphersSha1: string;
		clientHelloLength: string;
		clientExtensionsSha1: string;
		clientExtensionsSha1Le: string;
	}
	protocol: {
		httpVersion: string;
		clientAcceptEncoding: string;
	}
	enriched: {
		geo: {
			country: string;
			city: string;
			latitude: string;
			longitude: string;
			timezone: string;
			continent: string;
			postalCode: string;
		}
		network: {
			asn: string;
			asOrganization: string;
		}
	}
	additional: {
		colo: string;
		botManagement: object;
	}
}

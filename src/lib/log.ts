import { makeApiRequest } from "./helper";
import { LogTemplate } from "./types";
import version from "./version";

export function log(request: Request, env: Env) {
	const logTemplate: LogTemplate = {
		timestamp: new Date().toISOString(),
		version: version,
		clientIp: request.headers.get('CF-Connecting-IP') || '',
		hostName: request.headers.get('Host') || '',
		headers: Object.fromEntries(request.headers.entries()),
		tls: {
			version: String(request.cf?.tlsVersion || ''),
			cipher: String(request.cf?.tlsCipher || ''),
			clientRandom: String(request.cf?.tlsClientRandom || ''),
			clientCiphersSha1: String(request.cf?.tlsClientCiphersSha1 || ''),
			clientHelloLength: String(request.cf?.tlsClientHelloLength || ''),
			clientExtensionsSha1: String(request.cf?.tlsClientExtensionsSha1 || ''),
			clientExtensionsSha1Le: String(request.cf?.tlsClientExtensionsSha1Le || ''),
		},
		protocol: {
			httpVersion: String(request.cf?.httpVersion || ''),
			clientAcceptEncoding: String(request.cf?.httpAcceptEncoding || ''),
		},
		enriched: {
			geo: {
				country: String(request.cf?.country || ''),
				city: String(request.cf?.city || ''),
				latitude: String(request.cf?.latitude || ''),
				longitude: String(request.cf?.longitude || ''),
				timezone: String(request.cf?.timezone || ''),
				continent: String(request.cf?.continent || ''),
				postalCode: String(request.cf?.postalCode || ''),
			},
			network: {
				asn: String(request.cf?.asn || ''),
				asOrganization: String(request.cf?.asOrganization || ''),
			},
		},
		additional: {
			colo: String(request.cf?.colo || ''),
			botManagement: request.cf?.botManagement || {},
		},
	};

	// Fire and forget - don't block the response
	makeApiRequest('log', 'POST', logTemplate, env.ARXIGNIS_API_KEY);
}




import { addToMetricsBuffer } from "./durable-buffer";
import { ThreatResult, MetricsTemplate } from './types';

export function metrics(request: Request, env: Env, result: ThreatResult): void {
  try {
    const metricsTemplate: MetricsTemplate = {
      timestamp: new Date().toISOString(),
      clientIp: request.headers.get('CF-Connecting-IP') || 'unknown',
      hostName: new URL(request.url).hostname,
      remediation: result.decision || 'none',
      ruleId: result.ruleId || '',
    };

    addToMetricsBuffer(env, metricsTemplate);
  } catch (error) {
    console.warn('Failed to send metrics:', error);
  }
}

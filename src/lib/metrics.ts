import { addToMetricsBuffer } from "./durable-buffer";
import { RemediationResult, MetricsTemplate } from './types';

export function metrics(request: Request, env: Env, result: RemediationResult): void {
  try {
    const metricsTemplate: MetricsTemplate = {
      timestamp: new Date().toISOString(),
      clientIp: request.headers.get('CF-Connecting-IP') || 'unknown',
      hostName: new URL(request.url).hostname,
      remediation: result.decision,
      ruleId: result.ruleId,
    };

    addToMetricsBuffer(env, metricsTemplate);
  } catch (error) {
    console.warn('Failed to send metrics:', error);
  }
}

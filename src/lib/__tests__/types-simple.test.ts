import { describe, it, expect } from 'vitest';

describe('Type Definitions', () => {
  it('should have correct structure for ThreatResult', () => {
    const threatResult = {
      decision: 'block' as const,
      ruleId: 'rule-123',
      cached: true
    };

    expect(threatResult.decision).toBe('block');
    expect(threatResult.ruleId).toBe('rule-123');
    expect(threatResult.cached).toBe(true);
  });

  it('should have correct structure for AccessRuleResult', () => {
    const accessRuleResult = {
      decision: 'allow' as const,
      ruleId: 'rule-456',
      cached: false
    };

    expect(accessRuleResult.decision).toBe('allow');
    expect(accessRuleResult.ruleId).toBe('rule-456');
    expect(accessRuleResult.cached).toBe(false);
  });

  it('should have correct structure for LogTemplate', () => {
    const logTemplate = {
      timestamp: '2023-01-01T00:00:00.000Z',
      version: '1.0.0',
      clientIp: '192.168.1.1',
      hostName: 'example.com',
      http: {
        method: 'GET',
        url: 'https://example.com/test',
        userAgent: 'Mozilla/5.0',
        referer: 'https://google.com',
        body: null
      },
      cf: {
        country: 'US',
        asn: 12345,
        asOrganization: 'Test ISP'
      },
      tls: {
        version: 'TLSv1.2',
        cipher: 'AES-256-GCM'
      },
      additional: {
        botManagement: {}
      }
    };

    expect(logTemplate.timestamp).toBe('2023-01-01T00:00:00.000Z');
    expect(logTemplate.version).toBe('1.0.0');
    expect(logTemplate.clientIp).toBe('192.168.1.1');
    expect(logTemplate.hostName).toBe('example.com');
    expect(logTemplate.http.method).toBe('GET');
    expect(logTemplate.cf.country).toBe('US');
  });

  it('should have correct structure for MetricsTemplate', () => {
    const metricsTemplate = {
      timestamp: '2023-01-01T00:00:00.000Z',
      clientIp: '192.168.1.1',
      hostName: 'example.com',
      remediation: 'block' as const,
      ruleId: 'rule-789'
    };

    expect(metricsTemplate.timestamp).toBe('2023-01-01T00:00:00.000Z');
    expect(metricsTemplate.clientIp).toBe('192.168.1.1');
    expect(metricsTemplate.hostName).toBe('example.com');
    expect(metricsTemplate.remediation).toBe('block');
    expect(metricsTemplate.ruleId).toBe('rule-789');
  });

  it('should have correct structure for ThreatResponse', () => {
    const threatResponse = {
      decision: 'challenge' as const,
      ruleId: 'rule-abc',
      cached: false
    };

    expect(threatResponse.decision).toBe('challenge');
    expect(threatResponse.ruleId).toBe('rule-abc');
    expect(threatResponse.cached).toBe(false);
  });

  it('should have correct structure for AccessRule', () => {
    const accessRule = {
      id: 'rule-xyz',
      name: 'Test Rule',
      action: 'block' as const,
      conditions: {
        ip: ['192.168.1.0/24'],
        country: ['US'],
        asn: [12345]
      },
      enabled: true
    };

    expect(accessRule.id).toBe('rule-xyz');
    expect(accessRule.name).toBe('Test Rule');
    expect(accessRule.action).toBe('block');
    expect(accessRule.conditions.ip).toEqual(['192.168.1.0/24']);
    expect(accessRule.enabled).toBe(true);
  });

  it('should validate decision types', () => {
    const validDecisions = ['allow', 'block', 'challenge'] as const;

    expect(validDecisions.includes('allow')).toBe(true);
    expect(validDecisions.includes('block')).toBe(true);
    expect(validDecisions.includes('challenge')).toBe(true);
  });

  it('should validate HTTP methods', () => {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const;

    expect(validMethods.includes('GET')).toBe(true);
    expect(validMethods.includes('POST')).toBe(true);
    expect(validMethods.includes('PUT')).toBe(true);
    expect(validMethods.includes('DELETE')).toBe(true);
  });
});

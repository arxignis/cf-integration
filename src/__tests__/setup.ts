import { vi } from 'vitest';

// Mock global objects that might not be available in test environment
global.fetch = vi.fn();
global.URL = URL;
global.FormData = FormData;
global.Headers = Headers;
global.Request = Request;
global.Response = Response;

// Mock performance API
global.performance = {
  now: vi.fn(() => Date.now())
} as any;

// Mock console methods to avoid noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn()
};

// Mock Math.random for predictable tests
const originalRandom = Math.random;
Math.random = vi.fn(() => 0.5);

// Mock ipaddr.js globally
vi.mock('ipaddr.js', () => {
  const mockParse = vi.fn().mockImplementation((ip: string) => {
    // Simple IP validation for testing
    if (ip === '192.168.1.1' || ip === '127.0.0.1' || ip === '8.8.8.8' || ip === '0.0.0.0' || ip === '255.255.255.255') {
      return { kind: () => 'ipv4', octets: ip.split('.').map(Number) };
    }
    if (ip === '2001:0db8:85a3:0000:0000:8a2e:0370:7334' || ip === '::1' || ip === '::' || ip === '2001:db8::1' || ip === '::ffff:192.168.1.1') {
      return { kind: () => 'ipv6', parts: [0x2001, 0xdb8, 0, 0, 0, 0, 0, 1] };
    }
    if (ip === '192.168.1' || ip === '192.168.1.1.1' || ip === '192.168.1.256' || ip === 'invalid' || ip === '') {
      throw new Error('Invalid IP');
    }
    return { kind: () => 'ipv4', octets: ip.split('.').map(Number) };
  });

  return {
    parse: mockParse
  };
});

// Restore original Math.random after all tests
afterAll(() => {
  Math.random = originalRandom;
});

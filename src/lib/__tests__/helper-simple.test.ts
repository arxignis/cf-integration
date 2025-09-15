import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Import after mocking
import { makeApiRequest, makeApiRequestAsync } from '../helper';

describe('Helper Functions - API Requests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('makeApiRequest', () => {
    it('should make a successful API request with correct parameters', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const mockEnv = {
        ARXIGNIS_API_URL: 'https://api.test.com/v1'
      };

      // Test the actual function signature: makeApiRequest(env, endpoint, method, body?, apiKey?)
      makeApiRequest(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      // Wait a bit for the async operation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/v1/test-endpoint', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: undefined,
        signal: expect.any(AbortSignal)
      });
    });

    it('should make API request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const mockEnv = {
        ARXIGNIS_API_URL: 'https://api.test.com/v1'
      };

      const body = { test: 'data' };
      makeApiRequest(mockEnv, 'test-endpoint', 'POST', body, 'test-key');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/v1/test-endpoint', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-key'
        },
        body: JSON.stringify(body),
        signal: expect.any(AbortSignal)
      });
    });

    it('should make API request without API key', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const mockEnv = {
        ARXIGNIS_API_URL: 'https://api.test.com/v1'
      };

      makeApiRequest(mockEnv, 'test-endpoint', 'GET');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalledWith('https://api.test.com/v1/test-endpoint', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: undefined,
        signal: expect.any(AbortSignal)
      });
    });

    it('should handle non-200 status codes', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue('Not found')
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const mockEnv = {
        ARXIGNIS_API_URL: 'https://api.test.com/v1'
      };

      makeApiRequest(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('makeApiRequestAsync', () => {
    const mockEnv = {
      ARXIGNIS_API_URL: 'https://api.test.com/v1'
    };

    it('should return successful response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ success: true })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toEqual({ success: true });
    });

    it('should return null for non-200 status', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: 'Not found' })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should handle internal IP rejection', async () => {
      const result = await makeApiRequestAsync(mockEnv, 'http://192.168.1.1/test', 'GET');

      expect(result).toBeNull();
    });

    it('should return null for non-JSON response', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('plain text response')
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should return null for response with error in body', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ error: 'API error' })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should handle network errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON'))
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const result = await makeApiRequestAsync(mockEnv, 'test-endpoint', 'GET', undefined, 'test-key');

      expect(result).toBeNull();
    });

    it('should use default API URL when not provided', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn().mockReturnValue('application/json')
        },
        json: vi.fn().mockResolvedValue({ success: true })
      };
      (global.fetch as any).mockResolvedValue(mockResponse);

      const envWithoutUrl = {};
      const result = await makeApiRequestAsync(envWithoutUrl, 'test', 'GET', undefined, 'test-key');

      expect(global.fetch).toHaveBeenCalledWith('https://api.arxignis.com/v1/test', expect.any(Object));
      expect(result).toEqual({ success: true });
    });
  });
});

import * as ipaddr from 'ipaddr.js';

const apiGlobalUrl = 'https://api.arxignis.com/v1';

/**
 * Validates if a string is a valid IP address (IPv4 or IPv6)
 * @param ip - IP address string to validate
 * @returns boolean - True if valid IP address
 */
export function isValidIP(ip: string): boolean {
  try {
    const ipAddr = ipaddr.parse(ip);
    return ipAddr.kind() === 'ipv4' || ipAddr.kind() === 'ipv6';
  } catch {
    return false;
  }
}

/**
 * Gets the IP type (ipv4 or ipv6) from a valid IP address string
 * @param ip - IP address string
 * @returns string - 'ipv4' or 'ipv6'
 */
export function getIPType(ip: string): string {
  // Handle undefined, null, or empty IP addresses
  if (!ip || ip.trim() === '') {
    throw new Error(`Invalid IP address: ${ip}`);
  }

  try {
    const ipAddr = ipaddr.parse(ip);
    return ipAddr.kind();
  } catch {
    throw new Error(`Invalid IP address: ${ip}`);
  }
}

/**
 * Makes an API request with timeout and error handling (fire and forget)
 * @param endpoint - API endpoint path
 * @param method - HTTP method
 * @param body - Request body (optional)
 * @param apiKey - Authorization API key
 * @returns void - fire and forget
 */
export function makeApiRequest<T = any>(
  env: Env,
  endpoint: string,
  method: string,
  body?: any,
  apiKey?: string
): void {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  const startTime = Date.now();
	const apiUrl = env.ARXIGNIS_API_URL || apiGlobalUrl;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  fetch(`${apiUrl}/${endpoint}`, {
    method: method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: controller.signal,
  })
    .then((response) => {
      clearTimeout(timeoutId);

      if (response.status !== 200) {
        return response.text().then((text) => {
          console.error(
            `API request failed with status ${response.status}: ${text}`
          );
        });
      }

      if (!response.ok) {
        return response.text().then((text) => {
          console.error(
            `API request failed with status ${response.status}: ${response.statusText} ${text}`
          );
        });
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return response.text().then((text) => {
          console.error(`Expected JSON response but got: ${contentType}`);
          console.error(`Response body: ${text}`);
        });
      }

      return response.json().then((result) => {
        console.log(
          `API request to ${endpoint} completed successfully in ${
            Date.now() - startTime
          }ms`
        );
      });
    })
    .catch((error) => {
      clearTimeout(timeoutId);
      const duration = Date.now() - startTime;

      if (error instanceof Error && error.name === 'AbortError') {
        console.error(
          `API request to ${endpoint} timed out after ${duration}ms (30s limit)`
        );
      } else {
        console.error(
          `API request to ${endpoint} failed after ${duration}ms:`,
          error
        );
      }
    });
}

/**
 * Makes an API request with timeout and error handling (async version)
 * @param endpoint - API endpoint path
 * @param method - HTTP method
 * @param body - Request body (optional)
 * @param apiKey - Authorization API key
 * @returns Promise with API response or null on failure
 */
export async function makeApiRequestAsync<T = any>(
	env: Env,
  endpoint: string,
  method: string,
  body?: any,
  apiKey?: string
): Promise<T | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  const startTime = Date.now();
	const apiUrl = env.ARXIGNIS_API_URL || apiGlobalUrl;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${apiUrl}/${endpoint}`, {
      method: method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.status !== 200) {
      const errorText = await response.text();
      console.error(
        `API request failed with status ${
          response.status
        }: ${errorText}`
      );

      // Handle specific error cases
      if (errorText.includes('Internal IP addresses are not allowed')) {
        console.warn('Internal IP rejected by API - this is expected in development environment');
        // Return a special error object instead of null to distinguish this case
        return { error: 'internal_ip_rejected', message: errorText } as any;
      }

      return null;
    }

    // Check if response is ok
    if (!response.ok) {
      console.error(
        `API request failed with status ${response.status}: ${
          response.statusText
        } ${await response.text()}`
      );
      return null;
    }

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error(`Expected JSON response but got: ${contentType}`);
      const text = await response.text();
      console.error(`Response body: ${text}`);
      return null;
    }

    try {
      const result = (await response.json()) as T;

      // Check if the response contains an error message even with 200 status
      if (result && typeof result === 'object' && 'error' in result) {
        console.error(`API returned error in response body:`, result);
        return null;
      }

      console.log(
        `API request to ${endpoint} completed successfully in ${
          Date.now() - startTime
        }ms`
      );
      return result;
    } catch (error) {
      console.error('Failed to parse JSON response:', error);
      return null;
    }
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (error instanceof Error && error.name === 'AbortError') {
      console.error(
        `API request to ${endpoint} timed out after ${duration}ms (30s limit)`
      );
    } else {
      console.error(
        `API request to ${endpoint} failed after ${duration}ms:`,
        error
      );
    }
    return null;
  }
}

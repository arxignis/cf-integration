import type { FilterAdditionalData, FilterApiResponse, FilterEvent, ScanRequestPayload } from './types';
import { isValidIP } from './helper';

interface Env {
  ARXIGNIS_API_URL?: string;
  ARXIGNIS_API_KEY?: string;
}

const DEFAULT_BASE_URL = 'https://api.arxignis.com/v1';
const FILTER_ENDPOINT = 'filter';
const SCAN_ENDPOINT = 'scan';
const DEFAULT_EVENT_TYPE = 'filter';
const DEFAULT_SCHEMA_VERSION = '1.0';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function sanitizeBaseUrl(apiUrl?: string | null): string {
  const trimmed = (apiUrl ?? '').trim();
  const withoutTrailingSlash = trimmed.replace(/\/+$/, '');
  if (withoutTrailingSlash.length > 0) {
    return withoutTrailingSlash;
  }
  return DEFAULT_BASE_URL;
}

function headersToObject(headers: Headers): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  headers.forEach((value, key) => {
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  });
  return result;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === 'string' ? textEncoder.encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

function bytesToBinaryString(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  let value = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    value += String.fromCharCode(...chunk);
  }
  return value;
}

const DATA_URI_REGEX = /^data:([^;,]+)(?:;[^,]*)*;base64,(.+)$/i;

interface BuildScanOverrides {
  body?: string;
  contentType?: string;
}

function decodeBase64ToBytes(data: string): Uint8Array {
  if (typeof atob === 'function') {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i) & 0xff;
    }
    return bytes;
  }

  if (typeof Buffer !== 'undefined') {
    const buffer = Buffer.from(data, 'base64');
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  throw new Error('Base64 decoding is not supported in this environment');
}

interface DataUriExtraction {
  decodedBytes: Uint8Array;
  mimeType: string;
}

function extractDataUriFromJson(body: string): DataUriExtraction | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    return null;
  }

  const stack: unknown[] = [parsed];

  while (stack.length > 0) {
    const value = stack.pop();

    if (typeof value === 'string') {
      const match = DATA_URI_REGEX.exec(value.trim());
      if (match) {
        try {
          return {
            decodedBytes: decodeBase64ToBytes(match[2]),
            mimeType: match[1] || 'application/octet-stream',
          };
        } catch (error) {
          console.warn('Arxignis filter: failed to decode data URI', error);
        }
      }
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        stack.push(item);
      }
      continue;
    }

    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) {
        stack.push(item);
      }
    }
  }

  return null;
}

function resolveContentType(
  httpSection: FilterEvent['http'] | undefined,
  overrides?: BuildScanOverrides,
): string {
  if (overrides?.contentType && overrides.contentType.length > 0) {
    return overrides.contentType;
  }

  if (httpSection?.content_type) {
    return httpSection.content_type;
  }

  const headers = httpSection?.headers;
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === 'content-type') {
        if (Array.isArray(value)) {
          return value[0] ?? 'application/octet-stream';
        }
        return value;
      }
    }
  }

  return 'application/octet-stream';
}

function setHeaderCaseInsensitive(
  headers: Record<string, string | string[]>,
  name: string,
  value: string,
): void {
  const lowerName = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) {
      headers[key] = value;
      return;
    }
  }
  headers[name] = value;
}

export interface BuildFilterEventOptions {
  tenantId?: string | null;
  additional?: FilterAdditionalData | Record<string, unknown> | null;
  timestamp?: string;
  requestId?: string | null;
  eventType?: string;
  schemaVersion?: string;
}

export interface SendFilterRequestOptions {
  idempotencyKey: string;
  originalEvent?: boolean;
  method?: string;
  headers?: Record<string, string>;
}

export function buildScanRequestFromEvent(
  event: FilterEvent,
  overrides?: BuildScanOverrides,
): ScanRequestPayload | null {
  if (!event || !event.http) {
    return null;
  }

  const sourceBody = overrides?.body ?? event.http.body;
  if (!sourceBody || sourceBody.length === 0) {
    return null;
  }

  const contentType = resolveContentType(event.http, overrides);

  return {
    content_type: contentType,
    body: sourceBody,
  };
}

export async function buildFilterEvent(
  request: Request,
  options: BuildFilterEventOptions = {}
): Promise<FilterEvent> {
  const url = new URL(request.url);
  const hostHeader = request.headers.get('Host') || url.hostname || null;
  // Strip port from host header (e.g., "127.0.0.1:8787" -> "127.0.0.1")
  const host = hostHeader ? hostHeader.split(':')[0] : null;
  const queryString = url.search ? url.search.slice(1) : null;

  const headersObject = headersToObject(request.headers);
  const originalContentType = request.headers.get('content-type') || request.headers.get('Content-Type') || null;
  const contentTypeLower = originalContentType ? originalContentType.toLowerCase() : '';
  const isLikelyJson = contentTypeLower.includes('json');
  const isLikelyText =
    !contentTypeLower ||
    contentTypeLower.startsWith('text/') ||
    isLikelyJson ||
    contentTypeLower.includes('xml') ||
    contentTypeLower.includes('javascript') ||
    contentTypeLower.includes('form-urlencoded');

  let bodyBytes: Uint8Array | null = null;
  try {
    const clone = request.clone();
    const arrayBuffer = await clone.arrayBuffer();
    if (arrayBuffer) {
      bodyBytes = new Uint8Array(arrayBuffer);
    }
  } catch (error) {
    console.warn('Arxignis filter: failed to read request body', error);
  }

  let bodyContent: string | undefined;
  let bodyLength: number | undefined;
  let bodyHash: string | undefined;

  if (bodyBytes) {
    bodyLength = bodyBytes.byteLength;
    if (bodyBytes.byteLength > 0) {
      if (isLikelyText) {
        try {
          bodyContent = textDecoder.decode(bodyBytes);
        } catch (error) {
          console.warn('Arxignis filter: failed to decode body as text', error);
          bodyContent = bytesToBinaryString(bodyBytes);
        }
      } else {
        bodyContent = bytesToBinaryString(bodyBytes);
      }

      if (isLikelyJson && bodyContent) {
        const extraction = extractDataUriFromJson(bodyContent);
        if (extraction) {
          bodyBytes = extraction.decodedBytes;
          bodyContent = bytesToBinaryString(bodyBytes);
          bodyLength = bodyBytes.byteLength;
          bodyHash = await sha256Hex(bodyBytes);
          setHeaderCaseInsensitive(headersObject, 'content-type', extraction.mimeType);
        } else {
          bodyHash = await sha256Hex(bodyBytes);
        }
      } else {
        bodyHash = await sha256Hex(bodyBytes);
      }
    } else {
      bodyContent = '';
    }
  }

  // Handle remote_ip validation - only include if it matches IPv4 or full IPv6 pattern
  const clientIP = request.headers.get('CF-Connecting-IP');
  const validRemoteIP = clientIP && isValidIP(clientIP)
    ? clientIP
    : null;

  const httpSection: FilterEvent['http'] = {
    method: request.method,
    path: url.pathname || null,
    query: queryString,
    host: host,
    scheme: url.protocol ? url.protocol.replace(':', '') : null,
    port: 443,
    remote_ip: validRemoteIP,
    user_agent: request.headers.get('user-agent') || request.headers.get('User-Agent'),
    content_type: headersObject['content-type']
      ? Array.isArray(headersObject['content-type'])
        ? headersObject['content-type'][0]
        : headersObject['content-type']
      : originalContentType,
    headers: headersObject,
  };

  if (bodyContent !== undefined) {
    httpSection.body = bodyContent;
    httpSection.content_length = bodyLength ?? null;
    if (bodyHash) {
      httpSection.body_sha256 = bodyHash;
    }
  } else {
    const lengthHeader = request.headers.get('content-length') || request.headers.get('Content-Length');
    if (lengthHeader) {
      const parsedLength = Number(lengthHeader);
      if (!Number.isNaN(parsedLength)) {
        httpSection.content_length = parsedLength;
      }
    }
  }

  if (queryString && queryString.length > 0) {
    httpSection.query_hash = await sha256Hex(queryString);
  }

  const event: FilterEvent = {
    event_type: options.eventType || DEFAULT_EVENT_TYPE,
    schema_version: options.schemaVersion || DEFAULT_SCHEMA_VERSION,
    timestamp: options.timestamp || new Date().toISOString(),
    request_id: options.requestId && options.requestId.trim().length > 0 ? options.requestId : undefined,
    tenant_id: options.tenantId ?? undefined,
    http: httpSection,
  };

  if (options.additional) {
    event.additional = options.additional;
  }

  return event;
}

export async function generateIdempotencyKey(request: Request): Promise<string> {
  const candidates = [
    request.headers.get('CF-Request-ID'),
    request.headers.get('CF-Ray'),
    request.headers.get('X-Request-ID'),
    request.headers.get('X-Amzn-Trace-Id'),
  ].filter((value): value is string => !!value && value.trim().length > 0);

  let rawKey = candidates.length > 0 ? candidates[0] : '';

  if (!rawKey) {
    const remoteIp = request.headers.get('CF-Connecting-IP') || 'unknown';
    const randomPart = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
    rawKey = `${remoteIp}:${Date.now()}:${randomPart}`;
  }

  const hash = await sha256Hex(rawKey);
  return hash.slice(0, 32);
}

export async function sendFilterRequest(
  env: Env,
  event: FilterEvent,
  options: SendFilterRequestOptions
): Promise<{ response: FilterApiResponse | null; error?: string }> {
  if (!options?.idempotencyKey) {
    return { response: null, error: 'idempotencyKey is required' };
  }

  let payload: string;
  try {
    payload = JSON.stringify(event);
  } catch (error) {
    return {
      response: null,
      error: `failed to encode filter event: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const method = options.method ? options.method.toUpperCase() : 'POST';
  const params = new URLSearchParams();
  params.set('idempotency-key', options.idempotencyKey);
  params.set('originalEvent', options.originalEvent ? 'true' : 'false');

  const baseUrl = sanitizeBaseUrl(env.ARXIGNIS_API_URL);
  const url = `${baseUrl}/${FILTER_ENDPOINT}?${params.toString()}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.ARXIGNIS_API_KEY) {
    headers.Authorization = `Bearer ${env.ARXIGNIS_API_KEY}`;
  }

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers[key] = value;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
    });

    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch (_error) {
      json = undefined;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const filterResponse: FilterApiResponse = {
      status: response.status,
      headers: responseHeaders,
      body: text,
      json,
    };

    return { response: filterResponse };
  } catch (error) {
    return {
      response: null,
      error: `filter API request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function sendScanRequest(
  env: Env,
  scanRequest: ScanRequestPayload,
  options?: { method?: string; headers?: Record<string, string> }
): Promise<{ response: FilterApiResponse | null; error?: string }> {
  if (!scanRequest || !scanRequest.body) {
    return { response: null, error: 'scanRequest.body is required' };
  }

  if (!scanRequest.content_type || scanRequest.content_type.trim() === '') {
    scanRequest.content_type = 'application/octet-stream';
  }

  let payload: string;
  try {
    payload = JSON.stringify({
      content_type: scanRequest.content_type,
      body: scanRequest.body,
    });
  } catch (error) {
    return {
      response: null,
      error: `failed to encode scan request: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const method = options?.method ? options.method.toUpperCase() : 'POST';
  const baseUrl = sanitizeBaseUrl(env.ARXIGNIS_API_URL);
  const url = `${baseUrl}/${SCAN_ENDPOINT}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.ARXIGNIS_API_KEY) {
    headers.Authorization = `Bearer ${env.ARXIGNIS_API_KEY}`;
  }

  if (options?.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers[key] = value;
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: payload,
    });

    const text = await response.text();
    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch (_error) {
      json = undefined;
    }

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const scanResponse: FilterApiResponse = {
      status: response.status,
      headers: responseHeaders,
      body: text,
      json,
    };

    return { response: scanResponse };
  } catch (error) {
    return {
      response: null,
      error: `scan API request failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

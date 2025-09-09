import { DurableObject } from "cloudflare:workers";

// Type definitions for function parameters
type Env = any;
type DurableObjectState = any;
type DurableObjectStorage = any;
type DurableObjectId = any;
type DurableObjectStub = any;

export interface BufferItem {
  data: any;
  timestamp: number;
  retryCount: number;
}

export interface BatchRequest {
  Entries: any[];
  count: number;
  timestamp: string;
}

// Base class for common buffer functionality
abstract class BaseBufferDO extends DurableObject {
  protected count: number = 0;
  protected abstract readonly FLUSH_INTERVAL: number;
  protected abstract readonly MAX_RETRIES: number;
  protected abstract readonly MAX_BUFFER_SIZE: number;
  protected state: DurableObjectState;
  protected storage: DurableObjectStorage;
  protected env: Env;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.storage = state.storage;
    this.env = env;

    // Initialize count from storage and set initial alarm if needed
    this.state.blockConcurrencyWhile(async () => {
      const vals = await this.storage.list({ reverse: true, limit: 1 });
      const firstKey = vals.keys().next().value;
      this.count = vals.size === 0 ? 0 : parseInt(firstKey || '0');

      // Set initial alarm if there are items but no alarm
      if (vals.size > 0) {
        const currentAlarm = await this.storage.getAlarm();
        if (currentAlarm === null || currentAlarm <= Date.now()) {
          const alarmTime = Date.now() + this.FLUSH_INTERVAL;
          await this.storage.setAlarm(alarmTime);
        }
      }
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === 'POST') {
      // Add data to buffer
      const data = await request.json();
      this.count++;

      const bufferItem: BufferItem = {
        data,
        timestamp: Date.now(),
        retryCount: 0
      };

      // Check buffer size limit
      const currentItems = await this.storage.list();
      if (currentItems.size >= this.MAX_BUFFER_SIZE) {
        // Remove oldest item (FIFO)
        const oldestKey = currentItems.keys().next().value;
        if (oldestKey && typeof oldestKey === 'string') {
          await this.storage.delete(oldestKey);
        }
      }

      // Store the item
      const itemKey = this.count.toString();
      await this.storage.put(itemKey, bufferItem);

      // Check if alarm is set, if not set one
      const currentAlarm = await this.storage.getAlarm();
      if (currentAlarm === null || currentAlarm <= Date.now()) {
        const alarmTime = Date.now() + this.FLUSH_INTERVAL;
        await this.storage.setAlarm(alarmTime);
      } else {
        // Check if alarm is too far in the future (more than 2x interval)
        const maxAlarmTime = Date.now() + (this.FLUSH_INTERVAL * 2);
        if (currentAlarm > maxAlarmTime) {
          const newAlarmTime = Date.now() + this.FLUSH_INTERVAL;
          await this.storage.setAlarm(newAlarmTime);
        }
      }

      const response = {
        queued: this.count,
        bufferSize: currentItems.size + 1,
        timestamp: bufferItem.timestamp,
        alarmSet: currentAlarm !== null,
        nextAlarm: currentAlarm ? new Date(currentAlarm).toISOString() : new Date(Date.now() + this.FLUSH_INTERVAL).toISOString()
      };

      return new Response(JSON.stringify(response), {
        headers: { 'content-type': 'application/json' }
      });
    }

    // GET request returns buffer status
    const status = await this.getBufferStatus();
    return new Response(JSON.stringify(status), {
      headers: { 'content-type': 'application/json' }
    });
  }

  // Direct method for adding data (no HTTP overhead)
  async addData(data: any): Promise<void> {
    this.count++;

    const bufferItem: BufferItem = {
      data,
      timestamp: Date.now(),
      retryCount: 0
    };

    // Check buffer size limit
    const currentItems = await this.storage.list();
    if (currentItems.size >= this.MAX_BUFFER_SIZE) {
      // Remove oldest item (FIFO)
      const oldestKey = currentItems.keys().next().value;
      if (oldestKey && typeof oldestKey === 'string') {
        await this.storage.delete(oldestKey);
      }
    }

    // Store the item
    await this.storage.put(this.count.toString(), bufferItem);

    // Check if alarm is set, if not set one
    const currentAlarm = await this.storage.getAlarm();
    if (currentAlarm === null) {
      await this.storage.setAlarm(Date.now() + this.FLUSH_INTERVAL);
    }
  }

  async alarm(): Promise<void> {
    try {
      // Get all items from storage
      const items = await this.storage.list();

      if (items.size === 0) {
        this.count = 0;
        return;
      }

      // Process all items
      await this.processBatch(items);

      // Clear all processed items
      await this.storage.deleteAll();
      this.count = 0;

      // Set next alarm if there are still items (retry logic)
      const remainingItems = await this.storage.list();
      if (remainingItems.size > 0) {
        const retryAlarmTime = Date.now() + this.FLUSH_INTERVAL;
        await this.storage.setAlarm(retryAlarmTime);
      } else {
        // Health check: ensure we have a future alarm set for new data
        const currentAlarm = await this.storage.getAlarm();
        if (currentAlarm === null || currentAlarm <= Date.now()) {
          const healthAlarmTime = Date.now() + this.FLUSH_INTERVAL;
          await this.storage.setAlarm(healthAlarmTime);
        }
      }

    } catch (error) {
      // Set alarm again to retry
      const retryAlarmTime = Date.now() + this.FLUSH_INTERVAL;
      await this.storage.setAlarm(retryAlarmTime);
    }
  }

  protected abstract processBatch(items: Map<string, any>): Promise<void>;
  protected abstract getEndpointName(): string;

  private async getBufferStatus(): Promise<{ size: number; count: number; isFlushing: boolean; type: string }> {
    const items = await this.storage.list();
    const currentAlarm = await this.storage.getAlarm();
    const isFlushing = currentAlarm !== null;

    return {
      size: items.size,
      count: this.count,
      isFlushing,
      type: this.getEndpointName()
    };
  }
}

// Durable Object specifically for logs
class ArxignisLogBufferDO extends BaseBufferDO {
  protected readonly FLUSH_INTERVAL = 5000; // 5 seconds - logs can be batched more frequently
  protected readonly MAX_RETRIES = 2; // Logs are less critical, fewer retries
  protected readonly MAX_BUFFER_SIZE = 2000; // Larger buffer for logs

  protected getEndpointName(): string {
    return 'log';
  }

  protected async processBatch(items: Map<string, any>): Promise<void> {
    const batchData = Array.from(items.values()).map(item => {
      if (item && typeof item === 'object' && 'data' in item) {
        return item.data;
      }
      return item;
    });

    const batchRequest: BatchRequest = {
      Entries: batchData,
      count: batchData.length,
      timestamp: new Date().toISOString()
    };

    try {
      const apiUrl = this.env.ARXIGNIS_API_URL || 'https://api.arxignis.com/v1';
      const endpoint = `${apiUrl}/${this.getEndpointName()}/batch`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.ARXIGNIS_API_KEY}`,
        },
        body: JSON.stringify(batchRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // All items processed successfully, they will be cleared by the parent method

    } catch (error) {
      console.error(`${this.constructor.name}: ❌ Failed to flush ${batchData.length} ${this.getEndpointName()} items:`, error);
      console.error(`${this.constructor.name}: API URL: ${this.env.ARXIGNIS_API_URL}`);
      console.error(`${this.constructor.name}: Endpoint: ${this.getEndpointName()}/batch`);

      // Handle retry logic for failed items
      for (const [key, item] of items) {
        if (item && typeof item === 'object' && 'retryCount' in item && item.retryCount < this.MAX_RETRIES) {
          item.retryCount++;
          item.timestamp = Date.now();
          await this.storage.put(key, item);
        } else {
          await this.storage.delete(key);
        }
      }

      // Re-throw the error so the parent method knows processing failed
      throw error;
    }
  }
}

// Durable Object specifically for metrics
class ArxignisMetricsBufferDO extends BaseBufferDO {
  protected readonly FLUSH_INTERVAL = 10000; // 10 seconds - metrics can wait longer
  protected readonly MAX_RETRIES = 5; // Metrics are more critical, more retries
  protected readonly MAX_BUFFER_SIZE = 1000; // Smaller buffer for metrics

  protected getEndpointName(): string {
    return 'metrics';
  }

  protected async processBatch(items: Map<string, any>): Promise<void> {
    const batchData = Array.from(items.values()).map(item => {
      if (item && typeof item === 'object' && 'data' in item) {
        return item.data;
      }
      return item;
    });

    const batchRequest: BatchRequest = {
      Entries: batchData,
      count: batchData.length,
      timestamp: new Date().toISOString()
    };

    try {
      const apiUrl = this.env.ARXIGNIS_API_URL || 'https://api.arxignis.com/v1';
      const endpoint = `${apiUrl}/${this.getEndpointName()}/batch`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.ARXIGNIS_API_KEY}`,
        },
        body: JSON.stringify(batchRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
      }

      // All items processed successfully, they will be cleared by the parent method

    } catch (error) {
      console.error(`${this.constructor.name}: ❌ Failed to flush ${batchData.length} ${this.getEndpointName()} items:`, error);
      console.error(`${this.constructor.name}: API URL: ${this.env.ARXIGNIS_API_URL}`);
      console.error(`${this.constructor.name}: Endpoint: ${this.getEndpointName()}/batch`);

      // Handle retry logic for failed items
      for (const [key, item] of items) {
        if (item && typeof item === 'object' && 'retryCount' in item && item.retryCount < this.MAX_RETRIES) {
          item.retryCount++;
          item.timestamp = Date.now();
          await this.storage.put(key, item);
        } else {
          await this.storage.delete(key);
        }
      }

      // Re-throw the error so the parent method knows processing failed
      throw error;
    }
  }
}

// Worker-side helper functions
export function getLogBufferId(env: any, name: string = "default"): DurableObjectId {
  return env.LOG_BUFFER.idFromName(name);
}

export function getMetricsBufferId(env: any, name: string = "default"): DurableObjectId {
  return env.METRICS_BUFFER.idFromName(name);
}

export function getLogBufferStub(env: any, name: string = "default"): DurableObjectStub {
  const id = getLogBufferId(env);
  return env.LOG_BUFFER.get(id);
}

export function getMetricsBufferStub(env: any, name: string = "default"): DurableObjectStub {
  const id = getMetricsBufferId(env);
  return env.METRICS_BUFFER.get(id);
}

export async function addToLogBuffer(env: Env, data: any): Promise<void> {
  try {
    const stub = getLogBufferStub(env);

    const response = await stub.fetch('https://buffer.local/', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error(`📝 ❌ Failed to add to log buffer: ${response.status}`);
    }
  } catch (error) {
    console.error('📝 ❌ Error adding to log buffer:', error);
  }
}

export async function addToMetricsBuffer(env: Env, data: any): Promise<void> {
  try {
    const stub = getMetricsBufferStub(env);

    const response = await stub.fetch('https://buffer.local/', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      console.error(`📊 ❌ Failed to add to metrics buffer: ${response.status}`);
    }
  } catch (error) {
    console.error('📊 ❌ Error adding to metrics buffer:', error);
  }
}

export async function getLogBufferStatus(env: Env): Promise<any> {
  try {
    const stub = getLogBufferStub(env);
    const response = await stub.fetch('https://buffer.local/');

    if (response.ok) {
      const status = await response.json();
      return status;
    }
  } catch (error) {
    console.error('📝 ❌ Error getting log buffer status:', error);
  }

  const fallbackStatus = { size: 0, count: 0, isFlushing: false, type: 'log' };
  return fallbackStatus;
}

export async function getMetricsBufferStatus(env: Env): Promise<any> {
  try {
    const stub = getMetricsBufferStub(env);
    const response = await stub.fetch('https://buffer.local/');

    if (response.ok) {
      const status = await response.json();
      return status;
    }
  } catch (error) {
    console.error('📊 ❌ Error getting metrics buffer status:', error);
  }

  const fallbackStatus = { size: 0, count: 0, isFlushing: false, type: 'metrics' };
  return fallbackStatus;
}

// Export the base classes
export { ArxignisLogBufferDO, ArxignisMetricsBufferDO };

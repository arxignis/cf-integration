import { BetterKV } from 'flareutils';

export class CacheManager {
  private l2Cache: BetterKV;

  constructor(
    kvNamespace: KVNamespace,
    waitUntil: (promise: Promise<any>) => void
  ) {
    this.l2Cache = new BetterKV(kvNamespace, waitUntil, {
      cacheSpace: 'ax-proxy-cache',
    });
  }

  // Update waitUntil function for new requests
  setWaitUntil(waitUntil: (promise: Promise<any>) => void): void {
    this.l2Cache.setWaitUntil(waitUntil);
  }

  async get(key: string): Promise<string | null> {
    // Use L2 cache (BetterKV) directly
    const value = await this.l2Cache.get(key);
    if (value !== null && value !== undefined && value !== '') {
      console.log('Cache ax-proxy-cache match');
      return value;
    }

    console.log('Cache miss for key:', key);
    return null;
  }

  async getWithMetadata(
    key: string,
    format: 'text' | 'json' | 'arrayBuffer' | 'stream' = 'text'
  ): Promise<any> {
    console.log(`KV AX_CACHE getWithMetadata`);

    // Use L2 cache (BetterKV) directly
    const value = await this.l2Cache.getWithMetadata(key, format as any);

    if (value !== null && value !== undefined) {
      console.log('Cache ax-proxy-cache match');
      return value;
    }

    console.log('Cache miss for key:', key);
    return null;
  }

  async set(key: string, value: string, ttl: number): Promise<void> {
    // Set in L2 cache (BetterKV)
    await this.l2Cache.put(key, value, { expirationTtl: ttl });
    console.log(`Cache ax-proxy-cache put`);
  }

  async delete(key: string): Promise<void> {
    // Delete from L2 cache (BetterKV)
    await this.l2Cache.delete(key);
    console.log('Deleted cache for key:', key);
  }
}

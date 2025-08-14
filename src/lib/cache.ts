import { CacheableMemory } from 'cacheable';

// Initialize L1 cache instance
const l1Cache = new CacheableMemory(
	{
		ttl: 300,
		lruSize: 5000, // Maximum number of items in LRU cache
	},
);

// Cache manager for two-tier caching (L1: in-memory, L2: Cloudflare KV)
export class CacheManager {
	private l1Cache: CacheableMemory;
	private l2Cache: KVNamespace;

	constructor(l2Cache: KVNamespace) {
		this.l1Cache = l1Cache;
		this.l2Cache = l2Cache;
	}

	async get(key: string): Promise<string | null> {
		// Try L1 cache first
		const l1Value = await this.l1Cache.get(key);
		if (l1Value !== null && l1Value !== undefined && l1Value !== '') {
			console.log('L1 cache hit for key:', key);
			return l1Value as string;
		}

		// Fallback to L2 cache (Cloudflare KV)
		const l2Value = await this.l2Cache.get(key);
		if (l2Value !== null && l2Value !== undefined && l2Value !== '') {
			console.log('L2 cache hit for key:', key);
			// Populate L1 cache with L2 value (cache for 60 seconds)
			this.l1Cache.set(key, l2Value, 60);
			return l2Value;
		}

		console.log('Cache miss for key:', key);
		return null;
	}

	async set(key: string, value: string, ttl: number): Promise<void> {
		// Set in both L1 and L2 caches
		this.l1Cache.set(key, value, ttl);
		await this.l2Cache.put(key, value, { expirationTtl: ttl });
		console.log(`Set cache for key: ${key}, L1 TTL: ${ttl}s, L2 TTL: ${ttl}s`);
	}

	async delete(key: string): Promise<void> {
		// Delete from both caches
		this.l1Cache.delete(key);
		await this.l2Cache.delete(key);
		console.log('Deleted cache for key:', key);
	}
}

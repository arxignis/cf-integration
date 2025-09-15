import * as ipaddr from 'ipaddr.js';
import { isValidIP } from './helper';

/**
 * Trie node for IP address storage
 */
class IPTrieNode {
  children: Map<string, IPTrieNode> = new Map();
  isEndOfIP: boolean = false;
  ipAddress?: string; // Store the full IP for exact matches
}

/**
 * Range tree node for CIDR ranges
 */
class RangeTreeNode {
  start: number;
  end: number;
  prefixLength: number;
  network: ipaddr.IPv4 | ipaddr.IPv6;
  left?: RangeTreeNode;
  right?: RangeTreeNode;
  height: number = 1;

  constructor(network: ipaddr.IPv4 | ipaddr.IPv6, prefixLength: number) {
    this.network = network;
    this.prefixLength = prefixLength;

    // Convert network to numeric range for efficient comparison
    if (network.kind() === 'ipv4') {
      const ipv4 = network as ipaddr.IPv4;
      const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
      this.start = ipv4.octets.reduce((acc, octet) => (acc << 8) + octet, 0) & mask;
      this.end = this.start | ((1 << (32 - prefixLength)) - 1);
    } else {
      // For IPv6, we'll use a simplified approach with the first 32 bits
      const ipv6 = network as ipaddr.IPv6;
      const parts = ipv6.parts.slice(0, 2); // Use first 2 parts (64 bits)
      this.start = (parts[0] << 16) + parts[1];
      this.end = this.start + (1 << (64 - prefixLength)) - 1;
    }
  }
}

/**
 * List data structure for efficient IP and CIDR range lookups
 */
interface ListData {
  // Legacy structures for backward compatibility
  individualIPs: Set<string>;
  cidrRanges: Array<{
    network: ipaddr.IPv4 | ipaddr.IPv6;
    prefixLength: number;
  }>;
  ipv4Ranges: Array<{
    network: ipaddr.IPv4;
    prefixLength: number;
  }>;
  ipv6Ranges: Array<{
    network: ipaddr.IPv6;
    prefixLength: number;
  }>;

  // Optimized data structures
  ipTrie: IPTrieNode;
  ipv4RangeTree?: RangeTreeNode;
  ipv6RangeTree?: RangeTreeNode;

  // Sorted arrays for binary search fallback
  sortedIPv4Ranges: Array<{
    network: ipaddr.IPv4;
    prefixLength: number;
    start: number;
    end: number;
  }>;
  sortedIPv6Ranges: Array<{
    network: ipaddr.IPv6;
    prefixLength: number;
    start: number;
    end: number;
  }>;
}

/**
 * Global list data structure
 */
let listData: ListData = {
  individualIPs: new Set(),
  cidrRanges: [],
  ipv4Ranges: [],
  ipv6Ranges: [],
  ipTrie: new IPTrieNode(),
  sortedIPv4Ranges: [],
  sortedIPv6Ranges: []
};

/**
 * Flag to track if list has been initialized
 */
let isInitialized = false;

/**
 * Cached initialization data for fast startup
 */
let cachedIPs: string[] | null = null;

/**
 * Insert IP address into trie
 */
function insertIntoTrie(trie: IPTrieNode, ip: string): void {
  const parts = ip.split('.');
  let current = trie;

  for (const part of parts) {
    if (!current.children.has(part)) {
      current.children.set(part, new IPTrieNode());
    }
    current = current.children.get(part)!;
  }

  current.isEndOfIP = true;
  current.ipAddress = ip;
}

/**
 * Search IP address in trie
 */
function searchInTrie(trie: IPTrieNode, ip: string): boolean {
  const parts = ip.split('.');
  let current = trie;

  for (const part of parts) {
    if (!current.children.has(part)) {
      return false;
    }
    current = current.children.get(part)!;
  }

  return current.isEndOfIP;
}

/**
 * Convert IP to numeric value for range comparison
 */
function ipToNumber(ip: string, isIPv6: boolean = false): number {
  if (isIPv6) {
    const ipv6 = ipaddr.parse(ip) as ipaddr.IPv6;
    const parts = ipv6.parts.slice(0, 2); // Use first 2 parts (64 bits)
    return (parts[0] << 16) + parts[1];
  } else {
    const ipv4 = ipaddr.parse(ip) as ipaddr.IPv4;
    return ipv4.octets.reduce((acc: number, octet: number) => (acc << 8) + octet, 0);
  }
}

/**
 * Binary search in sorted ranges
 */
function binarySearchRanges(
  ranges: Array<{ start: number; end: number; network: ipaddr.IPv4 | ipaddr.IPv6; prefixLength: number }>,
  targetIP: number
): boolean {
  let left = 0;
  let right = ranges.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const range = ranges[mid];

    if (targetIP >= range.start && targetIP <= range.end) {
      return true;
    } else if (targetIP < range.start) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return false;
}

/**
 * Build AVL tree for range matching
 */
function buildRangeTree(ranges: Array<{ network: ipaddr.IPv4 | ipaddr.IPv6; prefixLength: number }>): RangeTreeNode | undefined {
  if (ranges.length === 0) return undefined;

  // Sort ranges by start value
  const sortedRanges = ranges
    .map(range => new RangeTreeNode(range.network, range.prefixLength))
    .sort((a, b) => a.start - b.start);

  return buildAVLTree(sortedRanges, 0, sortedRanges.length - 1);
}

/**
 * Build AVL tree from sorted array
 */
function buildAVLTree(ranges: RangeTreeNode[], start: number, end: number): RangeTreeNode | undefined {
  if (start > end) return undefined;

  const mid = Math.floor((start + end) / 2);
  const node = ranges[mid];

  node.left = buildAVLTree(ranges, start, mid - 1);
  node.right = buildAVLTree(ranges, mid + 1, end);

  updateHeight(node);
  return node;
}

/**
 * Update node height for AVL tree
 */
function updateHeight(node: RangeTreeNode): void {
  const leftHeight = node.left?.height || 0;
  const rightHeight = node.right?.height || 0;
  node.height = Math.max(leftHeight, rightHeight) + 1;
}

/**
 * Search in range tree
 */
function searchInRangeTree(node: RangeTreeNode | undefined, targetIP: number): boolean {
  if (!node) return false;

  if (targetIP >= node.start && targetIP <= node.end) {
    return true;
  }

  if (targetIP < node.start) {
    return searchInRangeTree(node.left, targetIP);
  } else {
    return searchInRangeTree(node.right, targetIP);
  }
}

/**
 * Initialize list with IP addresses and CIDR ranges
 * @param ips - Array of IP addresses and CIDR ranges
 */
export function initializeList(ips: string[]): void {
  // Cache the IPs for potential re-initialization
  cachedIPs = ips;

  const startTime = performance.now();
  const individualIPs = new Set<string>();
  const ipv4Ranges: Array<{ network: ipaddr.IPv4; prefixLength: number }> = [];
  const ipv6Ranges: Array<{ network: ipaddr.IPv6; prefixLength: number }> = [];
  const ipTrie = new IPTrieNode();

  const parseStartTime = performance.now();
  for (const ip of ips) {
    try {
      // Check if it's a CIDR range
      if (ip.includes('/')) {
        const [address, prefixLengthStr] = ip.split('/');
        const prefixLength = parseInt(prefixLengthStr, 10);

        if (isNaN(prefixLength) || prefixLength < 0) {
          console.warn(`Invalid CIDR prefix length: ${ip}`);
          continue;
        }

        const network = ipaddr.parse(address);

        if (network.kind() === 'ipv4') {
          if (prefixLength > 32) {
            console.warn(`Invalid IPv4 CIDR prefix length: ${ip}`);
            continue;
          }
          ipv4Ranges.push({ network: network as ipaddr.IPv4, prefixLength });
        } else if (network.kind() === 'ipv6') {
          if (prefixLength > 128) {
            console.warn(`Invalid IPv6 CIDR prefix length: ${ip}`);
            continue;
          }
          ipv6Ranges.push({ network: network as ipaddr.IPv6, prefixLength });
        }
      } else {
        // Individual IP address
        if (isValidIP(ip)) {
          individualIPs.add(ip);
          insertIntoTrie(ipTrie, ip);
        } else {
          console.warn(`Invalid IP address: ${ip}`);
        }
      }
    } catch (error) {
      console.warn(`Failed to process IP/range: ${ip}`, error);
    }
  }
  const parseEndTime = performance.now();

  // Sort ranges by prefix length (longest first) for more efficient matching
  const sortStartTime = performance.now();
  ipv4Ranges.sort((a, b) => b.prefixLength - a.prefixLength);
  ipv6Ranges.sort((a, b) => b.prefixLength - a.prefixLength);
  const sortEndTime = performance.now();

  // Build optimized data structures
  const buildStartTime = performance.now();

  // Create sorted arrays for binary search
  const sortedIPv4Ranges = ipv4Ranges.map(range => {
    const ipv4 = range.network;
    const mask = (0xFFFFFFFF << (32 - range.prefixLength)) >>> 0;
    const start = ipv4.octets.reduce((acc, octet) => (acc << 8) + octet, 0) & mask;
    const end = start | ((1 << (32 - range.prefixLength)) - 1);
    return { ...range, start, end };
  }).sort((a, b) => a.start - b.start);

  const sortedIPv6Ranges = ipv6Ranges.map(range => {
    const ipv6 = range.network;
    const parts = ipv6.parts.slice(0, 2); // Use first 2 parts (64 bits)
    const start = (parts[0] << 16) + parts[1];
    const end = start + (1 << (64 - range.prefixLength)) - 1;
    return { ...range, start, end };
  }).sort((a, b) => a.start - b.start);

  // Build range trees
  const ipv4RangeTree = buildRangeTree(ipv4Ranges);
  const ipv6RangeTree = buildRangeTree(ipv6Ranges);
  const buildEndTime = performance.now();

  listData = {
    individualIPs,
    cidrRanges: [...ipv4Ranges, ...ipv6Ranges],
    ipv4Ranges,
    ipv6Ranges,
    ipTrie,
    ipv4RangeTree,
    ipv6RangeTree,
    sortedIPv4Ranges,
    sortedIPv6Ranges
  };

  isInitialized = true;
  const endTime = performance.now();
  console.log(`List initialized with ${individualIPs.size} individual IPs and ${ipv4Ranges.length + ipv6Ranges.length} CIDR ranges in ${(endTime - startTime).toFixed(3)}ms (parse: ${(parseEndTime - parseStartTime).toFixed(3)}ms, sort: ${(sortEndTime - sortStartTime).toFixed(3)}ms, build: ${(buildEndTime - buildStartTime).toFixed(3)}ms)`);
}

/**
 * Initialize list at service startup (one-time initialization)
 * @param ips - Array of IP addresses and CIDR ranges
 */
export function initializeListAtStartup(ips: string[]): void {
  if (isInitialized) {
    console.log('List already initialized, skipping startup initialization');
    return;
  }

  console.log('🚀 Initializing access control list at service startup...');
  initializeList(ips);
  console.log('✅ Access control list ready for requests');
}

/**
 * Ensure list is initialized (lazy initialization)
 */
function ensureInitialized(): void {
  if (!isInitialized && cachedIPs) {
    console.log('⚠️ Lazy initializing access control list...');
    initializeList(cachedIPs);
  }
}

/**
 * Check if an IP address is in the list
 * @param ip - IP address to check
 * @returns true if IP is in list, false otherwise
 */
export function isIPInList(ip: string): boolean {
  const startTime = performance.now();

  // Ensure list is initialized (lazy initialization)
  ensureInitialized();

  if (!ip || !isValidIP(ip)) {
    const endTime = performance.now();
    console.log(`IP validation failed for ${ip} in ${(endTime - startTime).toFixed(3)}ms`);
    return false;
  }

  try {
    const ipAddr = ipaddr.parse(ip);
    const isIPv6 = ipAddr.kind() === 'ipv6';

    // Check individual IPs using trie (fastest lookup)
    const trieStartTime = performance.now();
    if (searchInTrie(listData.ipTrie, ip)) {
      const endTime = performance.now();
      console.log(`IP ${ip} found in trie in ${(endTime - startTime).toFixed(3)}ms (trie: ${(endTime - trieStartTime).toFixed(3)}ms)`);
      return true;
    }
    const trieEndTime = performance.now();

    // Check CIDR ranges using optimized methods
    const rangeStartTime = performance.now();
    let found = false;
    let method = '';

    if (isIPv6) {
      // Try range tree first
      if (listData.ipv6RangeTree) {
        const targetIP = ipToNumber(ip, true);
        if (searchInRangeTree(listData.ipv6RangeTree, targetIP)) {
          found = true;
          method = 'range tree';
        }
      }

      // Fallback to binary search
      if (!found && listData.sortedIPv6Ranges.length > 0) {
        const targetIP = ipToNumber(ip, true);
        if (binarySearchRanges(listData.sortedIPv6Ranges, targetIP)) {
          found = true;
          method = 'binary search';
        }
      }

      // Final fallback to linear scan
      if (!found) {
        for (const range of listData.ipv6Ranges) {
          try {
            if (ipAddr.match(range.network, range.prefixLength)) {
              found = true;
              method = 'linear scan';
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    } else {
      // Try range tree first
      if (listData.ipv4RangeTree) {
        const targetIP = ipToNumber(ip, false);
        if (searchInRangeTree(listData.ipv4RangeTree, targetIP)) {
          found = true;
          method = 'range tree';
        }
      }

      // Fallback to binary search
      if (!found && listData.sortedIPv4Ranges.length > 0) {
        const targetIP = ipToNumber(ip, false);
        if (binarySearchRanges(listData.sortedIPv4Ranges, targetIP)) {
          found = true;
          method = 'binary search';
        }
      }

      // Final fallback to linear scan
      if (!found) {
        for (const range of listData.ipv4Ranges) {
          try {
            if (ipAddr.match(range.network, range.prefixLength)) {
              found = true;
              method = 'linear scan';
              break;
            }
          } catch (error) {
            continue;
          }
        }
      }
    }

    const endTime = performance.now();
    const rangeEndTime = performance.now();

    if (found) {
      console.log(`IP ${ip} found in CIDR range via ${method} in ${(endTime - startTime).toFixed(3)}ms (trie: ${(trieEndTime - trieStartTime).toFixed(3)}ms, range: ${(rangeEndTime - rangeStartTime).toFixed(3)}ms)`);
    } else {
      const ranges = isIPv6 ? listData.ipv6Ranges : listData.ipv4Ranges;
      console.log(`IP ${ip} not found in ${ranges.length} ranges in ${(endTime - startTime).toFixed(3)}ms (trie: ${(trieEndTime - trieStartTime).toFixed(3)}ms, range: ${(rangeEndTime - rangeStartTime).toFixed(3)}ms)`);
    }

    return found;
  } catch (error) {
    const endTime = performance.now();
    console.warn(`Error checking IP list for ${ip} in ${(endTime - startTime).toFixed(3)}ms:`, error);
    return false;
  }
}

/**
 * Add a single IP or CIDR range to the list
 * @param ip - IP address or CIDR range to add
 */
export function addToList(ip: string): void {
  if (!ip) return;

  try {
    if (ip.includes('/')) {
      // CIDR range
      const [address, prefixLengthStr] = ip.split('/');
      const prefixLength = parseInt(prefixLengthStr, 10);

      if (isNaN(prefixLength) || prefixLength < 0) {
        console.warn(`Invalid CIDR prefix length: ${ip}`);
        return;
      }

      const network = ipaddr.parse(address);

      if (network.kind() === 'ipv4') {
        if (prefixLength > 32) {
          console.warn(`Invalid IPv4 CIDR prefix length: ${ip}`);
          return;
        }
        const newRange = { network: network as ipaddr.IPv4, prefixLength };
        listData.ipv4Ranges.push(newRange);
        listData.cidrRanges.push(newRange);
        // Re-sort to maintain efficiency
        listData.ipv4Ranges.sort((a, b) => b.prefixLength - a.prefixLength);
      } else if (network.kind() === 'ipv6') {
        if (prefixLength > 128) {
          console.warn(`Invalid IPv6 CIDR prefix length: ${ip}`);
          return;
        }
        const newRange = { network: network as ipaddr.IPv6, prefixLength };
        listData.ipv6Ranges.push(newRange);
        listData.cidrRanges.push(newRange);
        // Re-sort to maintain efficiency
        listData.ipv6Ranges.sort((a, b) => b.prefixLength - a.prefixLength);
      }
    } else {
      // Individual IP
      if (isValidIP(ip)) {
        listData.individualIPs.add(ip);
      } else {
        console.warn(`Invalid IP address: ${ip}`);
      }
    }
  } catch (error) {
    console.warn(`Failed to add IP/range to list: ${ip}`, error);
  }
}

/**
 * Remove an IP or CIDR range from the list
 * @param ip - IP address or CIDR range to remove
 */
export function removeFromList(ip: string): void {
  if (!ip) return;

  try {
    if (ip.includes('/')) {
      // CIDR range
      const [address, prefixLengthStr] = ip.split('/');
      const prefixLength = parseInt(prefixLengthStr, 10);

      if (isNaN(prefixLength)) return;

      const network = ipaddr.parse(address);
      const ranges = network.kind() === 'ipv4' ? listData.ipv4Ranges : listData.ipv6Ranges;

      const index = ranges.findIndex(range =>
        range.network.toString() === network.toString() &&
        range.prefixLength === prefixLength
      );

      if (index !== -1) {
        ranges.splice(index, 1);
        // Also remove from combined cidrRanges
        const cidrIndex = listData.cidrRanges.findIndex(range =>
          range.network.toString() === network.toString() &&
          range.prefixLength === prefixLength
        );
        if (cidrIndex !== -1) {
          listData.cidrRanges.splice(cidrIndex, 1);
        }
      }
    } else {
      // Individual IP
      listData.individualIPs.delete(ip);
    }
  } catch (error) {
    console.warn(`Failed to remove IP/range from list: ${ip}`, error);
  }
}

/**
 * Get list statistics
 * @returns Object with list statistics
 */
export function getListStats(): {
  individualIPs: number;
  ipv4Ranges: number;
  ipv6Ranges: number;
  totalRanges: number;
} {
  return {
    individualIPs: listData.individualIPs.size,
    ipv4Ranges: listData.ipv4Ranges.length,
    ipv6Ranges: listData.ipv6Ranges.length,
    totalRanges: listData.cidrRanges.length
  };
}

/**
 * Clear the entire list
 */
export function clearList(): void {
  listData = {
    individualIPs: new Set(),
    cidrRanges: [],
    ipv4Ranges: [],
    ipv6Ranges: [],
    ipTrie: new IPTrieNode(),
    sortedIPv4Ranges: [],
    sortedIPv6Ranges: []
  };
  console.log('List cleared');
}

/**
 * Main access control function - checks if IP should be blocked
 * @param clientIP - Client IP address to check
 * @returns true if access should be denied, false if allowed
 */
export function accessControl(clientIP: string): boolean {
  const startTime = performance.now();

  // Ensure list is initialized (lazy initialization)
  ensureInitialized();

  if (!clientIP) {
    const endTime = performance.now();
    console.log(`Access control: No IP provided, allowing in ${(endTime - startTime).toFixed(3)}ms`);
    return false; // Allow if no IP provided
  }

  const result = isIPInList(clientIP);
  const endTime = performance.now();
  console.log(`Access control for ${clientIP}: ${result ? 'BLOCKED' : 'ALLOWED'} in ${(endTime - startTime).toFixed(3)}ms`);

  return result;
}

/**
 * Load list from a URL (useful for dynamic updates)
 * @param url - URL to fetch list data from
 * @returns Promise that resolves when list is loaded
 */
export async function loadListFromURL(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch list: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const ips = text.split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // Remove empty lines and comments

    initializeList(ips);
    console.log(`List loaded from ${url} with ${ips.length} entries`);
  } catch (error) {
    console.error(`Failed to load list from ${url}:`, error);
    throw error;
  }
}

/**
 * Load list from environment variable (comma-separated or newline-separated)
 * @param envVar - Environment variable containing list data
 * @returns Array of IP addresses and ranges
 */
export function loadListFromEnv(envVar: string): string[] {
  const listEnv = process.env[envVar] || '';
  return listEnv
    .split(/[,\n]/)
    .map(ip => ip.trim())
    .filter(ip => ip && !ip.startsWith('#'));
}

/**
 * Performance comparison utilities
 */
export function benchmarkLookup(ip: string, iterations: number = 1000): {
  trie: number;
  set: number;
  rangeTree: number;
  binarySearch: number;
  linearScan: number;
} {
  const results = {
    trie: 0,
    set: 0,
    rangeTree: 0,
    binarySearch: 0,
    linearScan: 0
  };

  // Benchmark trie lookup
  const trieStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    searchInTrie(listData.ipTrie, ip);
  }
  results.trie = performance.now() - trieStart;

  // Benchmark set lookup
  const setStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    listData.individualIPs.has(ip);
  }
  results.set = performance.now() - setStart;

  // Benchmark range tree lookup
  const ipAddr = ipaddr.parse(ip);
  const isIPv6 = ipAddr.kind() === 'ipv6';
  const targetIP = ipToNumber(ip, isIPv6);

  const rangeTreeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (isIPv6) {
      searchInRangeTree(listData.ipv6RangeTree, targetIP);
    } else {
      searchInRangeTree(listData.ipv4RangeTree, targetIP);
    }
  }
  results.rangeTree = performance.now() - rangeTreeStart;

  // Benchmark binary search
  const binaryStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    if (isIPv6) {
      binarySearchRanges(listData.sortedIPv6Ranges, targetIP);
    } else {
      binarySearchRanges(listData.sortedIPv4Ranges, targetIP);
    }
  }
  results.binarySearch = performance.now() - binaryStart;

  // Benchmark linear scan
  const linearStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const ranges = isIPv6 ? listData.ipv6Ranges : listData.ipv4Ranges;
    for (const range of ranges) {
      try {
        if (ipAddr.match(range.network, range.prefixLength)) {
          break;
        }
      } catch (error) {
        continue;
      }
    }
  }
  results.linearScan = performance.now() - linearStart;

  return results;
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): {
  individualIPs: number;
  ipv4Ranges: number;
  ipv6Ranges: number;
  totalRanges: number;
  trieNodes: number;
  rangeTreeHeight: { ipv4: number; ipv6: number };
  memoryUsage: string;
  isInitialized: boolean;
} {
  const countTrieNodes = (node: IPTrieNode): number => {
    let count = 1;
    for (const child of node.children.values()) {
      count += countTrieNodes(child);
    }
    return count;
  };

  const getTreeHeight = (node: RangeTreeNode | undefined): number => {
    if (!node) return 0;
    return Math.max(getTreeHeight(node.left), getTreeHeight(node.right)) + 1;
  };

  return {
    individualIPs: listData.individualIPs.size,
    ipv4Ranges: listData.ipv4Ranges.length,
    ipv6Ranges: listData.ipv6Ranges.length,
    totalRanges: listData.cidrRanges.length,
    trieNodes: countTrieNodes(listData.ipTrie),
    rangeTreeHeight: {
      ipv4: getTreeHeight(listData.ipv4RangeTree),
      ipv6: getTreeHeight(listData.ipv6RangeTree)
    },
    memoryUsage: `${Math.round(JSON.stringify(listData).length / 1024)}KB`,
    isInitialized
  };
}

/**
 * Test startup initialization performance
 */
export function testStartupPerformance(ips: string[]): void {
  console.log('🧪 Testing startup initialization performance...');

  // Clear any existing data
  clearList();

  const startTime = performance.now();
  initializeListAtStartup(ips);
  const endTime = performance.now();

  console.log(`✅ Startup initialization completed in ${(endTime - startTime).toFixed(3)}ms`);
  console.log(`📊 Performance stats:`, getPerformanceStats());
}

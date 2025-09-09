import * as ipaddr from 'ipaddr.js';
import { isValidIP } from './helper';

/**
 * List data structure for efficient IP and CIDR range lookups
 */
interface ListData {
  // Set of individual IP addresses for O(1) lookup
  individualIPs: Set<string>;
  // Array of CIDR ranges for range matching
  cidrRanges: Array<{
    network: ipaddr.IPv4 | ipaddr.IPv6;
    prefixLength: number;
  }>;
  // IPv4 and IPv6 ranges separated for better performance
  ipv4Ranges: Array<{
    network: ipaddr.IPv4;
    prefixLength: number;
  }>;
  ipv6Ranges: Array<{
    network: ipaddr.IPv6;
    prefixLength: number;
  }>;
}

/**
 * Global list data structure
 */
let listData: ListData = {
  individualIPs: new Set(),
  cidrRanges: [],
  ipv4Ranges: [],
  ipv6Ranges: []
};

/**
 * Initialize list with IP addresses and CIDR ranges
 * @param ips - Array of IP addresses and CIDR ranges
 */
export function initializeList(ips: string[]): void {
  const startTime = performance.now();
  const individualIPs = new Set<string>();
  const ipv4Ranges: Array<{ network: ipaddr.IPv4; prefixLength: number }> = [];
  const ipv6Ranges: Array<{ network: ipaddr.IPv6; prefixLength: number }> = [];

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

  listData = {
    individualIPs,
    cidrRanges: [...ipv4Ranges, ...ipv6Ranges],
    ipv4Ranges,
    ipv6Ranges
  };

  const endTime = performance.now();
  console.log(`List initialized with ${individualIPs.size} individual IPs and ${ipv4Ranges.length + ipv6Ranges.length} CIDR ranges in ${(endTime - startTime).toFixed(3)}ms (parse: ${(parseEndTime - parseStartTime).toFixed(3)}ms, sort: ${(sortEndTime - sortStartTime).toFixed(3)}ms)`);
}

/**
 * Check if an IP address is in the list
 * @param ip - IP address to check
 * @returns true if IP is in list, false otherwise
 */
export function isIPInList(ip: string): boolean {
  const startTime = performance.now();

  if (!ip || !isValidIP(ip)) {
    const endTime = performance.now();
    console.log(`IP validation failed for ${ip} in ${(endTime - startTime).toFixed(3)}ms`);
    return false;
  }

  try {
    const ipAddr = ipaddr.parse(ip);

    // Check individual IPs first (fastest lookup)
    if (listData.individualIPs.has(ip)) {
      const endTime = performance.now();
      console.log(`IP ${ip} found in individual IPs in ${(endTime - startTime).toFixed(3)}ms`);
      return true;
    }

    // Check CIDR ranges
    const ranges = ipAddr.kind() === 'ipv4' ? listData.ipv4Ranges : listData.ipv6Ranges;
    const rangeStartTime = performance.now();

    for (const range of ranges) {
      try {
        if (ipAddr.match(range.network, range.prefixLength)) {
          const endTime = performance.now();
          console.log(`IP ${ip} found in CIDR range ${range.network.toString()}/${range.prefixLength} in ${(endTime - startTime).toFixed(3)}ms (range scan: ${(endTime - rangeStartTime).toFixed(3)}ms)`);
          return true;
        }
      } catch (error) {
        // Skip invalid ranges
        continue;
      }
    }

    const endTime = performance.now();
    console.log(`IP ${ip} not found in ${ranges.length} ranges in ${(endTime - startTime).toFixed(3)}ms (range scan: ${(endTime - rangeStartTime).toFixed(3)}ms)`);
    return false;
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
    ipv6Ranges: []
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

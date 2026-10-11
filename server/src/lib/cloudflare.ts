import { BlockList, isIP } from 'node:net';

/**
 * Cloudflare's edge ranges, from https://www.cloudflare.com/ips-v4 and /ips-v6
 * (fetched 2026-10-11). They change rarely and with notice; if Cloudflare adds a
 * range, requests from it fall back to being keyed on the edge address — rate
 * limits get stricter, nothing gets spoofable.
 */
const RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

const edges = new BlockList();
for (const range of RANGES) {
  const [net, prefix] = range.split('/');
  edges.addSubnet(net, Number(prefix), isIP(net) === 6 ? 'ipv6' : 'ipv4');
}

/** True when the address belongs to Cloudflare's edge network. */
export function isCloudflareEdge(address: string): boolean {
  const family = isIP(address);
  if (!family) return false;
  return edges.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

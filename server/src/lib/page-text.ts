import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Turning a roaster's product page into something worth reading.
 *
 * The hard part is not stripping tags, it is that a shop page is mostly *other
 * coffees*. Perc's Outpost page mentions Colombia 205 times, every one of them in
 * a nav link to a different bag -- so a naive strip hands the model a page that
 * actively argues for the wrong origin. Navigation, headers and footers come out
 * first, and the product's own structured data goes in front, because that block
 * is scoped to this product and cannot be contaminated by the menu.
 */

const STRIP_ELEMENTS =
  /<(script|style|svg|noscript|head|nav|header|footer|form|iframe|template)\b[^>]*>.*?<\/\1>/gis;
/** Shopify and most themes label these regions even when the tag is a plain div. */
const STRIP_REGIONS =
  /<[^>]+(?:role="(?:navigation|banner|contentinfo|search)"|class="[^"]*(?:site-nav|header__|footer__|breadcrumb|menu-drawer|cart-drawer|announcement)[^"]*")[^>]*>.*?<\/[a-z]+>/gis;

function decode(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&(?:mdash|ndash);/g, '-')
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

/** Product name, brand and description, straight from the page's own JSON-LD. */
function productFacts(html: string): string[] {
  const out: string[] = [];
  const blocks = html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, raw] of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      continue;
    }
    for (const node of Array.isArray(data) ? data : [data]) {
      const d = node as Record<string, any>;
      const type = String(d?.['@type'] ?? '');
      if (!/product/i.test(type)) continue;
      if (d.name) out.push(`Product: ${d.name}`);
      const brand = typeof d.brand === 'string' ? d.brand : d.brand?.name;
      if (brand) out.push(`Brand: ${brand}`);
      if (d.description) {
        out.push(`Description: ${decode(String(d.description).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()}`);
      }
    }
  }
  return out;
}

export function extractReadable(html: string, limit = 7000): string {
  const facts = productFacts(html);

  let body = html.replace(STRIP_ELEMENTS, ' ').replace(STRIP_REGIONS, ' ');
  const main = /<(main|article)\b[^>]*>([\s\S]*?)<\/\1>/is.exec(body);
  if (main) body = main[2];

  const lines = decode(body.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1);

  // Runs of one- or two-word lines are almost always a surviving menu; a spec
  // block reads the same way though ("ORIGIN" / "San Adolfo"), so keep short lines
  // and only drop exact repeats, which is what duplicated nav looks like.
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const l of lines) {
    const key = l.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(l);
  }

  return [...facts, ...(facts.length ? ['', 'Page text:'] : []), ...trimRecommendations(kept)]
    .join('\n')
    .slice(0, limit);
}

/**
 * Shops end a product page with a rack of other bags. On the page that prompted
 * this, that rack is eleven coffees, most of them Colombian, for a product whose
 * own origin never says Colombia -- so it is the single most misleading thing on
 * the page. Cut from the heading that introduces it.
 */
const RECOMMENDATION_HEADING =
  /^(more stuff|you (?:may|might) also like|related products?|customers also|recently viewed|recommended|shop all|more from)/i;

function trimRecommendations(lines: string[]): string[] {
  const at = lines.findIndex((l) => RECOMMENDATION_HEADING.test(l.trim()));
  return at === -1 ? lines : lines.slice(0, at);
}

/** Anything that is not a public http(s) address is refused. */
async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https links can be read.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  for (const { address } of addresses) {
    if (isPrivate(address)) throw new Error('That link points at a private address.');
  }
  return url;
}

function isPrivate(ip: string): boolean {
  if (/^(10\.|127\.|0\.|169\.254\.)/.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  const lower = ip.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

const MAX_BYTES = 2_000_000;

/** Follows redirects by hand so every hop is checked, not just the first. */
export async function fetchPageText(rawUrl: string): Promise<string> {
  let target = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(target, {
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: {
        // Plenty of shops serve a stub to an unrecognised agent.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new Error(`That page redirected without a destination (${res.status}).`);
      target = await assertPublicUrl(new URL(next, target).toString());
      continue;
    }
    if (!res.ok) throw new Error(`That page returned ${res.status}.`);

    const type = res.headers.get('content-type') ?? '';
    if (!/html|text/i.test(type)) throw new Error(`That link is ${type || 'not a web page'}.`);

    const buf = await res.arrayBuffer();
    const html = new TextDecoder().decode(buf.slice(0, MAX_BYTES));
    const text = extractReadable(html);
    if (text.trim().length < 40) throw new Error('That page had almost no readable text.');
    return text;
  }
  throw new Error('That link redirected too many times.');
}

/** The pasted box accepts either a link or the copy itself. Lives in the shared
 *  package because the form asks the same question to fill in the Link field. */
export { asUrl } from '@brewlab/shared';

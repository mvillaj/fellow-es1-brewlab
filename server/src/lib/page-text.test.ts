import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractReadable } from './page-text.ts';
import { asUrl } from '../../../packages/shared/src/ai.ts';

/**
 * Shaped after a real Shopify product page: a nav full of other coffees, a spec
 * block that holds the facts, and a rack of recommendations at the foot. The
 * page that prompted these tests mentions Colombia 205 times without the coffee
 * itself being Colombian -- every one of them somewhere we must not read.
 */
const SHOP_PAGE = `<!doctype html><html><head><title>Outpost</title>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"ProductGroup","name":"Outpost Coffee",
 "brand":{"@type":"Brand","name":"PERC COFFEE"},
 "description":"<p>Notes of graham cracker &amp; marshmallow.</p>"}
</script>
<style>.x{color:red}</style></head>
<body>
<nav><a href="/a">Colombia Wilder Lazo Sidra</a><a href="/b">Ethiopia Chelchele</a></nav>
<header class="header__inner"><a>Colombia Nestor Lasso</a></header>
<main>
  <h1>Outpost Coffee</h1>
  <div>ORIGIN</div><div>San Adolfo</div>
  <div>ELEVATION</div><div>1700 MASL</div>
  <div>VARIETY</div><div>Caturra</div>
  <div>PROCESS</div><div>Adv Washed</div>
  <p>Jhon Rodriguez produces this at his farm, Rio Negro.</p>
  <h2>MORE STUFF</h2>
  <a>Colombia Franky Hoyos Adv Washed</a>
  <a>Colombia Diego Bermudez Castillo</a>
</main>
<footer><a>Colombia Young Producers</a></footer>
</body></html>`;

test('the product spec block survives extraction', () => {
  const t = extractReadable(SHOP_PAGE);
  for (const fact of ['San Adolfo', '1700 MASL', 'Caturra', 'Adv Washed', 'Rio Negro']) {
    assert.ok(t.includes(fact), `expected to keep "${fact}"`);
  }
});

test('structured product data leads, so the right bag is named first', () => {
  const t = extractReadable(SHOP_PAGE);
  assert.ok(t.startsWith('Product: Outpost Coffee'), t.slice(0, 60));
  assert.ok(t.includes('Brand: PERC COFFEE'), 'the roaster comes from the same block');
  assert.ok(t.includes('graham cracker & marshmallow'), 'entities decoded, tags stripped');
});

test('no other coffee from the page reaches the model', () => {
  const t = extractReadable(SHOP_PAGE);
  // This is the whole point: every mention of Colombia on the source page belongs
  // to a different product, and reading any of them gets the origin wrong.
  assert.equal(/colombia/i.test(t), false, `leaked: ${t}`);
  assert.equal(/Chelchele/i.test(t), false, 'nav must not survive');
});

test('script and style content never reaches the model', () => {
  const t = extractReadable(SHOP_PAGE);
  assert.equal(t.includes('color:red'), false);
  assert.equal(t.includes('@context'), false);
});

test('the extract is bounded', () => {
  const t = extractReadable(SHOP_PAGE, 120);
  assert.ok(t.length <= 120);
});

test('a bare link is recognised, prose is not', () => {
  assert.equal(asUrl('https://perccoffee.com/products/outpost-coffee'), 'https://perccoffee.com/products/outpost-coffee');
  assert.equal(asUrl('  https://x.test/a?b=1  '), 'https://x.test/a?b=1');
  assert.equal(asUrl('Ethiopia Guji, washed heirloom'), null);
  assert.equal(asUrl('see https://x.test for details'), null, 'prose mentioning a link is still prose');
  assert.equal(asUrl('file:///etc/passwd'), null);
  assert.equal(asUrl('perccoffee.com/products/outpost'), null, 'no scheme, treat as text');
});

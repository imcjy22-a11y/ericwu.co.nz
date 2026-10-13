/* Publishing helper for ericwu.co.nz (runs on GitHub, not on the website).
 *
 * Every time the site is pushed, and once a day, GitHub runs this before publishing:
 *   1. copies the website into a folder called _site
 *   2. reads Listings and Recently Sold from the 管理后台 database
 *   3. writes those cards into listings.html, sold.html and index.html inside _site
 * Only the published copy changes — the files in GitHub and on JY's computer are never touched.
 *
 * Safety: if the database can't be reached, or anything here goes wrong, the pages are
 * published exactly as they are in GitHub. Publishing never stops because of this script.
 */
'use strict';
const fs = require('fs');
const path = require('path');
let SiteData = null; // loaded after the plain copy is made, so a problem in it can't stop publishing

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, '_site');
const SKIP = new Set(['.git', '.github', 'scripts', '_site', 'node_modules']);

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const name of fs.readdirSync(src)) {
    if (SKIP.has(name)) continue;
    const s = path.join(src, name), d = path.join(dst, name);
    if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

async function fetchTable(table) {
  const res = await fetch(SiteData.SB_URL + SiteData.QUERY[table], {
    headers: { apikey: SiteData.SB_KEY },
    signal: AbortSignal.timeout(20000)
  });
  if (!res.ok) throw new Error(table + ': HTTP ' + res.status);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(table + ': unexpected answer');
  return data;
}

function bake(file, kind, list) {
  const p = path.join(OUT, file);
  if (!fs.existsSync(p)) { console.log('  skip ' + file + ' (not found)'); return; }
  let html = fs.readFileSync(p, 'utf8');
  const blocks = SiteData.blocks(kind, list);
  for (const key of Object.keys(blocks)) {
    const next = SiteData.inject(html, key, blocks[key]);
    if (next === null) { console.log('  ! ' + file + ': marker ' + key + ' missing — left as is'); continue; }
    html = next;
  }
  html = html.replace(new RegExp('(data-sitedata="' + kind + '"[^>]*?data-hash=")[^"]*(")'), '$1' + SiteData.hash(list) + '$2');
  fs.writeFileSync(p, html);
  console.log('  ✓ ' + file + ': ' + list.length + ' item(s) written');
}

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyDir(ROOT, OUT);
  console.log('Copied website to _site');
  SiteData = require('../js/site-data.js');

  try {
    const sold = await fetchTable('sold');
    if (!sold.length) {
      console.log('! Recently Sold came back empty — keeping the cards already in the pages');
    } else {
      bake('sold.html', 'sold', sold);
      bake('index.html', 'home', sold);
    }
  } catch (e) {
    console.log('! Recently Sold not updated (' + e.message + ') — publishing pages as they are');
  }

  try {
    const listings = await fetchTable('listings');
    bake('listings.html', 'listings', listings);
  } catch (e) {
    console.log('! Listings not updated (' + e.message + ') — publishing pages as they are');
  }
})().catch((e) => {
  console.log('! Unexpected problem (' + e.message + ') — publishing plain copy');
  if (!fs.existsSync(OUT)) copyDir(ROOT, OUT);
});

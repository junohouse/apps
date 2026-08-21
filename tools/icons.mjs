// Refresh `icon` from the platform that publishes one.
//
// Artwork is the half of an app that this file cannot state as a fact: a service's tile is a
// picture on somebody else's server, it is re-issued when a brand changes, and nothing here would
// notice. So `icon` is a **link**, never a copy, and this is what re-reads the links.
//
// Only for the boxes that cannot list their own apps. A Roku and an Apple TV report what they
// have installed together with their own artwork for each, and a controller draws that; the
// catalog's picture matters where there is no such list, which today means SmartCast. VIZIO
// publishes both halves — the app list a controller launches from, and an image URL per app — so
// that is where these come from.
//
//   node tools/icons.mjs           # rewrite apps.json in place
//   node tools/icons.mjs --dry-run # say what would change and touch nothing
//
// Written as text edits rather than JSON.parse/stringify on purpose. This file is hand-written
// and hand-formatted — one entry per few lines, launch strings kept on one line so a diff of them
// reads — and round-tripping it through a serialiser would reflow all 87 entries to change three.

import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://scfs.vizio.com/appservice/vizio_apps_prod.json';
const dryRun = process.argv.includes('--dry-run');
const path = new URL('../apps.json', import.meta.url);

/** The same reduction a controller applies: case and punctuation are not part of a name. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const response = await fetch(SOURCE);
if (!response.ok) {
  console.error(`::error::${SOURCE} answered HTTP ${response.status}`);
  process.exit(1);
}
const published = await response.json();

// First claim wins, matching how a controller indexes spellings — and VIZIO's file does carry
// repeats, one per country, whose icons are the same picture anyway.
const art = new Map();
for (const app of published) {
  const url = app?.mobileAppInfo?.app_icon_image_url;
  if (url && !art.has(key(app.name))) art.set(key(app.name), url);
}
if (art.size < 100) {
  console.error(`::error::only ${art.size} icons in ${SOURCE} — that file has changed shape`);
  process.exit(1);
}

const source = readFileSync(path, 'utf8');
const { apps } = JSON.parse(source);

let out = source;
const added = [];
const changed = [];
const missing = [];

for (const app of apps) {
  const found = [app.name, app.slug, ...(app.aliases ?? [])].map((n) => art.get(key(n))).find(Boolean);
  if (!found) {
    // No picture published for it. An existing link is left alone rather than deleted: it may
    // have been added by hand from somewhere this tool does not read.
    if (!app.icon) missing.push(app.slug);
    continue;
  }
  if (app.icon === found) continue;

  // The entry starts at `{ "slug": "…"` and `icon`, when present, is its own line before
  // `launch`. Anchoring on the slug keeps this to one entry however the rest is laid out.
  const entry = new RegExp(`(\\{ "slug": "${app.slug}",[^\\n]*\\n)((\\s*)"icon": "[^"]*",\\n)?(\\s*)"launch"`);
  if (!entry.test(out)) {
    console.error(`::error::${app.slug}: could not find its entry to edit`);
    process.exit(1);
  }
  out = out.replace(entry, (_, head, __, iconIndent, indent) =>
    `${head}${iconIndent ?? indent}"icon": "${found}",\n${indent}"launch"`);
  (app.icon ? changed : added).push(app.slug);
}

JSON.parse(out); // never write something a controller cannot read

const summary = [
  `${added.length} added`,
  `${changed.length} re-pointed`,
  `${apps.length - added.length - changed.length - missing.length} unchanged`,
  `${missing.length} with no published icon`,
].join(', ');

if (added.length) console.log(`added:      ${added.join(', ')}`);
if (changed.length) console.log(`re-pointed: ${changed.join(', ')}`);
if (missing.length) console.log(`no icon:    ${missing.join(', ')}`);
console.log(summary);

if (out === source) console.log('apps.json is already up to date');
else if (dryRun) console.log('--dry-run: apps.json not written');
else {
  writeFileSync(path, out);
  console.log('apps.json written');
}

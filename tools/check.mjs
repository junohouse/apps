// What the schema cannot say: that no two apps claim the same spelling.
//
// A duplicate is the failure worth guarding, because it is invisible. Matching takes the first
// claim, so the second app simply never resolves — its tile is drawn, its name is accepted, and
// launching it opens something else. Nothing errors, on any controller, ever.
//
// Everything else here is shape, and the schema owns that. Run with `node tools/check.mjs`.

import { readFileSync } from 'node:fs';

const { apps } = JSON.parse(readFileSync(new URL('../apps.json', import.meta.url), 'utf8'));

/** The same reduction a controller applies: case and punctuation are not part of a name. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const problems = [];
const claimed = new Map();
const slugs = new Set();

for (const app of apps) {
  if (slugs.has(app.slug)) problems.push(`two entries with slug \`${app.slug}\``);
  slugs.add(app.slug);

  // `slug` and `name` are matched without being listed, so they are the starting set rather
  // than something to check. An *alias* that reduces to one of them is dead weight — usually a
  // sign somebody meant to write a different spelling and typed the name again.
  const own = new Set([key(app.slug), key(app.name)]);
  for (const alias of app.aliases) {
    const k = key(alias);
    if (!k) {
      problems.push(`${app.slug}: \`${alias}\` reduces to nothing`);
      continue;
    }
    if (own.has(k)) {
      problems.push(`${app.slug}: alias \`${alias}\` already matches via its slug or name`);
    }
    own.add(k);
  }

  for (const k of own) {
    const other = claimed.get(k);
    if (other && other !== app.slug) {
      problems.push(`\`${k}\` is claimed by both ${other} and ${app.slug}`);
    }
    claimed.set(k, app.slug);
  }
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}

const platforms = new Map();
for (const app of apps)
  for (const p of Object.keys(app.launch ?? {})) platforms.set(p, (platforms.get(p) ?? 0) + 1);

console.log(`${apps.length} apps, ${claimed.size} spellings`);
for (const [p, n] of [...platforms].sort((a, b) => b[1] - a[1]))
  console.log(`  ${p}: ${n} filled in`);

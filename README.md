# Juno App Catalog

**What a streaming service is called on every box that has one, and the string each platform
needs to launch it.** One file, hand-edited, public: [`apps.json`](apps.json).

Served at **https://apps.juno.house/apps.json**, which every Juno controller reads on start and
once a day after. A merged pull request here reaches houses without anybody shipping a release.

## Why this exists

Every box spells the same service differently. A Roku lists `Prime Video`. An older Fire TV
lists `Amazon Instant Video`. A VIDAA television lists `Amazon Prime`. Somebody standing in the
room says "prime".

Left alone, a room with three of those boxes offers three unrelated Netflix-shaped tiles and has
to ask which television's Netflix was meant — which is not a question anyone in a house wants to
be asked. So a controller asks this file, and the room offers **Netflix**, once.

The second half is launching. Some devices will tell you what they have installed and some will
not, and a device that will not needs to be handed the id its platform uses. Those ids are
knowledge about the world — they change when HBO Max becomes Max, when a vendor re-issues its
app ids in a firmware update, when a service shuts down and boxes keep listing it anyway. None
of that is a code change, and none of it should wait for a release.

## An entry

```json
{
  "slug": "prime-video",
  "name": "Prime Video",
  "aliases": ["amazon prime video", "amazon video", "amazon instant video", "amazon prime", "prime"],
  "launch": {
    "roku": "13",
    "android_tv": "com.amazon.amazonvideo.livingroom",
    "fire_tv": "com.amazon.avod",
    "webos": "amazon",
    "tizen": "amazon"
  }
}
```

| Field | What |
| --- | --- |
| `slug` | Stable id. **Never change or reuse one** — a project may have written it down. |
| `name` | What a person is shown, and what a room is asked for. Matched as an alias automatically. |
| `aliases` | Every other spelling: what each vendor's own list calls it, and what somebody would say out loud. Only the ones that differ from `name` and `slug`. |
| `launch` | Per platform, the string that opens it. Sparse — see below. |

Platform keys, and what each one wants, are documented in `apps.json`'s own `platforms` block.
Today: `roku`, `apple_tv`, `android_tv`, `fire_tv`, `webos`, `tizen`.

## Two rules worth knowing before you send a change

**Matching is exact.** Case and punctuation are ignored, so `Disney+`, `disney plus` and
`DisneyPlus` are one key. Nothing else is — no prefixes, no substrings, no edit distance. That
is what keeps `Netflix Kids` its own app and stops `Sky Sports Box Office` collapsing into
`Sky Go`. A name that is not matching is fixed by **adding a spelling**, which every house then
gets, not by loosening a rule for everybody.

**`launch` is sparse, and blank means unknown.** An absent platform means nobody has filled that
one in — not that the service is unavailable there. A missing id costs nothing on a device that
lists its own apps, so please do not guess one. A wrong id opens the wrong app, or nothing, and
reports success either way, which is the one failure mode a person cannot debug from a sofa.

Adding a platform key is fine and needs no schema change; the ids are opaque to a controller and
only that platform's driver reads them.

## Sending a change

```bash
node tools/check.mjs
```

That, plus the schema, is the whole CI. It runs on every pull request, needs no credentials, and
says exactly which entry is wrong. The check that matters is the one a schema cannot express: no
two apps may claim the same spelling. Matching takes the first claim, so a duplicate means the
second app silently never resolves — its tile draws, its name is accepted, and launching it opens
something else, on every controller, with nothing logged anywhere.

Artwork is not filled in by hand for the boxes that need it. `node tools/icons.mjs` re-reads
VIZIO's published app list and re-points every `icon` it covers; `--dry-run` says what it would
change and writes nothing. Run it when a service rebrands, or when a tile stops loading. It is
deliberately not part of CI — a link that moved is not a broken pull request, and a check that
failed every time somebody else re-issued a logo would be turned off within a month.

Ids are best taken off a device you actually have. `curl http://<roku>:8060/query/apps` prints a
Roku's channels with their ids; `adb shell pm list packages` does the same for an Android-based
box.

## How a controller reads it

Fetch on start, once a day after, and fall back to the copy compiled into the build
(`core/src/house/apps.json`). So an update is a day away at worst, a house with no internet still
knows what Netflix is, and a broken file here cannot take a house down — it can only stop updates
arriving, which is why the check above exists.

`JUNO_APPS` overrides the URL, for a controller pointed at a staging copy.

## Deploying it

Cloudflare Pages project `juno-apps` → `apps.juno.house`, from the `publish` workflow.

The Cloudflare token has Pages access and `Zone:Read` but **no** `Zone:DNS:Edit`, so the CNAME
for a new hostname has to be added by hand. Attaching the custom domain before that CNAME
resolves half-succeeds — the hostname reports `pending`, never appears in the project's `domains`
list, and serves 522. If that happens, DELETE the domain and re-POST it once DNS resolves; it
goes active a couple of minutes later.

# changhai-brand-setting

English | [中文](README.zh.md)

White-label the DeepSeek Harness Web GUI from a dedicated **Brand** page in
Settings: the sidebar mark and wordmark, the blank-session hero headline,
tagline and badge, the browser tab title and the favicon — with the shipped
brand restored the moment the master switch goes off. The switch ships **on**,
so a fresh install is branded immediately.

Unlike a stylesheet-overlay skin, this plugin fills the brand holes the shell
already declares, so the sidebar keeps its own layout, hit areas, fold
behaviour and hover states.

## What it changes, and how

| Surface | Mechanism |
| --- | --- |
| Sidebar logo (wide row and collapsed rail) | Occupant of the `sidebar.brand.mark` slot |
| Sidebar wordmark | Occupant of the `sidebar.brand.name` slot |
| Blank-session hero mark | Occupant of the `conversation.hero.brand.mark` slot |
| Hero headline / preview badge | Guarded text substitution by exact match against the shipped copy, read from the live locale dictionary |
| Hero tagline | A node this plugin **creates** under the headline; ships with default copy and an explicit hide |
| Tagline alignment | Measured inset on that node only — the headline is never restyled |
| Tab title, favicon | Guarded `document.title` / `rel="icon"` writes |

The three slots are `kind: 'single'`, and
`@deepseek-ai/dsh-client-ui-brand-official` already occupies the two sidebar
ones at the default priority. Slots shadow by priority — the cell's lowest live
entry renders — so this plugin registers at `priority: -100` and wins the cell
**only while a surface actually differs from the shipped presentation**. With
the switch off it registers nothing at all, so the official occupants, their
fallbacks and the build badge stay exactly as shipped.

The mark **ships with artwork of its own** — the Changhai wave, embedded in the
browser half as a PNG data URL — so `logoKind` defaults to `image` and a fresh
install is branded out of the box, with no file to carry
alongside the package. Picking your own image replaces it; choosing `shipped`
hands the slots back to the official occupant. The embedded file is the source
artwork at its own 50×51px, because the image pipeline never upscales it (see
`MAX_IMAGE_EDGE`) and resampling here would only inflate the bundle.

The hero headline and the preview badge are not slots (they are i18n strings
compiled into `ui-conversation`), and `document.title` / the favicon have no
extension point either. Those are handled as opt-in, guarded rewrites: the
plugin reads the shipped copy from the active locale dictionary, replaces nodes
whose text matches it exactly, and restores them when the field is cleared.
A reshaped surface degrades to "not found" rather than rewriting the wrong node.

The **favicon** also defaults to the embedded mark, so the tab is branded out of
the box. It is the same image the mark uses — no extra
bytes — and clearing the field returns to it rather than to the shell's icon;
picking a file replaces it. The tab *title* ships copy too (`长海智能`): an empty
field applies it and the shipped product name leaves the tab, while the session
name and the rest of the string stay the shell's. The rewrite is idempotent — it
rolls its own previous value back before substituting again, without which a
second edit would find no product name left to replace and the tab would keep the
stale title.

The **tagline** is the one surface the plugin *creates* rather than substitutes:
the shipped hero has no tagline slot or string, so there is nothing to rewrite.
A single marked node (`data-dsh-brand-tagline`) is inserted as a sibling of the
headline row, which lays it out directly below the title and above the composer.
The row is located from the same hero mark anchor the rest of the plugin uses,
and accepted only when it is the innermost element holding the headline — the
outer hero stack also contains one, and inserting there would drop the tagline
below the composer instead.

It is also the one surface that ships with **copy of its own**
(`创新求变破困局，冲上山头论英雄`), so an empty field means "use the shipped
line" rather than "show nothing". Hiding it is a separate, explicit choice, which
keeps those two intents from colliding inside one empty value. Turning the master
switch off removes the node outright, leaving the shipped hero byte-identical.

The tagline is **aligned to the title** by default (centring is the other
option). Only the tagline moves: the headline keeps the shell's layout untouched,
which is why the override is written as `text-align` + `padding-left` on the
tagline node alone rather than by restyling the row. The padding is the
*measured* distance from the row's left edge to where the centred title's glyphs
actually begin — read with a `Range` over the headline's contents, because that
distance follows the title's rendered width and is not derivable from the text
(measured on the live shell: ~158px for a long headline, ~319px for a short one).
It is re-measured whenever the copy changes and on `resize`, since a viewport
change or a swapping web font reflows the title without any DOM mutation to
observe. Choosing centring measures nothing and writes no inset.

## Install

The package is a normal bundle: it declares `dsh.bundle.patch`, so the standard
path works.

```sh
dsh plugin --profile web add /absolute/path/to/changhai-brand-setting
```

That path registers the loader row through `dsh.profile.bundles`, which is read
at boot — restart `dsh web` once afterwards, then reload the page.

For a local checkout you can instead activate the row from the profile's own
`cordis.patch.yml`, which the loader reloads live:

```yaml
- insert:
    - id: changhai-brand-setting
      name: changhai-brand-setting
```

**Use exactly one of the two paths.** Registering the same loader entry id in
both places makes the loader throw `duplicate loader entry id` at boot.

## Install offline

The package has **no runtime dependencies** and no build step: the browser half
only requires `react`, which the shell itself provides. Nothing has to be
fetched from a registry, so an offline machine needs nothing but the files.

### 1. Copy the folder + run the installer (recommended)

Carry the project directory over (USB, internal share, `scp`), then:

```sh
./scripts/install-offline.sh                        # copy into $DSH_HOME/profiles/web
./scripts/install-offline.sh --mode link            # symlink instead (dev loop)
./scripts/install-offline.sh --profile tui          # another profile
./scripts/install-offline.sh --home /opt/dsh        # another DSH home
./scripts/install-offline.sh --uninstall            # remove plugin + loader row
```

That copies the package into `<DSH_HOME>/profiles/<profile>/node_modules/` (a
real copy, so it keeps working after the source checkout is gone), adds exactly
one loader row to the profile's `cordis.patch.yml` — creating the file as `[]`
when absent, and never touching a reader's own comments or other plugins'
entries — and syntax-checks both halves. It is idempotent, refuses to create a
duplicate activation when the package is already listed in
`dsh.profile.bundles` (override with `--force`), and `--uninstall` restores the
patch file to `[]`.

### 2. By hand (same two steps the script performs)

```sh
cp -R /media/usb/changhai-brand-setting "$DSH_HOME/profiles/web/node_modules/"
```

then append to `$DSH_HOME/profiles/web/cordis.patch.yml`:

```yaml
- insert:
    - id: changhai-brand-setting
      name: changhai-brand-setting
```

The patch file's root must stay a list: if it currently holds only `[]`, replace
that line with the entry above instead of appending after it.

### 3. As a tarball

```sh
pnpm pack                                 # on the machine that has the source
# carry changhai-brand-setting-0.1.0.tgz over, then:
dsh plugin --profile web add --offline ./changhai-brand-setting-0.1.0.tgz
```

A local tarball needs no registry, the package has no dependencies to resolve,
and the profile's own dependencies are already in its store, so `--offline`
completes without touching the network (verified: `pnpm add --offline
./changhai-brand-setting-0.1.0.tgz` resolves and installs in a fresh project). This
path goes through `dsh.profile.bundles` and therefore needs a `dsh web`
restart — afterwards remove any `cordis.patch.yml` entry for the same id.
Unpacking the tarball straight into the profile's `node_modules` works too and
is then identical to path 1.

On Windows, use path 2 (copy + patch entry) or path 3; the shell installer is
POSIX-only.

### Verifying the install

```sh
node --check "$DSH_HOME/profiles/web/node_modules/changhai-brand-setting/lib/client.js"
curl -s -X POST http://127.0.0.1:3080/changhai-brand-setting/api \
  -H 'content-type: application/json' -d '{"method":"status"}'
```

`client.registered: true` means the browser row is composed and the page will
fetch the bundle. Then reload the GUI page.

## Use

Settings → **Brand**. The page is registered as its own section in the settings
navigation, next to Appearance.

- **Enable custom brand** — the master switch. **On by default**, so the install
  is branded without opening Settings; switching it off restores the shipped
  brand immediately and the configuration is kept either way.
- **Mark** — `Image` (the default: the built-in Changhai wave, or pick a file to
  replace it — downscaled to at most 512 px and stored as a PNG data URL) /
  `Official` / `Text` (a monogram or emoji) / `Hidden`, plus a size.
- **Name** — the sidebar wordmark: text with size, weight, letter spacing and
  colour, or an image, or hidden.
- **Hero** — the blank-session headline and the preview badge (keep the shipped
  text, write your own, or hide it), plus a **tagline** under the title with its
  own size, colour and alignment. Leave the field empty for the built-in line
  (`创新求变破困局，冲上山头论英雄`), type your own, or set **Hidden** to remove
  it altogether. Alignment is **Align to title** (the default, hanging the line
  off the headline's own left edge) or **Centred**; the headline itself is never
  moved.
- **Browser** — the tab title (the product name is substituted inside
  `document.title`, keeping the session part; an empty field applies the built-in
  `长海智能`) and the favicon, which falls back to the built-in mark when no file
  is picked.
- **Live preview** — the page previews the mark and wordmark as you edit.

## Console API

```js
__DSH_BRAND.set({ enabled: '1', logoKind: 'text', logoText: '长海', nameKind: 'text', nameText: 'changhai' })
__DSH_BRAND.set({ heroTagline: '让每一次对话都通向未来', taglineSize: '15', taglineAlign: 'title' })
__DSH_BRAND.set({ heroTagline: '', taglineHidden: '1' })   // built-in line → hidden
__DSH_BRAND.get()    // current settings
__DSH_BRAND.slots()  // slots currently claimed
__DSH_BRAND.reset()  // back to the shipped brand
__DSH_BRAND.help()
```

Kinds are `shipped | image | text | none`; an empty string clears a field back
to its shipped default.

## Where settings live

`$DSH_HOME/changhai-brand-setting.json` (default `~/.dsh/changhai-brand-setting.json`), written
owner-only and atomically through this package's host half. The browser reaches
it through a fenced JSON API at `POST /changhai-brand-setting/api`:

- `{ "method": "get" }` → the whole state object;
- `{ "method": "set", "patch": { ... } }` → merged patch; a string sets, `null`
  removes, keys outside the allowlist are dropped;
- `{ "method": "status" }` → `{ file, client: { registered, url, rev } }`, the
  quick answer to "is the browser half wired up?".

The route accepts loopback (or configured trusted) hosts with same-origin
browser markers only — a DNS-rebinding / cross-site defense, not authentication.
`localStorage` is used as a first-paint seed only: it is origin-scoped, and the
desktop shell picks a new port on every launch.

Why not the product's own settings channel: `dsh-host-apiproxy` exposes an
explicit allowlist of settings namespaces to browser clients, so a third-party
namespace answers `settings-not-exposed` by design.

## Development

Plain ESM and a plain CJS browser bundle — no build step.

```sh
npm run check   # syntax check both halves
npm test        # runs the browser half in a simulated shell
```

The smoke test loads `lib/client.js` through a captured
`window.__ModuleLoader__.load`, drives it with a fake cordis context, DOM and
storage, and asserts that the settings page registers, that slots are claimed
only for configured surfaces (and released when switched off), that every
registered component renders, that the mark shows the built-in artwork on a fresh
install and is replaced by a picked image, that the favicon falls back to that
same built-in image, that the tab-title substitution
works, that the tagline shows the built-in line with no configuration at all and
is removed only when explicitly hidden (reusing one node across syncs rather than
duplicating it), and that aligning to the title writes the measured inset without
ever restyling the headline. It
resolves React from `$DSH_WEB_MODULES`, then
`$DSH_HOME/profiles/web/node_modules`, then `./node_modules`.
Host-half edits need a `dsh web` restart (the host loader caches modules by
specifier); browser-half edits are picked up by `dsh-client-hmr` and reload the
plugin in the open page.

## Known limits

- **Claiming the wordmark slot removes the shell's local-build badge**, because
  that badge lives inside the same fallback the official occupant replaces.
  Switch the name back to `Official` to get it back.
- **Hero copy is substituted in the pages that render the shipped strings.**
  If a future version renames the classes the plugin probes for, the fallback
  path is a document-wide exact-text match, and failing that nothing is changed.
- **The tagline depends on that same hero anchor.** It is inserted as a sibling
  of the row holding the headline, so if the hero is reshaped beyond recognition
  the tagline is not shown at all — it never guesses an insertion point. Because
  the node is written from a `MutationObserver` callback, every write is
  guarded by an equality check and the node is reused rather than recreated, so
  a steady state produces no further mutations.
- **"Align to title" measures the live layout.** The inset comes from the
  rendered headline, so it is exact for the title as drawn — but it is a
  measurement, not a rule, so it is re-taken on copy changes and on `resize`. A
  reflow that fires neither (an exotic animation that moves the title without
  resizing the window) would leave the inset stale until the next sync. If the
  headline cannot be measured, the tagline falls back to a 0px inset — visible
  and recoverable, never thrown.
- **Images are stored as data URLs** in the settings file, so prefer a simple
  mark over a photograph; a picked image longer than 1.5 M characters is
  refused, and the page says so instead of failing silently. An image source
  with nothing picked shows the built-in wave, so a surface never blanks.
- **The built-in mark is the source artwork at 50×51px**, embedded as-is (about
  5.5 KB). That is crisp at the sizes the shell asks for (24 px in the sidebar,
  34 px in the hero), but it is not a vector: pick a larger image if you want to
  use the mark at a much bigger size, since nothing here will upscale it.
- **An image pick that fails is visible in the page**, not only in the console.

## License

MIT

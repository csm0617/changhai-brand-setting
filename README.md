# changhai-brand-setting

English | [中文](README.zh.md)

White-label the DeepSeek Harness Web GUI from a dedicated **Brand** page in
Settings: the sidebar mark and wordmark, the blank-session hero headline and
badge, the browser tab title and the favicon — with the shipped brand restored
the moment the master switch goes off.

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
| Tab title, favicon | Guarded `document.title` / `rel="icon"` writes |

The three slots are `kind: 'single'`, and
`@deepseek-ai/dsh-client-ui-brand-official` already occupies the two sidebar
ones at the default priority. Slots shadow by priority — the cell's lowest live
entry renders — so this plugin registers at `priority: -100` and wins the cell
**only while a surface actually differs from the shipped presentation**. With
the switch off it registers nothing at all, so the official occupants, their
fallbacks and the build badge stay exactly as shipped.

The hero headline and the preview badge are not slots (they are i18n strings
compiled into `ui-conversation`), and `document.title` / the favicon have no
extension point either. Those are handled as opt-in, guarded rewrites: the
plugin reads the shipped copy from the active locale dictionary, replaces nodes
whose text matches it exactly, and restores them when the field is cleared.
A reshaped surface degrades to "not found" rather than rewriting the wrong node.

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

- **Enable custom brand** — the master switch. Off (the default) leaves the
  shipped brand untouched; the configuration is kept either way.
- **Mark** — `Official` / `Image` (pick a file, downscaled to 512 px and stored
  as a PNG data URL) / `Text` (a monogram or emoji) / `Hidden`, plus a size.
- **Name** — the sidebar wordmark: text with size, weight, letter spacing and
  colour, or an image, or hidden.
- **Hero** — the blank-session headline and the preview badge (keep the shipped
  text, write your own, or hide it).
- **Browser** — the tab title (the product name is substituted inside
  `document.title`, keeping the session part) and the favicon.
- **Live preview** — the page previews the mark and wordmark as you edit.

## Console API

```js
__DSH_BRAND.set({ enabled: '1', logoKind: 'text', logoText: '长海', nameKind: 'text', nameText: 'changhai' })
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
registered component renders, and that the tab-title substitution works. It
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
- **Images are stored as data URLs** in the settings file, so prefer a simple
  mark over a photograph; a picked image longer than 1.5 M characters is
  refused, and the page says so instead of failing silently. An image source
  with nothing picked falls back to the text value, so a surface never blanks.
- **An image pick that fails is visible in the page**, not only in the console.

## License

MIT

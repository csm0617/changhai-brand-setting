#!/usr/bin/env sh
#
# changhai-brand-setting — offline installer.
#
# Copies (or links) this plugin into a DSH profile and activates exactly one
# loader row for it, without pnpm, without a registry, and without network.
#
#   ./scripts/install-offline.sh                     # copy into the web profile
#   ./scripts/install-offline.sh --mode link         # symlink instead (dev loop)
#   ./scripts/install-offline.sh --profile tui       # another profile
#   ./scripts/install-offline.sh --home /opt/dsh     # another DSH home
#   ./scripts/install-offline.sh --uninstall         # remove plugin + loader row
#   ./scripts/install-offline.sh --force             # override a bundles install
#
# Why a copy (the default): the profile resolves the loader row through its own
# node_modules, so a real copy keeps working after the source checkout moves or
# is deleted — the whole point on a machine that cannot reinstall from a
# registry. Use --mode link when you are iterating on the source in place.

set -eu

PROFILE_NAME="web"
DSH_HOME_DIR="${DSH_HOME:-$HOME/.dsh}"
MODE="copy"
FORCE="0"
ACTION="install"

die() {
  printf 'changhai-brand-setting: %s\n' "$1" >&2
  exit 1
}

usage() {
  sed -n '2,20p' "$0" | sed 's/^#\{1,2\} \{0,1\}//'
  exit 0
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile) [ "$#" -ge 2 ] || die "--profile needs a value"; PROFILE_NAME="$2"; shift 2 ;;
    --home) [ "$#" -ge 2 ] || die "--home needs a value"; DSH_HOME_DIR="$2"; shift 2 ;;
    --mode) [ "$#" -ge 2 ] || die "--mode needs a value"; MODE="$2"; shift 2 ;;
    --uninstall) ACTION="uninstall"; shift ;;
    --force) FORCE="1"; shift ;;
    -h|--help) usage ;;
    *) die "unknown argument: $1" ;;
  esac
done

case "$MODE" in copy|link) ;; *) die "--mode must be copy or link" ;; esac

# The package root is this script's parent directory.
SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$SOURCE_DIR/package.json" ] || die "package.json not found next to scripts/"
[ -f "$SOURCE_DIR/lib/index.js" ] || die "lib/index.js not found — the package is incomplete"
[ -f "$SOURCE_DIR/lib/client.js" ] || die "lib/client.js not found — the package is incomplete"

PROFILE_DIR="$DSH_HOME_DIR/profiles/$PROFILE_NAME"
[ -d "$PROFILE_DIR" ] || die "profile directory not found: $PROFILE_DIR"
PATCH_FILE="$PROFILE_DIR/cordis.patch.yml"
TARGET_DIR="$PROFILE_DIR/node_modules/changhai-brand-setting"
PACKAGE_ID="changhai-brand-setting"
ENTRY_ID="changhai-brand-setting"

PACKAGE_NAME="$(sed -n 's/.*"name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$SOURCE_DIR/package.json" | head -1)"
[ "$PACKAGE_NAME" = "$PACKAGE_ID" ] || die "unexpected package name: $PACKAGE_NAME"

# ── uninstall ───────────────────────────────────────────────────────────────

remove_entry() {
  [ -f "$PATCH_FILE" ] || return 0
  grep -q "$PACKAGE_ID" "$PATCH_FILE" || return 0
  # Drop exactly one top-level list item — the one naming this package — plus
  # only those comment lines above it that name the package too, so a reader's
  # own comments and other plugins' entries survive untouched.
  awk -v pkg="$PACKAGE_ID" '
    { lines[NR] = $0 }
    END {
      count = 0
      for (i = 1; i <= NR; i++) if (lines[i] ~ /^-/) starts[++count] = i
      dropFrom = 0
      dropTo = 0
      for (k = 1; k <= count; k++) {
        from = starts[k]
        to = (k < count) ? starts[k + 1] - 1 : NR
        # A block is ours only when a DATA line names the package: comment lines
        # above the next item must not make that item look like ours.
        mentions = 0
        for (i = from; i <= to; i++) {
          if (lines[i] ~ /^[[:space:]]*#/) continue
          if (index(lines[i], pkg) > 0) mentions = 1
        }
        if (mentions) { dropFrom = from; dropTo = to }
      }
      if (dropFrom == 0) {
        for (i = 1; i <= NR; i++) print lines[i]
        exit
      }
      # Take the whole contiguous comment run directly above the item when any
      # of it names the package (that is the block this installer wrote).
      runStart = dropFrom
      while (runStart > 1 && lines[runStart - 1] ~ /^#/) runStart--
      runMentions = 0
      for (i = runStart; i < dropFrom; i++) if (index(lines[i], pkg) > 0) runMentions = 1
      if (runMentions) dropFrom = runStart
      for (i = 1; i < dropFrom; i++) print lines[i]
      for (i = dropTo + 1; i <= NR; i++) print lines[i]
    }
  ' "$PATCH_FILE" > "$PATCH_FILE.tmp"
  mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  # The patch layer's root must stay a list: re-add the empty-list marker when
  # no item is left (an empty or comment-only document is not a patch list).
  if ! grep -q '^-' "$PATCH_FILE"; then
    printf '[]\n' >> "$PATCH_FILE"
  fi
}

if [ "$ACTION" = "uninstall" ]; then
  if [ -L "$TARGET_DIR" ] || [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
    printf 'removed %s\n' "$TARGET_DIR"
  else
    printf 'nothing installed at %s\n' "$TARGET_DIR"
  fi
  remove_entry
  printf 'loader entry removed from %s\n' "$PATCH_FILE"
  printf 'reload the GUI page (or restart dsh web) to finish.\n'
  exit 0
fi

# ── guards ──────────────────────────────────────────────────────────────────

# Activating the same loader entry id twice makes the loader throw
# `duplicate loader entry id` at boot. A bundles install is the other path.
if grep -q "\"$PACKAGE_ID\"" "$PROFILE_DIR/package.json" 2>/dev/null; then
  if [ "$FORCE" != "1" ]; then
    die "$PACKAGE_ID is listed in $PROFILE_DIR/package.json (the bundles install path);
     activate it through ONE path only. Remove it from dsh.profile.bundles first,
     or re-run with --force to add the patch entry anyway."
  fi
  printf 'warning: %s is also listed in package.json — remove one activation path.\n' "$PACKAGE_ID" >&2
fi

if [ -e "$TARGET_DIR" ] && [ "$MODE" = "copy" ]; then
  printf 'replacing existing %s\n' "$TARGET_DIR"
fi

mkdir -p "$PROFILE_DIR/node_modules"
if [ -L "$PROFILE_DIR/node_modules" ]; then
  printf 'note: %s is a symlink; the plugin lands in its target directory.\n' "$PROFILE_DIR/node_modules"
fi

# ── place the package ───────────────────────────────────────────────────────

rm -rf "$TARGET_DIR"
if [ "$MODE" = "link" ]; then
  ln -s "$SOURCE_DIR" "$TARGET_DIR"
  printf 'linked %s -> %s\n' "$TARGET_DIR" "$SOURCE_DIR"
else
  # Copy the whole package minus VCS/housekeeping noise, so the offline machine
  # ends up with lib/, the bundle patch, the docs, the tests and this installer.
  mkdir -p "$TARGET_DIR"
  (cd "$SOURCE_DIR" && tar cf - --exclude .git --exclude .DS_Store --exclude node_modules .) |
    (cd "$TARGET_DIR" && tar xf -)
  # Packages land in a shared node_modules: keep them readable even when the
  # source checkout used a restrictive umask.
  chmod -R u+rwX,go+rX "$TARGET_DIR"
  printf 'copied %s -> %s (%s mode)\n' "$SOURCE_DIR" "$TARGET_DIR" "$MODE"
fi

# ── activate one loader row ─────────────────────────────────────────────────

[ -f "$PATCH_FILE" ] || printf '[]\n' > "$PATCH_FILE"

if grep -q "^[[:space:]]*-[[:space:]]*id:[[:space:]]*$ENTRY_ID\$" "$PATCH_FILE"; then
  printf 'loader entry already present in %s\n' "$PATCH_FILE"
else
  # A bare `[]` root cannot take a list item, so drop that marker line first.
  # (`grep -v` exits 1 when it selects nothing — hence the explicit success.)
  grep -v '^\[\][[:space:]]*$' "$PATCH_FILE" > "$PATCH_FILE.tmp" || true
  cat >> "$PATCH_FILE.tmp" <<EOF
# $PACKAGE_ID — installed by scripts/install-offline.sh ($MODE mode).
# Activate through ONE path only: this loader row, or dsh.profile.bundles in
# package.json — never both, or the loader throws duplicate loader entry id.
- insert:
    - id: $ENTRY_ID
      name: $PACKAGE_ID
EOF
  mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  printf 'loader entry added to %s\n' "$PATCH_FILE"
fi

# ── sanity ──────────────────────────────────────────────────────────────────

if command -v node >/dev/null 2>&1; then
  node --check "$TARGET_DIR/lib/index.js" || die "lib/index.js failed the syntax check"
  node --check "$TARGET_DIR/lib/client.js" || die "lib/client.js failed the syntax check"
  printf 'syntax check passed\n'
fi

cat <<'EOF'

Installed. Next:
  1. reload the GUI page — the boot graph is injected per index render;
  2. open Settings -> Brand and turn on "Enable custom brand".
A code change to the host half needs a `dsh web` restart; the browser half is
picked up by dsh-client-hmr without one.
EOF

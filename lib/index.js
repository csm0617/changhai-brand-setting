/**
 * changhai-brand-setting — host half.
 *
 * Durable, origin-independent persistence for the browser half.
 *
 * Why a host half at all: browser preferences would otherwise live in
 * localStorage, which is scoped per origin (scheme + host + port). DSH Desktop
 * binds its web server to an OS-assigned port on every launch, so the GUI
 * origin changes on every restart and localStorage "forgets" the saved brand —
 * the data is still in the browser store, just under the previous origin.
 * The product's own settings wire is not an option either: dsh-host-apiproxy
 * exposes an explicit allowlist of settings namespaces to browser clients
 * (`WEB_SETTINGS_NAMESPACES`), so a third-party namespace answers
 * `settings-not-exposed` by design.
 *
 * So this half gives the browser half a stable channel that survives origin
 * changes:
 *
 *   - a state file at `$DSH_HOME/changhai-brand-setting.json`, written atomically
 *     (tmp + rename), owner-only on POSIX;
 *   - a fenced JSON API at `/changhai-brand-setting/api` — POST `{method:"get"}` returns
 *     the whole state object; POST `{method:"set", patch}` merges a patch
 *     (string value sets, null removes, absent keys untouched) so two browser
 *     tabs cannot clobber each other.
 *
 * The browser half seeds its in-memory cache from localStorage (so the first
 * paint is already branded), then adopts this file as the authoritative state.
 *
 * Route security: the same trust fence the flagship third-party plugins use —
 * loopback (or a configured trusted authority) Host header plus same-origin
 * browser markers only. This is a DNS-rebinding / cross-site defense, not
 * authentication; the state is non-secret presentation data.
 */

import { homedir } from "node:os";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/** State file name inside the DSH home directory. */
const STATE_FILENAME = "changhai-brand-setting.json";
/** Route prefix owned by this plugin. */
const API_PREFIX = "/changhai-brand-setting/api";
/** Max accepted request body — brand artwork is a base64 data URL. */
const MAX_BODY_BYTES = 8 * 1024 * 1024;
/** Max stored length of one string field. */
const MAX_VALUE_LENGTH = 4 * 1024 * 1024;

/**
 * Accepted state keys. An allowlist keeps the file bounded and stops a
 * compromised page from using this route as arbitrary key/value storage.
 * Anything not listed here is dropped by `method:"set"`.
 */
const STATE_KEYS = new Set([
  // master switch + logo (sidebar mark, hero mark)
  "enabled",
  "logoKind",
  "logoImage",
  "logoText",
  "logoSize",
  "heroLogoSize",
  // sidebar wordmark
  "nameKind",
  "nameText",
  "nameImage",
  "nameSize",
  "nameWeight",
  "nameLetterSpacing",
  "nameColor",
  // blank-session hero
  "heroHeadline",
  "heroTagline",
  "taglineSize",
  "taglineColor",
  "taglineAlign",
  "badgeKind",
  "badgeText",
  // browser chrome
  "title",
  "titleFrom",
  "favicon",
]);

/** Plugin identity for cordis loader rows. */
export const name = "changhai-brand-setting";
/** Required services: the web-server route carrier and the trust-fence host list. */
export const inject = ["webServer", "webRuntime"];

// ── state file ─────────────────────────────────────────────────────────────

/** Absolute path of the state file under the DSH home directory. */
function statePath() {
  const home =
    typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0
      ? process.env.DSH_HOME
      : join(homedir(), ".dsh");
  return join(home, STATE_FILENAME);
}

/** Read the state object; `{}` when absent, unreadable, or not a plain object. */
function readState() {
  try {
    const parsed = JSON.parse(readFileSync(statePath(), "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const state = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (STATE_KEYS.has(key) && typeof value === "string") state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
}

/** Persist the state object atomically (tmp + rename, direct-write fallback). */
function writeState(state) {
  const file = statePath();
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  const body = JSON.stringify(state);
  // The file can hold the user's own logo artwork; keep it owner-only on POSIX
  // (the mode is ignored on Windows).
  writeFileSync(tmp, body, { encoding: "utf8", mode: 0o600 });
  try {
    renameSync(tmp, file);
  } catch {
    // rename can fail on Windows while the target is transiently locked; a
    // direct write is safe for this single-process writer.
    writeFileSync(file, body, { encoding: "utf8", mode: 0o600 });
  }
}

// ── trust fence ────────────────────────────────────────────────────────────

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority) {
  try {
    return new URL(`http://${authority}`);
  } catch {
    return undefined;
  }
}

/** Whether a normalized URL hostname names the local loopback authority. */
function isLoopbackHostname(hostname) {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  return (
    parts.length === 4 &&
    parts[0] === "127" &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

/** Canonical authority form: hostname, or hostname:port when a port was written. */
function canonicalAuthority(entry, entryUrl) {
  const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
  return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}

/**
 * Assert one configured `trustedHosts` entry is a bare authority (`host` or
 * `host:port`) in canonical form. Anything WHATWG parsing would silently
 * rewrite is refused, so a misconfigured entry cannot quietly broaden the
 * grant. The list arrives from webRuntime (already validated by dsh-web-app);
 * this is a defensive second check that fails loud on a broken value.
 */
function assertTrustedAuthority(entry) {
  const entryUrl = parseAuthority(entry);
  if (entryUrl !== undefined && canonicalAuthority(entry, entryUrl) === entry.toLowerCase()) return;
  throw new Error(
    `changhai-brand-setting: trustedHosts entry ${JSON.stringify(entry)} is not a bare host[:port] authority`,
  );
}

/** Whether the request authority matches a trustedHosts entry (exact or port-less). */
function isTrustedAuthority(hostUrl, trustedHosts) {
  return trustedHosts.some((entry) => {
    assertTrustedAuthority(entry);
    const entryUrl = parseAuthority(entry);
    if (entryUrl === undefined) return false;
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host;
  });
}

/**
 * Decide whether one request may reach the plugin routes.
 * @param req - node HTTP request facts (headers).
 * @param trustedHosts - non-loopback authorities this deployment serves.
 * @returns true when the Host is ours (loopback or trusted) and browser markers are same-origin.
 */
function isTrustedApiRequest(req, trustedHosts) {
  const host = typeof req.headers.host === "string" ? req.headers.host : undefined;
  if (host === undefined) return false;
  const hostUrl = parseAuthority(host);
  if (hostUrl === undefined) return false;
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

// ── JSON body / response helpers ───────────────────────────────────────────

/** Sentinel: the request body exceeded MAX_BODY_BYTES (respond 413, not 400). */
const PAYLOAD_TOO_LARGE = Symbol("payload-too-large");

/**
 * Read a JSON request body, capped at MAX_BODY_BYTES.
 * @returns the parsed body, `null` when not valid JSON, or PAYLOAD_TOO_LARGE.
 */
function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES && !aborted) {
        aborted = true;
        req.destroy();
        resolve(PAYLOAD_TOO_LARGE);
        return;
      }
      if (!aborted) chunks.push(chunk);
    });
    req.on("end", () => {
      if (aborted) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        resolve(null);
      }
    });
    req.on("error", () => {
      if (!aborted) resolve(null);
    });
  });
}

/** Write a JSON response with the given status code. */
function writeJson(res, status, value) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

/** One failure envelope. */
function fail(status, code, message) {
  return { status, body: { ok: false, error: { code, message } } };
}

/**
 * Apply one patch onto the current state: allowlisted string keys only, null
 * removes the key, anything else is dropped. Returns the merged state.
 */
function mergePatch(patch) {
  const next = readState();
  for (const [key, value] of Object.entries(patch)) {
    if (!STATE_KEYS.has(key)) continue;
    if (value === null) {
      delete next[key];
      continue;
    }
    if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) continue;
    next[key] = value;
  }
  return next;
}

/** Handle one fenced API request. */
async function handleApi(req, res, diagnostics) {
  if (req.method !== "POST") {
    const { status, body } = fail(405, "method-error", "method not allowed");
    writeJson(res, status, body);
    return;
  }
  // Content-type fence: only JSON bodies are meaningful here, so a cross-site
  // form POST cannot be parsed as `{}` and mis-handled.
  const contentType =
    typeof req.headers["content-type"] === "string" ? req.headers["content-type"].toLowerCase() : "";
  if (!contentType.startsWith("application/json")) {
    const { status, body } = fail(415, "unsupported-media-type", "content-type must be application/json");
    writeJson(res, status, body);
    return;
  }
  const payload = await readJsonBody(req);
  if (payload === PAYLOAD_TOO_LARGE) {
    const { status, body } = fail(413, "payload-too-large", "request body too large");
    writeJson(res, status, body);
    return;
  }
  if (payload === null || typeof payload !== "object" || typeof payload.method !== "string") {
    const { status, body } = fail(400, "bad-request", "bad request");
    writeJson(res, status, body);
    return;
  }
  if (payload.method === "get") {
    writeJson(res, 200, { ok: true, value: readState() });
    return;
  }
  if (payload.method === "status") {
    // Diagnostics for the one question users actually hit: "is the browser half
    // wired up?". The client row is read from the live module graph, which is
    // what decides whether the page will fetch this package's bundle at all.
    writeJson(res, 200, { ok: true, value: diagnostics() });
    return;
  }
  if (payload.method === "set") {
    if (payload.patch === null || typeof payload.patch !== "object" || Array.isArray(payload.patch)) {
      const { status, body } = fail(400, "bad-request", "patch must be a plain object");
      writeJson(res, status, body);
      return;
    }
    const next = mergePatch(payload.patch);
    writeState(next);
    writeJson(res, 200, { ok: true, value: next });
    return;
  }
  const { status, body } = fail(404, "not-found", `unknown method "${payload.method}"`);
  writeJson(res, status, body);
}

/**
 * Host loader entry: mount the fenced persistence API.
 * @param ctx - host cordis context (webServer, webRuntime).
 */
export function apply(ctx) {
  /** Read this package's row out of the live client module graph. */
  const clientRow = () => {
    try {
      const registry = ctx.get("clientModules");
      if (registry === undefined) return { registered: false, reason: "client module system absent" };
      const graph = registry.graph();
      const row = graph.entries.find((entry) => entry.id === "changhai-brand-setting");
      if (row === undefined) return { registered: false, reason: "row not composed" };
      return { registered: true, url: row.url, rev: row.rev };
    } catch (error) {
      return { registered: false, reason: String(error?.message ?? error) };
    }
  };
  const diagnostics = () => ({ file: statePath(), client: clientRow() });

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: "prefix",
        path: API_PREFIX,
        handler: async (req, res) => {
          if (!isTrustedApiRequest(req, ctx.webRuntime.trustedHosts)) {
            writeJson(res, 403, { ok: false, error: { code: "forbidden", message: "forbidden" } });
            return;
          }
          try {
            await handleApi(req, res, diagnostics);
          } catch (error) {
            // Never echo internals back to the page: the trusted origin does not
            // need filesystem paths or stack frames.
            console.error("[changhai-brand-setting] persistence API error:", error);
            writeJson(res, 500, { ok: false, error: { code: "internal", message: "internal error" } });
          }
        },
      }),
    "changhai-brand-setting: persistence API route",
  );
}

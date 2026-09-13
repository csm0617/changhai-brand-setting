/**
 * Browser-half smoke test.
 *
 * The browser half ships as a plain CJS bundle for the shell's lazy module
 * table, so it can be executed here inside a simulated shell: a captured
 * `window.__ModuleLoader__.load` definition, a fake cordis context, a fake
 * DOM, and the real React the shell resolves `require("react")` to.
 *
 * What it proves:
 *   - `apply()` runs to completion against the declared contracts;
 *   - the Brand settings page registers into `settings.section`;
 *   - brand slots are claimed ONLY for surfaces that differ from the shipped
 *     presentation, and released again when the master switch goes off;
 *   - every registered component renders without throwing;
 *   - the tab-title substitution actually rewrites document.title.
 *
 * Run: node --test tests/
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(HERE, "..", "lib", "client.js");

/** Candidate module trees holding the React the shell's module table provides. */
const MODULE_TREES = [
  process.env.DSH_WEB_MODULES,
  join(process.env.DSH_HOME ?? join(homedir(), ".dsh"), "profiles", "web", "node_modules"),
  join(HERE, "..", "node_modules"),
].filter((entry) => typeof entry === "string" && entry.length > 0);

/** Resolve React from whichever module tree has it, or null. */
function loadReact() {
  for (const root of MODULE_TREES) {
    try {
      return createRequire(join(root, "noop.js"))("react");
    } catch {
      // try the next tree
    }
  }
  return null;
}

const React = loadReact();

/** The client bundle's factory, captured from the loader envelope. */
function loadFactory(window) {
  let definition = null;
  window.__ModuleLoader__ = {
    load: (value) => {
      definition = value;
    },
  };
  const source = readFileSync(BUNDLE, "utf8");
  // The envelope is an expression statement over `window`; evaluate it with the
  // bundle's own `window` in scope so its factory closes over the same object
  // the test drives.
  new Function("window", `${source}\n`)(window);
  assert.equal(definition?.id, "changhai-brand-setting", "bundle declares the plugin id");
  return definition.factory;
}

/** Minimal DOM good enough for the substitution paths. */
function createDom() {
  const elements = [];
  /** The box a node with no layout supplied reports. */
  const ZERO_BOX = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  const makeElement = (tag) => {
    const element = {
      tagName: String(tag).toUpperCase(),
      childElementCount: 0,
      style: {},
      textContent: "",
      isConnected: false,
      parentElement: null,
      attributes: {},
      children: [],
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      getAttribute(name) {
        return this.attributes[name] ?? null;
      },
      /** A node is in the document when its root is the captured body. */
      get connectedTo() {
        return this._body ?? null;
      },
      appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      /** Insert `node` directly after this element, the way Element.after does. */
      after(node) {
        const parent = this.parentElement;
        if (parent === null || parent === undefined) return;
        const index = parent.children.indexOf(this);
        // A re-insert of a node already in this parent has to move it, not clone it.
        const existing = parent.children.indexOf(node);
        if (existing >= 0) parent.children.splice(existing, 1);
        parent.children.splice(index + 1, 0, node);
        node.parentElement = parent;
      },
      remove() {
        const parent = this.parentElement;
        if (parent === null || parent === undefined) return;
        const index = parent.children.indexOf(this);
        if (index >= 0) parent.children.splice(index, 1);
        this.parentElement = null;
        this.isConnected = false;
      },
      get previousElementSibling() {
        const parent = this.parentElement;
        if (parent === null || parent === undefined) return null;
        const index = parent.children.indexOf(this);
        return index > 0 ? parent.children[index - 1] : null;
      },
      addEventListener() {},
      click() {},
      getContext() {
        return { drawImage() {} };
      },
      toDataURL() {
        return "data:image/png;base64,AA==";
      },
      /** Scoped search, matching what the production code asks of an element. */
      querySelector(selector) {
        return descendants(this, selector)[0] ?? null;
      },
      querySelectorAll(selector) {
        return descendants(this, selector);
      },
      /** Layout box, when a test supplied one; an all-zero box otherwise. */
      getBoundingClientRect() {
        return this.layout ?? ZERO_BOX;
      },
    };
    elements.push(element);
    return element;
  };
  /** Every descendant of `root` matching a selector, in document order. */
  const descendants = (root, selector) => {
    const found = [];
    const walk = (node) => {
      for (const child of node.children ?? []) {
        if (matches(child, selector)) found.push(child);
        walk(child);
      }
    };
    walk(root);
    return found;
  };
  const visit = descendants;
  /** Attribute-presence, class-substring and bare tag selectors — all this bundle asks for. */
  const matches = (element, selector) => {
    // Checked before the generic attribute form: `[class*="x"]` has a `*` that
    // the `[name]`/`[name="v"]` pattern below would not consume.
    const byClass = /^\[class\*="([^"]*)"\]$/.exec(selector);
    if (byClass !== null) return String(element.getAttribute("class") ?? "").includes(byClass[1]);
    const attribute = /^\[([^\]=]+)(?:="([^"]*)")?\]$/.exec(selector);
    if (attribute !== null) {
      const value = element.getAttribute(attribute[1]);
      return attribute[2] === undefined ? value !== null : value === attribute[2];
    }
    return element.tagName === selector.toUpperCase();
  };
  const body = makeElement("body");
  const document = {
    title: "A session - DeepSeek Harness",
    head: makeElement("head"),
    body,
    createElement: makeElement,
    querySelector: (selector) => visit(body, selector, [])[0] ?? null,
    querySelectorAll: (selector) => visit(body, selector, []),
    createTreeWalker: () => ({ nextNode: () => null }),
    /**
     * Layout stand-in. Elements carry an explicit `layout` box (set by the tests
     * that care), and a Range over an element's contents reports that element's
     * own text box — which is what the alignment code measures to find where the
     * centred headline's glyphs actually start.
     */
    createRange: () => ({
      node: null,
      selectNodeContents(node) {
        this.node = node;
      },
      getBoundingClientRect() {
        return this.node?.layout ?? ZERO_BOX;
      },
    }),
  };
  return { document, makeElement, body, visit };
}

/**
 * The blank-session hero as the shell renders it around the marked slot: a
 * headline row holding the slot host and the two text spans this plugin
 * substitutes, all inside the stack that also carries the composer below.
 *
 * The shape mirrors the live DOM measured on 127.0.0.1:3081 — the mark anchor
 * sits in a `display: contents` slot host inside a hitbox, two levels below the
 * headline row, and the tagline's insertion point is `row.after(...)` inside the
 * stack. The shipped copy is the locale key itself, because the test's fake
 * locale service translates to `<namespace key>`.
 */
function installHeroRow(dom) {
  const { makeElement, document, body } = dom;
  const anchor = makeElement("span");
  anchor.setAttribute("data-dsh-brand-mark", "hero");
  const host = makeElement("span");
  host.appendChild(anchor);
  const headline = makeElement("span");
  headline.setAttribute("class", "pXSMma_headlineText");
  headline.textContent = "hero.headline";
  const badge = makeElement("span");
  badge.setAttribute("class", "pXSMma_previewBadge");
  badge.textContent = "hero.preview";
  const row = makeElement("div");
  row.setAttribute("class", "pXSMma_headline");
  for (const child of [host, headline, badge]) row.appendChild(child);
  const composer = makeElement("div");
  composer.setAttribute("class", "pXSMma_body");
  const stack = makeElement("div");
  stack.setAttribute("class", "pXSMma_stack");
  stack.appendChild(row);
  stack.appendChild(composer);
  body.appendChild(stack);
  for (const element of [anchor, host, headline, badge, row, composer, stack, body]) element.isConnected = true;
  // Layout boxes matching the live shell's centred hero: the row spans 696px and
  // the headline text is inset from its left edge, which is the inset the
  // "align to title" mode measures. Tests move `headline.layout` to stand in for
  // a title of a different length.
  row.layout = { left: 420, top: 256, right: 1116, bottom: 290, width: 696, height: 34 };
  // `layout` is read through a Range over the headline's contents, so give the
  // element the same box (the real Range covers the glyphs, which for a leaf
  // text span is the element's own box).
  headline.layout = { left: 682, top: 257, right: 848, bottom: 289, width: 166, height: 32 };
  return { anchor, host, row, headline, badge, composer, stack };
}

/**
 * Fake cordis client context over a fixed set of declared slots.
 * @param declared - slot keys the shell has declared.
 */
function createCtx(declared) {
  const registrations = [];
  const handlers = new Map();
  const effects = [];
  const ctx = {
    effect(callback, label) {
      const dispose = callback();
      effects.push({ label, dispose: typeof dispose === "function" ? dispose : null });
      return () => {
        if (typeof dispose === "function") dispose();
      };
    },
    on(event, callback) {
      handlers.set(event, callback);
      return () => handlers.delete(event);
    },
    slots: {
      inject(key, callback) {
        if (!declared.has(key)) return () => {};
        const dispose = callback();
        return () => {
          if (typeof dispose === "function") dispose();
        };
      },
      register(options, component) {
        const registration = { options, component };
        registrations.push(registration);
        return () => {
          const index = registrations.indexOf(registration);
          if (index >= 0) registrations.splice(index, 1);
        };
      },
    },
    locale: {
      register() {
        return () => {};
      },
      bind() {
        return (key) => key;
      },
    },
  };
  return { ctx, registrations, effects, handlers };
}

/** Boot the bundle against a fake shell. */
function boot({ declared, hero } = {}) {
  const dom = createDom();
  const heroRow = hero === true ? installHeroRow(dom) : null;
  const frames = [];
  const calls = [];
  /** Listeners the plugin attached, keyed by event name. */
  const listeners = new Map();
  const window = {
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    setTimeout: (callback) => setTimeout(callback, 0),
    clearTimeout: (handle) => clearTimeout(handle),
    addEventListener: (type, handler) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener: (type, handler) => {
      listeners.get(type)?.delete(handler);
    },
    /** Fire one event, as the browser would. */
    dispatch: (type) => {
      for (const handler of [...(listeners.get(type) ?? [])]) handler({ type });
    },
  };
  const localStorage = {
    store: new Map(),
    getItem(key) {
      return this.store.has(key) ? this.store.get(key) : null;
    },
    setItem(key, value) {
      this.store.set(key, String(value));
    },
    removeItem(key) {
      this.store.delete(key);
    },
  };
  window.localStorage = localStorage;
  window.document = dom.document;

  const previous = {
    window: globalThis.window,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    fetch: globalThis.fetch,
    MutationObserver: globalThis.MutationObserver,
    NodeFilter: globalThis.NodeFilter,
    Image: globalThis.Image,
  };
  globalThis.window = window;
  globalThis.document = dom.document;
  globalThis.localStorage = localStorage;
  globalThis.NodeFilter = { SHOW_TEXT: 4 };
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  globalThis.Image = class {};
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, value: {} }) };
  };

  const shell = { registrations: null };
  const exports = loadFactory(window)((name) => {
    if (name === "react") return React;
    throw new Error(`unexpected require(${JSON.stringify(name)})`);
  });
  const { ctx, registrations } = createCtx(
    declared ?? new Set([
      "settings.section",
      "sidebar.brand.mark",
      "sidebar.brand.name",
      "conversation.hero.brand.mark",
    ]),
  );
  shell.registrations = registrations;
  exports.apply(ctx);

  return {
    dom,
    heroRow,
    window,
    calls,
    registrations,
    flushFrames() {
      while (frames.length > 0) frames.shift()();
    },
    /** Let the async host hydration and any debounce settle before teardown. */
    settle() {
      return new Promise((resolve) => setImmediate(resolve));
    },
    restore() {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    },
  };
}

/** Composed props for one registration, the way the renderer builds them. */
function propsFor(registration, brand) {
  const options = registration.options;
  const face = typeof options.inject === "function" ? options.inject() : {};
  const hooks = face.hooks ?? {};
  const composed = { ...face };
  delete composed.hooks;
  for (const [name, source] of Object.entries(hooks)) {
    const prop = `use${name[0].toUpperCase()}${name.slice(1)}`;
    composed[prop] = (selector) => selector(source.getSnapshot());
  }
  return { ...composed, size: 24, className: "", t: (key) => key, close: () => {}, ...brand };
}

test("registers the Brand settings page and no brand slots by default", { skip: React === null }, async () => {
  const shell = boot();
  try {
    const sections = shell.registrations.filter((entry) => entry.options.name === "settings.section");
    assert.equal(sections.length, 1);
    assert.equal(sections[0].options.id, "changhai-brand-setting");
    assert.equal(sections[0].options.locale, "changhai-brand-setting");
    assert.equal(
      shell.registrations.filter((entry) => entry.options.name.startsWith("sidebar.brand")).length,
      0,
      "the shipped brand stays untouched while nothing is configured",
    );
    assert.equal(shell.window.__DSH_BRAND.slots().length, 0);
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("claims exactly the configured slots and renders every occupant", { skip: React === null }, async () => {
  const shell = boot();
  try {
    shell.window.__DSH_BRAND.set({
      enabled: "1",
      logoKind: "text",
      logoText: "长海",
      logoSize: "28",
      nameKind: "text",
      nameText: "changhai",
      nameColor: "#ff8800",
    });
    assert.deepEqual(shell.window.__DSH_BRAND.slots(), [
      "sidebar.brand.mark",
      "conversation.hero.brand.mark",
      "sidebar.brand.name",
    ]);

    const occupied = shell.registrations.filter((entry) => entry.options.name !== "settings.section");
    assert.equal(occupied.length, 3);
    for (const registration of occupied) {
      assert.equal(registration.options.priority, -100, "occupants shadow the shipped priority 0 cell");
      const element = registration.component(propsFor(registration));
      assert.ok(element !== null && typeof element === "object", "occupant renders an element");
    }

    const nameOccupant = occupied.find((entry) => entry.options.name === "sidebar.brand.name");
    const name = nameOccupant.component(propsFor(nameOccupant));
    assert.equal(name.props.children, "changhai");
    assert.equal(name.props.style.color, "#ff8800");
    assert.equal(name.props.style.fontSize, "18px");

    const markOccupant = occupied.find((entry) => entry.options.name === "sidebar.brand.mark");
    const mark = markOccupant.component(propsFor(markOccupant));
    assert.equal(mark.props["data-dsh-brand-mark"], "sidebar");
    assert.equal(mark.props.children, "长海");
    assert.equal(mark.props.style.width, "28px");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("shows the built-in logo by default, replaced by a picked image", { skip: React === null }, async () => {
  const shell = boot();
  try {
    const occupied = () => shell.registrations.filter((entry) => entry.options.name !== "settings.section");
    const find = (name) => occupied().find((entry) => entry.options.name === name);

    // A fresh install, with nothing configured but the master switch: the mark is
    // the image this plugin ships, at both the sidebar and hero slots.
    shell.window.__DSH_BRAND.set({ enabled: "1" });
    assert.deepEqual(shell.window.__DSH_BRAND.slots(), [
      "sidebar.brand.mark",
      "conversation.hero.brand.mark",
    ]);
    const mark = find("sidebar.brand.mark");
    const defaultSrc = mark.component(propsFor(mark)).props.src;
    assert.ok(
      typeof defaultSrc === "string" && defaultSrc.startsWith("data:image/png;base64,"),
      "the shipped mark is an embedded PNG",
    );
    assert.ok(defaultSrc.length > 1000, "…and it is the real artwork, not a stub");

    // Picking an image replaces the built-in one.
    shell.window.__DSH_BRAND.set({ logoImage: "data:image/png;base64,AA==" });
    assert.equal(mark.component(propsFor(mark)).props.src, "data:image/png;base64,AA==");

    // The text source still works and still takes precedence over the built-in
    // image once chosen explicitly.
    shell.window.__DSH_BRAND.set({ logoKind: "text", logoText: "长海", logoImage: "" });
    assert.equal(mark.component(propsFor(mark)).props.children, "长海");

    // "shipped" hands the slot back to the official occupant entirely.
    shell.window.__DSH_BRAND.set({ logoKind: "shipped" });
    assert.deepEqual(shell.window.__DSH_BRAND.slots(), []);
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("renders the settings page with the shipped hero copy as placeholder", { skip: React === null }, async () => {
  const shell = boot();
  try {
    const section = shell.registrations.find((entry) => entry.options.name === "settings.section");
    const element = section.component(propsFor(section, { shippedHeadline: "探索未至之境", shippedBadge: "预览版" }));
    assert.ok(element !== null);
    const text = JSON.stringify(element);
    assert.ok(text.includes("探索未至之境"), "headline placeholder carries the shipped copy");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("releases the slots and restores the shipped brand when switched off", { skip: React === null }, async () => {
  const shell = boot();
  try {
    shell.window.__DSH_BRAND.set({ enabled: "1", logoKind: "image", logoImage: "data:image/png;base64,AA==" });
    assert.equal(shell.registrations.filter((entry) => entry.options.name !== "settings.section").length, 2);
    shell.window.__DSH_BRAND.set({ enabled: "" });
    assert.equal(shell.registrations.filter((entry) => entry.options.name !== "settings.section").length, 0);
    shell.window.__DSH_BRAND.reset();
    assert.deepEqual(shell.window.__DSH_BRAND.get(), {});
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("substitutes the product name in the tab title", { skip: React === null }, async () => {
  const shell = boot();
  try {
    shell.dom.document.title = "A session - DeepSeek Harness";
    shell.window.__DSH_BRAND.set({ title: "长海" });
    shell.flushFrames();
    assert.equal(shell.dom.document.title, "A session - 长海");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("substitutes the hero headline and hides the badge, then restores both", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { headline, badge } = shell.heroRow;
    shell.window.__DSH_BRAND.set({ enabled: "1", heroHeadline: "向未知而行", badgeKind: "none" });
    shell.flushFrames();
    assert.equal(headline.textContent, "向未知而行", "headline carries the custom copy");
    assert.equal(badge.textContent, "", "hidden badge is blanked");
    assert.equal(badge.style.display, "none", "hidden badge is taken out of the flow");

    shell.window.__DSH_BRAND.set({ heroHeadline: "" });
    shell.flushFrames();
    assert.equal(headline.textContent, "hero.headline", "clearing the field restores the shipped copy");

    shell.window.__DSH_BRAND.set({ badgeKind: "text", badgeText: "限定版" });
    shell.flushFrames();
    assert.equal(badge.textContent, "限定版");
    assert.equal(badge.style.display, "", "a text badge stays in the flow");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("shows the built-in tagline by default, and places it under the headline", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { stack, row } = shell.heroRow;
    const tagline = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]");

    assert.equal(tagline(), null, "nothing is written while the brand is off");

    // The tagline ships with copy of its own: enabling the brand is enough to
    // show it, with no value ever typed into the field.
    shell.window.__DSH_BRAND.set({ enabled: "1" });
    shell.flushFrames();
    const node = tagline();
    assert.ok(node !== null, "the built-in tagline appears once the brand is on");
    assert.equal(node.textContent, "创新求变破困局，冲上山头论英雄", "…and it is the shipped line");
    assert.ok(node.parentElement === stack, "the tagline lives in the headline's own container");
    assert.ok(node.previousElementSibling === row, "the tagline sits directly below the headline row");
    assert.ok(
      stack.children.indexOf(node) < stack.children.indexOf(shell.heroRow.composer),
      "the tagline stays above the composer",
    );

    // A typed value replaces the built-in line rather than adding to it.
    shell.window.__DSH_BRAND.set({ heroTagline: "让每一次对话都通向未来" });
    shell.flushFrames();
    assert.equal(tagline().textContent, "让每一次对话都通向未来");
    assert.equal(shell.dom.document.querySelectorAll("[data-dsh-brand-tagline]").length, 1, "still one node");

    // Clearing goes back to the built-in line — it does NOT hide the tagline.
    shell.window.__DSH_BRAND.set({ heroTagline: "" });
    shell.flushFrames();
    assert.equal(tagline().textContent, "创新求变破困局，冲上山头论英雄", "clearing restores the shipped line");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("removes the tagline only when it is explicitly hidden", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { stack } = shell.heroRow;
    const tagline = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]");

    shell.window.__DSH_BRAND.set({ enabled: "1" });
    shell.flushFrames();
    assert.ok(tagline() !== null, "shown by default");

    // The one way to get rid of the line: an explicit hide, since an empty field
    // now means "use the shipped copy".
    shell.window.__DSH_BRAND.set({ taglineHidden: "1" });
    shell.flushFrames();
    assert.equal(tagline(), null, "hiding removes the node outright");
    assert.equal(stack.children.length, 2, "the stack is back to headline + composer");

    // …and unhiding brings it straight back.
    shell.window.__DSH_BRAND.set({ taglineHidden: "" });
    shell.flushFrames();
    assert.equal(tagline().textContent, "创新求变破困局，冲上山头论英雄", "unhiding restores the line");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("applies the tagline size and colour, defaulting to the theme colour", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const style = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]").getAttribute("style");

    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语" });
    shell.flushFrames();
    assert.ok(style().includes("font-size:14px"), "an unset size uses the default");
    assert.ok(style().includes("var(--dsw-alias-label-tertiary)"), "an unset colour follows the theme");

    shell.window.__DSH_BRAND.set({ taglineSize: "22", taglineColor: "#ff8800" });
    shell.flushFrames();
    assert.ok(style().includes("font-size:22px"), "the configured size is applied");
    assert.ok(style().includes("color:#ff8800"), "the configured colour is applied");

    // Out-of-range sizes are clamped rather than passed through.
    shell.window.__DSH_BRAND.set({ taglineSize: "400" });
    shell.flushFrames();
    assert.ok(style().includes("font-size:28px"), "an oversized value clamps to the maximum");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("leaves no tagline node while the master switch is off", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const tagline = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]");

    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语" });
    shell.flushFrames();
    assert.ok(tagline() !== null, "the tagline appears while the brand is on");

    shell.window.__DSH_BRAND.set({ enabled: "" });
    shell.flushFrames();
    assert.equal(tagline(), null, "switching the brand off removes the tagline too");

    // And the setting itself survives the round trip: turning it back on restores it.
    shell.window.__DSH_BRAND.set({ enabled: "1" });
    shell.flushFrames();
    assert.equal(tagline().textContent, "标语", "the saved tagline comes back with the switch");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("reuses one tagline node across syncs instead of duplicating it", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const nodes = () => shell.dom.document.querySelectorAll("[data-dsh-brand-tagline]");
    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "一" });
    shell.flushFrames();
    const first = nodes()[0];
    // Several passes stand in for the observer firing on its own writes: the
    // synthesized node must be reused, never re-created (that would be an
    // unbounded mutation loop in the live page).
    shell.flushFrames();
    shell.window.__DSH_BRAND.set({ heroTagline: "二" });
    shell.flushFrames();
    shell.flushFrames();
    assert.equal(nodes().length, 1, "exactly one tagline node exists");
    assert.equal(nodes()[0], first, "the same node instance is reused");
    assert.equal(nodes()[0].textContent, "二", "the reused node carries the new text");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("picks the innermost headline holder, not an outer wrapper", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { stack, row, composer } = shell.heroRow;
    // The hero stack also contains the headline; a naive "any element containing a
    // headline" lookup would pick it and drop the tagline below the composer.
    assert.ok(stack.querySelector('[class*="headlineText"]') !== null, "the stack does contain a headline");

    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语" });
    shell.flushFrames();
    const node = shell.dom.document.querySelector("[data-dsh-brand-tagline]");
    assert.ok(node !== null);
    assert.ok(node.parentElement === stack, "the tagline's parent is the stack (the row's parent)");
    assert.ok(node.previousElementSibling === row, "…and it follows the headline row itself");
    assert.equal(
      stack.children.indexOf(composer) - stack.children.indexOf(node),
      1,
      "the tagline sits immediately above the composer, not past it",
    );
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("hangs the tagline off the headline's left edge, never moving the headline", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { row, headline } = shell.heroRow;
    const style = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]").getAttribute("style");

    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语" });
    shell.flushFrames();
    // Aligned to the title is now the shipped default, so the inset is measured
    // without anyone choosing that mode.
    assert.ok(style().includes("text-align:left"), "the default alignment is left (aligned to the title)");
    assert.ok(style().includes("padding-left:262px"), "…with the measured title offset");
    // The whole point of the feature: the headline is never touched.
    assert.equal(row.style.justifyContent ?? "", "", "the headline row keeps the shipped centring");

    // The headline text sits 262px in from the row's left edge (682 - 420).
    shell.window.__DSH_BRAND.set({ taglineAlign: "center" });
    shell.flushFrames();
    assert.ok(style().includes("text-align:center"), "choosing the shipped centring switches the line to centre");
    assert.ok(style().includes("padding-left:0px"), "…and drops the inset");
    assert.equal(row.style.justifyContent ?? "", "", "the headline is still untouched");

    shell.window.__DSH_BRAND.set({ taglineAlign: "" });
    shell.flushFrames();
    assert.ok(style().includes("text-align:left"), "clearing the choice restores the aligned-to-title default");
    assert.ok(style().includes("padding-left:262px"), "…with the inset measured again");
    // The headline keeps its own layout throughout; the node is gone from it.
    assert.equal(headline.style.textAlign ?? "", "", "the headline text is never restyled");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("re-measures the title offset when the headline is a different length", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const { headline } = shell.heroRow;
    const style = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]").getAttribute("style");

    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语", taglineAlign: "title" });
    shell.flushFrames();
    assert.ok(style().includes("padding-left:262px"), "the initial title length gives a 262px inset");

    // A longer title is centred less far from the row's left edge; the inset has
    // to follow the rendered glyphs, not a value baked in when it was configured.
    headline.layout = { left: 578, top: 257, right: 958, bottom: 289, width: 380, height: 32 };
    // Relayouting the title is not a DOM mutation the observer can see, so the
    // plugin needs the resize signal to know it must re-measure.
    shell.window.dispatch("resize");
    shell.flushFrames();
    assert.ok(style().includes("padding-left:158px"), "a longer title yields the smaller measured inset");

    // And back again, for a shorter title than either.
    headline.layout = { left: 739, top: 257, right: 905, bottom: 289, width: 166, height: 32 };
    shell.window.dispatch("resize");
    shell.flushFrames();
    assert.ok(style().includes("padding-left:319px"), "a shorter title yields the larger inset");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("stops listening for layout changes once the observer is torn down", { skip: React === null }, async () => {
  const shell = boot({ hero: true });
  try {
    const style = () => shell.dom.document.querySelector("[data-dsh-brand-tagline]").getAttribute("style");
    shell.window.__DSH_BRAND.set({ enabled: "1", heroTagline: "标语", taglineAlign: "title" });
    shell.flushFrames();
    assert.ok(style().includes("padding-left:262px"));

    // With the brand off there is no tagline and no listener work to do; a resize
    // must not resurrect the node.
    shell.window.__DSH_BRAND.set({ enabled: "" });
    shell.flushFrames();
    assert.equal(shell.dom.document.querySelector("[data-dsh-brand-tagline]"), null);
    shell.window.dispatch("resize");
    shell.flushFrames();
    assert.equal(
      shell.dom.document.querySelector("[data-dsh-brand-tagline]"),
      null,
      "a resize after switching the brand off leaves no tagline behind",
    );
  } finally {
    await shell.settle();
    shell.restore();
  }
});

test("hydrates from the host persistence API on start", { skip: React === null }, async () => {
  const shell = boot();
  try {
    assert.equal(shell.calls.length, 1);
    assert.equal(shell.calls[0].url, "/changhai-brand-setting/api");
    assert.equal(shell.calls[0].body.method, "get");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

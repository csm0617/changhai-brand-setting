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
  assert.equal(definition?.id, "dsh-custom-brand", "bundle declares the plugin id");
  return definition.factory;
}

/** Minimal DOM good enough for the substitution paths. */
function createDom() {
  const elements = [];
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
      appendChild(child) {
        this.children.push(child);
        child.parentElement = this;
        return child;
      },
      addEventListener() {},
      click() {},
      getContext() {
        return { drawImage() {} };
      },
      toDataURL() {
        return "data:image/png;base64,AA==";
      },
      querySelectorAll() {
        return [];
      },
    };
    elements.push(element);
    return element;
  };
  const document = {
    title: "A session - DeepSeek Harness",
    head: makeElement("head"),
    body: makeElement("body"),
    createElement: makeElement,
    querySelector: () => null,
    querySelectorAll: () => [],
    createTreeWalker: () => ({ nextNode: () => null }),
  };
  return { document, makeElement };
}

/**
 * The blank-session hero as the shell renders it around the marked slot: a
 * headline row holding the slot host and the two text spans this plugin
 * substitutes. The shipped copy is the locale key itself, because the test's
 * fake locale service translates to `<namespace key>`.
 */
function installHeroRow(dom) {
  const { makeElement, document } = dom;
  const anchor = makeElement("span");
  anchor.setAttribute("data-dsh-brand-mark", "hero");
  const host = makeElement("span");
  host.appendChild(anchor);
  const headline = makeElement("span");
  headline.textContent = "hero.headline";
  const badge = makeElement("span");
  badge.textContent = "hero.preview";
  const row = makeElement("div");
  row.children = [host, headline, badge];
  for (const child of row.children) child.parentElement = row;
  row.querySelectorAll = () => [host, headline, badge];
  for (const element of [anchor, host, headline, badge, row]) element.isConnected = true;
  document.querySelector = (selector) => (selector === '[data-dsh-brand-mark="hero"]' ? anchor : null);
  return { anchor, host, row, headline, badge };
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
  const window = {
    requestAnimationFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelAnimationFrame: () => {},
    setTimeout: (callback) => setTimeout(callback, 0),
    clearTimeout: (handle) => clearTimeout(handle),
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
    assert.equal(sections[0].options.id, "custom-brand");
    assert.equal(sections[0].options.locale, "custom-brand");
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

test("falls back to the text value when an image source has no image yet", { skip: React === null }, async () => {
  const shell = boot();
  try {
    // Logo kind is "image" but nothing was picked (or it was cleared): the mark
    // must show the text value instead of leaving an empty box.
    shell.window.__DSH_BRAND.set({ enabled: "1", logoKind: "image", logoText: "长海", nameKind: "image", nameText: "changhai" });
    const occupied = shell.registrations.filter((entry) => entry.options.name !== "settings.section");
    const mark = occupied.find((entry) => entry.options.name === "sidebar.brand.mark");
    const name = occupied.find((entry) => entry.options.name === "sidebar.brand.name");
    assert.equal(mark.component(propsFor(mark)).props.children, "长海");
    assert.equal(name.component(propsFor(name)).props.children, "changhai");

    // A picked image wins over the text value.
    shell.window.__DSH_BRAND.set({ logoImage: "data:image/png;base64,AA==" });
    assert.equal(mark.component(propsFor(mark)).props.src, "data:image/png;base64,AA==");
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

test("hydrates from the host persistence API on start", { skip: React === null }, async () => {
  const shell = boot();
  try {
    assert.equal(shell.calls.length, 1);
    assert.equal(shell.calls[0].url, "/custom-brand/api");
    assert.equal(shell.calls[0].body.method, "get");
  } finally {
    await shell.settle();
    shell.restore();
  }
});

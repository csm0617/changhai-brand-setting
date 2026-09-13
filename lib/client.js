// changhai-brand-setting — browser half (client plugin bundle).
//
// Loaded by dsh-client-modules at /plugins/changhai-brand-setting/client.js and
// executed through the vendored cordis Loader's lazy-CJS module table
// (window.__ModuleLoader__.load). The factory body is plain CJS with
// require() resolved against the shell's module table — the same shape the
// shipped ui-* packages' tsdown bundles emit. Only platform seed words
// ("react") and registered client bundles may be required.
//
// What this half does
// -------------------
// It fills the brand holes the Web shell already declares, instead of layering
// transparent overlays over the shipped artwork:
//
//   sidebar.brand.mark            the sidebar logo (wide row + collapsed rail)
//   sidebar.brand.name            the sidebar wordmark beside it
//   conversation.hero.brand.mark  the blank-session hero mark
//
// All three are `kind: 'single'` slots and @deepseek-ai/dsh-client-ui-brand-official
// already occupies the first two at the default priority (0). Slots shadow by
// priority — "the cell's lowest live entry renders" — so this plugin registers
// at a negative priority and wins the cell when the user turns a custom brand
// on, and registers NOTHING while it is off, which leaves the shipped brand,
// its fallbacks and its build badge exactly as they were.
//
// Two surfaces are not slots and are handled as guarded DOM substitutions,
// both opt-in and only while configured:
//   - the hero headline / preview badge (i18n strings compiled into
//     ui-conversation; the shipped text is read from the live locale
//     dictionary, never hardcoded), and
//   - document.title / the favicon of the browser tab.
//
// Preferences live in $DSH_HOME/changhai-brand-setting.json through the host half's
// fenced API (localStorage is only the first-paint seed: it is origin-scoped
// and DSH Desktop changes port on every launch).

window.__ModuleLoader__.load({
	id: "changhai-brand-setting",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const h = React.createElement;

		/** localStorage seed key (origin-scoped; the host file is authoritative). */
		const SEED_KEY = "dsh.changhai-brand-setting.v1";
		/** Host persistence route (see lib/index.js). */
		const API_PATH = "/changhai-brand-setting/api";
		/** Locale namespace owned by this plugin. */
		const NS = "changhai-brand-setting";
		/** Settings-section identity in the settings navigation. */
		const SECTION_ID = "changhai-brand-setting";
		/** nav order: right after the Appearance page dsh-dream-skin registers at 10. */
		const SECTION_ORDER = 15;
		/**
		 * Shadowing rank of every brand occupant. Lower renders first, so anything
		 * below the shipped occupants' default 0 replaces their presentation; a
		 * distinct priority is also what keeps the ledger from throwing on the
		 * occupied single cell.
		 */
		const BRAND_PRIORITY = -100;
		/** Namespace owning the shipped conversation copy this plugin substitutes. */
		const CONVERSATION_NS = "conversation";
		/** Product name the layout writes into document.title. */
		const DEFAULT_PRODUCT_NAME = "DeepSeek Harness";
		/** Longest edge of a stored raster image, in px (keeps the data URL small). */
		const MAX_IMAGE_EDGE = 512;
		/** Give up storing a brand image past this many characters of data URL. */
		const MAX_IMAGE_CHARS = 1_500_000;
		/** Write debounce for the host API. */
		const SAVE_DEBOUNCE_MS = 250;

		/** The four presentation sources a mark or a wordmark can come from. */
		const KINDS = ["shipped", "image", "text", "none"];
		/** Badge sources. */
		const BADGE_KINDS = ["shipped", "text", "none"];
		/**
		 * Tagline alignment. "center" is the shipped presentation (the line is
		 * centred under a centred title); "title" hangs it from the headline text's
		 * own left edge, which moves with the title's length.
		 */
		const TAGLINE_ALIGNS = ["center", "title"];

		const DEFAULT_LOGO_SIZE = 24;
		const DEFAULT_HERO_LOGO_SIZE = 34;
		const DEFAULT_NAME_SIZE = 18;
		const DEFAULT_NAME_WEIGHT = 600;
		const DEFAULT_NAME_SPACING = 0.04;
		const DEFAULT_TAGLINE_SIZE = 14;
		/**
		 * The tagline used when the field is left empty.
		 *
		 * Unlike every other surface here, the tagline ships with copy of its own:
		 * an empty field means "use this line", not "show nothing". Hiding the line
		 * is a separate, explicit choice (`taglineHidden`), which keeps the two
		 * intents from colliding inside one empty value.
		 */
		const DEFAULT_TAGLINE = "创新求变破困局，冲上山头论英雄";
		/**
		 * The mark this plugin ships with: the Changhai wave, as a PNG data URL.
		 *
		 * Embedded rather than read from disk so a fresh install is branded with no
		 * file of its own to carry, and it is the source image's own 50x51px — the
		 * image pipeline never upscales (see MAX_IMAGE_EDGE), so nothing is gained
		 * by resampling it here.
		 */
		const DEFAULT_LOGO_IMAGE =
			"data:image/png;base64,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";

		/** Marks the synthesized tagline node, so it is found again after a re-render. */
		const TAGLINE_ATTR = "data-dsh-brand-tagline";

		// ── settings model ───────────────────────────────────────────────────
		//
		// The store snapshot is the flat string map the host file holds: one
		// representation end to end, so persistence never has to serialize a
		// second shape. Accessors apply defaults and clamping.

		/** One setting as a trimmed string, or the fallback when unset. */
		function str(state, key, fallback) {
			const value = state[key];
			return typeof value === "string" && value !== "" ? value : fallback;
		}

		/** One setting as a number inside [min, max], or the fallback. */
		function num(state, key, fallback, min, max) {
			const value = Number(state[key]);
			if (!Number.isFinite(value)) return fallback;
			return Math.min(max, Math.max(min, value));
		}

		/** One enum setting, narrowed to its allowed values. */
		function oneOf(state, key, allowed, fallback) {
			const value = state[key];
			return typeof value === "string" && allowed.includes(value) ? value : fallback;
		}

		/**
		 * The logo source kind.
		 *
		 * Defaults to "image" because this plugin ships its own mark: a fresh
		 * install shows the Changhai wave rather than the official logo, and the
		 * stored value only ever records a deliberate departure from that.
		 */
		function logoKind(state) {
			return oneOf(state, "logoKind", KINDS, "image");
		}

		/** The wordmark source kind. */
		function nameKind(state) {
			return oneOf(state, "nameKind", KINDS, "shipped");
		}

		/** The hero badge source kind. */
		function badgeKind(state) {
			return oneOf(state, "badgeKind", BADGE_KINDS, "shipped");
		}

		/**
		 * Whether the master switch is on.
		 *
		 * The switch ships on, so an absent key means enabled rather than
		 * disabled: a fresh install is branded without anyone finding Settings
		 * first.
		 *
		 * The two explicit values are asymmetric on purpose. "0" is the opt-out
		 * this version writes. "" is what the previous version wrote when the
		 * switch was turned off, and it is still read as off: the old boolean
		 * lived in a key whose absence now means on, so honouring the stale ""
		 * is what keeps an existing user's choice from silently flipping.
		 */
		function enabled(state) {
			return state.enabled !== "0" && state.enabled !== "";
		}

		/**
		 * Which slots this configuration must occupy. A slot is claimed only when
		 * its presentation actually differs from the shipped one, so an untouched
		 * surface keeps the shell's own occupant and fallback.
		 * @returns slot names, stable-ordered.
		 */
		function occupancy(state) {
			if (!enabled(state)) return [];
			const slots = [];
			if (logoKind(state) !== "shipped") {
				slots.push("sidebar.brand.mark", "conversation.hero.brand.mark");
			}
			if (nameKind(state) !== "shipped") slots.push("sidebar.brand.name");
			return slots;
		}

		// ── store ────────────────────────────────────────────────────────────

		/**
		 * Minimal observable settings store: the same getSnapshot/subscribe
		 * currency the slot renderer binds `useBrand` from, plus whole-map writes
		 * that always publish a new frozen snapshot.
		 * @returns the store.
		 */
		function createStore() {
			let snapshot = Object.freeze({});
			const listeners = new Set();
			const emit = () => {
				for (const listener of [...listeners]) {
					try {
						listener();
					} catch (error) {
						console.error("[changhai-brand-setting] store listener failed", error);
					}
				}
			};
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				/** Replace the whole map (hydration from the durable file). */
				replace(next) {
					snapshot = Object.freeze({ ...next });
					emit();
				},
				/**
				 * Merge a patch; an empty string or null removes the key, so clearing
				 * a field restores its shipped default everywhere (file included).
				 */
				patch(patch) {
					const next = { ...snapshot };
					for (const [key, value] of Object.entries(patch)) {
						if (value === null || value === undefined || value === "") delete next[key];
						else next[key] = String(value);
					}
					snapshot = Object.freeze(next);
					emit();
				},
			};
		}

		/** Read the localStorage first-paint seed; `{}` when absent or unreadable. */
		function readSeed() {
			try {
				const raw = window.localStorage.getItem(SEED_KEY);
				if (raw === null) return {};
				const parsed = JSON.parse(raw);
				return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
			} catch {
				return {};
			}
		}

		/** Write the localStorage seed; a quota error is not worth breaking the UI. */
		function writeSeed(state) {
			try {
				window.localStorage.setItem(SEED_KEY, JSON.stringify(state));
			} catch (error) {
				console.warn("[changhai-brand-setting] could not seed localStorage", error);
			}
		}

		/** One fenced API call against the host half. */
		async function callHost(payload) {
			const response = await fetch(API_PATH, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(payload),
			});
			const body = await response.json().catch(() => null);
			if (!response.ok || body === null || body.ok !== true) {
				const message = body?.error?.message ?? `HTTP ${response.status}`;
				throw new Error(message);
			}
			return body.value;
		}

		// ── image picking ────────────────────────────────────────────────────

		/**
		 * Transient user-facing notices (a pick that could not be stored). Kept
		 * outside the settings store on purpose: a notice is not a preference and
		 * must never reach the durable file.
		 */
		const notices = (() => {
			let snapshot = "";
			const listeners = new Set();
			return {
				getSnapshot: () => snapshot,
				subscribe(listener) {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set(code) {
					if (snapshot === code) return;
					snapshot = code;
					for (const listener of [...listeners]) listener();
				},
			};
		})();

		/**
		 * Downscale a picked raster image so one logo fits comfortably in both
		 * stores. SVG and GIF pass through untouched (a canvas would rasterize the
		 * first and flatten the second).
		 * @param dataUrl - the FileReader result.
		 * @param done - receives the storable data URL, or null when unusable.
		 */
		function normalizeImage(dataUrl, done) {
			if (/^data:image\/(svg\+xml|gif)/i.test(dataUrl)) {
				done(dataUrl);
				return;
			}
			const image = new Image();
			image.onload = () => {
				try {
					const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
					const width = Math.max(1, Math.round(image.width * scale));
					const height = Math.max(1, Math.round(image.height * scale));
					const canvas = document.createElement("canvas");
					canvas.width = width;
					canvas.height = height;
					canvas.getContext("2d").drawImage(image, 0, 0, width, height);
					done(canvas.toDataURL("image/png"));
				} catch (error) {
					console.error("[changhai-brand-setting] image scaling failed", error);
					done(dataUrl);
				}
			};
			image.onerror = () => {
				console.error("[changhai-brand-setting] image could not be decoded");
				done(null);
			};
			image.src = dataUrl;
		}

		/**
		 * Open the file picker and hand the normalized data URL to `accept`. A pick
		 * that cannot be stored leaves a notice the settings page renders, instead
		 * of failing silently.
		 * @param accept - called with the data URL, or not at all on failure.
		 */
		function pickImage(accept) {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/gif";
			input.addEventListener(
				"change",
				() => {
					const file = input.files?.[0];
					if (file === undefined) return;
					const reader = new FileReader();
					reader.onload = () => {
						normalizeImage(String(reader.result), (dataUrl) => {
							if (dataUrl === null) {
								notices.set("decode");
								return;
							}
							if (dataUrl.length > MAX_IMAGE_CHARS) {
								console.warn(
									`[changhai-brand-setting] image is ${dataUrl.length} characters; pick a smaller or simpler one`,
								);
								notices.set("too-large");
								return;
							}
							accept(dataUrl);
							notices.set("");
						});
					};
					reader.readAsDataURL(file);
				},
				{ once: true },
			);
			input.click();
		}

		// ── brand rendering (shared by the occupants and the settings preview) ──

		/**
		 * The mark element for one settings snapshot.
		 * @param state - settings snapshot.
		 * @param size - the size the host surface asked for.
		 * @param surface - "sidebar" or "hero"; also the anchor the hero copy sync reads.
		 * @returns the mark element.
		 */
		function markElement(state, size, surface) {
			const kind = logoKind(state);
			const fallback = surface === "hero" ? DEFAULT_HERO_LOGO_SIZE : DEFAULT_LOGO_SIZE;
			const edge = num(state, "logoSize", size || fallback, 12, 64);
			// With no image picked, "image" means the mark this plugin ships — that is
			// what makes a fresh install branded. Picking one replaces it.
			const src = str(state, "logoImage", kind === "image" ? DEFAULT_LOGO_IMAGE : "");
			const text = str(state, "logoText", "");
			// An image source with nothing picked yet, or a text source with an empty
			// value, falls through to the other one: the surface never goes blank
			// between picking an image and clearing it.
			if (kind === "image" && src !== "") {
				return h("img", {
					src,
					alt: "",
					draggable: false,
					"data-dsh-brand-mark": surface,
					style: { display: "block", width: edge + "px", height: edge + "px", objectFit: "contain" },
				});
			}
			if ((kind === "image" || kind === "text") && text !== "") {
				return h(
					"span",
					{
						"data-dsh-brand-mark": surface,
						"aria-hidden": "true",
						style: {
							display: "inline-flex",
							alignItems: "center",
							justifyContent: "center",
							width: edge + "px",
							height: edge + "px",
							fontSize: Math.round(edge * 0.82) + "px",
							lineHeight: 1,
						},
					},
					text,
				);
			}
			// "none" (or a kind whose value is still empty) renders an invisible
			// placeholder that keeps the row geometry and stays the hero anchor.
			return h("span", {
				"data-dsh-brand-mark": surface,
				"aria-hidden": "true",
				style: { display: "inline-block", width: kind === "none" ? "0px" : edge + "px", height: edge + "px" },
			});
		}

		/**
		 * The sidebar wordmark element for one settings snapshot.
		 * @param state - settings snapshot.
		 * @returns the wordmark element.
		 */
		function nameElement(state) {
			const kind = nameKind(state);
			const size = num(state, "nameSize", DEFAULT_NAME_SIZE, 10, 40);
			const src = str(state, "nameImage", "");
			const text = str(state, "nameText", "");
			if (kind === "image" && src !== "") {
				return h("img", {
					src,
					alt: "",
					draggable: false,
					style: { display: "block", height: size + "px", width: "auto", maxWidth: "180px", objectFit: "contain" },
				});
			}
			// Same asymmetry as the mark: an empty image value falls back to the text
			// one instead of blanking the wordmark.
			if ((kind === "image" || kind === "text") && text !== "") {
				const color = str(state, "nameColor", "");
				return h(
					"span",
					{
						style: {
							fontSize: size + "px",
							fontWeight: num(state, "nameWeight", DEFAULT_NAME_WEIGHT, 300, 800),
							letterSpacing: num(state, "nameLetterSpacing", DEFAULT_NAME_SPACING, -0.05, 0.3) + "em",
							lineHeight: 1.15,
							whiteSpace: "nowrap",
							...(color === "" ? {} : { color }),
						},
					},
					text,
				);
			}
			return h("span", { style: { display: "none" } });
		}

		/** Sidebar logo occupant (owner share: { size }). */
		function BrandMark(props) {
			const state = props.useBrand((snapshot) => snapshot);
			return markElement(state, props.size, "sidebar");
		}

		/** Hero logo occupant (owner share: { size, className }). */
		function HeroMark(props) {
			const state = props.useBrand((snapshot) => snapshot);
			return markElement(state, props.size, "hero");
		}

		/** Sidebar wordmark occupant (owner share: empty). */
		function BrandName(props) {
			const state = props.useBrand((snapshot) => snapshot);
			return nameElement(state);
		}

		// ── DOM substitutions (hero copy, tab title, favicon) ─────────────────

		/** Nodes this plugin replaced, per override, so a cleared setting restores the shipped copy. */
		const tracked = new Map();

		/** The shipped conversation copy, read from the live locale dictionary. */
		function shippedCopy(ctx) {
			try {
				const t = ctx.locale.bind(CONVERSATION_NS);
				return { headline: t("hero.headline"), badge: t("hero.preview") };
			} catch (error) {
				console.warn("[changhai-brand-setting] shipped hero copy unavailable", error);
				return { headline: "", badge: "" };
			}
		}

		/** The replacement text of one hero override, or the shipped text when unset. */
		function desiredCopy(state, shipped) {
			return {
				headline: str(state, "heroHeadline", shipped.headline),
				badge:
					badgeKind(state) === "none"
						? ""
						: badgeKind(state) === "text"
							? str(state, "badgeText", shipped.badge)
							: shipped.badge,
			};
		}

		/** The tagline text: the user's own copy, else the line this plugin ships. */
		function taglineText(state) {
			return str(state, "heroTagline", DEFAULT_TAGLINE).trim() || DEFAULT_TAGLINE;
		}

		/** Whether the user explicitly turned the tagline off. */
		function taglineHidden(state) {
			return state.taglineHidden === "1";
		}

		/** The tagline alignment; ships aligned to the title, not centred. */
		function taglineAlign(state) {
			return oneOf(state, "taglineAlign", TAGLINE_ALIGNS, "title");
		}

		/**
		 * How far the headline *text* is inset from the left edge of its row, in px.
		 *
		 * The title is centred, so this inset depends on how wide the text renders —
		 * measured on the live shell, it swings between ~158px for a long headline
		 * and ~319px for a short one. It therefore has to be read off the rendered
		 * glyphs rather than computed from anything the plugin knows about the copy.
		 *
		 * The text is located with a Range over the element's contents so the
		 * measurement covers the actual glyph box, not the (full-width) block that
		 * contains it. Returns null when nothing is measurable yet.
		 */
		function headlineTextInset(row) {
			const text = row.querySelector('[class*="headlineText"]');
			if (text === null) return null;
			try {
				const range = document.createRange();
				range.selectNodeContents(text);
				const textBox = range.getBoundingClientRect();
				const rowBox = row.getBoundingClientRect();
				// A detached or still-unlaid-out node reports all zeros; treating that
				// as "unknown" keeps the caller from applying a bogus 0px inset.
				if (textBox.width === 0 && rowBox.width === 0) return null;
				return Math.max(0, Math.round(textBox.left - rowBox.left));
			} catch {
				// Range is unavailable (a non-browser DOM in tests) — degrade to no
				// offset rather than throwing out of the sync pass.
				return null;
			}
		}

		/**
		 * Elements to write for one override: previously tracked ones first, then a
		 * scan that narrows from the hero anchor to the class probe to an exact
		 * document-wide text match. Every scan hit is verified by text equality, so a
		 * reshaped surface degrades to "not found" instead of rewriting the wrong node.
		 */
		function targetsFor(key, probe, shipped, desired, container) {
			const found = new Set();
			for (const node of tracked.get(key) ?? []) {
				if (node.isConnected) found.add(node);
			}
			const accept = (element) => {
				if (element === null || element.childElementCount !== 0) return;
				const text = (element.textContent ?? "").trim();
				if (text === shipped || text === desired) found.add(element);
			};
			if (found.size === 0 && container !== null) {
				for (const element of container.querySelectorAll("span")) accept(element);
			}
			if (found.size === 0) {
				for (const element of document.querySelectorAll(`[class*="${probe}"]`)) accept(element);
			}
			if (found.size === 0 && shipped !== "") {
				const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
				let node = walker.nextNode();
				while (node !== null) {
					if ((node.nodeValue ?? "").trim() === shipped) accept(node.parentElement);
					node = walker.nextNode();
				}
			}
			return found;
		}

		/**
		 * Write one hero override: replacement text when configured, the shipped
		 * text when the setting is cleared, and `display:none` when it is hidden.
		 * @param key - tracked-override key.
		 * @param probe - class-name substring of the shipped node (last-resort scan).
		 * @param shipped - shipped copy for this surface.
		 * @param next - desired text ("" hides the node).
		 * @param hideWhenEmpty - whether an empty value hides the node instead of blanking it.
		 * @param container - the hero headline row, when the mark anchor located it.
		 */
		function applyCopy(key, probe, shipped, next, hideWhenEmpty, container) {
			if (shipped === "") return;
			const nodes = targetsFor(key, probe, shipped, next, container);
			const live = new Set();
			for (const node of nodes) {
				if ((node.textContent ?? "") !== next) node.textContent = next;
				if (hideWhenEmpty) node.style.display = next === "" ? "none" : "";
				live.add(node);
			}
			tracked.set(key, live);
		}

		/** Apply (or restore) the hero headline and badge text. */
		function syncHeroCopy(state, shipped) {
			const desired = desiredCopy(state, shipped);
			const anchor = document.querySelector('[data-dsh-brand-mark="hero"]');
			const container = anchor?.parentElement?.parentElement ?? null;
			applyCopy("headline", "headlineText", shipped.headline, desired.headline, false, container);
			applyCopy("badge", "previewBadge", shipped.badge, desired.badge, true, container);
		}

		/**
		 * Locate the row the tagline sits under: the container that holds the hero
		 * headline (and, in the shipped layout, the mark and the badge).
		 *
		 * The tagline is inserted as this element's *sibling*, so what is wanted here
		 * is the container, never the headline text node itself. Resolution order
		 * mirrors `targetsFor`: the row of the headline this plugin already replaced,
		 * then the mark anchor's ancestors (the shipped row nests the slot host
		 * inside a hitbox), then a class probe. Candidates are verified to actually
		 * contain a headline before one is accepted, so a reshaped surface degrades
		 * to "not found" rather than inserting the tagline into an unrelated row.
		 */
		function headlineRow(shippedHeadline) {
			/** The element that holds a headline, or null. */
			const rowContaining = (element) => {
				if (element === null || element === undefined) return null;
				if (element.parentElement === null || element.parentElement === undefined) return null;
				if (element.getAttribute(TAGLINE_ATTR) !== null) return null;
				if (element.querySelector('[class*="headlineText"]') === null) return null;
				// Require the innermost holder: an outer wrapper (the hero stack) also
				// contains the headline, and inserting there would drop the tagline
				// below the composer instead of directly under the title.
				for (const child of element.children) {
					if (child.querySelector('[class*="headlineText"]') !== null) return null;
				}
				return element;
			};
			for (const node of tracked.get("headline") ?? []) {
				if (!node.isConnected) continue;
				const row = rowContaining(node.parentElement);
				if (row !== null) return row;
			}
			const anchor = document.querySelector('[data-dsh-brand-mark="hero"]');
			// The mark renders inside a `display: contents` slot wrapper inside a
			// hitbox span, so the row is a couple of levels up; walk outward rather
			// than guessing a fixed depth.
			for (let candidate = anchor?.parentElement, hops = 0; candidate != null && hops < 5; candidate = candidate.parentElement, hops += 1) {
				const row = rowContaining(candidate);
				if (row !== null) return row;
			}
			// Last resort: the class probe, preferring the headline that still carries
			// the shipped copy so a deleted-and-recreated hero is found again.
			const headlines = document.querySelectorAll('[class*="headlineText"]');
			for (const node of headlines) {
				if (shippedHeadline !== "" && (node.textContent ?? "").trim() === shippedHeadline) {
					const row = rowContaining(node.parentElement);
					if (row !== null) return row;
				}
			}
			for (const node of headlines) {
				const row = rowContaining(node.parentElement);
				if (row !== null) return row;
			}
			return null;
		}

		/**
		 * Apply (or remove) the synthetic tagline under the hero headline.
		 *
		 * The tagline is the one surface this plugin *creates* rather than
		 * substitutes: the shipped hero has no tagline slot or string, so there is
		 * nothing to rewrite. A single marked node is kept as a sibling of the
		 * headline row so it lays out below the title and above the composer, and is
		 * removed outright when the setting is cleared (the default), leaving the
		 * shipped hero byte-identical.
		 *
		 * Loop safety: this runs from a MutationObserver callback, and writing the
		 * node mutates the observed subtree. Every write is therefore guarded by an
		 * equality check (text/style re-applied only when the value actually
		 * differs), and the node is reused rather than recreated, so a steady state
		 * produces no further mutations.
		 */
		function syncHeroTagline(state, shipped) {
			const text = taglineText(state);
			const existing = document.querySelector(`[${TAGLINE_ATTR}]`);
			// Hidden, or the brand is off: remove the node so nothing of ours remains.
			// Note this is the *only* way to get rid of the line — an empty field
			// means "use the shipped default copy", not "show nothing".
			if (!enabled(state) || taglineHidden(state) || text === "") {
				if (existing !== null) existing.remove();
				return;
			}
			const row = headlineRow(shipped.headline);
			if (row === null || row.parentElement === null) {
				// The hero is not on screen (a session with messages, a settings page):
				// drop any stale node and leave nothing behind.
				if (existing !== null) existing.remove();
				return;
			}
			let node = existing;
			if (node === null) {
				node = document.createElement("div");
				node.setAttribute(TAGLINE_ATTR, "");
				node.setAttribute("role", "presentation");
			}
			const size = num(state, "taglineSize", DEFAULT_TAGLINE_SIZE, 11, 28);
			const color = str(state, "taglineColor", "");
			// "title" hangs the line off the headline's left edge, which means
			// offsetting it by however far the (centred) title text sits from the
			// row's left edge. That inset is only measured when this mode is on:
			// getBoundingClientRect forces a layout flush, and the default centring
			// needs no measurement at all.
			const alignsToTitle = taglineAlign(state) === "title";
			const inset = alignsToTitle ? headlineTextInset(row) : null;
			const nextStyle = [
				"display:block",
				"text-align:" + (alignsToTitle ? "left" : "center"),
				// A null inset means the text was not measurable yet; falling back to
				// 0 keeps the line on screen and the next sync corrects it.
				"padding-left:" + (inset ?? 0) + "px",
				"line-height:1.5",
				"font-size:" + size + "px",
				// Colour follows the theme unless the user pinned one, so the tagline
				// stays legible when the shell switches light/dark.
				"color:" + (color === "" ? "var(--dsw-alias-label-tertiary)" : color),
			].join(";");
			// Guarded writes: skip anything already correct so the observer stays quiet.
			if (node.textContent !== text) node.textContent = text;
			if (node.getAttribute("style") !== nextStyle) node.setAttribute("style", nextStyle);
			// Re-insert only when the node is gone or no longer in the right place, so
			// a steady state performs no DOM mutation at all.
			if (node.parentElement !== row.parentElement || node.previousElementSibling !== row) {
				row.after(node);
			}
		}

		/**
		 * Substitute the product name inside document.title.
		 *
		 * The text to replace is always the shipped product name: the settings page
		 * used to expose it as a second field, but editing it only ever produced a
		 * title nobody could find, so the field is gone and the search word is fixed.
		 */
		function syncTitle(state) {
			const replacement = str(state, "title", "");
			if (replacement === "") return;
			const title = document.title;
			if (!title.includes(DEFAULT_PRODUCT_NAME)) return;
			const next = title.split(DEFAULT_PRODUCT_NAME).join(replacement);
			if (next !== title) document.title = next;
		}

		/**
		 * Point the favicon at the stored image, or at the mark this plugin ships.
		 *
		 * The tab icon defaults to the built-in artwork for the same reason the mark
		 * does: a fresh install should be branded without anyone picking a file. It
		 * is the same embedded image, so this costs nothing extra, and clearing the
		 * field returns to it rather than to the shell's own icon.
		 */
		function syncFavicon(state) {
			if (!enabled(state)) return;
			const src = str(state, "favicon", DEFAULT_LOGO_IMAGE);
			if (src === "") return;
			let link = document.querySelector('link[rel="icon"]');
			if (link === null) {
				link = document.createElement("link");
				link.setAttribute("rel", "icon");
				document.head.appendChild(link);
			}
			if (link.getAttribute("href") !== src) link.setAttribute("href", src);
		}

		/** Whether any DOM substitution is configured (observers stay off otherwise). */
		function copyActive(state) {
			return (
				(enabled(state) && str(state, "heroHeadline", "") !== "") ||
				// The tagline now has default copy of its own, so it is active
				// whenever the brand is on and the user has not hidden it — not
				// merely when a value was typed into the field.
				(enabled(state) && !taglineHidden(state) && taglineText(state) !== "") ||
				(enabled(state) && badgeKind(state) !== "shipped") ||
				// The favicon also has a shipped default now, so it is active as soon
				// as the brand is on — not only once a file has been picked.
				(enabled(state) && str(state, "favicon", DEFAULT_LOGO_IMAGE) !== "") ||
				str(state, "title", "") !== ""
			);
		}

		// ── settings page ────────────────────────────────────────────────────

		const styles = {
			section: { display: "flex", flexDirection: "column", width: "100%" },
			group: {
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				padding: "16px 0",
				borderBottom: "1px solid var(--dsw-alias-border-l2)",
			},
			groupTitle: { color: "var(--dsw-alias-label-primary)", fontSize: "14px", lineHeight: "22px" },
			hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
			warning: { color: "var(--dsw-alias-state-error-primary)", fontSize: "12px", lineHeight: "18px" },
			row: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" },
			label: { color: "var(--dsw-alias-label-secondary)", fontSize: "13px", minWidth: "72px" },
			segmented: {
				display: "inline-flex",
				border: "1px solid var(--dsw-alias-border-l2)",
				borderRadius: "8px",
				overflow: "hidden",
			},
			segment: {
				height: "28px",
				padding: "0 10px",
				border: "none",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				cursor: "pointer",
				font: "inherit",
				fontSize: "12px",
			},
			segmentActive: {
				background: "var(--dsw-alias-interactive-bg-hover)",
				color: "var(--dsw-alias-label-primary)",
				fontWeight: 600,
			},
			input: {
				flex: 1,
				minWidth: "180px",
				height: "32px",
				padding: "0 10px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				font: "inherit",
				fontSize: "13px",
				boxSizing: "border-box",
			},
			button: {
				height: "32px",
				padding: "0 14px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-button-elevated-fill)",
				color: "var(--dsw-alias-label-primary)",
				cursor: "pointer",
				font: "inherit",
				fontSize: "13px",
				boxSizing: "border-box",
			},
			buttonQuiet: { background: "transparent", color: "var(--dsw-alias-label-secondary)" },
			slider: { flex: 1, minWidth: "160px", accentColor: "var(--dsw-alias-brand-primary)" },
			sliderValue: {
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "12px",
				width: "48px",
				textAlign: "right",
				fontVariantNumeric: "tabular-nums",
			},
			checkbox: { accentColor: "var(--dsw-alias-brand-primary)", width: "16px", height: "16px" },
			previewBox: {
				display: "flex",
				alignItems: "center",
				gap: "10px",
				minHeight: "56px",
				padding: "8px 14px",
				borderRadius: "12px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
			},
			thumb: {
				width: "40px",
				height: "40px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				objectFit: "contain",
				background: "var(--dsw-alias-bg-layer-2)",
			},
		};

		/** A small segmented control. */
		function Segmented(props) {
			return h(
				"div",
				{ style: styles.segmented, role: "group" },
				props.options.map((option) =>
					h(
						"button",
						{
							key: option.value,
							type: "button",
							style: { ...styles.segment, ...(option.value === props.value ? styles.segmentActive : {}) },
							onClick: () => props.onChange(option.value),
						},
						option.label,
					),
				),
			);
		}

		/** Label + slider + numeric readout. */
		function Slider(props) {
			return h(
				"div",
				{ style: styles.row },
				h("span", { style: styles.label }, props.label),
				h("input", {
					type: "range",
					min: props.min,
					max: props.max,
					step: props.step ?? 1,
					value: props.value,
					style: styles.slider,
					onChange: (event) => props.onChange(Number(event.target.value)),
				}),
				h("span", { style: styles.sliderValue }, `${props.value}${props.suffix ?? ""}`),
			);
		}

		/** Label + text input. */
		function TextRow(props) {
			return h(
				"div",
				{ style: styles.row },
				h("span", { style: styles.label }, props.label),
				h("input", {
					type: "text",
					value: props.value,
					placeholder: props.placeholder ?? "",
					style: styles.input,
					onChange: (event) => props.onChange(event.target.value),
				}),
			);
		}

		/** Label + a file-picking button + thumbnail + clear. */
		function ImageRow(props) {
			return h(
				"div",
				{ style: styles.row },
				h("span", { style: styles.label }, props.label),
				props.src !== ""
					? h("img", { src: props.src, alt: "", style: styles.thumb })
					: h("span", { style: { ...styles.thumb, display: "inline-block" } }),
				h("button", { type: "button", style: styles.button, onClick: props.onPick }, props.pickLabel),
				props.src !== ""
					? h(
							"button",
							{ type: "button", style: { ...styles.button, ...styles.buttonQuiet }, onClick: () => props.onChange("") },
							props.clearLabel,
						)
					: null,
			);
		}

		/** A labelled group inside the brand page. */
		function Group(props) {
			return h(
				"div",
				{ style: styles.group },
				h("div", { style: styles.groupTitle }, props.title),
				...React.Children.toArray(props.children),
			);
		}

		/**
		 * The "Brand" settings page: master switch, sidebar mark, sidebar wordmark,
		 * hero copy and browser chrome, each with a live preview of the current
		 * configuration.
		 */
		function BrandSection(props) {
			const t = props.t;
			const state = props.useBrand((snapshot) => snapshot);
			const notice = props.useNotice((value) => value);
			const set = props.set;
			const kindOptions = [
				{ value: "shipped", label: t("kind.shipped") },
				{ value: "image", label: t("kind.image") },
				{ value: "text", label: t("kind.text") },
				{ value: "none", label: t("kind.none") },
			];
			const badgeOptions = [
				{ value: "shipped", label: t("kind.shipped") },
				{ value: "text", label: t("kind.text") },
				{ value: "none", label: t("kind.none") },
			];
			// Centring is the shipped presentation, so choosing it clears the stored
			// value instead of pinning it — the way every other "shipped" choice here
			// behaves. "title" is this plugin's default, so it clears too.
			const taglineAlignOptions = [
				{ value: "center", label: t("tagline.align.center") },
				{ value: "title", label: t("tagline.align.title") },
			];
			// Showing is the default, so only the hidden choice is stored.
			const taglineShowOptions = [
				{ value: "shown", label: t("tagline.show.shown") },
				{ value: "hidden", label: t("tagline.show.hidden") },
			];
			const on = enabled(state);
			return h(
				"div",
				{ style: styles.section },
				h(
					"div",
					{ style: styles.group },
					h("div", { style: styles.groupTitle }, t("intro.title")),
					h("div", { style: styles.hint }, t("intro.body")),
					h(
						"div",
						{ style: styles.row },
						h("input", {
							type: "checkbox",
							style: styles.checkbox,
							checked: on,
							// On writes "1" rather than clearing the key. Clearing would
							// also read as on, but then a user who had an old "" in the
							// file could never leave the off state: the checkbox would
							// write "" again and the switch would snap back.
							onChange: (event) => set({ enabled: event.target.checked ? "1" : "0" }),
						}),
						h("span", { style: styles.label }, t("enable")),
						h("span", { style: { flex: 1 } }),
						h(
							"button",
							{ type: "button", style: { ...styles.button, ...styles.buttonQuiet }, onClick: props.reset },
							t("reset"),
						),
					),
					h("div", { style: styles.hint }, t("enable.hint")),
					notice === ""
						? null
						: h(
								"div",
								{ style: { ...styles.row, gap: "8px" } },
								h("span", { style: styles.warning }, t(`notice.${notice}`)),
								h(
									"button",
									{ type: "button", style: { ...styles.button, ...styles.buttonQuiet }, onClick: props.dismissNotice },
									t("clear"),
								),
							),
				),

				h(
					Group,
					{ title: t("logo.title") },
					h(
						"div",
						{ style: styles.previewBox },
						h("span", { style: styles.hint }, t("preview")),
						markElement(state, 24, "preview"),
						nameElement(state),
					),
					h(
						"div",
						{ style: styles.row },
						h("span", { style: styles.label }, t("kind")),
						h(Segmented, {
							options: kindOptions,
							value: logoKind(state),
							onChange: (value) => set({ logoKind: value === "shipped" ? "" : value }),
						}),
					),
					logoKind(state) === "image"
						? h(ImageRow, {
								label: t("logo.image"),
								src: str(state, "logoImage", ""),
								pickLabel: t("pick"),
								clearLabel: t("clear"),
								onPick: () => props.chooseImage((dataUrl) => set({ logoImage: dataUrl })),
								onChange: (value) => set({ logoImage: value }),
							})
						: null,
					logoKind(state) === "text"
						? h(TextRow, {
								label: t("logo.text"),
								value: str(state, "logoText", ""),
								placeholder: t("logo.text.ph"),
								onChange: (value) => set({ logoText: value }),
							})
						: null,
					h(Slider, {
						label: t("size"),
						min: 12,
						max: 48,
						value: num(state, "logoSize", DEFAULT_LOGO_SIZE, 12, 64),
						suffix: "px",
						onChange: (value) => set({ logoSize: String(value) }),
					}),
				),

				h(
					Group,
					{ title: t("name.title") },
					h(
						"div",
						{ style: styles.row },
						h("span", { style: styles.label }, t("kind")),
						h(Segmented, {
							options: kindOptions,
							value: nameKind(state),
							onChange: (value) => set({ nameKind: value === "shipped" ? "" : value }),
						}),
					),
					nameKind(state) === "image"
						? h(ImageRow, {
								label: t("name.image"),
								src: str(state, "nameImage", ""),
								pickLabel: t("pick"),
								clearLabel: t("clear"),
								onPick: () => props.chooseImage((dataUrl) => set({ nameImage: dataUrl })),
								onChange: (value) => set({ nameImage: value }),
							})
						: null,
					nameKind(state) === "text"
						? h(TextRow, {
								label: t("name.text"),
								value: str(state, "nameText", ""),
								placeholder: t("name.text.ph"),
								onChange: (value) => set({ nameText: value }),
							})
						: null,
					nameKind(state) === "text"
						? h(Slider, {
								label: t("size"),
								min: 10,
								max: 32,
								value: num(state, "nameSize", DEFAULT_NAME_SIZE, 10, 40),
								suffix: "px",
								onChange: (value) => set({ nameSize: String(value) }),
							})
						: null,
					nameKind(state) === "text"
						? h(Slider, {
								label: t("name.weight"),
								min: 300,
								max: 800,
								step: 100,
								value: num(state, "nameWeight", DEFAULT_NAME_WEIGHT, 300, 800),
								onChange: (value) => set({ nameWeight: String(value) }),
							})
						: null,
					nameKind(state) === "text"
						? h(Slider, {
								label: t("name.spacing"),
								min: -0.02,
								max: 0.2,
								step: 0.01,
								value: num(state, "nameLetterSpacing", DEFAULT_NAME_SPACING, -0.05, 0.3),
								suffix: "em",
								onChange: (value) => set({ nameLetterSpacing: String(value) }),
							})
						: null,
					nameKind(state) === "text"
						? h(
								"div",
								{ style: styles.row },
								h("span", { style: styles.label }, t("name.color")),
								h("input", {
									type: "color",
									value: str(state, "nameColor", "#4f83f2"),
									style: { width: "40px", height: "28px", padding: 0, border: "none", background: "transparent" },
									onChange: (event) => set({ nameColor: event.target.value }),
								}),
								h(
									"button",
									{
										type: "button",
										style: { ...styles.button, ...styles.buttonQuiet },
										onClick: () => set({ nameColor: "" }),
									},
									t("name.color.inherit"),
								),
							)
						: null,
					h("div", { style: styles.hint }, t("name.hint")),
				),

				h(
					Group,
					{ title: t("hero.title") },
					h(TextRow, {
						label: t("hero.headline"),
						value: str(state, "heroHeadline", ""),
						placeholder: props.shippedHeadline,
						onChange: (value) => set({ heroHeadline: value }),
					}),
					h(TextRow, {
						label: t("hero.tagline"),
						value: str(state, "heroTagline", ""),
						// The built-in line is what actually shows while the field is
						// empty, so previewing it here is the honest placeholder.
						placeholder: DEFAULT_TAGLINE,
						onChange: (value) => set({ heroTagline: value }),
					}),
					h(
						"div",
						{ style: styles.row },
						h("span", { style: styles.label }, t("hero.tagline.show")),
						h(Segmented, {
							options: taglineShowOptions,
							value: taglineHidden(state) ? "hidden" : "shown",
							onChange: (value) => set({ taglineHidden: value === "hidden" ? "1" : "" }),
						}),
					),
					!taglineHidden(state)
						? h(Slider, {
								label: t("hero.tagline.size"),
								min: 11,
								max: 28,
								step: 1,
								value: num(state, "taglineSize", DEFAULT_TAGLINE_SIZE, 11, 28),
								onChange: (value) => set({ taglineSize: String(value) }),
							})
						: null,
					!taglineHidden(state)
						? h(
								"div",
								{ style: styles.row },
								h("span", { style: styles.label }, t("hero.tagline.color")),
								h("input", {
									type: "color",
									value: str(state, "taglineColor", "#8a8a8a"),
									style: { width: "40px", height: "28px", padding: 0, border: "none", background: "transparent" },
									onChange: (event) => set({ taglineColor: event.target.value }),
								}),
								h(
									"button",
									{
										type: "button",
										style: { ...styles.button, ...styles.buttonQuiet },
										onClick: () => set({ taglineColor: "" }),
									},
									t("name.color.inherit"),
								),
							)
						: null,
					!taglineHidden(state)
						? h(
								"div",
								{ style: styles.row },
								h("span", { style: styles.label }, t("hero.tagline.align")),
								h(Segmented, {
									options: taglineAlignOptions,
									value: taglineAlign(state),
									onChange: (value) => set({ taglineAlign: value === "title" ? "" : value }),
								}),
							)
						: null,
					h(
						"div",
						{ style: styles.row },
						h("span", { style: styles.label }, t("hero.badge")),
						h(Segmented, {
							options: badgeOptions,
							value: badgeKind(state),
							onChange: (value) => set({ badgeKind: value === "shipped" ? "" : value }),
						}),
					),
					badgeKind(state) === "text"
						? h(TextRow, {
								label: t("hero.badge.text"),
								value: str(state, "badgeText", ""),
								placeholder: props.shippedBadge,
								onChange: (value) => set({ badgeText: value }),
							})
						: null,
					h("div", { style: styles.hint }, t("hero.hint")),
				),

				h(
					Group,
					{ title: t("browser.title") },
					h(TextRow, {
						label: t("browser.tab"),
						value: str(state, "title", ""),
						placeholder: DEFAULT_PRODUCT_NAME,
						onChange: (value) => set({ title: value }),
					}),
					h(ImageRow, {
						label: t("browser.favicon"),
						// Show the built-in as the current value, because that is what
						// the tab actually gets while nothing has been picked.
						src: str(state, "favicon", DEFAULT_LOGO_IMAGE),
						pickLabel: t("pick"),
						clearLabel: t("clear"),
						onPick: () => props.chooseImage((dataUrl) => set({ favicon: dataUrl })),
						onChange: (value) => set({ favicon: value }),
					}),
					h("div", { style: styles.hint }, t("browser.hint")),
				),

				h("div", { style: { ...styles.hint, paddingTop: "12px" } }, t("footer.hint")),
			);
		}

		// ── dictionaries ─────────────────────────────────────────────────────

		const ZH = {
			"section.label": "品牌",
			"intro.title": "自定义品牌",
			"intro.body":
				"替换侧栏标志与名称、空会话首页文案与浏览器标签，全部走官方插槽与受控改写；关闭开关即恢复官方品牌。",
			enable: "启用自定义品牌",
			"enable.hint": "默认开启。关闭后立即恢复官方标志、名称与首页文案，配置会保留。",
			"notice.too-large": "这张图片太大了（已超过 150 万字符），换一张更小或更简单的图片。",
			"notice.decode": "这张图片无法解码，请换一张 PNG / JPEG / WebP / SVG。",
			reset: "恢复默认",
			kind: "来源",
			"kind.shipped": "官方",
			"kind.image": "图片",
			"kind.text": "文字",
			"kind.none": "隐藏",
			preview: "预览",
			"logo.title": "标志（侧栏与首页）",
			"logo.image": "标志图片",
			"logo.text": "标志文字",
			"logo.text.ph": "例如 长海 或一个 emoji",
			size: "大小",
			"name.title": "名称（侧栏字标）",
			"name.image": "名称图片",
			"name.text": "名称文字",
			"name.text.ph": "例如 changhai",
			"name.weight": "字重",
			"name.spacing": "字距",
			"name.color": "颜色",
			"name.color.inherit": "跟随主题",
			"name.hint": "选择“图片”可直接使用 logo 图；选择“官方”恢复官方字标。",
			"hero.title": "空会话首页",
			"hero.headline": "标题文案",
			"hero.tagline": "小标语",
			"hero.tagline.ph": "例如 让每一次对话都通向未来",
			"hero.tagline.show": "显示标语",
			"tagline.show.shown": "显示",
			"tagline.show.hidden": "隐藏",
			"hero.tagline.size": "标语字号",
			"hero.tagline.color": "标语颜色",
			"hero.tagline.align": "标语对齐",
			"tagline.align.center": "居中",
			"tagline.align.title": "与标题对齐",
			"hero.badge": "版本徽标",
			"hero.badge.text": "徽标文字",
			"hero.hint": "首页标题与徽标不在插槽里，插件按当前语言读取官方文案后做等值替换；清空即恢复。标语是插件新增的一行：留空显示内置语句，也可填自己的文案，选「隐藏」则不显示；对齐默认与标题左边缘对齐。",
			"browser.title": "浏览器",
			"browser.tab": "标签页标题",

			"browser.favicon": "站点图标",
			"browser.hint": "留空则使用内置的长海图标；标签页标题留空则保持官方不变，填写后替换掉标题里的官方产品名。",
			"footer.hint":
				"配置保存在 $DSH_HOME/changhai-brand-setting.json（localStorage 只作首屏种子），刷新页面后侧栏与首页即生效。",
			pick: "选择图片",
			clear: "清除",
		};

		const EN = {
			"section.label": "Brand",
			"intro.title": "Custom brand",
			"intro.body":
				"Replace the sidebar mark and wordmark, the blank-session hero copy and the browser tab, through the shell's own brand slots and guarded rewrites. Turning the switch off restores the shipped brand.",
			enable: "Enable custom brand",
			"enable.hint": "On by default. Switching off restores the official mark, wordmark and hero copy immediately; settings are kept.",
			"notice.too-large": "That image is too large to store (over 1.5M characters) — pick a smaller or simpler one.",
			"notice.decode": "That image could not be decoded — pick a PNG, JPEG, WebP or SVG file.",
			reset: "Restore defaults",
			kind: "Source",
			"kind.shipped": "Official",
			"kind.image": "Image",
			"kind.text": "Text",
			"kind.none": "Hidden",
			preview: "Preview",
			"logo.title": "Mark (sidebar and hero)",
			"logo.image": "Mark image",
			"logo.text": "Mark text",
			"logo.text.ph": "e.g. a monogram or an emoji",
			size: "Size",
			"name.title": "Name (sidebar wordmark)",
			"name.image": "Name image",
			"name.text": "Name text",
			"name.text.ph": "e.g. changhai",
			"name.weight": "Weight",
			"name.spacing": "Letter spacing",
			"name.color": "Color",
			"name.color.inherit": "Inherit theme",
			"name.hint": "Use the image source to reuse your logo artwork; Official restores the shipped wordmark.",
			"hero.title": "Blank-session hero",
			"hero.headline": "Headline",
			"hero.tagline": "Tagline",
			"hero.tagline.ph": "e.g. Every conversation leads somewhere",
			"hero.tagline.show": "Show tagline",
			"tagline.show.shown": "Shown",
			"tagline.show.hidden": "Hidden",
			"hero.tagline.size": "Tagline size",
			"hero.tagline.color": "Tagline colour",
			"hero.tagline.align": "Tagline align",
			"tagline.align.center": "Centred",
			"tagline.align.title": "Align to title",
			"hero.badge": "Preview badge",
			"hero.badge.text": "Badge text",
			"hero.hint":
				"The headline and badge are not slots: the plugin reads the shipped copy in the active language and substitutes it by exact match. Clear the field to restore it. The tagline is an extra line this plugin adds: leaving the field empty shows the built-in line, and \"Hidden\" removes it entirely. It is aligned to the title's left edge by default.",
			"browser.title": "Browser",
			"browser.tab": "Tab title",
			"browser.favicon": "Favicon",
			"browser.hint": "Left empty, the tab icon falls back to the built-in Changhai mark. The tab title stays as shipped while its field is empty; a value replaces the shipped product name inside it.",
			"footer.hint":
				"Settings live in $DSH_HOME/changhai-brand-setting.json (localStorage is only the first-paint seed). Reload the page to see the sidebar and hero.",
			pick: "Choose image",
			clear: "Clear",
		};

		// ── plugin body ──────────────────────────────────────────────────────

		/** Required services: the slot registry and the locale registry. */
		const inject = ["slots", "locale"];

		/**
		 * Client plugin body: hydrate settings, publish the Brand settings page,
		 * claim the brand slots that differ from the shipped presentation, and keep
		 * the non-slot surfaces in sync while configured.
		 * @param ctx - client cordis context.
		 */
		function apply(ctx) {
			const store = createStore();
			store.replace(readSeed());

			// ── locale dictionaries ──────────────────────────────────────────
			ctx.effect(
				() => {
					const zh = ctx.locale.register(NS, "zh", ZH);
					const en = ctx.locale.register(NS, "en", EN);
					return () => {
						zh();
						en();
					};
				},
				"changhai-brand-setting: settings dictionaries",
			);

			// ── durable settings ─────────────────────────────────────────────
			// The localStorage seed paints the first frame; the host file is
			// authoritative and replaces it as soon as it answers.
			let hydrating = true;
			let sent = {};
			let saveTimer = null;
			const persist = () => {
				const snapshot = store.getSnapshot();
				writeSeed(snapshot);
				if (hydrating) return;
				const patch = {};
				for (const [key, value] of Object.entries(snapshot)) {
					if (sent[key] !== value) patch[key] = value;
				}
				for (const key of Object.keys(sent)) {
					if (!(key in snapshot)) patch[key] = null;
				}
				if (Object.keys(patch).length === 0) return;
				sent = { ...snapshot };
				callHost({ method: "set", patch }).catch((error) =>
					console.warn("[changhai-brand-setting] settings not saved:", error.message),
				);
			};
			persist();
			ctx.effect(
				() => {
					const onChange = () => {
						writeSeed(store.getSnapshot());
						if (saveTimer !== null) window.clearTimeout(saveTimer);
						saveTimer = window.setTimeout(() => {
							saveTimer = null;
							persist();
						}, SAVE_DEBOUNCE_MS);
					};
					const unsubscribe = store.subscribe(onChange);
					return () => {
						unsubscribe();
						if (saveTimer !== null) window.clearTimeout(saveTimer);
					};
				},
				"changhai-brand-setting: settings persistence",
			);
			callHost({ method: "get" })
				.then((value) => {
					hydrating = false;
					if (value !== null && typeof value === "object" && !Array.isArray(value)) {
						sent = { ...value };
						store.replace(value);
					}
				})
				.catch((error) => {
					hydrating = false;
					console.warn("[changhai-brand-setting] host settings unavailable, using browser seed:", error.message);
				})
				.finally(() => {
					persist();
				});

			// ── brand slots ──────────────────────────────────────────────────
			// One slot per configured surface, re-claimed only when the SET of
			// surfaces changes: value edits ride the store hook instead.
			const brandFace = () => ({ hooks: { brand: store } });
			const componentFor = (slot) =>
				slot === "sidebar.brand.mark" ? BrandMark : slot === "conversation.hero.brand.mark" ? HeroMark : BrandName;
			ctx.effect(() => {
				let held = "";
				let disposers = [];
				const reconcile = () => {
					const slots = occupancy(store.getSnapshot());
					const signature = slots.join("|");
					if (signature === held) return;
					for (const dispose of disposers) dispose();
					disposers = [];
					held = signature;
					for (const slot of slots) {
						disposers.push(
							ctx.slots.inject(slot, () =>
								ctx.slots.register({ name: slot, priority: BRAND_PRIORITY, inject: brandFace }, componentFor(slot)),
							),
						);
					}
				};
				reconcile();
				const unsubscribe = store.subscribe(reconcile);
				return () => {
					unsubscribe();
					for (const dispose of disposers) dispose();
					disposers = [];
				};
			}, "changhai-brand-setting: brand occupants");

			// ── settings page ────────────────────────────────────────────────
			const sectionFace = () => ({
				hooks: { brand: store, notice: notices },
				set: (patch) => store.patch(patch),
				reset: () => store.replace({}),
				chooseImage: (accept) => pickImage(accept),
				dismissNotice: () => notices.set(""),
				shippedHeadline: shippedCopy(ctx).headline,
				shippedBadge: shippedCopy(ctx).badge,
			});
			let disposeSection = null;
			const registerSection = () => {
				if (disposeSection !== null) disposeSection();
				const label = ctx.locale.bind(NS)("section.label");
				disposeSection = ctx.slots.inject("settings.section", () =>
					ctx.slots.register(
						{
							name: "settings.section",
							id: SECTION_ID,
							order: SECTION_ORDER,
							label,
							locale: NS,
							inject: sectionFace,
						},
						BrandSection,
					),
				);
			};
			registerSection();
			// The shell keeps its nav labels as plain strings, so a locale switch
			// re-registers the page with fresh text instead of subscribing it.
			ctx.on("locale/change", registerSection);
			ctx.effect(
				() => () => {
					if (disposeSection !== null) disposeSection();
					disposeSection = null;
				},
				"changhai-brand-setting: settings page",
			);

			// ── non-slot surfaces ────────────────────────────────────────────
			// Hero copy, tab title and favicon are not extension points. They are
			// re-applied on DOM mutations (React replaces that DOM without notifying
			// anyone) and only while something is configured.
			let frame = null;
			const sync = () => {
				frame = null;
				const state = store.getSnapshot();
				try {
					const shipped = shippedCopy(ctx);
					syncHeroCopy(state, shipped);
					syncHeroTagline(state, shipped);
					syncTitle(state);
					syncFavicon(state);
				} catch (error) {
					console.error("[changhai-brand-setting] brand sync failed", error);
				}
			};
			const schedule = () => {
				if (frame !== null) return;
				frame = window.requestAnimationFrame(sync);
			};
			ctx.effect(
				() => {
					const observer = new MutationObserver(schedule);
					// "Align to title" is the one surface whose value is a *layout*
					// measurement (how far the centred title sits from the row's left
					// edge), so it can go stale without any DOM mutation to observe —
					// a viewport change, a sidebar fold, or a web font swapping in all
					// reflow the title while leaving the observed DOM untouched. A
					// resize listener re-schedules the sync so the inset is re-measured.
					const onResize = () => {
						if (copyActive(store.getSnapshot())) schedule();
					};
					window.addEventListener("resize", onResize);
					let observing = false;
					const onChange = () => {
						const active = copyActive(store.getSnapshot());
						if (active && !observing) {
							observing = true;
							observer.observe(document.body, { childList: true, subtree: true, characterData: true });
						} else if (!active && observing) {
							observing = false;
							observer.disconnect();
							// One last pass restores the shipped copy from the nodes this
							// plugin replaced, before their record is dropped.
							sync();
							tracked.clear();
							return;
						}
						// A settings edit must reach the page on its own: mutations only
						// cover what React re-renders afterwards.
						if (active) schedule();
					};
					onChange();
					const unsubscribe = store.subscribe(onChange);
					return () => {
						unsubscribe();
						observer.disconnect();
						window.removeEventListener("resize", onResize);
						if (frame !== null) window.cancelAnimationFrame(frame);
						frame = null;
					};
				},
				"changhai-brand-setting: dom substitutions",
			);

			/** Console escape hatch for scripted setups and quick checks. */
			window.__DSH_BRAND = {
				get: () => ({ ...store.getSnapshot() }),
				set: (values) => {
					store.patch(values ?? {});
					persist();
					return { ...store.getSnapshot() };
				},
				reset: () => {
					store.replace({});
					persist();
				},
				slots: () => occupancy(store.getSnapshot()),
				help: () =>
					console.log(
						[
							"changhai-brand-setting",
							"  __DSH_BRAND.set({ enabled: '1', logoKind: 'text', logoText: '长海', nameKind: 'text', nameText: 'changhai' })",
							"  __DSH_BRAND.get()   // current settings",
							"  __DSH_BRAND.reset() // back to the shipped brand",
							"  __DSH_BRAND.slots() // slots currently claimed",
							"kinds: shipped | image | text | none",
						].join("\n"),
					),
			};
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});

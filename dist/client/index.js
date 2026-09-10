var module = { exports: {} }; var exports = module.exports; window.__ModuleLoader__.load({ id: "dsh-lexiforge", factory: (require) => {
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.tsx
var index_exports = {};
__export(index_exports, {
  SettingsPanel: () => SettingsPanel,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
async function api(body) {
  const response = await fetch("/lexiforge/api", { method: "POST", headers: { "Content-Type": "application/json", "X-LexiForge": "1" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || result.error) throw new Error(result.error ?? `HTTP ${response.status}`);
  return result.value;
}
var tokens = {
  bgBase: "var(--dsw-alias-bg-base)",
  layer1: "var(--dsw-alias-bg-layer-1)",
  layer2: "var(--dsw-alias-bg-layer-2)",
  border1: "var(--dsw-alias-border-l1)",
  border2: "var(--dsw-alias-border-l2)",
  label: "var(--dsw-alias-label-primary)",
  label2: "var(--dsw-alias-label-secondary)",
  caption: "var(--dsw-alias-label-caption)",
  brand: "var(--dsw-alias-brand-primary)",
  buttonPrimary: "var(--dsw-alias-button-primary-fill)",
  buttonPrimaryHover: "var(--dsw-alias-button-primary-hover)",
  ghost: "var(--dsw-alias-button-ghost-active-fill)",
  ghostBorder: "var(--dsw-alias-button-ghost-active-border)",
  hover: "var(--dsw-alias-interactive-bg-hover)",
  danger: "var(--dsw-alias-state-error-primary)",
  success: "var(--dsw-alias-state-success-primary)",
  warn: "var(--dsw-alias-state-warn-primary)"
};
var btn = (primary = false, danger = false) => ({
  borderRadius: 999,
  padding: "5px 14px",
  fontSize: 13,
  border: `1px solid ${danger ? tokens.danger : primary ? "transparent" : tokens.border2}`,
  cursor: "pointer",
  background: danger ? "transparent" : primary ? tokens.buttonPrimary : tokens.ghost,
  color: danger ? tokens.danger : primary ? "var(--dsw-alias-label-primary-inverted)" : tokens.label
});
var input = {
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${tokens.border2}`,
  background: tokens.bgBase,
  color: tokens.label,
  fontSize: 14,
  outline: "none"
};
var card = {
  border: `1px solid ${tokens.border1}`,
  borderRadius: 12,
  background: tokens.layer1,
  padding: "14px 16px",
  marginBottom: 10
};
var MODE_HINT = { A: "LLM \u6539\u5199", B: "\u672F\u8BED\u5E93\u68C0\u7D22", C: "\u672C\u5730\u89C4\u5219", composite: "" };
var modeBadge = (mode) => mode === "composite" ? "\u590D\u5408\u6A21\u5F0F" : mode;
function SettingsPanel() {
  const [state, setState] = (0, import_react.useState)({ enabled: false, packs: [], timeoutMs: 500, debugEnabled: false, debugLogFile: null, disclaimer: null, disclaimerVersion: 1 });
  const [timeoutInput, setTimeoutInput] = (0, import_react.useState)("0.5");
  const [items, setItems] = (0, import_react.useState)(null);
  const [searching, setSearching] = (0, import_react.useState)(false);
  const [searched, setSearched] = (0, import_react.useState)(false);
  const [query, setQuery] = (0, import_react.useState)("");
  const [repo, setRepo] = (0, import_react.useState)("");
  const [error, setError] = (0, import_react.useState)("");
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [drag, setDrag] = (0, import_react.useState)();
  const [doc, setDoc] = (0, import_react.useState)(null);
  const [docOpen, setDocOpen] = (0, import_react.useState)(false);
  const [docAgreed, setDocAgreed] = (0, import_react.useState)(false);
  const [pendingInstall, setPendingInstall] = (0, import_react.useState)(null);
  const [pendingPack, setPendingPack] = (0, import_react.useState)(null);
  const [packPick, setPackPick] = (0, import_react.useState)(null);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  (0, import_react.useEffect)(() => {
    let live = true;
    void api({ action: "state" }).then((s) => {
      if (live) {
        setState(s);
        setTimeoutInput(String(s.timeoutMs / 1e3));
      }
    }).catch((e) => {
      if (live) setError(String(e));
    });
    return () => {
      live = false;
    };
  }, []);
  const save = (enabled, packs, timeoutMs = state.timeoutMs, debugEnabled = state.debugEnabled) => run(async () => {
    const updated = { enabled, packs: packs.map(({ id, enabled: enabled2, priority }) => ({ id, enabled: enabled2, priority })), timeoutMs, debugEnabled };
    setState(await api({ action: "configure", state: updated }));
  });
  const commitTimeout = () => {
    const seconds = Number(timeoutInput);
    if (!Number.isFinite(seconds)) {
      setError("\u8D85\u65F6\u5FC5\u987B\u662F\u6570\u5B57\uFF08\u79D2\uFF09");
      return;
    }
    const clamped = Math.min(600, Math.max(0.1, seconds));
    setTimeoutInput(String(clamped));
    void save(state.enabled, state.packs, Math.round(clamped * 1e3));
  };
  const search = () => run(async () => {
    setSearching(true);
    try {
      setItems(await api({ action: "search", query }));
      setSearched(true);
    } finally {
      setSearching(false);
    }
  });
  const openDisclaimer = async (installRepo, installPack = null) => {
    setPendingInstall(installRepo);
    setPendingPack(installPack);
    setDocAgreed(false);
    try {
      setDoc(await api({ action: "disclaimer" }));
      setDocOpen(true);
    } catch (e) {
      setError(String(e));
    }
  };
  const acceptAndInstall = () => {
    if (!doc || !docAgreed) return;
    void run(async () => {
      setState(await api({ action: "accept-disclaimer", version: doc.version }));
      setDocOpen(false);
      if (pendingInstall) {
        setState(await api({ action: "install", repo: pendingInstall, pack: pendingPack ?? void 0, confirmed: true }));
        setPendingInstall(null);
        setPendingPack(null);
      }
    });
  };
  const startInstall = (repository, packId) => {
    const accepted2 = state.disclaimer && state.disclaimer.version >= state.disclaimerVersion;
    if (!accepted2) {
      void openDisclaimer(repository, packId);
      return;
    }
    if (!window.confirm(`\u5B89\u88C5\u7B2C\u4E09\u65B9\u8BED\u8A00\u5305 ${repository}${packId ? ` \xB7 ${packId}` : ""}\uFF1F\u683C\u5F0F\u6821\u9A8C\u4E0D\u7B49\u4E8E\u5185\u5BB9\u5B89\u5168\u5BA1\u6838\u3002\u5176\u63D0\u793A\u8BCD\u53EF\u80FD\u53D1\u9001\u6587\u672C\u7ED9\u5F53\u524D\u6A21\u578B\u670D\u52A1\u3002\u662F\u5426\u627F\u62C5\u98CE\u9669\u5E76\u7EE7\u7EED\uFF1F`)) return;
    void run(async () => {
      setState(await api({ action: "install", repo: repository, pack: packId ?? void 0, confirmed: true }));
    });
  };
  const install = (repository) => {
    void run(async () => {
      const listing = await api({ action: "repo-packs", repo: repository });
      if (listing.collection && listing.packs.length > 1) {
        setPackPick({ repo: repository, packs: listing.packs });
        return;
      }
      startInstall(repository, null);
    });
  };
  const ordered = [...state.packs].sort((a, b) => a.priority - b.priority);
  const enabledCount = ordered.filter((p) => p.enabled).length;
  const accepted = state.disclaimer !== null && state.disclaimer.version >= state.disclaimerVersion;
  const move = (from, to) => {
    const next = [...ordered];
    const source = next.findIndex((p) => p.id === from), target = next.findIndex((p) => p.id === to);
    if (source < 0 || target < 0) return;
    next.splice(target, 0, next.splice(source, 1)[0]);
    void save(state.enabled, next.map((p, priority) => ({ ...p, priority })));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { style: { maxWidth: 860, padding: "28px 8px", margin: "0 auto", color: tokens.label, fontSize: 14, overflowWrap: "anywhere", position: "relative" }, "aria-label": "\u8BED\u8A00\u6A21\u7EC4", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", { style: { marginBottom: 20 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { style: { fontSize: 18, margin: "0 0 6px" }, children: "LexiForge \xB7 \u8BED\u8A00\u6A21\u7EC4" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { margin: 0, fontSize: 12, color: tokens.label2 }, children: "\u5BF9 AI \u8F93\u51FA\u505A\u914D\u7F6E\u9A71\u52A8\u7684\u8BED\u8A00\u52A0\u5DE5\uFF1B\u5305\u6309\u987A\u5E8F\u94FE\u5F0F\u5904\u7406\uFF0C\u8D85\u65F6\u6216\u5931\u8D25\u56DE\u9000\u539F\u6587\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, marginTop: 10, fontSize: 12, color: tokens.label2, flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { color: state.enabled ? tokens.success : tokens.caption }, children: [
          "\u25CF ",
          state.enabled ? "\u5DF2\u542F\u7528" : "\u5DF2\u505C\u7528"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u5DF2\u88C5 ",
          state.packs.length,
          " \u5305 \xB7 \u6FC0\u6D3B ",
          enabledCount,
          " \u4E2A"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
          "\u8D85\u65F6 ",
          Math.round(state.timeoutMs) / 1e3,
          "s"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => void openDisclaimer(null), style: { ...btn(), padding: "2px 10px", fontSize: 12 }, children: [
          "\u514D\u8D23\u58F0\u660E",
          state.disclaimer && state.disclaimer.version >= state.disclaimerVersion ? `\uFF08\u5DF2\u63A5\u53D7 v${state.disclaimer.version}\uFF09` : "\uFF08\u672A\u63A5\u53D7\uFF09"
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { role: "alert", style: { color: tokens.danger, margin: "0 0 8px", fontSize: 12 }, children: error }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { disabled: busy, style: { border: 0, padding: 0, margin: 0 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: card, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600 }, children: "\u542F\u7528\u8BED\u8A00\u52A0\u5DE5" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 2 }, children: "\u5F00\u542F\u540E\u5BF9\u6BCF\u6761\u56DE\u590D\u5E94\u7528\u5DF2\u6FC0\u6D3B\u7684\u8BED\u8A00\u5305\u3002" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: state.enabled, onChange: (e) => void save(e.target.checked, state.packs), style: { width: 18, height: 18, accentColor: tokens.brand, cursor: "pointer" }, "aria-label": "\u542F\u7528\u8BED\u8A00\u52A0\u5DE5" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.border1}` }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600 }, children: "\u5904\u7406\u8D85\u65F6\uFF08\u79D2\uFF09" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 2 }, children: "\u6BCF\u4E2A A/B \u5305\u6539\u5199\u7684\u6700\u957F\u7B49\u5F85\uFF1B\u8D85\u65F6\u5219\u8DF3\u8FC7\u8BE5\u5305\u3002\u8303\u56F4 0.1\u2013600\uFF0C\u9ED8\u8BA4 0.5\u3002\u6539\u540E\u5373\u65F6\u751F\u6548\u3002" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "number", min: 0.1, max: 600, step: 0.1, value: timeoutInput, onChange: (e) => setTimeoutInput(e.target.value), onBlur: commitTimeout, onKeyDown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTimeout();
              }
            }, style: { ...input, width: 90 }, "aria-label": "\u5904\u7406\u8D85\u65F6\u79D2\u6570" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), onClick: commitTimeout, children: "\u5E94\u7528" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: `1px solid ${tokens.border1}` }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600 }, children: "\u8C03\u8BD5\u6A21\u5F0F" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 2 }, children: [
              "\u5F00\u542F\u540E\u8F93\u51FA\u8FD0\u884C\u65E5\u5FD7\uFF08\u542B\u5904\u7406\u6587\u672C\u7247\u6BB5\uFF09\u5230\u8BED\u8A00\u5305\u6570\u636E\u76EE\u5F55\u4E0B\u7684 ",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: state.debugLogFile ?? "\uFF08\u672A\u914D\u7F6E\uFF09" }),
              "\uFF08\u76F8\u5BF9 packagesDir \u89E3\u6790\uFF09\u3002\u53EF\u80FD\u5E26\u6765\u526F\u4F5C\u7528\uFF1A\u6027\u80FD\u4E0B\u964D\u3001\u78C1\u76D8\u5360\u7528\u3001\u672C\u5730\u7559\u4E0B\u542B\u56DE\u590D\u5185\u5BB9\u7684\u8BB0\u5F55\uFF0C\u8BF7\u4EC5\u5728\u6392\u969C\u65F6\u5F00\u542F\u3002"
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: state.debugEnabled, onChange: (e) => void save(state.enabled, state.packs, state.timeoutMs, e.target.checked), style: { width: 18, height: 18, accentColor: tokens.brand, cursor: "pointer" }, "aria-label": "\u8C03\u8BD5\u6A21\u5F0F" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", { style: { fontSize: 14, margin: "18px 2px 10px", display: "flex", gap: 8, alignItems: "baseline" }, children: [
        "\u5DF2\u5B89\u88C5\u8BED\u8A00\u5305",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: tokens.caption, fontWeight: 400 }, children: "\u62D6\u62FD\u6216\u4E0A\u4E0B\u79FB\u8C03\u6574\u94FE\u5F0F\u987A\u5E8F" })
      ] }),
      !ordered.length && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...card, color: tokens.label2, fontSize: 13, textAlign: "center" }, children: "\u6682\u65E0\u8BED\u8A00\u5305\uFF0C\u4ECE\u4E0B\u65B9\u5E02\u573A\u5B89\u88C5\u6216\u624B\u52A8\u5B89\u88C5 ZIP\u3002" }),
      ordered.map((p, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { draggable: !busy, onDragStart: () => setDrag(p.id), onDragOver: (e) => e.preventDefault(), onDrop: () => {
        if (drag) move(drag, p.id);
      }, style: { ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", cursor: busy ? "default" : "grab" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: tokens.caption, fontSize: 12, width: 14 }, children: index + 1 }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 220px", minWidth: 180 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 14 }, children: p.manifest.name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 11, padding: "1px 8px", borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }, children: [
              modeBadge(p.manifest.mode),
              MODE_HINT[p.manifest.mode] ? ` \xB7 ${MODE_HINT[p.manifest.mode]}` : ""
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 12, color: tokens.caption }, children: [
              "v",
              p.manifest.version
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 3 }, children: [
            p.enabled ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: tokens.success }, children: "\u5DF2\u6FC0\u6D3B" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: tokens.caption }, children: "\u5DF2\u505C\u7528" }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 10 }, children: p.manifest.author })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginLeft: "auto" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: p.enabled, onChange: (e) => void save(state.enabled, state.packs.map((x) => x.id === p.id ? { ...x, enabled: e.target.checked } : x)), style: { accentColor: tokens.brand, cursor: "pointer" } }),
            "\u542F\u7528"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(), disabled: index === 0, onClick: () => move(p.id, ordered[index - 1].id), children: "\u4E0A\u79FB" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(), disabled: index === ordered.length - 1, onClick: () => move(p.id, ordered[index + 1].id), children: "\u4E0B\u79FB" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(false, true), onClick: () => {
            if (window.confirm(`\u5378\u8F7D ${p.manifest.name}\uFF1F`)) void run(async () => setState(await api({ action: "uninstall", id: p.id })));
          }, children: "\u5378\u8F7D" })
        ] })
      ] }, p.id)),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { fontSize: 14, margin: "22px 2px 10px" }, children: "\u8BED\u8A00\u5305\u5E02\u573A" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, padding: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (e) => {
          e.preventDefault();
          void search();
        }, style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "\u641C\u7D22\u5173\u952E\u8BCD", placeholder: "\u641C\u7D22 GitHub \u4E0A\u7684 dsh \u8BED\u8A00\u5305\u2026", value: query, onChange: (e) => setQuery(e.target.value), style: { ...input, flex: 1 } }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), disabled: searching, children: searching ? "\u641C\u7D22\u4E2D\u2026" : "\u641C\u7D22" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, color: tokens.caption, margin: "8px 2px 0" }, children: "Star \u4EC5\u4EE3\u8868\u6D41\u884C\u5EA6\uFF0C\u4E0D\u4EE3\u8868\u5B89\u5168\u3002\u6240\u6709\u6765\u6E90\u5747\u6807\u8BB0\u4E3A\u7B2C\u4E09\u65B9\u672A\u5BA1\u6838\u3002" })
      ] }),
      items === null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, color: tokens.caption, textAlign: "center", fontSize: 13 }, children: [
        "\u8F93\u5165\u5173\u952E\u8BCD\u641C\u7D22 ",
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { style: { color: tokens.label2 }, children: "topic:dsh-langpack" }),
        " \u4ED3\u5E93\u3002"
      ] }),
      items !== null && !items.length && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, color: tokens.label2, textAlign: "center", fontSize: 13 }, children: [
        "\u6CA1\u6709\u5339\u914D\u7ED3\u679C",
        searched ? "\uFF08\u8BDD\u9898\u4E0B\u53EF\u80FD\u8FD8\u6CA1\u6709\u4ED3\u5E93\uFF09" : "",
        "\u3002"
      ] }),
      items?.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", { style: { ...card, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: "1 1 260px", minWidth: 200 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: item.url, target: "_blank", rel: "noreferrer", style: { color: tokens.brand, fontWeight: 600, textDecoration: "none" }, children: item.full_name }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 12, color: tokens.caption }, children: [
              "\u2605 ",
              item.stars
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, padding: "1px 8px", borderRadius: 999, border: `1px solid ${tokens.warn}55`, color: tokens.warn }, children: "\u672A\u5BA1\u6838" })
          ] }),
          item.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 4 }, children: item.description })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), onClick: () => install(item.full_name), children: "\u5B89\u88C5" }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: `${item.url}/issues`, target: "_blank", rel: "noreferrer", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(), children: "\u53CD\u9988 / \u4E3E\u62A5" }) })
        ] })
      ] }, item.full_name)),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { style: { fontSize: 14, margin: "22px 2px 10px" }, children: "\u624B\u52A8\u5B89\u88C5" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...card, padding: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", { onSubmit: (e) => {
          e.preventDefault();
          install(repo);
        }, style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { "aria-label": "GitHub \u4ED3\u5E93 URL", placeholder: "owner/repo \u6216 GitHub \u4ED3\u5E93 URL\uFF08\u6839\u76EE\u5F55\u9700\u6709 langpack.zip\uFF09", value: repo, onChange: (e) => setRepo(e.target.value), style: { ...input, flex: "1 1 280px" } }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), children: "\u5B89\u88C5" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { style: { fontSize: 12, color: tokens.caption, margin: "8px 2px 0" }, children: [
          "\u672C\u5730 ZIP \u8BF7\u4F7F\u7528 CLI\uFF1A",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", { children: "lexiforge ROOT install \u5305.zip ID --accept-risk" }),
          "\u3002Token \u7531\u4E3B\u673A githubToken \u6216 CLI GITHUB_TOKEN \u63D0\u4F9B\uFF0C\u4E0D\u53D1\u9001\u5230\u6D4F\u89C8\u5668\u3002"
        ] })
      ] })
    ] }),
    !accepted && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { position: "absolute", inset: 0, zIndex: 60, background: "var(--dsw-alias-bg-mask-2)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, padding: "22px 26px", maxWidth: 520, textAlign: "center" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 700, fontSize: 16, marginBottom: 8 }, children: "\u529F\u80FD\u4E0D\u53EF\u7528" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, color: tokens.label2, lineHeight: 1.7, marginBottom: 16 }, children: "\u9996\u6B21\u4F7F\u7528\u524D\uFF0C\u987B\u5148\u9605\u8BFB\u5E76\u63A5\u53D7\u300A\u7B2C\u4E09\u65B9\u8BED\u8A00\u5305\u514D\u8D23\u58F0\u660E\u300B\u3002\u58F0\u660E\u6DB5\u76D6\u516C\u5F00\u4ED3\u5E93\u53EF\u80FD\u5B58\u5728\u7684\u6076\u610F\u4E0E\u75C5\u6BD2\u6587\u4EF6\u3001\u63D0\u793A\u8BCD\u6CE8\u5165\u3001\u9690\u79C1\u4E0E\u6570\u636E\u5916\u6D41\u7B49\u98CE\u9669\u3002\u63A5\u53D7\u8BB0\u5F55\u4EC5\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u4E0D\u4F1A\u4E0A\u4F20\u3002" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), onClick: () => void openDisclaimer(null), children: "\u9605\u8BFB\u5E76\u540C\u610F" })
    ] }) }),
    packPick && packPick.packs.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "dialog", "aria-modal": "true", style: { position: "fixed", inset: 0, background: "var(--dsw-alias-bg-mask-1)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, maxWidth: 620, width: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "14px 20px", borderBottom: `1px solid ${tokens.border1}` }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 700, fontSize: 16 }, children: [
          "\u8BE5\u4ED3\u5E93\u5305\u542B ",
          packPick.packs.length,
          " \u4E2A\u8BED\u8A00\u5305"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 2 }, children: [
          packPick.repo,
          " \xB7 \u8BF7\u9009\u62E9\u8981\u5B89\u88C5\u7684\u4E00\u4E2A"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 8, overflowY: "auto", flex: 1 }, children: packPick.packs.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { onClick: () => {
        const repo2 = packPick.repo;
        setPackPick(null);
        startInstall(repo2, p.id);
      }, style: { ...card, width: "100%", textAlign: "left", cursor: "pointer", color: tokens.label, display: "block", fontFamily: "inherit", fontSize: 14 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600 }, children: p.name }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, padding: "1px 8px", borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }, children: p.id }),
          p.mode && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, padding: "1px 8px", borderRadius: 999, border: `1px solid ${tokens.border2}`, color: tokens.label2 }, children: p.mode }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: 12, color: tokens.caption }, children: [
            "v",
            p.version
          ] })
        ] }),
        p.description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 4 }, children: p.description }),
        p.author && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontSize: 12, color: tokens.caption, marginTop: 2 }, children: [
          "\u4F5C\u8005\uFF1A",
          p.author
        ] })
      ] }, p.id)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "10px 16px", borderTop: `1px solid ${tokens.border1}` }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(), onClick: () => setPackPick(null), children: "\u53D6\u6D88" }) })
    ] }) }),
    docOpen && doc && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "dialog", "aria-modal": "true", style: { position: "fixed", inset: 0, background: "var(--dsw-alias-bg-mask-1)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { background: tokens.layer2, border: `1px solid ${tokens.border2}`, borderRadius: 16, maxWidth: 680, width: "100%", maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "14px 20px", borderBottom: `1px solid ${tokens.border1}` }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 700, fontSize: 16 }, children: [
          "\u7B2C\u4E09\u65B9\u8BED\u8A00\u5305\u514D\u8D23\u58F0\u660E v",
          doc.version
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: tokens.label2, marginTop: 2 }, children: pendingInstall ? `\u5B89\u88C5\u300C${pendingInstall}${pendingPack ? ` \xB7 ${pendingPack}` : ""}\u300D\u524D\u5FC5\u987B\u901A\u8BFB\u5E76\u786E\u8BA4\u3002` : "\u5185\u5BB9\u5982\u4E0B\uFF0C\u53EF\u968F\u65F6\u67E5\u770B\u3002" })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: "4px 20px 12px", overflowY: "auto", flex: 1, fontSize: 13, lineHeight: 1.7 }, children: doc.sections.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { margin: "12px 0" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, fontSize: 14, marginBottom: 4 }, children: s.title }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { whiteSpace: "pre-wrap", color: tokens.label2 }, children: s.body })
      ] }, s.title)) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: "12px 20px", borderTop: `1px solid ${tokens.border1}`, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", gap: 8, alignItems: "center", fontSize: 13, cursor: pendingInstall || !accepted ? "pointer" : "default", color: pendingInstall || !accepted ? tokens.label : tokens.caption }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "checkbox", checked: docAgreed, disabled: !pendingInstall && accepted, onChange: (e) => setDocAgreed(e.target.checked), style: { accentColor: tokens.brand } }),
          pendingInstall || !accepted ? "\u6211\u5DF2\u901A\u8BFB\u5E76\u7406\u89E3\u4E0A\u8FF0\u5168\u90E8\u98CE\u9669\uFF0C\u81EA\u613F\u627F\u62C5\u540E\u679C" : "\uFF08\u67E5\u770B\u6A21\u5F0F\uFF1A\u65E0\u9700\u786E\u8BA4\uFF09"
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(), onClick: () => {
            setDocOpen(false);
            setPendingInstall(null);
            setDocAgreed(false);
          }, children: "\u5173\u95ED" }),
          (pendingInstall !== null || !accepted) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { style: btn(true), disabled: !docAgreed, onClick: acceptAndInstall, children: pendingInstall !== null ? "\u786E\u8BA4\u5E76\u5B89\u88C5" : "\u540C\u610F\u5E76\u89E3\u9501" })
        ] })
      ] })
    ] }) })
  ] });
}
var inject = ["slots"];
function apply(ctx) {
  ctx.slots.inject("settings.section", () => ctx.slots.register({ name: "settings.section", id: "lexiforge", order: 50, label: "\u8BED\u8A00\u6A21\u7EC4" }, SettingsPanel));
}
return module.exports; } });

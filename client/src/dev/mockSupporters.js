// DEV-ONLY FIXTURE — never real data, never shipped to production.
//
// Exists purely to preview the Supporters marquee's scroll/loop feel at a
// realistic item count before any real supporter data exists. Every entry
// is an obviously-fake numbered placeholder — never a name that could pass
// as a real person or organization.
//
// This file is only reachable from Welcome.jsx behind two gates:
//   1. `import.meta.env.DEV` — a compile-time constant, so Vite's production
//      build dead-code-eliminates the branch that references this import,
//      and the module (plus these strings) never ends up in the shipped
//      bundle at all.
//   2. an explicit `?mockSupporters=<count>` query flag — so it doesn't even
//      show up by default in a local dev session, only when asked for.
export function makeMockSupportersDevOnly(count) {
  return Array.from({ length: count }, (_, i) => ({
    name: `ผู้สนับสนุน ${String(i + 1).padStart(2, '0')}`,
  }));
}

# CLI Framework Comparison Research

> Agent: cli-framework-researcher
> Date: 2025-02-21
> Task: Find the best 3rd-party module for CLI arg parsing and command routing

## Current State

Our CLI (`@meet-ai/cli`) is a 447-line hand-rolled parser using a `switch` statement on `process.argv.slice(2)`, with a custom `parseFlags()` function. Current built output: **28.6 KB**. Zero dependencies. 11 subcommands.

Pain points: repetitive `--help` checks, repetitive `rejectFlagLikeArgs` calls, manual usage strings duplicated across command bodies and the default help text.

---

## Detailed Comparison Table

| Criteria | **arg** | **citty** | **cac** | **commander** | **cleye** | **clipanion** | **meow** | **yargs** |
|---|---|---|---|---|---|---|---|---|
| **Bundle Size** (min) | **2.7 KB** | **7.2 KB** | **9.9 KB** | 41.4 KB | 40.8 KB | 48.4 KB | 132 KB | 111.5 KB |
| **Bundle Size** (gzip) | **1.5 KB** | **3.0 KB** | **3.6 KB** | 12.0 KB | 13.6 KB | 14.3 KB | 45.4 KB | 33.9 KB |
| **Install Deps** | 0 | 0 | 0 | 0 | 2 | 1 | 0 | 12 |
| **GitHub Stars** | 1.3K | 1.1K | 2.9K | 28K | 611 | 1.2K | 3.7K | 11.4K |
| **Weekly Downloads** | 62.6M | 14.5M | 22.3M | 27.9M | 83K | 4.4M | 3.7M | 11.4M |
| **Last Updated** | 4 years ago | 9 days ago | 3 years ago | 21 days ago | 2 months ago | 1 year ago | 1 day ago | 9 months ago |
| **TypeScript Types** | Bundled .d.ts | Native (100% TS) | Written in TS | Bundled .d.ts | Native (TS-first) | Native (98.6% TS) | TS config present | @types/yargs needed |
| **Type Inference** | Manual only | Inferred from `defineCommand` | Weak (any in actions) | Weak (manual generics) | Strong (inferred from flag defs) | Strong (class decorators) | Strong (from flag defs) | Moderate (chaining) |
| **ESM Native** | No (CJS only) | Yes | Yes (dual) | CJS default, ESM export | Yes | Yes | Yes | Yes |
| **Subcommand Support** | None | Yes (nested) | Yes (git-like) | Yes (nested) | Yes | Yes (class-based) | Limited | Yes |
| **Auto-generated Help** | None | Yes | Yes | Yes | Yes (responsive) | Yes | Yes | Yes |
| **Bun Works?** | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

---

## Analysis by Library

### arg (Vercel) - The minimalist
2.7 KB, but only a parser. No subcommands, no help generation. Abandoned/feature-complete (4 years old). Not a real improvement over hand-rolled approach.

### citty (UnJS) - The modern lightweight pick
7.2 KB, zero deps, ESM-native, 100% TypeScript with inferred types. Nested subcommands, auto-generated help. Actively maintained by UnJS team (Nuxt ecosystem). Caveat: v0.2.x (pre-1.0), sparse docs.

### cac (egoist) - The proven lightweight option
9.9 KB, zero deps. Used by Vite internally. Git-like subcommands. Caveat: last updated 3 years ago, weak type inference (action callbacks are `any`).

### commander - The industry standard
41.4 KB, zero deps, 28K stars. CJS-first. Weak TypeScript inference. 4x-6x heavier than citty/cac.

### cleye - TypeScript-first
40.8 KB (due to 2 deps). Strongest type inference. Only 611 stars, 83K weekly downloads.

### clipanion (Yarn) - Class-based
48.4 KB. Overkill for simple tools. Still at 4.0.0-rc.

### meow (sindresorhus)
132 KB - disqualifying. Basic subcommand support.

### yargs
111.5 KB with 12 transitive deps. Massively heavy.

---

## Top 3 Recommendations

### #1: citty (RECOMMENDED)
- **7.2 KB bundled** - adds ~7 KB while removing hundreds of lines of boilerplate
- ESM-native, zero deps, 100% TypeScript with inferred types
- Nested subcommands + auto-generated help
- Actively maintained by UnJS team
- `defineCommand` + `subCommands` maps almost 1:1 to existing switch/case
- Risk: v0.2.x, sparse docs, smaller community

### #2: cac
- **9.9 KB bundled**, zero deps
- Used by Vite (30M+ weekly downloads of Vite)
- Stable for years, feature-complete
- Weaker TypeScript inference (action callbacks are `any`)
- Pick if you value proven stability over active maintenance

### #3: commander (safe choice)
- **41.4 KB bundled** - 4x citty
- 28K stars, deeply documented, largest community
- Weaker TypeScript inference
- Pick only if bundle size is not a constraint

---

## Alternative: node:util parseArgs (zero deps)

Node.js 18.3+ and Bun both support `util.parseArgs()` natively:

```typescript
import { parseArgs } from "node:util";

const { values, positionals } = parseArgs({
  args: process.argv.slice(3),
  options: {
    room: { type: "string", short: "r" },
    json: { type: "boolean" },
    verbose: { type: "boolean", short: "v" },
  },
  allowPositionals: true,
});
```

This gives `--flag=value`, `-r value`, `--json` (boolean), and proper error messages for free. But no subcommand routing or auto-generated help.

---

## My Strong Recommendation: citty

For a CLI that ships as a single-file via `bun build`, is used by AI agents, and has zero dependencies, **citty** is the clear winner. Most value (subcommand routing, typed args, auto-help) at lowest cost (7.2 KB, zero deps, ESM-native).

---

## DECISION (Owner: @isnifer, 2026-02-21)

**APPROVED: citty** is the chosen CLI framework.

Additional decisions:
- **zod** will be added as the validation layer for command arguments. Zod schemas are the source of truth for argument validation, not citty's built-in arg types.
- Each command will have its own directory with: `usecase.ts` (business logic + zod validation), `command.ts` (citty binding), `usecase.test.ts` (tests).
- The `command.ts` receives raw args from citty's `run`, validates via zod schema, then calls the usecase.

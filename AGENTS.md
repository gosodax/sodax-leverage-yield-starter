# AGENTS.md

What this repo is and the rules for working in it. For how the SODAX SDK works, use SODAX's own docs:
https://docs.sodax.com/ai-integration-guide.

## What this is

A whitelabel React starter for a workshop: participants use a coding agent to build **SODAX Leverage Yield**, the
pooled vaults whose shares are `lsoda*` tokens (lsodaWEETH, lsodaWSTETH, lsodaJITOSOL, lsodaSUSDS). Users deposit a
supported token from an EVM network, receive vault shares, and can withdraw later.

The feature is the **vaults**, not leverage *positions* (a different SODAX product).

Already done: wallet connection (EVM only), the SODAX SDK provider (mainnet), theme and layout. The vault UI goes in
`src/features/leverage-yield/`.

## Real money

This app runs on **mainnet with real funds**. There is no testnet vault.

- Never set `minOutputAmount` to `0`. Derive the minimum from a live quote.
- Slippage must stay at or below `MAX_SLIPPAGE_BPS` (`src/config/workshop.ts`).
- Never pass `skipSimulation`.
- Never ask for, read or store private keys or seed phrases, and never write scripts that sign or send
  transactions. Users sign in their own wallet, in the browser.
- No partner fee. Don't copy fee addresses from SODAX demos or docs.
- Show the user what they'll receive, the minimum they'll accept and the risks before they sign.

## Commands

```bash
pnpm install     # once
pnpm dev         # http://localhost:5173
pnpm check       # typecheck + lint + version/format guards. Run after every change.
pnpm build       # production build
pnpm preflight   # read-only health check of the SODAX API and RPCs
```

## Where things are

| Path | What | Edit? |
|---|---|---|
| `src/features/leverage-yield/` | The vault feature. `LeverageYieldPage.tsx` is the mount point. | **Yes: build here** |
| `src/config/workshop.ts` | Source networks, defaults, slippage and polling limits | Yes, if needed |
| `src/wallet/` | `useEvmWallet(chainKey)`: address, `walletProvider`, `isWrongChain`, `switchChain`, `connect` | No |
| `src/lib/` | Unit, formatting and explorer helpers | Add helpers if needed |
| `src/components/ui/` | Button, Card, Dialog, Select, Input, Badge, Callout, Skeleton, Tooltip | Reuse; add new primitives here |
| `src/brand/` | `theme.css` (colours, fonts, radii), `brand.config.ts` (name, logos) | Only for rebranding |
| `src/providers.tsx`, `src/config/{rpc,sodax,wallet}.ts`, `vite.config.ts` | SDK + wallet wiring | **No** |

## Rules

1. Use `useEvmWallet` from `@/wallet` for the wallet; don't import wagmi hooks in feature code.
2. **Never add or upgrade `@sodax/*` packages.** They're pinned to `2.2.0-rc.8` and already installed; `pnpm add
   @sodax/...` would install an older `latest`. `pnpm check` fails if that happens.
3. Style with the semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`, `bg-card`, …). Never hardcode
   colours or fonts in components; they live in `src/brand/theme.css`.
4. Don't poll faster than `REFETCH_MS`: a whole room shares one IP and the same public RPCs.
5. Keep feature code inside `src/features/leverage-yield/`. Run `pnpm check` before you say you're done.

## Workshop

The workshop is described in `docs/WORKSHOP.md`. Reference builds live on branches `checkpoint/m1` …
`checkpoint/m4` and `solution`.

On `main` and the checkpoints, `LeverageYieldPage.tsx` shows `<NextPrompt next={N} />` (from
`@/components/workshop/NextPrompt`): the prompt the participant pastes next, read from `docs/WORKSHOP.md`. Keep it
at the top of the page. When you finish milestone N, set `next={N + 1}`, or `next="done"` after Milestone 4 (or
after building the whole feature in one go).

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

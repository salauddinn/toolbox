# R01 Release Gate Record

**Date:** 2026-07-19
**Owner:** ToolBox parent orchestrator
**Scope:** Final local release verification after U01–U11; honest status of deploy/demo items
**Related:** `docs/P0-RELEASE-GATE.md`, `TASKS.md` §14–15, `docs/UI-IMPLEMENTATION-TODOS.md`

## Decision

| Gate | Result |
| --- | --- |
| Local UI + correctness release checks | **PASS** |
| Submission / public release claims | **NO-GO** until deploy/network/demo items below are evidenced |

All planned implementation todos **F00, G01–G05, U01–U11** are complete and committed. Remaining open items are environmental release checks, not unfinished product features.

## Local verification (2026-07-19)

Commands run on the development host after U11:

| Command | Result |
| --- | --- |
| `npm test` | passed (full Vitest) |
| `npm run lint` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm run test:e2e` | passed (landing + theme/a11y Playwright) |
| Controlled-example sequence | covered by `src/server/workflow/e2e-sequence.test.ts` |

Also previously verified during the queue:

- Unsupported syntax readiness (G01)
- Package-manager lockfile evidence (G02)
- Provider token budgets (G03)
- Composition-root cycle repair (G04)
- Bounded recoverable review payload (U01)
- Paper + Terminal UI through completion (U03–U11)
- Explicit user-controlled dark mode with persistence and Axe coverage (U11)

## Explicit dark mode

- Default: light paper
- Dark: user toggle only (`data-theme`), persisted in `localStorage`
- No `prefers-color-scheme` auto inversion
- Terminal remains a cooler near-black inset in both themes
- Playwright proves persistence, OS-dark independence, and no serious/critical Axe findings on landing in both themes

## Still open (submission blockers)

These are **not** marked complete.

| Item | Owner | Why open | Verification point |
| --- | --- | --- | --- |
| External-repository scenario | Release operator | Needs live public GitHub URL + network + AI provider | Deployed app against a real public repo |
| Controlled-example on deploy host | Release operator | Local host only so far | `npm test` / controlled E2E on deploy image |
| Incognito deployed-browser test | Release operator | No public URL in this gate | Deployed URL, cold browser |
| Process-restart recovery | Release operator | Needs real process recycle | Stop process → `/api/health` → prior runs gone |
| Three-minute demo timing + video | Demo presenter | Timing depends on deploy latency and narration | Timed walkthrough + published video |
| Public URL / repo publish / link audit | Submitter | Submission packaging | `TASKS.md` §15 |

## Non-claims

This record does **not** claim:

- Public deployment readiness
- External GitHub modernization success
- Three-minute demo timing
- Published demo video or pitch deck
- That P1 optional polish is complete

## Product surface after R01 local pass

- `/` — evidence-led landing, paper + terminal specimen, dark-mode toggle
- `/app` — repository start, gate failures, candidate decision, evidence inspector, Stage Plan, Change Set review, rollback/stop/completion
- Server contracts for eligibility, screening, ranking, authorization, validation, acceptance, and artifacts unchanged in meaning

## Next actions for submission

1. Deploy the application and record the public URL.
2. Run external-repository and deploy-host controlled-example checks; attach dated evidence.
3. Verify process restart + health recovery on the deploy host.
4. Time the demo under three minutes and publish the video.
5. Only then mark `TASKS.md` §14–15 complete.

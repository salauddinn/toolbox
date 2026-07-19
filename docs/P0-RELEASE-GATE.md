# P0 Release Gate Record

**Date:** 2026-07-19  
**Owner:** ToolBox parent orchestrator (Sol High)  
**Scope:** Decide whether broad Paper + Terminal UI work may begin after G01–G04  
**Related:** `TASKS.md` §14–15, `docs/UI-REDESIGN-PLAN.md`, `docs/UI-IMPLEMENTATION-TODOS.md`

## Decision

**GO for broad UI implementation (U01 onward).**

Correctness and safety P0 follow-ups required before visual redesign are complete and committed:

| Item | Status | Evidence |
| --- | --- | --- |
| Unsupported syntax → Transformation Readiness | Complete | `d71ccb6`, readiness + analyzer tests |
| Package-manager lockfile evidence | Complete | `33cd067`, extract + eligibility + snapshot tests |
| AI provider token budgets | Complete | `a5ea2ca`, provider + stage-runner tests |
| Cycle-repair composition-root injection | Complete | `ecc5349`, static + controlled E2E tests |
| Controlled-example full sequence | Complete locally | Vitest `e2e-sequence` passed 2026-07-19 |
| Honest rejection / rollback scenarios | Complete locally | Fixture and stage-runner coverage |
| Secrets absent from client assets | Complete locally | Secrets-boundary tests |

Remaining open P0 items are **deployment, network, or demo-host checks**. They do not block local UI redesign. They remain submission blockers and are scheduled under **R01 / TASKS §14–15**, not marked complete.

## Local verification run (2026-07-19)

Commands executed on the development host after G04 acceptance:

```text
npx vitest run \
  src/server/workflow/e2e-sequence.test.ts \
  src/server/validation/static.test.ts \
  src/server/ranking/readiness.test.ts \
  src/server/eligibility/evaluate.test.ts \
  src/server/ai/provider.test.ts
```

Result:

- 5 files passed
- 52 tests passed
- Controlled-example sequence asserts behaviour → module → cycle_repair → integration → completed
- Cycle-repair checks include `factory-injection` and `composition-root-injection`

Full suite, lint, typecheck, and production build also passed during G04 acceptance on the same host.

## Deferred P0 items

These remain open. None are silently completed.

### 1. Successful external-repository scenario

| Field | Value |
| --- | --- |
| TASKS item | §14 external-repository scenario |
| Owner | Release operator at deploy time |
| Reason deferred | Requires a live public GitHub URL, network access, and configured AI provider against a non-fixture repository |
| Product impact | Cannot claim end-to-end production GitHub fetch + modernization until run |
| Demo limitation | Demo must use the controlled fixture or a pre-verified public repo only after this check passes |
| Verification point | R01 / deployed environment with network |
| Status | Scheduled — not complete |

### 2. Incognito deployed-browser test

| Field | Value |
| --- | --- |
| TASKS item | §14 deployed application in an incognito browser |
| Owner | Release operator at deploy time |
| Reason deferred | No public deployed URL is part of this local gate |
| Product impact | Cookie/session, asset loading, and cold-browser UX unproven on the deployment host |
| Demo limitation | Do not present the deployment URL as release-ready until this passes |
| Verification point | R01 against the published application URL |
| Status | Scheduled — not complete |

### 3. Process-restart recovery

| Field | Value |
| --- | --- |
| TASKS item | §14 process restart discards active runs; health recovers |
| Owner | Release operator on the long-lived Node process host |
| Reason deferred | In-memory `RunStore` restart behavior needs a real process recycle on the deploy host; unit/E2E coverage only proves in-process retention |
| Product impact | Operators must not assume active runs survive restarts; clients should recover via health + new assessment |
| Demo limitation | Demo should not depend on restart mid-run until verified |
| Verification point | R01: stop process, confirm `/api/health`, confirm prior run IDs are gone, start a new run |
| Status | Scheduled — not complete |

### 4. Three-minute demo timing

| Field | Value |
| --- | --- |
| TASKS item | §14 / §15 three-minute demo path and video |
| Owner | Demo presenter before submission |
| Reason deferred | Timing depends on final UI, deployed latency, and AI provider speed; measuring now would freeze an incomplete surface |
| Product impact | Submission risk if the narrated path exceeds three minutes after UI work |
| Demo limitation | Keep the script to one candidate and the happy path; cut optional evidence deep-dives first |
| Verification point | R01 after U11, with final UI and target provider |
| Status | Scheduled — not complete |

### 5. Controlled-example tests on deploy host

| Field | Value |
| --- | --- |
| TASKS item | §14 run controlled example tests and record the real result on deploy host |
| Owner | Release operator |
| Reason deferred | Local host evidence is recorded above; deploy-host parity still required for submission |
| Product impact | Environment drift could break the fixture path only on the server image |
| Verification point | R01 on deploy host: `npm test` focusing controlled-example E2E |
| Status | Local complete; deploy-host scheduled |

## Explicit non-claims

This gate does **not** claim:

- External-repository success
- Deployed incognito-browser success
- Process-restart verification on a real host
- Three-minute demo timing
- Public URL or demo video publication
- That P1 nostalgia, rich graph, or optional Modernization Intent may start before R01 if submission P0 remains open — those stay P1 and remain cut-first

## UI work authorization

| Work | Authorized now? |
| --- | --- |
| U01–U11 Paper + Terminal redesign and recoverable review | **Yes** |
| R01 full release and demo gate | **No** — after U11 |
| P1 optional polish / Modernization Intent / rich graph | **No** while submission P0 deploy items remain open |

## Go / no-go summary

| Question | Answer |
| --- | --- |
| Are G01–G04 complete with tests? | Yes |
| Is local controlled-example evidence recorded? | Yes |
| Are remaining P0 deploy/network/demo items explicitly deferred with owner and impact? | Yes |
| May broad UI redesign begin? | **GO** |
| May submission be declared complete? | **NO-GO** until R01 and TASKS §14–15 deploy items pass |

## Next step

Start **U01 — bounded recoverable review payload**, then continue the UI queue sequentially. Revisit this document at R01 before any release or demo publication claim.

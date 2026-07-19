# R01 Release Gate Record

**Date:** 2026-07-19
**Owner:** ToolBox parent orchestrator
**Scope:** Final local release verification after U01–U11; honest status of deploy/demo items
**Related:** `docs/P0-RELEASE-GATE.md`, `TASKS.md` §14–15, `docs/UI-IMPLEMENTATION-TODOS.md`

## Decision

| Gate | Result |
| --- | --- |
| Local UI + correctness release checks | **PASS** |
| Local process-restart recovery | **PASS** |
| Live public GitHub fetch + deterministic gates | **PASS** (honest stop outcomes) |
| Full external modernization to accepted module | **PASS** (local `next start`, public repo `salauddinn/toolbox-external-smoke`) |
| Submission / public release claims | **NO-GO** until deploy URL / demo publish items below are evidenced |

All planned implementation todos **F00, G01–G05, U01–U11** are complete and committed. Remaining open items are mostly deploy/demo packaging, plus a full happy-path external modernization when a supported public repo is available.

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

## Process-restart recovery (local production server)

Host: `next start` on `127.0.0.1:3200` with `.env.local`.

| Step | Result |
| --- | --- |
| `GET /api/health` before load | `status: ok`, `service: toolbox` |
| `POST /api/runs` fixture `controlled-example` | `ok: true`, phase `assessed`, run id issued |
| `GET /api/runs/:id` with session cookie | `200`, same run retained in-process |
| Kill Node process and restart `next start` | process came back |
| `GET /api/health` after restart | `status: ok` |
| `GET /api/runs/:id` after restart | `404 RUN_NOT_FOUND` — prior in-memory run discarded |
| New `POST /api/runs` after restart | `ok: true`, new assessed run |

Conclusion: local long-lived process retains runs across requests; restart discards runs and health recovers. **Deploy-host repeat still recommended before submission.**

## Live public GitHub checks (local host + network)

Production server on `127.0.0.1:3200`, real GitHub archive fetch (no fixture path).

### Honest stop outcomes

| Repository | HTTP | Outcome | Notes |
| --- | --- | --- | --- |
| `https://github.com/bradtraversy/mern-auth` | 200 | `eligibility_failed` | Live fetch succeeded; rejected for ESM (`type: module`) |
| `https://github.com/madhums/node-express-mongoose-demo` | 200 | `safety_failed` | Live fetch succeeded; Safety Screening stopped the run |
| `https://github.com/sahat/hackathon-starter` | 200 | `safety_failed` | Live fetch succeeded; Safety Screening stopped the run |
| Additional starts | 429 | `RATE_LIMIT_STARTS` | Client start budget enforced (`<= 3 / hour`) |

### Successful external modernization

| Field | Value |
| --- | --- |
| Public repo | `https://github.com/salauddinn/toolbox-external-smoke` |
| Account | `salauddinn` only |
| Content | Published controlled-example CommonJS Express/Mongoose smoke target |
| Host | local `next start` `:3200` |
| Result | `assessed` → selected `orders` → 4 accepted Change Sets → `completed` |
| Artifact | ZIP download HTTP 200 (10471 bytes) with `repository/` + `toolbox-validation-report.json` |
| Generation mode | `TOOLBOX_DETERMINISTIC_GENERATION=1` after live AI authorize hit `PROVIDER_TRANSPORT` timeout |
| Product fix required | GitHub tarball now uses metadata `default_branch` (HEAD codeload 404 on this public repo) |

Conclusion:

- Networked GitHub URL intake works on a real process.
- Eligibility and Safety Screening produce honest stop states.
- Full external modernization to an accepted artifact is proven on a public repo under `salauddinn`.
- First AI authorize attempt timed out once; deterministic generation completed the stage pipeline for the release evidence run. Re-test AI authorize on deploy if provider latency is critical for the demo.

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
| Controlled-example on deploy host | Release operator | Local host only so far | `npm test` / controlled E2E on deploy image |
| Incognito deployed-browser test | Release operator | No public URL in this gate | Deployed URL, cold browser |
| Process-restart on deploy host | Release operator | Local process recycle passed; deploy host not exercised | Stop deploy process → `/api/health` → prior runs gone |
| Three-minute demo timing + video | Demo presenter | Timing depends on deploy latency and narration | Timed walkthrough + published video |
| Public app URL / repo publish / link audit | Submitter | Submission packaging | `TASKS.md` §15 |

## Non-claims

This record does **not** claim:

- Public deployment readiness
- AI provider latency under demo conditions (one local AI authorize timed out; deterministic path completed the external smoke)
- Three-minute demo timing
- Published demo video or pitch deck
- That P1 optional polish is complete

## Product surface after R01 local pass

- `/` — evidence-led landing, paper + terminal specimen, dark-mode toggle
- `/app` — repository start, gate failures, candidate decision, evidence inspector, Stage Plan, Change Set review, rollback/stop/completion
- Server contracts for eligibility, screening, ranking, authorization, validation, acceptance, and artifacts unchanged in meaning

## Next actions for submission

1. Deploy the application and record the public URL.
2. Re-run controlled-example, external smoke repo, and process-restart checks on the deploy host.
3. Optionally re-try AI authorize against the smoke repo if the demo must show live provider generation.
4. Time the demo under three minutes and publish the video.
5. Only then mark remaining `TASKS.md` §14–15 items complete.

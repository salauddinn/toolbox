# ToolBox UI Implementation Todo Queue

## Purpose

This queue converts `docs/UI-REDESIGN-PLAN.md` into bounded, sequential assignments. The parent agent remains the orchestrator. Only one writer subagent may modify the working tree at a time.

## Execution protocol

For every pending todo, the parent agent must perform these steps in order:

1. **Preflight**
   - Read the todo, its dependencies, and its acceptance criteria.
   - Inspect the current working tree and preserve unrelated user changes.
   - Confirm no other writer subagent is active.
2. **Writer assignment**
   - Launch one `worker` subagent with GPT-5.6 Terra at high effort by default.
   - Keep GPT-5.6 Sol at high effort as the parent orchestrator, acceptance authority, and synthesis model.
   - Give the worker the exact files, non-goals, acceptance criteria, and validation commands.
   - Escalate a bounded fix pass to Sol High only when Terra fails the same acceptance class twice, a public contract remains ambiguous, or the parent identifies a high-risk state-transition issue.
   - Use Sol Max only for final architecture or release review when High leaves a concrete unresolved risk.
   - The worker must not commit.
3. **Parent inspection**
   - Read every changed file and inspect the complete diff.
   - Run focused tests and `git diff --check`.
4. **Independent review**
   - Launch one fresh-context `reviewer` subagent.
   - Ask only for blockers and fixes worth doing now.
5. **Fix pass when required**
   - The parent synthesizes accepted findings.
   - Launch one bounded `worker` fix pass; never run competing writers.
   - Re-run focused review when the fix materially changes the implementation.
6. **Verification gate**
   - Run formatting for changed files, lint, typecheck, full Vitest, relevant browser tests, and production build.
   - Record any unrelated baseline failure separately; do not hide it.
7. **Queue update**
   - Mark the todo complete only when all acceptance criteria are evidenced.
   - Record changed files, verification commands, results, and remaining risks.
   - Start the next todo only after the current one passes.

## Model routing

| Responsibility | Default model | Effort |
| --- | --- | --- |
| Parent orchestration, scope control, and acceptance | GPT-5.6 Sol | High |
| Sequential implementation worker | GPT-5.6 Terra through U02; Grok 4.5 High from U03 onward | High |
| Independent code or plan reviewer | Fresh GPT-5.6 Sol | High |
| Repetitive cleanup after behavior is locked | GPT-5.6 Luna | Medium or High |
| Visual alternative or adversarial design critique | Grok 4.5 | High |
| Final architecture/release escalation | GPT-5.6 Sol | Max, only when justified |

A cheaper model never marks its own work complete. The Sol parent reads the diff, runs verification, synthesizes reviewer feedback, and decides whether the todo advances.

## Global guardrails

- Preserve official terminology from `CONTEXT.md`.
- Do not call Safety Screening certification.
- Do not call Static Validation Runtime Validation.
- Do not imply technical ranking is business priority.
- Do not describe a Domain Module as a microservice, migration, full rewrite, or deployment split.
- Candidate selection and confirmation remain separate.
- Stage authorization and Change Acceptance remain separate.
- Mutation endpoints and state-transition semantics remain unchanged unless a todo explicitly authorizes a bounded contract change.
- Terminal styling is reserved for evidence, code, validation, and diffs.
- Paper surfaces remain professional, spacious, and readable.
- Do not imitate Windows, macOS, or another operating system literally.
- Do not edit `.opencode/` or `.pi-subagents/` artifacts.
- Do not begin optional nostalgia, animation, or rich graph work while a required correctness task is unresolved.

## Status summary

| ID | Todo | Status | Depends on |
| --- | --- | --- | --- |
| F00 | Phase 0 contracts and rendered-test baseline | Complete | — |
| G01 | Wire unsupported syntax into Transformation Readiness | Complete | F00 |
| G02 | Preserve package-manager lockfile evidence | Complete | G01 |
| G03 | Enforce AI provider token budgets | Complete | G02 |
| G04 | Strengthen composition-root injection validation | Complete | G03 |
| G05 | Record the P0 gate decision and release deferrals | Complete | G04 |
| U01 | Add the bounded recoverable review payload | Complete | G05 |
| U02 | Integrate typed client state and presentation adapter | Complete | U01 |
| U03 | Build Paper + Terminal tokens and route shells | Complete | U02 |
| U04 | Redesign the landing page | Complete | U03 |
| U05 | Redesign repository start and gate failures | Complete | U04 |
| U06 | Build the assessment and candidate decision workspace | Complete | U05 |
| U07 | Build evidence inspector and dependency file context | Complete | U06 |
| U08 | Build Stage Plan and honest operation-status views | Complete | U07 |
| U09 | Build the Change Set review workspace | Complete | U08 |
| U10 | Build rollback, stop, and completion experiences | Complete | U09 |
| U11 | Complete responsive and accessibility behavior | Pending | U10 |
| R01 | Run the complete release and demo gate | Pending | U11 |

---

## F00 — Phase 0 contracts and rendered-test baseline

**Status:** Complete

**Delivered:**

- Typed presentation state for every durable run phase
- Candidate-confirmation and Change Acceptance gates
- Operation-specific pending and error states
- Runtime-safe unknown-phase fallback
- Testing Library, Playwright, and Axe foundations
- Active-run replacement failure coverage
- Honest “accepted module” marketing copy
- Initial accessibility contrast corrections

**Evidence:**

- ESLint passed
- TypeScript passed
- Full Vitest suite passed
- Playwright and Axe smoke test passed
- Production build passed
- Independent review found no remaining fix worth doing now

---

## G01 — Wire unsupported syntax into Transformation Readiness

**Status:** Complete

**Writer goal:** Complete the unresolved ADR-0008 readiness path without broadening generation support.

**Primary files:**

- `src/server/ranking/readiness.ts`
- `src/server/ranking/readiness.test.ts`
- `src/server/analysis/*`
- `src/core/readiness.ts`
- `docs/adr/0008-commonjs-express-mongoose-repository-contract.md`
- `TASKS.md`

**Required work:**

- Identify unsupported route, mount, handler, model, and CRUD evidence already detected by analysis.
- Feed that evidence into deterministic Transformation Readiness.
- Keep repository eligibility separate from candidate readiness.
- Add positive and negative tests with exact evidence.

**Non-goals:**

- Supporting new syntax shapes
- AI interpretation of readiness
- Changing candidate ranking weights

**Acceptance:**

- Unsupported candidate syntax deterministically fails readiness with stable rule IDs and evidence.
- Supported fixtures remain ready.
- Eligibility behavior is unchanged.
- Relevant ADR and `TASKS.md` status accurately reflect verified behavior.

**Validation:**

- Focused readiness and analyzer tests
- Full Vitest
- Lint and typecheck

### G01 completion record

- Status: Complete
- Writer: Terra High; bounded escalation fix by Sol High
- Changed areas:
  - Express route, handler, and mount syntax evidence
  - Mongoose model and CRUD syntax evidence
  - Candidate-level readiness rule and stable per-shape evidence IDs
  - Supported and unsupported syntax fixtures
  - ADR-0008 and `TASKS.md`
- Verification:
  - Changed-file Prettier — passed
  - ESLint — passed
  - TypeScript — passed
  - Focused analyzer, readiness, eligibility, validation, and sequence tests — passed
  - Full Vitest — passed
  - Production build — passed
  - `git diff --check` — passed
- Independent review:
  - Initial false-positive and mount-attribution findings fixed
  - Final source review clean; parent reran all required tests
- Residual risks:
  - Support remains intentionally limited to the documented conventional syntax profile
- Next todo: G02

---

## G02 — Preserve package-manager lockfile evidence

**Status:** Complete

**Writer goal:** Complete lockfile detection without weakening archive filtering or path safety.

**Primary files:**

- `src/server/github/extract.ts`
- `src/server/github/ignore.ts`
- `src/server/eligibility/evaluate.ts`
- Related GitHub and eligibility tests
- `TASKS.md`

**Required work:**

- Preserve supported lockfile names long enough for deterministic package-manager detection.
- Continue excluding lockfile content from untrusted source analysis and AI prompts where required.
- Add fixtures for npm and unsupported or ambiguous package-manager states.

**Non-goals:**

- Installing dependencies
- Executing external repositories
- Supporting monorepos

**Acceptance:**

- Lockfile presence and package-manager evidence survive extraction safely.
- Ignored-content and protected-file rules remain intact.
- No external repository content executes.

**Validation:**

- GitHub extraction tests
- Eligibility tests
- Secrets-boundary tests
- Full Vitest

### G02 completion record

- Status: Complete
- Writer: Terra High; bounded safety escalation fix by Sol High
- Changed areas:
  - Content-free root package-manager evidence carried from archive extraction through snapshots
  - Deterministic npm, Yarn, pnpm, Bun, Composer, unknown, and ambiguous eligibility outcomes
  - Shared fixture/archive ignore behavior, including case-insensitive current and legacy Bun lockfiles
  - Normalized collision checks before ignored-content filtering
  - Root and nested ignored-path protection during candidate snapshot application
  - Snapshot propagation, path safety, and protected-content regression tests
  - `TASKS.md`
- Verification:
  - Changed-file Prettier — passed
  - ESLint — passed
  - TypeScript — passed
  - Focused extraction, fetch, eligibility, snapshot, secrets-boundary, and path tests — passed
  - Full Vitest — passed
  - Production build — passed
  - `git diff --check` — passed
  - No staged files — verified
- Independent review:
  - Bun, collision, nested ignored-path, and fixture-consistency findings fixed
  - Final focused review found no blocker
- Residual risks:
  - Lockfile and package-manager configuration contents remain intentionally excluded from snapshots and artifacts; only normalized root evidence names survive
- Next todo: G03

---

## G03 — Enforce AI provider token budgets

**Status:** Complete

**Writer goal:** Enforce declared provider input and output token budgets before and after generation.

**Primary files:**

- `src/server/ai/provider.ts`
- `src/server/ai/provider.test.ts`
- `src/server/generation/prompts.ts`
- `src/server/env.ts`
- Relevant core contracts and tests
- `TASKS.md`

**Required work:**

- Define deterministic input and output budget accounting.
- Reject or truncate safely before sending an over-budget request.
- Reject over-budget provider output before file operations can mutate a candidate snapshot.
- Preserve one bounded repair attempt and transport retry semantics.

**Non-goals:**

- Changing provider vendors
- Adding client-supplied API keys
- Changing Stage Plan operation or byte budgets

**Acceptance:**

- Tests prove under-budget success and over-budget rejection.
- Over-budget content cannot reach snapshot mutation.
- Error messages avoid leaking repository content or secrets.

**Validation:**

- Provider tests
- Stage-runner tests
- Secrets-boundary tests
- Full Vitest

### G03 completion record

- Status: Complete
- Writer: Terra High; reviewer-driven bounded fix pass by Terra High
- Changed areas:
  - Configurable, capped provider input and output budgets
  - Deterministic UTF-8 byte estimates with documented chat framing reserve
  - Pre-fetch input and pre-parse output guards
  - Optional root and nested OpenAI-compatible usage validation
  - First-attempt manual-retry recovery and repair-attempt rollback behavior
  - Snapshot-preservation and secret-safe error tests
  - `.env.example`, README, and `TASKS.md`
- Verification:
  - Changed-file Prettier — passed
  - ESLint — passed
  - TypeScript — passed
  - Focused provider, env, stage-runner, secrets, and workflow tests — passed
  - Full Vitest — passed
  - Production build — passed
  - `git diff --check` — passed
  - No staged files — verified
- Independent review:
  - Initial stuck-run, inaccurate token claim, cap, and snapshot assertions fixed
  - Final focused review found no blocker
- Residual risks:
  - Provider budgets are conservative byte-based request gates, not model-specific tokenizer accounting; larger Stage Plan byte ceilings may be unreachable in one provider response as documented
- Next todo: G04

---

## G04 — Strengthen composition-root injection validation

**Status:** Complete

**Writer goal:** Replace shallow cycle-repair heuristics with evidence-backed composition-root validation.

**Primary files:**

- `src/server/validation/static.ts`
- `src/server/validation/static.test.ts`
- `src/server/generation/deterministic.ts`
- `src/server/sequence/plan.ts`
- Controlled-example fixtures
- `TASKS.md`

**Required work:**

- Verify the public module factory receives the supported injected dependency.
- Verify the recognized composition root supplies that dependency.
- Verify the repaired cycle disappears from the entry-reachable graph.
- Reject lookalike code that exports a factory without wiring it correctly.

**Non-goals:**

- General dependency-injection framework support
- Executing external repositories
- Expanding the cycle-repair path envelope

**Acceptance:**

- Positive controlled-example cycle repair passes.
- Missing, incorrect, or unused composition-root injection fails with exact validation checks.
- Rollback behavior remains unchanged.

**Validation:**

- Static validation tests
- Stage-runner tests
- Controlled-example end-to-end sequence
- Full Vitest

### G04 completion record

- Status: Complete
- Writer: Terra High; parent Sol High for residual export-state and observable-use hardening
- Changed areas:
  - Evidence-backed cycle injection contract from entry-reachable analysis
  - Public factory shape, final CommonJS export-state, and observable injected-dependency use
  - Composition-root require bindings and exact factory-argument wiring
  - Deterministic cycle-repair generation for the controlled Orders ↔ Payments case
  - Sequence criteria split into `factory-injection` and `composition-root-injection`
  - Exact pass/fail static checks and regression coverage for lookalike, overwrite, reassignment, no-op, unused, missing, and wrong-argument cases
  - `TASKS.md`
- Verification:
  - Changed-file Prettier — passed
  - ESLint — passed
  - TypeScript — passed
  - Focused static, sequence, stage-runner, and controlled E2E tests — passed
  - Full Vitest — passed
  - Production build — passed
  - `git diff --check` — passed
- Independent review:
  - Initial export-overwrite and no-op-reference bypasses fixed
  - Final residual regression for later factory-property reassignment added and verified
- Residual risks:
  - Supported shapes remain intentionally narrow to the deterministic CommonJS factory and composition-root profile
- Next todo: G05
- Commit: `fb2879b` feat(validation): verify cycle repair composition roots

---

## G05 — Record the P0 gate decision and release deferrals

**Status:** Complete

**Writer goal:** Produce an evidence-backed gate record before broad visual implementation.

**Primary files:**

- `TASKS.md`
- `docs/UI-REDESIGN-PLAN.md`
- `docs/P0-RELEASE-GATE.md`
- `docs/UI-IMPLEMENTATION-TODOS.md`

**Required work:**

- Verify G01–G04 are complete.
- Run and record the controlled-example tests locally.
- Classify remaining network or deployment checks as scheduled release verification, not silently completed work.
- Record owner, reason, product impact, and verification point for:
  - External-repository scenario
  - Incognito deployed-browser test
  - Process-restart recovery
  - Three-minute demo timing

**Non-goals:**

- Claiming external or deployed checks were performed when they were not
- Marking P0 items complete without evidence

**Acceptance:**

- Every unresolved P0 item is either verified complete or explicitly scheduled with impact and owner.
- Broad UI work has a written go/no-go result.

**Validation:**

- Documentation terminology review
- `git diff --check`
- Relevant local release commands

### G05 completion record

- Status: Complete
- Writer: Parent Sol High (documentation gate; no product-code change)
- Decision: **GO** for U01–U11; **NO-GO** for submission/release claims
- Changed areas:
  - `docs/P0-RELEASE-GATE.md` evidence-backed gate record
  - `TASKS.md` §14 local vs deploy-host split and scheduled deferrals
  - `docs/UI-REDESIGN-PLAN.md` prerequisite GO wording
  - This queue status
- Verification:
  - Focused controlled-example + G01–G04 suites — 5 files / 52 tests passed (2026-07-19)
  - `git diff --check` — passed
  - No external, incognito, process-restart, or three-minute claims recorded as complete
- Residual risks:
  - Deploy-host and demo timing remain open under R01
- Next todo: U01

---

## U01 — Add the bounded recoverable review payload

**Status:** Complete

**Writer goal:** Make the validated Change Set review recoverable after refresh without exposing unrestricted snapshot content.

**Primary files:**

- `src/server/workflow/review-payload.ts`
- `src/server/workflow/public-view.ts`
- `src/server/workflow/stage-runner.ts`
- `src/app/api/runs/[runId]/authorize/route.ts`
- Related workflow, API, and security tests

### U01 completion record

- Status: Complete
- Writer: Terra High; parent verification + GLM-5.2 review
- Changed areas:
  - Typed bounded `ReviewPayload` with path/preview/check limits and truncation labels
  - Secret redaction and ignored/protected/envelope allowlisting
  - Authorize response uses shared builder; legacy `diff` fields remain but are bounded
  - GET/`toPublicRunView` recovers review only in `awaiting_acceptance`
  - Accept refuses stale/incomplete review with `STALE_REVIEW`
- Verification:
  - Focused review/API/workflow/security tests — passed
  - Full Vitest — passed
  - ESLint, TypeScript, Prettier, `git diff --check` — passed
- Independent review: CLEAN (GLM-5.2)
- Residual risks:
  - Secret redaction is heuristic, mitigated by preview caps and always-partial previews
- Next todo: U02

---

## U02 — Integrate typed client state and presentation adapter

**Status:** Complete

**Writer goal:** Replace stringly typed console orchestration without changing visible layout yet.

### U02 completion record

- Status: Complete
- Writer: Terra High; parent verification
- Changed areas:
  - Exported discriminated `PublicRunView`
  - Typed `assessment-api` client and `useAssessmentRun` hook
  - Console wired to presentation-state action gates and review readiness
  - Removed `Record<string, any>` from console path
- Verification: lint, typecheck, full Vitest (200), build, Prettier, `git diff --check`
- Next todo: U03 (implementation writer switches to Grok 4.5 High)

---

## U03 — Build Paper + Terminal tokens and route shells

**Status:** Complete

### U03 completion record

- Writer: Grok 4.5 High; parent verification + independent review
- Changed areas: stable warm paper/dark terminal tokens, contrast-oriented focus/diff/status roles, skip link, semantic product/console shells, bounded marketing width, and 1440px console shell
- Verification: shell/page/assessment tests, Playwright landing Axe smoke, lint, typecheck, build, `git diff --check` — passed
- Independent review: CLEAN
- Residual risk: legacy feature class names are token aliases until later UI slices
- Next todo: U04

---

## U04 — Redesign the landing page

**Status:** Complete

### U04 completion record

- Writer: Grok 4.5 High; parent verification + independent review
- Changed areas: outcome-led paper hero, meaningful terminal assessment specimen, five-step workflow, deterministic/AI/developer ledger, split requirements, and explicit safety/non-goal limits
- Verification: 9 landing tests, Playwright Axe + 320px overflow smoke, lint, typecheck, full Vitest (208), build, Prettier, `git diff --check` — passed
- Independent review: CLEAN
- Residual risk: full-repository Prettier has unrelated baseline warnings; U04 files are formatted
- Next todo: U05

---

## U05 — Redesign repository start and gate failures

**Status:** Complete

**Writer goal:** Make repository entry and deterministic stop conditions clear and recoverable.

**Primary files:**

- Repository-start and gate-failure feature components
- `AssessmentApp` composition
- Related rendered tests

**Required work:**

- Separate controlled-example and GitHub URL entry paths.
- Use a keyboard-submittable form.
- Collapse the full contract after a run starts.
- Distinguish eligibility and Safety Screening failures.
- State that AI was not called.
- Confirm active-run replacement and destructive reset.

**Acceptance:**

- Duplicate starts are blocked.
- Errors are announced and focused correctly.
- Failed replacement preserves the existing run and attempted input.
- Gate failures expose exact evidence and truthful recovery.

**Validation:**

- Rendered interaction tests
- Request-shape tests
- Keyboard test
- Axe scan

### U05 completion record

- Writer: Grok 4.5 High; parent verification + independent review
- Verification: focused rendered tests, lint, typecheck, full Vitest (213), build, Prettier, `git diff --check` — passed
- Independent review: CLEAN
- Residual risk: inline confirmations do not move focus automatically; legacy candidate cards remain until U06
- Next todo: U06

---

## U06 — Build assessment and candidate decision workspace

**Status:** Complete

**Writer goal:** Replace long candidate cards with a scan-and-inspect decision workflow.

**Required work:**

- Assessment facts summary
- Compact semantic candidate radio list or table
- No initial candidate selection
- Safest technical candidate annotation remains advisory
- Selected candidate detail with routes, model, signals, conflicts, and blockers
- Separate selection and confirmation

**Acceptance:**

- A not-ready candidate cannot be confirmed.
- Candidate comparison does not require expanding every evidence snippet.
- Technical ranking never implies business priority.
- Modernization Intent remains deferred unless G05 explicitly permits it.

**Validation:**

- Candidate state tests
- Keyboard radio tests
- Rendered assessment fixtures
- Axe scan

### U06 completion record

- Writer: Grok 4.5 High; parent verification + independent review
- Verification: focused decision/keyboard tests, lint, typecheck, full Vitest (220), build, Prettier, `git diff --check` — passed
- Independent review: CLEAN
- Next todo: U07 (complete)

---

## U07 — Build evidence inspector and dependency file context

**Status:** Complete

**Writer goal:** Make evidence navigation real without fabricating graph evidence.

**Required work:**

- Evidence inspector with file, line, rule, severity, message, and snippet
- Previous and next navigation within the current evidence collection
- Reliable focus lifecycle
- Graph selection opens only available path and line context
- Cycle labels do not depend on red or animation alone
- Add a dependency list only if G05 permits the optional graph enhancement

**Acceptance:**

- Evidence selections retain the current decision context.
- Graph-only selections never invent a rule, message, severity, or snippet.
- Inspector and drawer meet modal and focus requirements.

**Validation:**

- Inspector interaction tests
- Graph/file-context tests
- Keyboard and reduced-motion tests
- Axe scan

### U07 completion record

- Status: Complete
- Writer: Grok 4.5 High; no commit (parent owns commit)
- Changed areas:
  - Shared `EvidenceInspector` dialog with evidence vs file-context modes
  - Assessment decision / gate failure / stage evidence open real collections
  - Dependency graph node/edge file-context, cycle text labels, reduced-motion
  - Dependency list deferred (G05 does not authorize optional rich-graph enhancement)
- Verification:
  - Focused inspector/graph/decision/app tests — passed
  - Full Vitest — 238 passed
  - lint, typecheck, build, Prettier (touched files), `git diff --check` — passed
- Residual risks:
  - React Flow a11y remains limited to mocked node/edge controls in unit tests; full browser graph keyboard coverage stays for later e2e
- Next todo: U08

---

## U08 — Build Stage Plan and honest operation-status views

**Writer goal:** Clarify stage authorization without pretending synchronous internal phases are live.

**Required work:**

- Ordered Stage Plan rail
- Current, queued, accepted, conditional, failed, and stopped labels
- Purpose, evidence, expected files, validation criteria, and budgets
- One honest local state while authorization request is pending
- Durable generation, validation, or repair screens only when the server actually returns those states

**Acceptance:**

- Users can identify stage scope and validation contract before authorization.
- No acceptance action appears before `awaiting_acceptance` with complete current review data.
- No fabricated percentage or subphase appears.

**Validation:**

- Phase/action matrix tests
- Stage fixture tests
- Authorization request tests

---

## U09 — Build the Change Set review workspace

**Writer goal:** Deliver a decision-grade review of the candidate snapshot.

**Required work:**

- Changed-file navigator
- Bounded diff or before/after preview
- Validation ledger with every client-safe check
- Attempt, operation, byte, and truncation information
- Static versus Runtime Validation distinction
- Sticky consequence and action bar
- Confirmed “Reject and stop” behavior

**Acceptance:**

- Accept is disabled for loading, missing, partial, failed, or stale review payloads.
- Acceptance wording explicitly promotes the validated candidate snapshot.
- Rejection wording explicitly stops the sequence.
- Refresh recovery restores the same current review.

**Validation:**

- Review readiness tests
- Refresh recovery browser test
- Keyboard and dialog tests
- Axe scan

---

## U10 — Build rollback, stop, and completion experiences

**Writer goal:** Make terminal outcomes honest and actionable.

**Required work:**

- Second-failure rollback report
- Developer-rejected stop outcome
- Transport or validation stop reasons
- Accepted Change Set count
- Per-stage Validation Report summaries
- Expected ZIP structure and download action

**Acceptance:**

- Rejected or rolled-back output never appears accepted.
- Completion renders only fields exposed by the completed public view.
- External generated tests remain labelled “not executed.”
- Download appears only when provided by the API.

**Validation:**

- Rollback and stop fixtures
- Completion rendered tests
- ZIP availability browser assertion

---

## U11 — Complete responsive and accessibility behavior

**Writer goal:** Audit the complete product rather than applying late decorative polish.

**Required work:**

- Three-column, two-region, and single-column console behavior
- 320 px overflow audit
- 200% zoom audit
- Coarse-pointer target sizes
- Dialog and drawer focus containment, Escape, inertness, and restoration
- Reduced-motion behavior
- Paper/terminal contrast in all supported theme conditions

**Acceptance:**

- Complete workflow is keyboard operable.
- No status depends on color alone.
- No critical or serious Axe findings on critical screens.
- Primary actions remain reachable without obscuring content.

**Validation:**

- Component accessibility tests
- Desktop and mobile Playwright
- Axe suite
- Manual keyboard checklist

---

## R01 — Run the complete release and demo gate

**Writer goal:** Verify and document the final product honestly.

**Required work:**

- Run the enforced release verification command.
- Run controlled example from start through ZIP download.
- Record local controlled-example test results.
- Verify process restart discards runs and health recovers.
- Verify the successful external-repository scenario when network access is available.
- Test the deployed application in an incognito browser when a URL is available.
- Time the complete demo and keep it under three minutes.
- Update `README.md`, `TASKS.md`, and screenshots only with verified outcomes.

**Acceptance:**

- All locally runnable release checks pass.
- External or deployed checks include dated evidence or remain explicitly open.
- No limitation is silently marked complete.
- Final documentation matches actual UI and behavior.

**Validation:**

- `npm run verify:release`
- Deployment-specific checks
- Final terminology review
- Independent final reviewer

## Parent progress log template

After each todo, append a record using this structure:

```md
### <Todo ID> completion record

- Status: Complete | Blocked | Deferred
- Writer: <agent/model/effort>
- Changed files:
  - ...
- Verification:
  - `<command>` — passed/failed
- Independent review:
  - Clean | Findings fixed | Deferred findings
- Residual risks:
  - ...
- Next todo: <ID>
```

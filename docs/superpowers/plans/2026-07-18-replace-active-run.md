# Replace Active Run Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client explicitly end an abandoned idle run and retry a new Modernization Assessment without waiting for the 30-minute TTL.

**Architecture:** Keep run lookup and capacity ownership in `RunStore`, expose a client-bound workflow operation through `DELETE /api/runs/:runId`, and return a safely replaceable run ID with the existing active-client 429. The React client presents one explicit recovery action and retries the retained start request once; no unload handling, heartbeat, or persistence is added.

**Tech Stack:** TypeScript, Next.js App Router, React 19, Vitest

---

## File Map

- `src/server/run-store.ts`: identify capacity-owning and safely replaceable runs.
- `src/server/workflow/assess.ts`: return the replaceable ID and end a bound run.
- `src/app/api/runs/route.ts`: project the replaceable ID in the existing error.
- `src/app/api/runs/[runId]/route.ts`: expose guarded run deletion.
- `src/app/components/assessment-app.tsx`: render recovery and retry once.
- Corresponding `*.test.ts` and `*.test.tsx` files: focused regression coverage.

### Task 1: Make Run Capacity Ownership Explicit

**Files:**
- Modify: `src/server/run-store.ts`
- Test: `src/server/run-store.test.ts`

- [ ] **Step 1: Write failing RunStore tests**

Add tests that assert an assessed run is returned by `findReplaceableByClient` only for its owner, a loading run is not replaceable, and expiration of an old terminal run cannot release a newer run's rate-limit slot.

For the regression, reset `globalRateLimiter`, leave a terminal run in the store, reserve a newer slot with `tryStart(client)`, expire the terminal run, and assert another `tryStart(client)` still returns `RATE_LIMIT_ACTIVE_CLIENT`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/server/run-store.test.ts
```

Expected: FAIL because `findReplaceableByClient` and capacity-aware eviction do not exist.

- [ ] **Step 3: Implement minimal phase helpers and lookup**

Add:

```ts
const NON_CAPACITY_PHASES = new Set<RunState["phase"]>([
  "eligibility_failed",
  "safety_failed",
  "not_ready",
  "sequence_stopped",
  "completed",
  "expired",
]);

const SERVER_BUSY_PHASES = new Set<RunState["phase"]>([
  "created",
  "loading",
  "generating",
  "validating",
  "repairing",
]);

export function holdsRunCapacity(run: RunState): boolean {
  return !NON_CAPACITY_PHASES.has(run.phase);
}

export function canExplicitlyEndRun(run: RunState): boolean {
  return !SERVER_BUSY_PHASES.has(run.phase);
}
```

Add `RunStore.findReplaceableByClient(clientKeyHash)` that evicts expired runs and returns the first owned run for which both helpers are true. In `evictExpired`, call `globalRateLimiter.release` only when `holdsRunCapacity(state)` is true.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/server/run-store.test.ts src/server/ai/rate-limit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/run-store.ts src/server/run-store.test.ts
git commit -m "fix: track run capacity ownership by phase"
```

### Task 2: Add the End-Run Workflow

**Files:**
- Modify: `src/server/workflow/assess.ts`
- Test: `src/server/workflow/assess.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Test this desired API:

```ts
const ended = endAssessmentRun({
  runId: assessed.run.runId,
  clientKeyHash: "owner",
  store,
});
expect(ended).toEqual({ ok: true });
expect(store.get(assessed.run.runId)).toBeUndefined();
```

Then start another assessment for `owner` and expect success. Also assert another client gets `403 RUN_FORBIDDEN`, a loading run gets `409 RUN_BUSY`, and a second blocked start returns the assessed run's ID in `activeRunId`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/server/workflow/assess.test.ts
```

Expected: FAIL because `endAssessmentRun` and `AssessError.activeRunId` do not exist.

- [ ] **Step 3: Implement the minimal workflow operation**

Extend `AssessError` with `activeRunId?: RunId`. For `RATE_LIMIT_ACTIVE_CLIENT`, include `store.findReplaceableByClient(input.clientKeyHash)?.runId`.

Add `endAssessmentRun({ runId, clientKeyHash, store? })`. It returns `404 RUN_NOT_FOUND` for a missing run, `403 RUN_FORBIDDEN` for an ownership mismatch, and `409 RUN_BUSY` when `canExplicitlyEndRun` is false. Otherwise, release only when `holdsRunCapacity(run)` is true, delete the run, and return `{ ok: true }`.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- src/server/workflow/assess.test.ts src/server/run-store.test.ts src/server/ai/rate-limit.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/workflow/assess.ts src/server/workflow/assess.test.ts
git commit -m "feat: end abandoned assessment runs"
```

### Task 3: Expose the Bound DELETE API

**Files:**
- Modify: `src/app/api/runs/route.ts`
- Modify: `src/app/api/runs/[runId]/route.ts`
- Create: `src/app/api/runs/[runId]/route.test.ts`

- [ ] **Step 1: Write failing route tests**

Test that cross-origin `DELETE` is rejected by `guardStateChangingRequest`. Create a run with a signed session cookie and assert same-client DELETE returns 200, while another signed session receives `403 RUN_FORBIDDEN`. Call POST twice with the same cookie and assert the 429 body includes the first run's public ID as `activeRunId`.

- [ ] **Step 2: Verify RED**

```bash
npm test -- 'src/app/api/runs/[runId]/route.test.ts'
```

Expected: FAIL because no `DELETE` export exists and POST omits `activeRunId`.

- [ ] **Step 3: Implement route behavior**

Add `DELETE` to `src/app/api/runs/[runId]/route.ts`. Apply `guardStateChangingRequest`, bind the session/client, call `endAssessmentRun`, preserve workflow status/code/message on failure, return `{ ok: true }` on success, and attach any new session cookie.

In both source branches of `POST /api/runs`, include `activeRunId: result.activeRunId` in error JSON.

- [ ] **Step 4: Verify GREEN**

```bash
npm test -- 'src/app/api/runs/[runId]/route.test.ts' src/server/workflow/assess.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add 'src/app/api/runs/[runId]/route.ts' 'src/app/api/runs/[runId]/route.test.ts' src/app/api/runs/route.ts
git commit -m "feat: expose client-bound run deletion"
```

### Task 4: Add Explicit Recovery to the Assessment UI

**Files:**
- Modify: `src/app/components/assessment-app.tsx`
- Create: `src/app/components/assessment-app.test.tsx`

- [ ] **Step 1: Write the failing client recovery test**

Use `// @vitest-environment jsdom`, `createRoot`, and React `act`. Mock `fetch` with these responses:

1. POST returns 429 with `RATE_LIMIT_ACTIVE_CLIENT` and `activeRunId: "old-run"`.
2. DELETE `/api/runs/old-run` returns `{ ok: true }`.
3. Retried POST returns a minimal assessed `new-run` public view.

Click **Try controlled example**, assert **End previous run and start new** appears, click it, and assert the calls are `POST /api/runs`, `DELETE /api/runs/old-run`, and `POST /api/runs` with no fourth request.

- [ ] **Step 2: Verify RED**

```bash
npm test -- src/app/components/assessment-app.test.tsx
```

Expected: FAIL because the recovery action is absent.

- [ ] **Step 3: Implement one bounded recovery flow**

Add a `StartBody` type and `blockedStart` state containing the attempted body and active run ID. Consolidate fixture/GitHub starts behind `startAssessment(body, allowRecovery = true)`. On the specific 429, retain the body and render the recovery button.

Add a same-origin DELETE helper with JSON headers/body. The recovery handler deletes the retained run, treats 404 as already ended, clears recovery state, and retries once with `allowRecovery = false`. Replace the current client-only **New** behavior with **End run / Start over**, clearing run state only after successful deletion or 404. Preserve errors and current state on other failures.

- [ ] **Step 4: Verify GREEN and types**

```bash
npm test -- src/app/components/assessment-app.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/assessment-app.tsx src/app/components/assessment-app.test.tsx
git commit -m "feat: recover from abandoned active runs"
```

### Task 5: Verify the Complete Change

**Files:**
- Verify all modified files

- [ ] **Step 1: Run focused regressions**

```bash
npm test -- src/server/run-store.test.ts src/server/ai/rate-limit.test.ts src/server/workflow/assess.test.ts 'src/app/api/runs/[runId]/route.test.ts' src/app/components/assessment-app.test.tsx
```

Expected: PASS without warnings or unhandled errors.

- [ ] **Step 2: Run repository verification**

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: every command exits 0. Record any unrelated pre-existing failure without changing unrelated files.

- [ ] **Step 3: Confirm scope**

```bash
git status --short
git diff --stat main...HEAD
git diff --check main...HEAD
```

Expected: only design/plan and active-run recovery files changed; `.opencode/` and `.pi-subagents/` remain untouched.

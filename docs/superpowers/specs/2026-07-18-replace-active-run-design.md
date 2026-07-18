# Replace Active Run Design

## Goal

Let a client recover from an abandoned browser tab without waiting 30 minutes for its active Modernization Assessment to expire. Preserve the one-active-run-per-client limit and never allow one client to end another client's run.

## User Experience

When starting an assessment returns `RATE_LIMIT_ACTIVE_CLIENT`, the start form shows a specific recovery action instead of only the generic error:

> You already have an active run.

The user can choose **End previous run and start new**. The action is explicit because browser tab-close events are unreliable and cannot safely distinguish closing from refreshing or navigating.

An active run screen also provides **End run / Start over**. Ending a run returns the UI to the initial assessment form.

Both actions require deliberate user interaction. ToolBox will not automatically destroy work on page unload.

## Server Design

### End-run operation

Add one workflow operation that accepts a run ID and the bound client key. It:

1. Loads the run from the process-local `RunStore`.
2. Returns the existing not-found response when the run has expired or does not exist.
3. Returns `RUN_FORBIDDEN` when the run belongs to another client.
4. Rejects replacement while the run is in a server-executing phase such as loading, generating, validating, or repairing. This avoids deleting state while an asynchronous operation can still write it back.
5. Releases client/process rate-limit capacity when the run still owns capacity.
6. Deletes the run from the store.

Expose this through `DELETE /api/runs/:runId`, protected by the existing state-changing-request guard and session/client binding.

### Finding the previous run

When `POST /api/runs` is blocked by `RATE_LIMIT_ACTIVE_CLIENT`, include the bound client's active idle run ID in the error response. Do not expose any run belonging to another client. The UI keeps the original start request and uses that ID to end the previous run before retrying the request once.

If no safely replaceable run exists, preserve the 429 response without a replacement action. This can occur while server work is actively executing.

### Capacity ownership

Centralize the definition of whether a run phase still holds active capacity. Use it for explicit ending and expiration so a previously completed or stopped run cannot later release the capacity slot of a newer run from the same client.

Capacity-holding phases are the nonterminal workflow phases from creation through assessment and sequence execution. Terminal eligibility, safety, readiness, stopped, completed, and expired phases do not hold capacity because their transition already releases it.

## Client Flow

The assessment component retains the attempted request body. On `RATE_LIMIT_ACTIVE_CLIENT` with an `activeRunId`:

1. Display the recovery message and button.
2. On confirmation, call `DELETE /api/runs/:activeRunId`.
3. If deletion succeeds, retry the retained start request once.
4. If deletion fails, show the returned error and do not retry automatically.

For **End run / Start over**, delete the currently displayed run, then clear run-specific UI state and return to the initial form.

The retry is bounded to one attempt to prevent loops.

## Error Handling

- `404 RUN_NOT_FOUND`: the run already expired; the recovery flow may retry the start because no old run remains.
- `403 RUN_FORBIDDEN`: show the error and do not retry.
- `409 RUN_BUSY`: explain that the current operation must finish before it can be ended.
- Other network/server failures: retain the current screen and show the existing error treatment.

## Testing

Add focused tests proving:

- A client can end its own idle active run and immediately start another.
- A client cannot end another client's run.
- A server-executing run cannot be deleted while its asynchronous work may continue.
- Ending a terminal run does not release a newer run's capacity slot.
- The run route applies the existing CSRF/state-changing guard to `DELETE`.
- The start API returns an active run ID only for the bound client.
- The client recovery flow deletes the abandoned run and retries the original request at most once.

## Non-goals

- Automatic tab-close or unload cleanup.
- Cross-process or durable run coordination.
- Resuming an abandoned run in a new tab.
- Changing the one-active-run-per-client or three-starts-per-hour limits.

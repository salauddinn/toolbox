# ToolBox UI Redesign Plan

## Status

Approved design direction: **Paper + Terminal Hybrid**

Sequential execution queue: `docs/UI-IMPLEMENTATION-TODOS.md`

Primary objective: **Workflow clarity**

Scope: landing page, shared product shell, work console, assessment experience, Modernization Sequence, Change Set review, completion artifact, responsive behavior, accessibility, and UI tests.

This plan primarily changes presentation and client-side composition. It does not change repository eligibility, Safety Screening, ranking, Transformation Readiness, Stage Plan generation, authorization, validation, acceptance, rollback, or artifact semantics.

One bounded server addition is permitted: a client-safe, size-limited, read-only review payload that makes the validated diff and Validation Report recoverable after refresh. It must not expose secrets, unrestricted snapshot contents, or new mutation behavior.

## Design principles

1. **Current task first** — Every console state must answer: Where am I? What happened? What can I do next?
2. **Evidence beside claims** — Candidate, readiness, stage, graph, and validation claims must open their source evidence without losing context.
3. **Progressive disclosure** — Summaries appear first; code evidence and detailed checks expand on demand.
4. **Decision-grade review** — Authorization and Change Acceptance must expose scope, consequences, validation coverage, and limitations.
5. **Plain language over backend state** — Internal phase identifiers are translated into user-facing workflow labels.
6. **Honest certainty** — Safety Screening is not certification. Static Validation is not Runtime Validation. AI output is not accepted until explicit Change Acceptance.
7. **Professional nostalgia** — Borrow tactile workflow cues from classic engineering utilities without imitating an operating system.
8. **Responsive equivalence** — Mobile retains workflow status, evidence access, and decision controls rather than merely stacking desktop panels.

## Visual direction

### Paper surface

Use warm, editorial surfaces for:

- Marketing content
- Screen headings and explanations
- Candidate comparison
- Stage Plan summaries
- Workflow navigation
- Forms and decision controls

The paper treatment should use restrained borders, generous spacing, strong typographic hierarchy, and minimal shadows.

### Terminal surface

Use dark terminal surfaces only where the metaphor adds meaning:

- Source evidence
- Paths and snippets
- Dependency details
- Generation and validation activity
- File diffs
- Operations
- Validation check output

Terminal panels must remain selectable, scrollable, accessible, and readable. Avoid excessive glow, scan lines, blinking text, or decorative command output.

### Nostalgic details

Allowed:

- Tactile control states
- Task-oriented workflow navigation
- Compact status regions
- Subtle blue and green utility accents
- Keyboard hints for expert actions
- Familiar window titles for inspectors and review panes

Avoid:

- Fake desktop or Start menu
- Operating-system logos or copied chrome
- Decorative modal overload
- Tiny bitmap text
- Heavy bevels, CRT distortion, or constant animation
- Controls that look like system controls but behave differently

### Theme behavior

The approved experience uses an intentional warm paper shell with dark terminal insets in both system color schemes. The current automatic full-surface dark inversion will be removed for redesigned paper surfaces so the paper/terminal distinction remains stable.

If a full dark-paper theme is added later, it must be an explicit, separately tested theme rather than an automatic inversion. Both surfaces must meet contrast requirements, and terminal regions must remain visually distinct from surrounding content.

## Design tokens

### Color roles

- `canvas-paper`: warm neutral application background
- `surface-paper`: primary reading and decision surface
- `surface-inset`: secondary grouped content
- `surface-terminal`: near-black technical output
- `text-primary`: high-contrast body and heading text
- `text-secondary`: explanatory text
- `text-quiet`: metadata only
- `border-subtle`: grouping and table rules
- `border-strong`: active panels and structural boundaries
- `focus`: high-contrast keyboard focus
- `accent-action`: restrained utility blue
- `success`: verified green
- `warning`: amber
- `danger`: brick red
- `diff-add`, `diff-change`, `diff-delete`: accessible diff semantics

No workflow state may depend on color alone.

### Typography

- Editorial headings: a readable serif face or serif system fallback
- Interface and body: Geist Sans
- Paths, identifiers, evidence, checks, and metrics: Geist Mono
- Substantive interface content: 14 px minimum target
- Metadata: 11–12 px minimum, used sparingly
- Reading measure: approximately 65–75 characters

### Shape and motion

- Modest 4–8 px corner radii
- Minimal shadow hierarchy
- 36–44 px control heights depending on density and pointer type
- Motion duration: 120–180 ms for local transitions
- No invented progress percentages
- Respect `prefers-reduced-motion`

## Information architecture

## Product page `/`

1. Product header
2. Outcome-led editorial hero
3. Terminal assessment specimen
4. Five-step workflow narrative
5. Deterministic versus AI responsibility ledger
6. Supported Repository contract
   - Requirements for assessment
   - Additional requirements for transformation
7. Safety and non-goal boundaries
8. Final work-console action
9. Compact disclosure footer

The hero and first following section must communicate:

- Supported input
- One Domain Module within the existing deployment boundary
- Bounded AI role
- Developer authorization and acceptance
- Static Validation limitation

The landing page must replace or immediately qualify claims such as “safe domain boundary” and “verified module.” Prefer “evidence-backed boundary,” “validated Change Set,” and “accepted repository snapshot.” The word “verified” may appear only when the exact checks performed are named nearby.

## Work console `/app`

### Desktop structure

1. **Console masthead**
   - Source label
   - Run ID
   - User-facing status
   - New-assessment menu

2. **Workflow rail**
   - Repository
   - Assessment
   - Decision
   - Sequence
   - Artifact

3. **Primary task surface**
   - Only the current decision or review task receives primary emphasis

4. **Context rail**
   - Assessment facts or Stage Plans
   - Current and accepted stages

5. **Evidence inspector**
   - File
   - Line
   - Rule
   - Message
   - Snippet
   - Related candidate or stage

6. **Sticky decision bar**
   - Consequence summary
   - Primary action
   - Secondary or destructive action
   - Operation-specific busy state

### Responsive structure

- `>= 1280 px`: context rail, task surface, evidence inspector
- `768–1279 px`: task surface plus collapsible context; evidence opens as a drawer
- `< 768 px`: single task column, compact workflow summary, inline evidence, full-width actions

No page-level horizontal overflow at 320 px. Code, tables, and diffs own their internal overflow.

## Workflow presentation model

Create a typed presentation adapter over the public run state. It returns:

- Current workflow step
- User-facing heading
- Status tone and label
- Explanation
- Permitted actions
- Busy operation
- Recovery action
- Main screen component

| Run state | Workflow step | Primary presentation |
| --- | --- | --- |
| No run | Repository | Controlled example and public GitHub form |
| Start request / loading | Repository | Honest assessment progress |
| `eligibility_failed` | Repository | Unsupported repository evidence; AI not called |
| `safety_failed` | Repository | Safety Screening rejection evidence; AI not called |
| `assessed` | Assessment / Decision | Assessment summary, candidate comparison, evidence |
| `not_ready` | Assessment | Assessment-only result and failed readiness rules |
| `candidate_selected` | Decision | Confirmed Modernization Decision; no sequence is shown unless present in the public view |
| `awaiting_authorization` | Sequence | Current Stage Plan and authorization decision |
| Local authorize request | Sequence | “Generating and validating the authorized stage”; no fabricated subphase |
| `generating` | Sequence | Render only if this durable state is actually returned or made observable |
| `validating` | Sequence | Render only if this durable state is actually returned or made observable |
| `repairing` | Sequence | Render only if observable; show first-attempt failures only when publicly exposed |
| `awaiting_acceptance` | Sequence | Dedicated Change Set review backed by a complete review payload |
| `stage_failed_rolled_back` | Sequence | Rollback, both attempts, retained current snapshot |
| `sequence_stopped` | Sequence | Stop reason and retained accepted state |
| `completed` | Artifact | Accepted Change Sets, report, ZIP download |
| `expired` | Repository | In-memory expiration and restart action |
| Unknown | Current / blocked | Safe fallback with no unsupported mutation |

The UI must not expose actions unsupported by the API state.

### Public-view and screen-data matrix

Phase 0 must record every required field against the existing `PublicRunView` before component work begins. The initial known constraints are:

- Candidate Write Ownership is not a first-class public field. Show primary model and key evidence unless a safe ownership summary is explicitly added.
- Reaching `assessed` implies the gates passed, but their successful result objects are not exposed. Label them as completed prerequisites rather than rendering invented details.
- Graph nodes provide file paths and graph edges provide line numbers; they do not provide rule messages or snippets. Graph selection opens file context, while evidence selections open full evidence detail.
- `candidate_selected` does not expose a sequence. Do not promise a sequence preview in that phase.
- `awaiting_acceptance` exposes operation metadata and a Validation Report, while the current diff preview is transient. Add a bounded recoverable review payload before requiring diff review after refresh.
- `completed` exposes report summaries and a download path, not the full accepted snapshot. The completion screen summarizes the artifact and links the ZIP; it does not render the repository snapshot in the browser.

Any new public projection must have explicit field allowlists, byte limits, truncation labels, authorization checks, and contract tests.

## Screen specifications

### Repository start and active-run replacement

- Separate “Try controlled example” and “Assess a public repository” paths
- Use a real form so Enter submits the URL
- Show concise eligibility guidance before submission
- Keep full contract details in a disclosure
- Announce start errors and progress
- Prevent duplicate starts
- Explain that active runs are in-memory and expire after 30 minutes
- Confirm before ending a current run, replacing an active run, abandoning an unaccepted Change Set, or using “Reject and stop”
- If deleting or replacing a run fails, preserve the current run and attempted start details
- Use one reset routine for URL, intent, candidate choice, diff, evidence focus, errors, blocked-start recovery, and run data

### Gate failures

- Distinguish eligibility from Safety Screening
- Make exact rule evidence the primary content
- State that AI was not called
- Provide only truthful recovery actions
- Preserve the screening disclaimer

### Assessment overview

Show:

- Source
- Entry point
- Route count
- Model count
- Cycle count derived from the exposed graph
- Safety and eligibility as completed prerequisites, without inventing unavailable result detail

The dependency graph is supporting evidence, not the first decision surface.

### Candidate decision

Use a compact semantic list or radio table containing:

- Candidate name
- Technical score
- Evidence strength
- Readiness
- Primary model and key evidence summary
- Blocker count
- Safest technical candidate annotation

Candidate controls begin unselected. The safest technical candidate is visually annotated as a recommendation but is not preselected as the developer’s choice. Selecting and confirming remain separate actions.

The selected detail reveals:

- Routes
- Primary model
- Signals
- Conflicting evidence
- Failed readiness rules
- Optional Modernization Intent only after unresolved P0 work is cleared or formally deferred

No not-ready candidate can be confirmed.

### Evidence inspector

Evidence selections open a shared inspector rather than only changing passive text.

The inspector supports:

- File and line
- Rule and severity
- Message
- Source snippet
- Related candidate or Stage Plan
- Previous and next evidence within the current evidence collection
- Close and return focus

Graph selections open file context using only the path and line data actually available. They must not fabricate an evidence rule, severity, message, or snippet.

### Dependency view

- Keep React Flow for visual exploration
- Add a data-equivalent list view after higher-priority P0 work is resolved or formally deferred
- Mark entry points and cycles with labels and shape, not color alone
- Disable animated cycle edges with reduced motion
- Maintain a minimum readable zoom
- Send evidence items to the evidence inspector and graph-only items to file context

### Stage Plan and authorization

Before every authorization, show:

- Stage number and title
- Required or conditional state
- Purpose
- Evidence
- Expected files
- Validation criteria
- Scope or operation budgets when available
- Consequence of authorization

State clearly that AI cannot change stage count, trigger outcome, or purpose.

### Generation, validation, and repair

The first release uses an honest local operation state while the synchronous authorization request is pending: “Generating and validating the authorized stage.” It keeps the authorized Stage Plan visible but does not claim to know the server’s current internal subphase.

Separate “Generating,” “Running Static Validation,” and “Repairing” screens require an explicit later polling, SSE, or asynchronous API slice. Do not imply those states are live merely because they exist in the server state machine. Do not show acceptance actions early or invent a percentage.

### Change Set review

Use a dedicated three-part workspace:

1. Changed-file navigator
2. Bounded diff or before/after preview surface
3. Validation ledger

Define a complete `ReviewPayload` as:

- Change Set identifier and attempt
- Created, updated, and deleted totals
- Allowlisted changed-file paths and operation kinds
- Operation bytes when available
- Size-limited, clearly truncated before/after previews or unified hunks
- Full client-safe Validation Report checks and details
- Static versus Runtime Validation distinction
- External tests “not executed” label

The authorize response may provide the payload immediately. A same-origin, run-bound, read-only recovery path must return the same bounded payload after refresh while the run is awaiting acceptance. Accept remains unavailable when this payload is loading, incomplete, failed, or no longer matches the current Change Set.

The sticky decision bar states:

- Accepting promotes the validated candidate snapshot
- Rejecting stops the sequence

“Reject and stop” requires confirmation.

### Completion

Show only data available from the completed public view:

- Accepted Change Set count
- Selected Domain Candidate
- Per-stage Validation Report summaries
- Expected artifact structure: accepted repository under `repository/` plus `toolbox-validation-report.json`
- External generated tests as “not executed” when exposed
- Download action only when the API provides it

Do not render or imply browser access to the full accepted snapshot. Detailed reports and Runtime Validation commands remain inside the downloaded artifact unless a separate bounded public projection is approved.

## Component architecture

Reduce `src/app/components/assessment-app.tsx` to a typed controller and shell composer through vertical feature slices, not an architecture-first rewrite.

The `/` and `/app` route split already exists. Preserve those URLs and introduce route-appropriate shells only where the current shared 1120 px layout constrains the console.

### Initial required boundaries

- Typed API client and `useAssessmentRun`
- Exhaustive presentation adapter consuming the existing exported `PublicRunView`
- `ConsoleShell`, `WorkflowRail`, `ActionBar`, and `EvidenceInspector`
- `RepositoryStart` and `GateFailure`
- `AssessmentOverview`, `CandidateDecision`, and `EvidenceList`
- `StagePlanView`, `ChangeSetReview`, and `CompletionArtifact`

Create generic `Dialog`, `Drawer`, `DataTable`, `CodeBlock`, or additional feature components only when a concrete implemented screen needs them. Avoid premature component libraries and barrel files.

### Client state and API

- Consume and refine the existing serializable discriminated `PublicRunView`; do not create a parallel run contract
- Centralize API calls in a typed client
- Centralize run mutations in `useAssessmentRun`
- Track operation-specific errors and busy state
- Add one complete `resetRunContext()` behavior
- Preserve the latest valid run after mutation, deletion, or replacement errors
- Add the bounded recoverable review payload without changing mutation semantics
- Remove `Record<string, any>` from the console path

## Accessibility requirements

- Add a skip link and explicit main landmark
- Provide `aria-current` for active workflow and navigation
- Use radio semantics for candidate choice
- Add accessible names such as “Select Orders”
- Add consistent `:focus-visible` styling
- For dialogs and drawers: provide an accessible title and description, correct modal semantics, initial focus, contained focus, Escape behavior, inert background content, and reliable focus restoration
- If an invoking evidence item disappears after a state transition, restore focus to the nearest stable screen heading
- Announce operation progress once without repeated live-region noise
- Use at least 44 px targets for coarse pointers
- Preserve actions and content at 200% zoom
- Ensure all terminal content remains selectable text
- Provide graph/list equivalence when the list view is implemented
- Meet WCAG 2.2 AA contrast targets
- Produce no serious or critical automated accessibility findings on critical screens

## Implementation prerequisites

Broad visual redesign was gated by unresolved P0 correctness and release work recorded in `TASKS.md`. That gate was decided in `docs/P0-RELEASE-GATE.md` (2026-07-19):

1. G01–G04 correctness follow-ups are completed and verified; and
2. Remaining deploy/network/demo P0 items are explicitly deferred with owner, reason, product impact, and verification point.

**Gate result: GO for U01–U11 Paper + Terminal implementation.** Submission/release claims remain NO-GO until R01 and `TASKS.md` §14–15 deploy items pass.

Foundations already landed before the GO: typed public presentation state, rendered UI tests, active-run safeguards, honest workflow labels, and accessibility test harness. Recoverable review data (U01) is the first authorized UI contract slice after this gate.

Optional Modernization Intent, rich graph interaction, decorative motion, and nostalgic polish remain deferred while submission P0 deploy criteria remain open.

## Implementation phases

### Phase 0 — Contracts, tooling, and regression baseline

1. Inventory every durable public run phase and local request state.
2. Build the field-by-field public-view and screen-data matrix.
3. Define expected heading, workflow step, allowed actions, recovery, and safety copy for each state.
4. Create fixtures for every durable phase, partial review payload, expired run, active-run conflict, deletion failure, and unknown fallback.
5. Choose the minimum rendered-test stack: React Testing Library, `user-event`, and `jest-dom` with Vitest.
6. Choose and configure Playwright for one browser workflow and an axe-compatible accessibility check for critical rendered screens.
7. Add scripts so the release verification command runs the required UI, accessibility, and browser gates, or document a separate CI-enforced release command.
8. Replace source-string-only assertions with initial rendered behavior tests.
9. Resolve or formally defer every remaining P0 item in `TASKS.md` before broad visual work.

### Phase 1 — Typed and recoverable foundations

1. Consume the existing exported `PublicRunView` in the client.
2. Add an exhaustive presentation adapter for durable server phases and local operation states.
3. Extract typed API mutations and run state into `useAssessmentRun`.
4. Define and test the complete reset, end-run, and active-run replacement behavior.
5. Define the bounded `ReviewPayload`, size limits, truncation rules, and same-origin run binding.
6. Add a read-only review recovery path or equivalent bounded public projection for `awaiting_acceptance`.
7. Add contract tests proving review data survives refresh and cannot expose files outside the current Change Set.
8. Define paper, terminal, status, focus, and diff tokens.
9. Add only the primitives and console-shell pieces required by the first vertical screens.

### Phase 2 — Product entry and gate outcomes

Prerequisite: the P0 gate is cleared or formally documented.

1. Rebuild the landing page around the approved information architecture.
2. Add the restrained terminal assessment specimen.
3. Replace “safe” and unqualified “verified” marketing claims.
4. Assert the five-step workflow, deterministic-versus-AI ledger, and assessment/transformation contract split in rendered tests.
5. Rebuild repository start as two clear paths and a real form.
6. Implement active-run replacement and end-run confirmations.
7. Implement eligibility and Safety Screening failure screens.
8. Collapse passed contract details after a run starts.

### Phase 3 — Assessment and Modernization Decision

1. Build the assessment summary from fields actually exposed in `PublicRunView`.
2. Replace expanded candidate cards with scan-and-inspect comparison.
3. Begin candidate radios unselected while visually annotating the safest technical candidate.
4. Implement the shared evidence inspector and graph file-context behavior.
5. Preserve separate selection and confirmation.
6. Add the dependency list only after higher-priority release work is clear.

### Phase 4 — Sequence and Change Set review

1. Build Stage Plan navigation and authorization.
2. Use one honest local pending state for the synchronous authorize request.
3. Build the recoverable diff and Validation Report workspace.
4. Disable acceptance for missing, stale, incomplete, or failed review payloads.
5. Add guarded acceptance and rejection controls.
6. Build rollback, stop, and completion experiences from durable public data.
7. Treat live generating, validating, and repairing subphases as a separate server/API enhancement unless they become observable.

### Phase 5 — Responsive, accessibility, and release validation

Accessibility and responsive behavior are implemented within every earlier phase; this phase is the final cross-screen audit, not the first accessibility pass.

1. Validate desktop, tablet, 320 px mobile, and 200% zoom behavior.
2. Complete keyboard and focus behavior for dialogs, drawers, inspectors, and destructive confirmations.
3. Run automated accessibility checks on critical screens.
4. Run the controlled-example browser workflow and keyboard smoke path.
5. Verify paper/terminal contrast and distinction, reduced motion, and internal overflow.
6. Validate the full demo in under three minutes.

## Test strategy

### Unit and contract tests

- Exhaustive durable-phase and local-operation presentation mapping
- Allowed action matrix
- Public-view and `ReviewPayload` field allowlists
- Review payload byte limits, truncation labels, refresh recovery, and stale Change Set rejection
- Typed API error behavior
- Complete reset behavior
- End-run and active-run replacement failure preservation
- Candidate selection versus confirmation
- Evidence inspector and graph file-context behavior
- Validation Report grouping

### Rendered component tests

- Landing five-step workflow and responsibility ledger
- Assessment requirements versus transformation requirements
- Prohibition or immediate qualification of “safe” and “verified” claims
- Start form keyboard submission
- Active-run conflict and destructive confirmations
- Gate failure evidence and “AI not called” copy
- Candidate radios initially unselected
- Stage authorization copy
- Change Set review loading, incomplete, stale, failed, and complete states
- Dialog and drawer focus lifecycle
- Completion download availability
- Paper and terminal semantic status labels

### Browser and accessibility tests

One critical controlled-example path:

1. Start fixture
2. Inspect evidence
3. Select and confirm Orders
4. Authorize each stage
5. Review and accept each Change Set
6. Confirm completion
7. Confirm ZIP download is available

Run desktop and mobile viewport smoke paths. Include keyboard-only navigation, reduced motion, a 320 px overflow assertion, and automated accessibility checks for landing, start, gate failure, assessment, Change Set review, and completion.

## Acceptance criteria

- The current workflow step and next allowed action are visible without searching in every non-terminal state.
- Candidate controls start unselected; safest technical candidate remains advisory; selection and confirmation remain separate.
- Stage authorization and Change Acceptance remain separate.
- Every evidence-backed claim can expose file, line, message, and snippet without losing the current task.
- Graph-only selections expose only the path and line context actually available.
- The complete `ReviewPayload` is defined, size-limited, refresh-recoverable, and bound to the current Change Set.
- Accept is unavailable for missing, loading, incomplete, failed, or stale review data.
- The Change Set review exposes changed files, validation checks, limitations, and consequences before acceptance.
- Active-run deletion or replacement failure preserves the existing run and attempted action.
- Passed contract details no longer interrupt active workflow content.
- Landing tests assert the five-step workflow, responsibility ledger, and separate assessment/transformation requirements.
- No UI wording claims a safe boundary, unqualified verification, business-priority ranking, malware certification, Runtime Validation, microservice extraction, full migration, or automatic acceptance.
- The warm paper shell and dark terminal insets remain visually distinct regardless of system color scheme.
- No page-level horizontal overflow occurs at 320 px.
- The complete workflow is keyboard operable with visible focus.
- Dialogs and drawers satisfy title, focus, Escape, inertness, and focus-restoration requirements.
- Status meaning never depends on color alone.
- `assessment-app.tsx` becomes a typed controller without phase-specific document markup; component extraction remains driven by concrete screens.
- Mutation endpoints, payloads, transition semantics, rollback rules, and ZIP availability remain unchanged; only the bounded read-only review projection may be added.
- The enforced release verification command passes.
- The controlled example remains completable in under three minutes.

## Delivery slices

1. **Safety foundations:** state matrix, rendered tests, active-run handling, typed client, recoverable review contract
2. **Product entry:** landing, start form, contract split, gate failures
3. **Assessment:** summary, candidate decision, evidence inspector, graph file context
4. **Sequence:** Stage Plans, honest pending state, Change Set review, completion
5. **Release polish:** responsive audit, accessibility audit, optional graph list, restrained nostalgia, demo timing

Each slice must be independently reviewable, preserve the controlled-example workflow, and avoid advancing optional polish ahead of unresolved P0 work.

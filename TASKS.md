# ToolBox Implementation Tasks

Tasks are ordered by dependency. Complete P0 tasks before any P1 work.

## P0 — submission blockers

### 1. Scaffold the application

- [x] Create the Next.js TypeScript application.
- [x] Add Tailwind CSS and the base responsive shell.
- [x] Add formatting, linting and unit-test commands.
- [x] Add server environment validation for `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` and optional `GITHUB_TOKEN`.
- [x] Confirm secrets cannot enter the client bundle.

Done when the application builds, tests and runs with a placeholder start screen.

### 2. Define core contracts

- [x] Define `RepositoryFile`, source snapshot and normalized path types.
- [x] Define eligibility and Safety Screening result types.
- [x] Define analysis, evidence, finding, graph and route/model types.
- [x] Define Domain Candidate ranking and Transformation Readiness types.
- [x] Define `StagePlan`, `FileOperation`, `ChangeSet` and `ValidationReport` types.
- [x] Define per-stage create/update/delete path envelopes, mutable AST regions and protected-region fingerprints as part of `StagePlan`.
- [x] Model the run as a discriminated state machine so authorization, acceptance, rejection, repair and rollback transitions cannot be skipped.
- [x] Define the `CodebaseAnalyzer` interface and `ExpressAnalyzer` shell.

Done when invalid states such as a ready candidate with failed readiness rules cannot be represented accidentally.

### 3. Build the controlled example and test fixtures

- [x] Add a small CommonJS Express/Mongoose application with Orders, Payments and Users.
- [x] Keep Orders business and Mongoose logic inside legacy route handlers.
- [x] Include a supported Orders↔Payments circular dependency to trigger the conditional stage.
- [x] Add a CommonJS Jest/Supertest harness, `npm test` command and stable route-level tests for the example.
- [x] Add fixture repositories for unsupported ESM, missing Mongoose, path risk and no-ready-candidate cases.
- [x] Add a fixture AI response that fails validation twice for rollback testing.

Done when fixtures deterministically exercise success, rejection, readiness failure, conditional stage and rollback paths.

### 4. Implement public GitHub repository loading

- [x] Accept and normalize only root `https://github.com/<owner>/<repo>` URLs.
- [x] Construct archive/API URLs server-side and allow only documented GitHub redirect hosts.
- [x] Verify GitHub repository metadata reports `private: false` before download, including when `GITHUB_TOKEN` is configured.
- [x] Fetch one repository archive per run into an in-memory snapshot.
- [x] Support optional least-privilege server-side GitHub authentication for public rate capacity without accepting user tokens.
- [x] Enforce 10 MB compressed, 1,000-entry and 25 MB extracted defaults before the 150-file/2 MB analysis limits.
- [x] Extract in memory; reject absolute, traversal, NUL, backslash-alias, symlink and normalized-path-collision entries, and never write untrusted entries to disk.
- [x] Enforce one application root, 150 analyzed files and 2 MB of source.
- [x] Ignore dependencies, builds, coverage, generated files, vendored code and binaries.
- [x] Add request timeouts and clear GitHub/network errors.
- [x] Expire inactive run state after 30 minutes.

Done when the example and one external public repository load into the same snapshot format.

### 5. Implement eligibility and Safety Screening

- [x] Require public GitHub, npm, JavaScript, CommonJS, Express and Mongoose.
- [x] Reject ESM, TypeScript, monorepos, missing entry points and missing route/model evidence.
- [x] Detect the published conventional syntax profile with stable evidence without conflating repository eligibility with candidate readiness.
- [x] Reject path traversal, symlinks and binary/executable analyzed source.
- [x] Reject recognized sensitive files, obfuscated/minified source and supported dynamic-code signals.
- [x] Reject recognized download-and-execute lifecycle scripts.
- [x] Display exact rule evidence and make no AI calls on failure.
- [x] Test false-positive-prone rules with explicit fixtures.

Done when every unsupported or suspicious fixture stops before analysis/AI with a stable reason code.

### 6. Implement Express/Mongoose static analysis

- [x] Parse CommonJS JavaScript with Babel.
- [x] Resolve relative `require()` edges.
- [x] Mark files and cycles reachable from the recognized application entry.
- [x] Extract Express entry points, routers, paths, methods, middleware and handlers.
- [x] Extract Mongoose schemas, models and read/write calls.
- [x] Support only the documented route, mount, handler, model and CRUD shapes; add positive and negative syntax fixtures for each.
- [x] Detect direct model access, large handlers, mixed concerns and missing tests.
- [x] Detect circular file dependencies and render the complete cycle.
- [x] Detect shared-model writes, global mutation and unsupported cross-domain access.
- [x] Attach `file`, `line` and bounded snippets to every finding.

Done when analysis facts are deterministic and snapshot tests cover representative syntax.

### 7. Rank Domain Candidates and determine readiness

- [x] Cluster route/model/file evidence into Domain Candidates.
- [x] Rank up to three candidates using documented technical signals.
- [x] Calculate exclusive Write Ownership and distinguish reads from writes.
- [x] Require exactly one writable primary Mongoose model for an MVP-ready candidate.
- [x] Fail readiness when the candidate directly accesses another domain's Mongoose model.
- [x] Require an existing CommonJS Jest/Supertest harness available through `npm test` without manifest changes.
- [x] Fail candidate readiness when required route, mount, handler, model or CRUD evidence uses an unsupported syntax shape.
- [x] Evaluate every deterministic Transformation Readiness rule.
- [x] Mark findings automatable or developer-decision-required.
- [x] Implement the assessment-only path when no candidate is ready.
- [x] Ensure AI cannot alter ranking or waive readiness failures.

Done when candidate order and readiness results are reproducible from the same snapshot.

### 8. Build the assessment experience

- [x] Build URL entry, supported-contract and Safety Screening screens.
- [x] Build the Modernization Assessment summary.
- [x] Build a basic dependency graph with evidence navigation.
- [x] Show up to three candidates, readiness, confidence and conflicting evidence.
- [x] Show the safest technical candidate without implying business priority.
- [x] Add developer selection/confirmation.

Done when a developer can trace every candidate claim to source evidence.

### 9. Implement the fixed AI provider adapter

- [x] Implement one server-only OpenAI-compatible provider call.
- [x] Delimit repository content as untrusted data.
- [x] Give the model no tools, shell, network or environment access.
- [x] Validate structured `FileOperation` JSON before use.
- [x] Enforce input/output token plus 20-operation, 128 KiB/file and 512 KiB total-change defaults per stage.
- [x] Rate-limit to three analysis starts/client/hour, one active run/client and five active runs/process by default.
- [x] Derive the client key from the deployment's trusted source-IP signal, hash it in memory and use a coarse global fallback when that signal is unavailable.
- [x] Bind run state to an unguessable server-issued token and enforce JSON plus same-origin checks on state-changing endpoints.
- [x] Retry one transient network/rate-limit/provider failure once.
- [x] Preserve run state and allow manual stage retry after a second transport failure.
- [x] Add deterministic provider mocks for tests.

Done when malformed, injected and transient-failure responses cannot mutate the snapshot.

### 10. Build the Modernization Sequence planner

- [x] Create required Stage Plans for behaviour capture, Domain Module creation and integration/cleanup.
- [x] Show a pending conditional marker when initial evidence finds a supported cycle.
- [x] Recalculate the entry-reachable graph after Domain Module acceptance and create the conditional Stage Plan only if that cycle remains reachable.
- [x] Show stage purpose, evidence, expected files and validation criteria.
- [x] Require generation authorization for every stage.
- [x] Prevent AI from changing stage count, trigger outcome or purpose.

Done when every ready candidate starts with three deterministic required Stage Plans and any pending conditional marker resolves from the accepted post-module snapshot, producing a final total of three or four.

### 11. Generate and apply project-dependent Change Sets

- [x] Generate characterization tests using only the existing Jest/Supertest harness without claiming external execution.
- [x] Allow behaviour capture to create one new test under the existing test root without changing existing tests or production files.
- [x] Generate the standard Domain Module shape with one public `index.js`.
- [x] Switch the selected HTTP route registration to the new public module entry while retaining legacy files needed by later stages.
- [x] Limit Domain Module creation to new module files and the evidenced route-registration update; allow no deletion.
- [x] Expose supported read-only model access through the module's public facade.
- [x] Generate circular-dependency repair through a public module factory and composition-root injection, then verify the cycle disappears.
- [x] Limit cycle repair to updates of evidenced cycle files, the public module entry and recognized composition root; allow no creation or deletion.
- [~] Generate integration/cleanup that rewires remaining supported consumers, removes superseded legacy code and preserves routes, methods, schemas and collections. (deterministic path is fixture-shaped; graph unreferenced-proof still shallow)
- [~] Delete only selected-domain legacy files proven superseded and unreferenced in the current snapshot. (partial)
- [x] Apply valid file operations only to a candidate snapshot.
- [x] Present the validated candidate-snapshot diff before promotion to the current snapshot.
- [x] Require Change Acceptance to create the next valid snapshot.
- [x] Keep the current snapshot and stop if the developer rejects.

Done when accepted stages operate sequentially on evolving state and rejected output never leaks forward.

### 12. Implement validation, repair and rollback

- [x] Parse every changed JavaScript file.
- [x] Resolve relative imports and enforce repository-root paths.
- [x] Enforce allowed files and the approved Stage Plan scope.
- [x] Reject updates that alter protected top-level AST regions outside the stage's evidenced mutable symbols. (top-level binding check; not full AST region hashing)
- [x] Reject manifest, lockfile, license, `.github`, environment and ignored-content changes.
- [x] Validate required module files, public entry and dependency direction. (direction heuristic)
- [x] Validate route/method, schema and collection preservation.
- [x] Compare deterministic pre/post route-table and schema/collection fingerprints.
- [x] Detect stale legacy wiring and internal module imports.
- [x] Validate conditional dependency injection at the public factory and composition root. (factory export heuristic)
- [x] Validate that supported external readers use the module's public facade.
- [x] Make one bounded repair call with structured errors after failure.
- [x] Re-run the full validation set after repair.
- [x] Roll back and stop after a second failure.
- [x] Show both attempts in the Validation Report.

Done when the deliberate double-failure fixture proves rollback and blocks later stages.

### Phase 1–4 review follow-ups (before / during Phase 5)

- [x] Full controlled-example E2E: behaviour → module → optional cycle → integration → completed
- [x] Wire unsupported syntax evidence into Transformation Readiness (ADR-0008)
- [x] Package-manager lockfile detection without dropping names at extract
- [x] Token budgets on AI provider input/output
- [x] Tighten integration path envelope (not `**/*.js`) — consumers from graph + candidate files
- [x] Stronger composition-root injection validation for cycle repair

### 13. Produce the finished artifact

- [x] Build per-stage and combined diffs.
- [x] Build before/after file trees.
- [x] Generate the final Validation Report with static/runtime distinctions.
- [x] Label external generated tests “not executed.”
- [x] Include local runtime-verification commands.
- [x] Generate a result ZIP containing the exact accepted snapshot under `repository/` and `toolbox-validation-report.json` at the archive root.

Done when the result ZIP's `repository/` folder reflects only accepted Change Sets and the separate report matches the UI.

### 14. Pass the release gate

Gate record: `docs/P0-RELEASE-GATE.md` (2026-07-19). Local correctness P0 follow-ups are complete; remaining items below are scheduled release/deploy verification and still block submission.

- [ ] Complete the successful external-repository scenario. (scheduled R01 — needs live URL + network; owner: release operator)
- [x] Complete the honest-rejection scenario with zero generation calls. (fixture ESM path covered in E2E)
- [x] Complete the double-failure repair/rollback scenario. (stage-runner tests)
- [x] Run the controlled example tests and record the real local result. (2026-07-19: controlled E2E + G01–G04 suites passed; see `docs/P0-RELEASE-GATE.md`)
- [ ] Re-run the controlled example tests on the deploy host and record that result. (scheduled R01)
- [ ] Test the deployed application in an incognito browser. (scheduled R01 — needs public URL)
- [x] Verify one long-lived application process retains run state across all stage requests. (RunStore + E2E)
- [ ] Verify process restart discards active runs cleanly and the health endpoint recovers. (scheduled R01 — deploy host process recycle)
- [x] Confirm API secrets are absent from client assets and the public repository. (secrets-boundary tests)
- [ ] Confirm the full demo path fits within three minutes. (scheduled R01 — after final UI)

Done when all three release scenarios work on the deployed URL.

UI redesign authorization: **GO** for U01–U11 per `docs/P0-RELEASE-GATE.md`. Submission remains **NO-GO** until this section and §15 are complete.

### 15. Submit

- [ ] Publish the public application URL.
- [ ] Publish the repository with setup, architecture, security boundaries and limitations in README.
- [ ] Record and publish the maximum three-minute demo video.
- [ ] Verify every link without authentication.
- [ ] Prepare the optional pitch deck only if all required links already work.

## P1 — cut first when time is short

- [ ] Optional Modernization Intent field
- [ ] Additional low-value finding detectors
- [ ] Rich React Flow interactions and animation
- [ ] Nonessential visual polish
- [ ] Optional pitch deck

P1 work must not begin while a P0 acceptance criterion is failing.

Broad UI redesign (U01–U11) may proceed under the documented P0 gate GO while only deploy/network/demo P0 items remain open. Optional P1 polish stays blocked until submission P0 is clear or explicitly re-gated.

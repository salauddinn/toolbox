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

- [ ] Build URL entry, supported-contract and Safety Screening screens.
- [ ] Build the Modernization Assessment summary.
- [ ] Build a basic dependency graph with evidence navigation.
- [ ] Show up to three candidates, readiness, confidence and conflicting evidence.
- [ ] Show the safest technical candidate without implying business priority.
- [ ] Add developer selection/confirmation.

Done when a developer can trace every candidate claim to source evidence.

### 9. Implement the fixed AI provider adapter

- [ ] Implement one server-only OpenAI-compatible provider call.
- [ ] Delimit repository content as untrusted data.
- [ ] Give the model no tools, shell, network or environment access.
- [ ] Validate structured `FileOperation` JSON before use.
- [ ] Enforce input/output token plus 20-operation, 128 KiB/file and 512 KiB total-change defaults per stage.
- [ ] Rate-limit to three analysis starts/client/hour, one active run/client and five active runs/process by default.
- [ ] Derive the client key from the deployment's trusted source-IP signal, hash it in memory and use a coarse global fallback when that signal is unavailable.
- [ ] Bind run state to an unguessable server-issued token and enforce JSON plus same-origin checks on state-changing endpoints.
- [ ] Retry one transient network/rate-limit/provider failure once.
- [ ] Preserve run state and allow manual stage retry after a second transport failure.
- [ ] Add deterministic provider mocks for tests.

Done when malformed, injected and transient-failure responses cannot mutate the snapshot.

### 10. Build the Modernization Sequence planner

- [ ] Create required Stage Plans for behaviour capture, Domain Module creation and integration/cleanup.
- [ ] Show a pending conditional marker when initial evidence finds a supported cycle.
- [ ] Recalculate the entry-reachable graph after Domain Module acceptance and create the conditional Stage Plan only if that cycle remains reachable.
- [ ] Show stage purpose, evidence, expected files and validation criteria.
- [ ] Require generation authorization for every stage.
- [ ] Prevent AI from changing stage count, trigger outcome or purpose.

Done when every ready candidate starts with three deterministic required Stage Plans and any pending conditional marker resolves from the accepted post-module snapshot, producing a final total of three or four.

### 11. Generate and apply project-dependent Change Sets

- [ ] Generate characterization tests using only the existing Jest/Supertest harness without claiming external execution.
- [ ] Allow behaviour capture to create one new test under the existing test root without changing existing tests or production files.
- [ ] Generate the standard Domain Module shape with one public `index.js`.
- [ ] Switch the selected HTTP route registration to the new public module entry while retaining legacy files needed by later stages.
- [ ] Limit Domain Module creation to new module files and the evidenced route-registration update; allow no deletion.
- [ ] Expose supported read-only model access through the module's public facade.
- [ ] Generate circular-dependency repair through a public module factory and composition-root injection, then verify the cycle disappears.
- [ ] Limit cycle repair to updates of evidenced cycle files, the public module entry and recognized composition root; allow no creation or deletion.
- [ ] Generate integration/cleanup that rewires remaining supported consumers, removes superseded legacy code and preserves routes, methods, schemas and collections.
- [ ] Delete only selected-domain legacy files proven superseded and unreferenced in the current snapshot.
- [ ] Apply valid file operations only to a candidate snapshot.
- [ ] Present the validated candidate-snapshot diff before promotion to the current snapshot.
- [ ] Require Change Acceptance to create the next valid snapshot.
- [ ] Keep the current snapshot and stop if the developer rejects.

Done when accepted stages operate sequentially on evolving state and rejected output never leaks forward.

### 12. Implement validation, repair and rollback

- [ ] Parse every changed JavaScript file.
- [ ] Resolve relative imports and enforce repository-root paths.
- [ ] Enforce allowed files and the approved Stage Plan scope.
- [ ] Reject updates that alter protected top-level AST regions outside the stage's evidenced mutable symbols.
- [ ] Reject manifest, lockfile, license, `.github`, environment and ignored-content changes.
- [ ] Validate required module files, public entry and dependency direction.
- [ ] Validate route/method, schema and collection preservation.
- [ ] Compare deterministic pre/post route-table and schema/collection fingerprints.
- [ ] Detect stale legacy wiring and internal module imports.
- [ ] Validate conditional dependency injection at the public factory and composition root.
- [ ] Validate that supported external readers use the module's public facade.
- [ ] Make one bounded repair call with structured errors after failure.
- [ ] Re-run the full validation set after repair.
- [ ] Roll back and stop after a second failure.
- [ ] Show both attempts in the Validation Report.

Done when the deliberate double-failure fixture proves rollback and blocks later stages.

### 13. Produce the finished artifact

- [ ] Build per-stage and combined diffs.
- [ ] Build before/after file trees.
- [ ] Generate the final Validation Report with static/runtime distinctions.
- [ ] Label external generated tests “not executed.”
- [ ] Include local runtime-verification commands.
- [ ] Generate a result ZIP containing the exact accepted snapshot under `repository/` and `toolbox-validation-report.json` at the archive root.

Done when the result ZIP's `repository/` folder reflects only accepted Change Sets and the separate report matches the UI.

### 14. Pass the release gate

- [ ] Complete the successful external-repository scenario.
- [ ] Complete the honest-rejection scenario with zero generation calls.
- [ ] Complete the double-failure repair/rollback scenario.
- [ ] Run the controlled example tests and record the real result.
- [ ] Test the deployed application in an incognito browser.
- [ ] Verify one long-lived application process retains run state across all stage requests.
- [ ] Verify process restart discards active runs cleanly and the health endpoint recovers.
- [ ] Confirm API secrets are absent from client assets and the public repository.
- [ ] Confirm the full demo path fits within three minutes.

Done when all three release scenarios work on the deployed URL.

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

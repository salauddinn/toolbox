# ToolBox MVP Plan

## Hackathon constraints

OpenAI × NamasteDev Codex Hackathon, 15–19 July 2026.

Required by 19 July 2026, 23:59 IST:

- Public hosted prototype
- Public code repository with README
- Public demo video, maximum three minutes
- Optional five-to-seven-slide pitch deck

Judging is equally weighted across originality, impact, AI fluency, prototype, demo and creativity.

## Locked product promise

> ToolBox analyzes a supported legacy Express.js repository, ranks technically suitable Domain Candidates with code evidence, and modularizes the developer-selected candidate through three or four project-dependent, approved Change Sets.

The final output is a downloadable repository plus a Validation Report that states precisely which checks passed or failed.

This is a finished narrow workflow, not a demonstration of several partially supported modernization strategies.

## Target user

A developer or small engineering team maintaining a structured but tightly coupled Express.js application and needing a safe first modularization step.

## Product and input technology

```text
ToolBox application       Next.js + TypeScript
Analyzed repositories     Legacy JavaScript + Express.js
Database convention       Mongoose
Module convention         CommonJS
Package manager           npm
JavaScript parser         Babel AST
MVP analyzer              ExpressAnalyzer only
```

ToolBox improves the structure of an Express.js application while preserving its deployment boundary. It does not migrate the application to NestJS and does not create microservices.

The implementation keeps only a small future-facing analyzer boundary:

```ts
interface CodebaseAnalyzer {
  supports(files: RepositoryFile[]): EligibilityResult;
  analyze(files: RepositoryFile[]): Promise<AnalysisResult>;
}

class ExpressAnalyzer implements CodebaseAnalyzer {
  // The only MVP implementation.
}
```

There is no plugin loader, framework selector or second analyzer in the MVP.

## Supported repository contract

A repository is eligible only when all required conditions pass:

- Public GitHub repository
- Passes Safety Screening before analysis or AI usage
- `package.json` declares Express and Mongoose
- JavaScript/CommonJS source using `.js` files and `require()`
- npm project with a single application root
- `package.json` does not opt into ESM through `"type": "module"`
- Recognizable Express entry point
- At least one route and one Mongoose model
- Maximum 150 analyzed source files
- Maximum 2 MB of analyzed source

ToolBox ignores `node_modules`, build output, coverage, generated files, vendored code and binaries.

The transformation path supports a deliberately conventional syntax profile:

- Entry file named `app.js`, `server.js` or `index.js`, selected from `package.json` or a deterministic fallback
- Direct relative CommonJS imports with string literals
- `express.Router()` plus `router.<method>(literalPath, ...handlers)` route registration
- Router mounting through `app.use(literalPrefix, importedRouter)`
- Named or inline handlers whose source is statically present in the repository
- Mongoose schemas and `mongoose.model()` declarations with statically identifiable model and collection names
- Direct model CRUD calls that can be classified as reads or writes from a fixed supported method list
- Jest and Supertest declared in the existing npm project, with a non-placeholder `npm test` script

Unsupported aliases, wrapper factories, computed route paths, generated registrations, dynamic imports and unresolved model access may still appear in the assessment, but they cannot enter generation. This is a syntax contract, not a claim that all CommonJS Express applications have the same structure.

Unsupported repositories are rejected before an AI call, with exact reasons and a link to the supported repository contract. ToolBox never describes unsupported input as “best effort.”

Eligibility rejection reasons include unsupported module system, missing Express, missing Mongoose, unsupported package manager, monorepo/multiple application roots, missing entry point, missing route/model evidence and repository size limits.

### Safety Screening

Reject before analysis or AI usage when a supported risk signal is present:

- Path traversal or a path that cannot be normalized inside the repository root
- Symbolic links
- Binary or executable files in the analyzed source tree
- `.env`, private-key or other recognized sensitive files
- Obfuscated or minified application source selected for analysis
- `eval()`, `new Function()` or other supported dynamic-code-execution signals
- Recognized download-and-execute patterns in npm lifecycle scripts

Passing Safety Screening means only that no supported signal was detected. ToolBox does not claim to provide malware scanning, security certification or proof that a repository is safe.

### Data lifetime and provider failure

- Disclose that selected public source files are sent to the configured AI provider.
- Keep repository snapshots and generated Change Sets in memory only.
- Expire an inactive run after 30 minutes.
- Provide no accounts or persistent external-repository storage.
- Cache deterministic static analysis in memory by content hash.
- Retry one transient network, rate-limit or provider `5xx` failure once.
- After a second transport failure, preserve the last valid snapshot and allow manual retry of the current stage without repeating static analysis.
- Never switch providers/models or fabricate fallback output.

### Hackathon immutability assumption

ToolBox fetches the submitted repository once at the beginning of a run and creates an in-memory source snapshot. The MVP assumes the remote branch does not need to be refreshed during that run. All analysis, generation, validation and downloads use the same captured snapshot plus accepted Change Sets.

Commit-SHA resolution, branch-change detection and live synchronization are out of scope for the hackathon.

### Repository archive controls

- Accept only root repository URLs matching `https://github.com/<owner>/<repo>`.
- Construct GitHub API/archive URLs server-side; never fetch a user-supplied host.
- Verify repository metadata reports `private: false` before archive download, even when the server has a `GITHUB_TOKEN`.
- Allow redirects only to documented GitHub archive hosts.
- Prefer one archive download over per-file content API requests.
- Allow an optional least-privilege server-side `GITHUB_TOKEN` for public-repository rate capacity; never accept or require a user token.
- Enforce defaults of 10 MB compressed download, 1,000 extracted entries, 25 MB total extracted bytes, 150 analyzed source files and 2 MB analyzed source before retaining content.
- Extract in memory with unique normalized POSIX paths; reject absolute paths, traversal, NUL bytes, backslash aliases, symlinks and normalized-path collisions, and never write archive entries directly to the host filesystem.
- Surface GitHub rate-limit responses without falling back to arbitrary URLs.

The bundled legacy Orders/Users/Payments repository satisfies the same contract as external repositories; it is not a separate hard-coded product path.

## Complete user journey

1. User enters a public GitHub URL or selects the bundled example.
2. ToolBox runs eligibility checks without AI.
3. ToolBox parses the eligible repository and builds code evidence and a dependency graph.
4. ToolBox ranks up to three Domain Candidates and evaluates Transformation Readiness without AI.
5. If none is ready, ToolBox returns the assessment and blocking evidence without generation calls.
6. If one or more are ready, ToolBox explains the safest technical candidate without claiming business priority.
7. The developer selects or confirms a ready Domain Candidate and may add optional Modernization Intent.
8. ToolBox proposes the three required stages and shows a pending conditional marker when the initial graph contains the supported cycle; the final stage count is resolved after Domain Module acceptance.
9. Before each stage, the developer reviews its Stage Plan and authorizes generation.
10. ToolBox generates against the current valid snapshot and runs Static Validation.
11. A failed Change Set receives one bounded repair attempt; a second failure rolls back and stops the sequence.
12. After validation, the developer reviews the diff and explicitly accepts or rejects the Change Set.
13. Change Acceptance creates the next valid snapshot; rejection leaves the current snapshot unchanged and stops later stages.
14. ToolBox presents the final diff, file tree and Validation Report.
15. The developer downloads a result ZIP containing the exact accepted repository snapshot plus ToolBox metadata outside the repository folder.

## Project-dependent Modernization Sequence

Three Change Sets are always required. A fourth blocker-resolution Change Set is inserted only when a supported evidence rule triggers it.

### Required — capture existing behaviour

- Generate characterization tests for the selected domain's existing HTTP routes.
- Record the current request paths and expected response contracts inferred from available evidence.
- Use only the repository's existing CommonJS Jest and Supertest harness and existing test command; do not add or upgrade dependencies.
- Create one new test file under the existing test root; do not update or delete existing tests or production files.
- Label generated tests for external repositories as “not executed.”
- Do not change production code.

### Required — create the Domain Module

- Create the standard domain folder:

```text
src/modules/<domain>/
├── index.js
├── <domain>.routes.js
├── <domain>.controller.js
├── <domain>.service.js
├── <domain>.repository.js
└── <entity>.model.js
```

- Use `index.js` as the only public module entry.
- Enforce routes → controller → service → repository → model dependency direction.
- Move selected business and database logic out of legacy route handlers.
- Switch the selected HTTP route registration to the new public module entry while leaving remaining external consumers and superseded legacy files for the integration stage.
- Limit this stage to creating the standard module files and updating the evidenced route-registration file; do not delete files.
- Preserve existing public URLs, HTTP methods, Mongoose schemas and collection names.
- Keep one application process and deployment boundary.
- When another domain has a supported read-only dependency on the primary model, expose the required read operation through the module's public `index.js` facade and rewire that reader during integration.

### Conditional — resolve a boundary blocker

After the Domain Module Change Set is accepted, recalculate the dependency graph reachable from the recognized application entry. Include this Change Set only when the supported circular CommonJS dependency involving the selected Domain Candidate is still reachable; an unwired legacy cycle does not trigger repair and is removed during cleanup.

- Show the complete cycle with file/line evidence.
- Replace the selected domain's direct cyclic import with an explicit dependency accepted by a factory exported from `index.js` and supplied by the recognized application composition root.
- Limit updates to the evidenced cycle files, the module's public entry and the composition root; do not create or delete files.
- Recalculate the dependency graph.
- Pass only when the original cycle is absent.

The initial sequence may show a pending conditional-stage marker, but the evidence rule is re-evaluated against the accepted snapshot before the stage exists. The rule and remaining cycle must be visible. AI cannot add or retain the stage on its own.

Other blockers remain Modernization Findings with developer guidance; they do not trigger automatic repair.

### Required — integrate and clean up

- Rewire remaining supported consumers to use the new Domain Module's public facade.
- Remove superseded legacy code and imports.
- Limit changes to evidenced consumers, selected-domain legacy files and their imports; delete only files proven superseded and unreferenced.
- Resolve internal relative imports.
- Produce the final before/after file tree and Validation Report.

The MVP never produces fewer than three or more than four Change Sets.

## MVP screens

### Start and eligibility

- “Try supported example” primary action
- Public GitHub URL input
- Visible repository contract
- Eligibility result with actionable rejection reasons

### Modernization Assessment

- Repository/runtime summary
- Architecture findings
- Interactive dependency graph
- Up to three ranked Domain Candidates
- Transformation Readiness result for each candidate
- Evidence list with clickable `file:line` references

Example:

```text
Application          Express 4 + Mongoose
Architecture         route-to-database coupling is high
Candidate            Orders
Evidence             4 routes access Order and Payment models directly
Recommendation       modularize Orders inside the existing application
Microservices        not justified by available evidence
```

### Recommendation

- Safest technical Domain Candidate and confidence
- Alternative candidates and conflicting evidence
- Plain-language benefits and risks
- “Why not microservices?” explanation
- Supporting code evidence
- Developer selection/confirmation control
- Optional Modernization Intent

### Modernization workspace

- Three-or-four-step sequence with the evidence-triggered conditional stage clearly marked
- Stage Plan and generation authorization before each AI call
- Files changed and unified diff
- Per-step Validation Report
- Change Acceptance or rejection after validation
- Final before/after file tree
- Result ZIP download with the accepted repository and separate ToolBox report

## Static analysis and evidence

Static analysis establishes repository facts. AI may explain those facts but may not invent them.

Extract:

- Node and Express versions from `package.json`
- `require()` dependency relationships
- Reachability from the recognized application entry
- Express routers, routes and middleware
- Route handlers and controllers
- Mongoose models and model references
- Direct model access from route/controller files
- Shared models and highly connected modules
- Circular dependencies
- Large route handlers and mixed concerns
- Test files and test scripts
- Candidate domain clusters based on names, paths, imports, routes and models

### Finding coverage

| Modernization Finding | Detect | Explain | Automate |
| --- | --- | --- | --- |
| Route/business/database coupling | Yes | Yes | Required Domain Module sequence |
| Circular CommonJS dependency | Yes | Yes | Conditional fourth Change Set |
| Large route handler | Yes | Yes | Addressed when inside selected domain |
| Shared Mongoose model ownership | Yes | Yes | No — developer decision required |
| Global mutable state | Yes | Yes | No — developer decision required |
| Unsupported cross-domain access | Yes | Yes | No — developer decision required |
| Missing domain characterization tests with a supported harness | Yes | Yes | Generate tests; do not execute externally |
| Missing CommonJS Jest/Supertest harness or `npm test` command | Yes | Yes | No — candidate is not ready |
| Outdated runtime/dependencies | Manifest evidence only | Yes | No |

Detection does not imply remediation. Every finding is labelled **automatable** or **developer decision required**.

Every finding includes evidence:

```ts
type Evidence = {
  ruleId: string;
  message: string;
  severity: "info" | "warning" | "critical";
  file: string;
  line: number;
  snippet: string;
};
```

## Deterministic domain selection

Candidate ranking begins with measurable signals rather than an unrestricted AI opinion:

- Domain-name consistency across routes, models and files
- Internal cohesion
- External imports and shared-model coupling
- Direct database access in HTTP handlers
- Route count and handler complexity
- Circular dependencies
- Existing test coverage

The highest score becomes the safest technical candidate, not the “best” or most important domain. ToolBox shows up to three candidates, confidence and conflicting evidence. The developer selects or confirms the Domain Candidate before generation.

Candidate ranking and Transformation Readiness are separate. A high-ranking candidate may still be ineligible for generation when it contains an unsupported Blocker. If no candidate is ready, the workflow ends with the Modernization Assessment and no generation calls.

### Transformation Readiness rules

A Domain Candidate is ready only when every rule passes:

- At least one statically discoverable Express route group has a stable path prefix.
- Exactly one writable primary Mongoose model is identifiable for the MVP transformation.
- The candidate has exclusive write ownership of its primary model.
- The candidate does not directly access another domain's Mongoose model.
- Other domains may read that model; competing writes make the candidate ineligible.
- An existing CommonJS Jest and Supertest harness is available through `npm test` without dependency or manifest changes.
- Route paths and HTTP methods are statically extractable.
- No dynamic `require()`, `eval()` or generated route registration occurs inside the candidate.
- The candidate does not write unsupported global mutable state.
- Selected files fit within generation source and token limits.
- Detected cycles are supported CommonJS file-dependency cycles.
- No unsupported Blocker prevents the standard Domain Module shape.

Every readiness rule displays its evidence and pass/fail status. AI cannot override or waive a failed rule.

## AI responsibilities

AI is core but bounded:

1. Explain and challenge the Domain Candidate ranking using supplied evidence without claiming business priority.
2. Generate the behaviour-capture Change Set from selected routes and contracts.
3. Generate the Domain Module Change Set from the validated current state.
4. Recalculate the entry-reachable dependency graph after Domain Module acceptance and, only when the supported cycle remains reachable, generate the blocker-resolution Change Set through the new module entry.
5. Generate the integration-and-cleanup Change Set from the validated current state.
6. Repair a failed Change Set once using structured validation errors without changing its approved purpose.

The provider must return structured file operations rather than an unconstrained prose response:

```ts
type FileOperation =
  | { type: "create"; path: string; content: string }
  | { type: "update"; path: string; content: string }
  | { type: "delete"; path: string };
```

Server-only configuration:

```text
AI_API_KEY=
AI_BASE_URL=
AI_MODEL=
GITHUB_TOKEN=          # optional, server-side, public-repository rate capacity
```

The API key is never exposed in browser JavaScript or committed to the repository.

The deployed MVP uses one fixed, tested OpenAI-compatible provider configuration. The provider must return structured JSON that can be validated against the `FileOperation` schema. ToolBox has no provider/model selection UI, automatic provider fallback or runtime model switching.

Each Stage Plan defines allowed create/update/delete paths, evidenced mutable symbols or AST regions, protected-region fingerprints and an output budget. Reject responses that change unrelated regions or exceed the maximum operation count, per-file bytes, total changed bytes or model output-token limit before applying them to a candidate snapshot.

Generation cannot create or modify dependency manifests, lockfiles, licenses, `.github` content, environment files or ignored content. ToolBox modernizes source within the repository's existing runtime and test toolchain.

Default generation limits are 20 file operations, 128 KiB per changed file, 512 KiB total changed content and the configured model output-token cap per stage.

## Untrusted repository security

Repository content is always data, never model instruction. ToolBox must:

- Delimit submitted source and label it untrusted in every generation request.
- Give the runtime model no tools, shell, network or environment access.
- Never place application secrets or server configuration in prompts.
- Accept only schema-valid `FileOperation` output.
- Restrict file operations to normalized paths inside the in-memory repository root.
- Reject changes to ignored, disallowed or Stage-Plan-external files.
- Ignore instructions embedded in source comments, documentation or filenames.

## Token and cost controls

- Reject unsupported repositories before AI usage.
- Do not make generation calls when Transformation Readiness fails.
- Never send the entire repository.
- Send compact metrics and evidence for explanation.
- Send only the selected domain, entry point and directly related files for generation.
- Cache deterministic analysis and grounded explanations in memory by captured-content hash.
- Cap selected source and evidence snippets.
- Rate-limit public runs.
- Default to three analysis starts per client per hour, no more than one active run per client and five active runs in the single process.
- Bind every run to an unguessable server-issued token, require JSON plus same-origin checks on state-changing endpoints, and never authorize a run from a user-supplied repository identifier alone.

Target per uncached completed workflow:

```text
Explanation input       <= 8,000 tokens
Each generation input   <= 15,000 tokens
Each repair input       <= 8,000 tokens
Normal AI calls         4 or 5: 1 explanation + 3 or 4 generation
Worst-case AI calls     7 or 9 with one repair per failed Change Set
```

These are semantic call counts. A single permitted transport retry may repeat a request and its token usage.

## Validation contract

For every Change Set:

- Parse every changed JavaScript file successfully.
- Confirm changed relative imports resolve in the virtual repository.
- Reject paths outside the repository root.
- Reject changes to ignored or disallowed files.
- Reject changes to manifests, lockfiles, licenses, `.github` content and environment files.
- Confirm required generated files exist.
- For conditional cycle repair, confirm the selected module no longer imports the injected dependency directly and the composition root supplies it through the public factory.
- On first failure, send only relevant files and structured validation errors for one repair attempt.
- Prevent the repair from expanding the approved Change Set purpose.
- Re-run all Static Validation after repair.
- On second failure, restore the last valid repository snapshot and stop the sequence.
- Record initial and repair outcomes in the Validation Report.

For the final result:

- Confirm original public route paths remain registered.
- Confirm the old selected-domain implementation is no longer wired into the application.
- Confirm `src/modules/<domain>/index.js` is the external entry point.
- Reject imports from outside the module into its internal files.
- Confirm supported external readers use the module's public read facade rather than its model file.
- Confirm the required layered files exist and their dependency direction is valid.
- Confirm Mongoose schema definitions and collection names are unchanged.
- Compare deterministic pre/post route-table and schema/collection fingerprints rather than asking AI to judge preservation.
- Produce one combined Validation Report.

For the bundled example only, the team will also run its tests during development and record the result in the demo. ToolBox does not execute arbitrary third-party code in the hosted MVP and does not claim runtime verification for external repositories.

## Implementation stack

| Area | MVP choice |
| --- | --- |
| Application | Next.js + TypeScript |
| UI | Tailwind CSS |
| Graph | React Flow |
| JavaScript parser | `@babel/parser` + `@babel/traverse` |
| Graph analysis | In-memory adjacency maps |
| Repository input | Fetch one public GitHub archive server-side |
| Virtual changes | In-memory repository snapshot |
| AI | Server-side provider adapter |
| Download | Server-generated result ZIP |
| Deployment | One long-lived Node.js process; no stateless serverless MVP |

## System flow

```text
GitHub URL
    |
    v
eligibility check --reject--> supported-contract explanation
    |
    v
Babel analysis -> evidence + graph -> ranked Domain Candidates
    |
    v
Transformation Readiness --none ready--> assessment + blocking evidence
    |
    v
developer selection + optional Modernization Intent
    |
    v
authorize capture -> generate -> static validation -> accept
    |
    v
authorize module -> generate -> validate -> accept -> recalculate graph
    |
    v
supported cycle remains? --yes--> authorize -> resolve through module entry -> validate -> accept
    | no                                      |
    +-----------------------------------------+
    |
    v
authorize integration -> generate -> validate -> accept -> final report + ZIP
```

## Four-day build plan

### Day 1 — repository contract and analysis

- Scaffold Next.js and the bundled Express/Mongoose example.
- Implement GitHub repository loading, limits and eligibility checks.
- Parse `package.json`, CommonJS dependencies, Express routes and Mongoose models.
- Define analysis, evidence and virtual-repository types.

Exit condition: both the example and one external supported repository produce real structured facts; unsupported input is rejected clearly.

### Day 2 — assessment and domain recommendation

- Implement dependency/cycle analysis and domain clustering.
- Detect route-to-model coupling and mixed concerns.
- Build the assessment dashboard, graph and evidence navigation.
- Rank up to three Domain Candidates deterministically.
- Evaluate Transformation Readiness separately and implement the assessment-only outcome.
- Add the grounded AI explanation and required developer confirmation boundary.

Exit condition: candidate ranking and readiness are credible and traceable, including a no-ready-candidate outcome without generation.

### Day 3 — project-dependent modernization workspace

- Implement structured AI file operations.
- Maintain an evolving virtual repository snapshot.
- Present and authorize each Stage Plan before generation.
- Generate and validate the three required Change Sets.
- Re-evaluate the graph after module acceptance, then insert and generate the conditional blocker-resolution Change Set only when the supported cycle remains.
- Require Change Acceptance before advancing the snapshot.
- Implement per-step static validation, stopping on failure.
- Implement one bounded repair attempt and rollback to the last valid snapshot.
- Generate the final combined diff and a result ZIP with `repository/` plus `toolbox-validation-report.json` at the archive root.

Exit condition: one external supported repository finishes a valid sequence, and the bundled example finishes the four-step sequence with visible trigger evidence.

### Day 4 — reliability and submission

- Repeatedly test success, rejection, provider-failure and invalid-output paths.
- Polish responsive UI, loading, empty and failure states.
- Deploy and test in an incognito browser.
- Complete the public README.
- Record the maximum three-minute demo.
- Prepare slides only after required submissions work.

Exit condition: every required submission link is public, and the supported workflow completes from a clean browser session.

## Three-minute demo

### 0:00–0:20 — problem

“Modernization does not automatically mean microservices. ToolBox finds a safe domain boundary and performs a controlled modularization.”

### 0:20–0:55 — real repository analysis

Enter a supported repository URL. Show eligibility, the graph and code evidence identifying Orders.

### 0:55–1:20 — recommendation

Show why Orders is the safest technical Domain Candidate, compare an alternative, and explain why microservices are not yet justified. Select Orders.

### 1:20–2:30 — project-dependent Change Sets

Show the detected blocker, then rapidly show behaviour capture, Domain Module creation, the still-triggered blocker resolution, integration and per-step validation.

### 2:30–3:00 — finished output

Show the before/after tree, final Validation Report and downloadable repository.

## MVP acceptance criteria

- [ ] The full workflow works for the bundled example and at least one external repository satisfying the documented contract.
- [ ] Unsupported repositories are rejected before any AI call.
- [ ] Only public GitHub repositories that pass Safety Screening enter analysis.
- [ ] Safety Screening reports supported risk signals without claiming malware certification.
- [ ] External repository data remains in memory and inactive runs expire after 30 minutes.
- [ ] Users are told which selected source is sent to the configured provider.
- [ ] A transient provider failure is retried once; a second failure preserves the snapshot for manual stage retry.
- [ ] Findings and recommendations link to real files and lines.
- [ ] Every finding is visibly labelled automatable or developer-decision-required.
- [ ] Only domain separation and circular-dependency repair are presented as automated remediation.
- [ ] Up to three Domain Candidates are ranked before AI explanation.
- [ ] Transformation Readiness is evaluated independently of repository eligibility and candidate rank.
- [ ] Every readiness rule is deterministic, evidence-backed and visible.
- [ ] A candidate has exactly one writable primary model; competing writes make it ineligible, while supported read-only access does not.
- [ ] A candidate is ready only when the repository already has a CommonJS Jest/Supertest harness available through `npm test`.
- [ ] AI cannot override a failed readiness rule.
- [ ] A no-ready-candidate result returns evidence and performs no generation calls.
- [ ] The UI never presents technical ranking as business priority.
- [ ] The developer selects a Domain Candidate and separately accepts every validated Change Set.
- [ ] Every generation call requires prior authorization of its Stage Plan.
- [ ] Every validated diff requires explicit Change Acceptance before it changes the current snapshot.
- [ ] Rejection leaves the snapshot unchanged, triggers no automatic repair and prevents later stages.
- [ ] Every sequence contains the three required Change Sets and uses the evolving repository state.
- [ ] Domain Module creation switches the selected HTTP route registration without prematurely removing legacy files needed by later stages.
- [ ] The conditional Change Set appears only when the supported cycle still exists after Domain Module acceptance, producing a maximum of four.
- [ ] Invalid AI output or failed validation stops the sequence visibly.
- [ ] A failed Change Set receives no more than one automatic repair attempt.
- [ ] A second failure restores the last valid snapshot and prevents later Change Sets.
- [ ] Repair attempts cannot expand the approved stage purpose.
- [ ] Changed JavaScript parses and relative imports resolve.
- [ ] Original public route paths remain registered in the final snapshot.
- [ ] The generated Domain Module has the standard layered shape and one public entry point.
- [ ] Mongoose schemas and collection names remain unchanged.
- [ ] External code does not import Domain Module internals.
- [ ] Supported read-only consumers are rewired through the module's public facade.
- [ ] The final Validation Report distinguishes static checks from runtime tests.
- [ ] Generated tests for external repositories are visibly labelled “not executed.”
- [ ] Downloaded results include local runtime-verification commands.
- [ ] The result ZIP downloads successfully; its `repository/` folder is the exact accepted snapshot and its ToolBox report is outside that folder.
- [ ] API keys remain server-side and repository/token limits are enforced.
- [ ] Repository content is delimited as untrusted data and cannot alter the Stage Plan.
- [ ] The model has no tools, shell, network or secret access.
- [ ] Schema and path validation reject out-of-scope file operations.
- [ ] The deployed URL, public repository and video work without login.
- [ ] The demo is no longer than three minutes.

## Release gate

ToolBox is submission-ready only when all three scenarios work:

### Successful transformation

- One external public repository passes eligibility, Safety Screening and Transformation Readiness.
- The developer completes and accepts its three-or-four-step Modernization Sequence.
- The accepted repository and Validation Report download successfully in the result ZIP.

### Honest rejection

- One public repository fails eligibility, Safety Screening or Transformation Readiness.
- ToolBox shows exact evidence and makes no generation calls.

### Failure recovery

- A deliberately invalid Change Set triggers one bounded repair attempt.
- A second failure demonstrates rollback to the last valid snapshot and stops later stages.

## Cut order

Cut these first if time is short:

1. Pitch deck
2. UI animation and nonessential visual polish
3. Optional Modernization Intent
4. Lower-value Modernization Finding detectors
5. Rich React Flow interactions; retain a basic dependency view

Never cut real external repository support, eligibility, Safety Screening, evidence-backed candidate ranking, Transformation Readiness, the three required Change Sets, the conditional circular-dependency stage, Static Validation, human authorization and Change Acceptance, repair/rollback, final download, public deployment or the three-minute video.

## Explicit non-goals

- Whole-application or one-shot conversion
- Runtime/framework upgrades in the MVP
- Automatic repair of shared-model ownership, global state or unsupported cross-domain access
- Microservice extraction
- TypeScript, NestJS, Spring Boot, Java, Python or ESM analysis
- Express-to-NestJS migration
- Monorepos or arbitrary Express.js structures
- Plugin marketplace, runtime plugin loading or framework-selection UI
- AI provider/model selection UI or automatic provider fallback
- GitHub OAuth, branches or pull-request creation
- Commit-SHA resolution, branch-change detection or live repository synchronization
- Stateless/serverless deployment without shared run state
- Executing untrusted third-party repository code
- Runtime verification for external repositories
- Kubernetes, deployment or infrastructure generation
- Graph databases or multi-agent frameworks
- AI-selected or arbitrary sequence length outside the three-to-four-stage contract

## Stretch goals

Only after every acceptance criterion passes:

- One additional automatically repairable finding, only with its own deterministic trigger and validation rule
- Git-compatible patch download
- Sandboxed test execution
- GitHub pull-request creation
- TypeScript/CommonJS repositories
- Before/after architecture metrics

## Final positioning

ToolBox is an evidence-backed Express.js domain modularization product, not an automatic microservice converter and not a generic repository chatbot.

> **Supported repository in. Ranked technical Domain Candidates; one developer-selected module and three or four evidence-driven Change Sets out.**

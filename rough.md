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

> ToolBox analyzes a supported legacy Express.js repository, identifies a Domain Module to modernize, explains the recommendation with code evidence, and modularizes that domain through exactly three developer-approved Change Sets.

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
- `package.json` declares Express and Mongoose
- JavaScript/CommonJS source using `.js` files and `require()`
- npm project with a single application root
- Recognizable Express entry point
- At least one route and one Mongoose model
- Maximum 150 analyzed source files
- Maximum 2 MB of analyzed source

ToolBox ignores `node_modules`, build output, coverage, generated files, vendored code and binaries.

Unsupported repositories are rejected before an AI call, with exact reasons and a link to the supported repository contract. ToolBox never describes unsupported input as “best effort.”

The bundled legacy Orders/Users/Payments repository satisfies the same contract as external repositories; it is not a separate hard-coded product path.

## Complete user journey

1. User enters a public GitHub URL or selects the bundled example.
2. ToolBox runs eligibility checks without AI.
3. ToolBox parses the eligible repository and builds code evidence and a dependency graph.
4. ToolBox recommends one Domain Module candidate and explains why modularization is safer than immediate service extraction.
5. The developer confirms or rejects the Modernization Recommendation.
6. ToolBox proposes a three-step Modernization Sequence.
7. The developer reviews and approves each Change Set separately.
8. Each approved Change Set is generated against the evolving virtual repository and statically validated before the next begins.
9. ToolBox presents the final diff, file tree and Validation Report.
10. The developer downloads the resulting repository ZIP.

## Three required Change Sets

### Change Set 1 — protect behaviour

- Add characterization tests for the selected domain's existing HTTP routes.
- Preserve current request paths and response contracts.
- Do not change production code.

### Change Set 2 — create the Domain Module

- Create a domain folder with explicit route/controller, business and persistence boundaries.
- Move selected business and database logic out of legacy route handlers.
- Preserve observable HTTP behaviour.

### Change Set 3 — integrate and clean up

- Rewire the application to use the new Domain Module.
- Remove superseded legacy code and imports.
- Resolve internal relative imports.
- Produce the final before/after file tree and Validation Report.

The fourth Change Set is not part of the MVP. It can be reconsidered only after every acceptance criterion passes.

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
- Candidate Domain Modules
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

- Recommended Domain Module and confidence
- Plain-language benefits and risks
- “Why not microservices?” explanation
- Supporting code evidence
- Confirm/reject control

### Modernization workspace

- Three-step sequence with current status
- Approval before each Change Set
- Files changed and unified diff
- Per-step Validation Report
- Final before/after file tree
- Repository ZIP download

## Static analysis and evidence

Static analysis establishes repository facts. AI may explain those facts but may not invent them.

Extract:

- Node and Express versions from `package.json`
- `require()` dependency relationships
- Express routers, routes and middleware
- Route handlers and controllers
- Mongoose models and model references
- Direct model access from route/controller files
- Shared models and highly connected modules
- Circular dependencies
- Large route handlers and mixed concerns
- Test files and test scripts
- Candidate domain clusters based on names, paths, imports, routes and models

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

The highest score is not automatically accepted. ToolBox shows confidence, conflicting evidence and the developer confirmation boundary.

## AI responsibilities

AI is core but bounded:

1. Explain and challenge the Domain Module recommendation using supplied evidence.
2. Generate Change Set 1 from the selected domain files and route contracts.
3. Generate Change Set 2 from the validated result of Change Set 1.
4. Generate Change Set 3 from the validated result of Change Set 2.

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
```

The API key is never exposed in browser JavaScript or committed to the repository.

## Token and cost controls

- Reject unsupported repositories before AI usage.
- Never send the entire repository.
- Send compact metrics and evidence for explanation.
- Send only the selected domain, entry point and directly related files for generation.
- Cache analysis and explanation by repository commit/hash.
- Cap selected source and evidence snippets.
- Rate-limit public runs.

Target per uncached completed workflow:

```text
Explanation input       <= 8,000 tokens
Each generation input   <= 15,000 tokens
AI calls                4 total: 1 explanation + 3 generation
```

## Validation contract

For every Change Set:

- Parse every changed JavaScript file successfully.
- Confirm changed relative imports resolve in the virtual repository.
- Reject paths outside the repository root.
- Reject changes to ignored or disallowed files.
- Confirm required generated files exist.
- Stop the sequence on validation failure; never silently continue.

For the final result:

- Confirm original public route paths remain registered.
- Confirm the old selected-domain implementation is no longer wired into the application.
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
| Repository input | Fetch public GitHub archive/tree server-side |
| Virtual changes | In-memory repository snapshot |
| AI | Server-side provider adapter |
| Download | Server-generated ZIP |
| Deployment | Public Node.js host |

## System flow

```text
GitHub URL
    |
    v
eligibility check --reject--> supported-contract explanation
    |
    v
Babel analysis -> evidence + graph -> Domain Module recommendation
    |
    v
developer confirmation
    |
    v
Change Set 1 -> validate -> approve
    |
    v
Change Set 2 -> validate -> approve
    |
    v
Change Set 3 -> validate -> final report + ZIP
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
- Rank Domain Module candidates deterministically.
- Add the grounded AI explanation and confirmation boundary.

Exit condition: the recommendation is credible and traceable without relying on invented AI facts.

### Day 3 — three-step modernization workspace

- Implement structured AI file operations.
- Maintain an evolving virtual repository snapshot.
- Generate, review and approve all three Change Sets.
- Implement per-step static validation, stopping on failure.
- Generate the final combined diff, report and ZIP.

Exit condition: one complete external supported repository and the bundled example finish the three-step sequence.

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

Show why Orders should become a Domain Module and why microservices are not yet justified. Confirm the recommendation.

### 1:20–2:30 — three Change Sets

Rapidly show behaviour protection, Domain Module creation, integration and per-step validation.

### 2:30–3:00 — finished output

Show the before/after tree, final Validation Report and downloadable repository.

## MVP acceptance criteria

- [ ] The full workflow works for the bundled example and at least one external repository satisfying the documented contract.
- [ ] Unsupported repositories are rejected before any AI call.
- [ ] Findings and recommendations link to real files and lines.
- [ ] Domain ranking is calculated before AI explanation.
- [ ] The developer confirms the recommendation and separately approves every Change Set.
- [ ] Exactly three sequential Change Sets use the evolving repository state.
- [ ] Invalid AI output or failed validation stops the sequence visibly.
- [ ] Changed JavaScript parses and relative imports resolve.
- [ ] Original public route paths remain registered in the final snapshot.
- [ ] The final Validation Report distinguishes static checks from runtime tests.
- [ ] The final repository ZIP downloads successfully.
- [ ] API keys remain server-side and repository/token limits are enforced.
- [ ] The deployed URL, public repository and video work without login.
- [ ] The demo is no longer than three minutes.

## Explicit non-goals

- Whole-application or one-shot conversion
- Runtime/framework upgrades in the MVP
- Microservice extraction
- TypeScript, NestJS, Spring Boot, Java, Python or ESM analysis
- Express-to-NestJS migration
- Monorepos or arbitrary Express.js structures
- Plugin marketplace, runtime plugin loading or framework-selection UI
- GitHub OAuth, branches or pull-request creation
- Executing untrusted third-party repository code
- Runtime verification for external repositories
- Kubernetes, deployment or infrastructure generation
- Graph databases or multi-agent frameworks
- A fourth Change Set before the required workflow is complete

## Stretch goals

Only after every acceptance criterion passes:

- A fourth Change Set for a clearly justified cleanup
- Git-compatible patch download
- Sandboxed test execution
- GitHub pull-request creation
- TypeScript/CommonJS repositories
- Before/after architecture metrics

## Final positioning

ToolBox is an evidence-backed Express.js domain modularization product, not an automatic microservice converter and not a generic repository chatbot.

> **Supported repository in. One confirmed Domain Module and three validated, reviewable Change Sets out.**

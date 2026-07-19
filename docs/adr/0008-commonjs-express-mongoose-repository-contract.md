# Support one Express repository profile

The MVP transformation workflow supports one single-root npm application using JavaScript, CommonJS, Express.js and Mongoose. Within that stack, generation is limited to the published conventional syntax profile for literal CommonJS imports, Express route mounting and registration, statically present handlers, Mongoose declarations and classifiable CRUD calls. ESM, TypeScript, monorepos and other persistence libraries are rejected before AI usage because each would add distinct dependency analysis, generation and validation paths that cannot be completed reliably within the hackathon.

## Consequences

Eligibility checks must identify the module system, framework, persistence library, package manager and application root deterministically. Archive extraction retains recognized root package-manager lockfile or config names as content-free evidence, while continuing to exclude their untrusted content from snapshots, analysis and AI input. npm evidence is accepted; unsupported or conflicting package-manager evidence rejects eligibility with stable evidence. Syntax outside the conventional transformation profile may still receive an assessment, but affected candidates fail Transformation Readiness and cannot generate changes. Messages must state the failed requirement and must not describe unsupported inputs as best effort.

The supported mount profile is `app.use('/literal', importedRouter)` and the generated public-module equivalent `app.use('/literal', importedModule.router)`. Direct-require mount targets such as `app.use('/literal', require('./router'))`, middleware-before-router mounts such as `app.use('/literal', auth, importedRouter)`, and non-literal prefixes remain assessment-only shapes.

The analyzer retains exact unsupported route, mount, handler, model, and CRUD syntax evidence. Candidate-relevant evidence fails the deterministic `READINESS_SUPPORTED_TRANSFORMATION_SYNTAX` rule with stable per-shape evidence IDs; it does not alter repository eligibility or candidate ranking.

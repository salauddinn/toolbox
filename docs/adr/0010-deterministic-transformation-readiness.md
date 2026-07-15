# Determine transformation readiness without AI

A Domain Candidate is ready only when static analysis finds stable Express routes, exactly one writable primary Mongoose model with exclusive Write Ownership, no direct access from the candidate to another domain's model, statically extractable routing, an existing CommonJS Jest/Supertest harness available through `npm test`, no dynamic loading or unsupported global-state writes, a source slice within generation limits, and no unsupported Blocker. AI cannot waive a failed readiness rule.

## Consequences

Read-only model access from other domains does not disqualify a candidate, but competing writes do. ToolBox uses the repository's existing test toolchain and does not add or upgrade dependencies, manifests or lockfiles. Readiness results must show every rule, its evidence and its pass/fail status; a failed rule prevents generation for that candidate.

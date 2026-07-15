# Support one Express repository profile

The MVP transformation workflow supports one single-root npm application using JavaScript, CommonJS, Express.js and Mongoose. Within that stack, generation is limited to the published conventional syntax profile for literal CommonJS imports, Express route mounting and registration, statically present handlers, Mongoose declarations and classifiable CRUD calls. ESM, TypeScript, monorepos and other persistence libraries are rejected before AI usage because each would add distinct dependency analysis, generation and validation paths that cannot be completed reliably within the hackathon.

## Consequences

Eligibility checks must identify the module system, framework, persistence library, package manager and application root deterministically. Syntax outside the conventional transformation profile may still receive an assessment, but affected candidates fail Transformation Readiness and cannot generate changes. Messages must state the failed requirement and must not describe unsupported inputs as best effort.

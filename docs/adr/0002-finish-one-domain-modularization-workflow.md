# Finish one domain modularization workflow

Status: superseded by ADR-0003

The hackathon MVP will fully support one workflow: produce an evidence-backed Modernization Recommendation for a Domain Module candidate in a supported legacy Express.js repository, require developer confirmation, and modularize that domain through exactly three sequential, separately approved Change Sets with explicit Validation Reports. This supersedes ADR-0001's single-Change-Set limit. Supporting multiple modernization strategies or whole-application conversion was rejected because it would sacrifice reliability and make the completion boundary impossible to demonstrate within four days.

## Consequences

All three Change Sets must operate on the evolving repository state, pass their declared static validation, and produce a downloadable final repository. A fourth Change Set and additional modernization strategies remain out of scope until the required workflow satisfies every acceptance criterion.

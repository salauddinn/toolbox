# Determine a three-to-four-step sequence from project evidence

ToolBox will always produce Change Sets that capture existing behaviour, create the confirmed Domain Module, and integrate and clean up the result. Static analysis inserts one additional blocker-resolution Change Set only when evidence reveals a circular dependency, shared-model ownership, global state or another supported obstacle to modularization. This supersedes ADR-0002's exactly-three limit while keeping sequence length and stage purposes deterministic rather than allowing AI to invent an arbitrary plan.

## Consequences

Every completed workflow contains three or four sequential Change Sets. The bundled example must exercise the conditional stage, and the Validation Report must cite the evidence rule that caused it to be included or omitted.

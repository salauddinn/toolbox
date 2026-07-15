# Determine a three-to-four-step sequence from project evidence

ToolBox will always produce Change Sets that capture existing behaviour, create the confirmed Domain Module, and integrate and clean up the result. Initial static analysis may show a pending conditional marker for a supported circular CommonJS dependency. After the Domain Module Change Set is accepted, ToolBox recalculates the graph reachable from the recognized application entry and inserts one blocker-resolution Change Set only when that cycle remains reachable. An unwired legacy cycle is handled by cleanup, not an extra repair stage. ADR-0007 narrows the MVP conditional rule to this finding. This supersedes ADR-0002's exactly-three limit while keeping sequence length, trigger and stage purposes deterministic rather than allowing AI to invent an arbitrary plan.

## Consequences

Every completed workflow contains three or four sequential Change Sets. The bundled example must preserve the supported cycle as entry-reachable through Domain Module creation so it exercises the conditional stage. The Validation Report must cite the post-acceptance graph evidence that caused the stage to be included or omitted.

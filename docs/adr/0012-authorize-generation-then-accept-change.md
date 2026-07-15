# Authorize generation, then accept the validated change

Each stage has two human controls: the developer first authorizes a scoped Stage Plan before ToolBox spends generation tokens, then separately reviews and accepts the generated, validated diff. Only Change Acceptance applies the Change Set to the evolving repository snapshot.

## Consequences

Rejecting a diff leaves the last valid snapshot unchanged and prevents later stages from continuing. Rejection is not a validation failure and does not trigger automatic repair; the developer may restart the stage after changing Modernization Intent.

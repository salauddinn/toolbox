# Allow one repair attempt, then roll back and stop

When a generated Change Set fails Static Validation, ToolBox may make one repair call using only the changed files, relevant originals and structured validation errors. If the repaired result also fails, ToolBox restores the last valid repository snapshot and stops the Modernization Sequence rather than entering an uncontrolled retry loop.

## Consequences

The repair cannot expand the approved Change Set purpose, both attempts appear in the Validation Report, and the next Change Set cannot begin after a second failure. Token budgets and rate limits must account for at most one repair call per stage.

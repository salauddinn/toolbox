# Use one explicit Domain Module shape

Every generated Domain Module will expose a public `index.js` and separate route, controller, service, repository and Mongoose model responsibilities with inward dependency flow. Existing HTTP routes, database schemas, collections and the single-process deployment boundary remain unchanged so ToolBox performs architectural modularization rather than framework, API or data migration.

## Consequences

External application code imports the module only through `index.js`, superseded legacy wiring is removed, and Static Validation must verify the public entry, dependency direction, route preservation and absence of stale references.

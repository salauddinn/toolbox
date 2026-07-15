# Do not execute external repositories in the hosted MVP

ToolBox will apply Static Validation to external repositories but will not install their dependencies or execute their application code, scripts or generated tests. Runtime Validation is limited to the controlled bundled example because executing untrusted repositories would require a hardened sandbox that cannot be built and audited reliably within the hackathon.

## Consequences

Generated characterization tests for external repositories must be labelled “not executed,” every Validation Report must distinguish Static Validation from Runtime Validation, and downloaded results must include local verification commands. The product must never imply behavioural equivalence from static checks alone.

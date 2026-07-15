# Treat repository content as untrusted data

All submitted repository content is untrusted, including comments and documentation that may contain prompt-injection instructions. ToolBox sends source only as clearly delimited data to a model with no tools, shell or network access and accepts only schema-validated file operations constrained to the in-memory repository root.

## Consequences

Secrets never enter prompts, repository-authored instructions cannot change the Stage Plan, path traversal and disallowed-file operations are rejected, and any requested operation outside the approved Change Set scope fails validation.

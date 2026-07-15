# Accept only public, safety-screened, temporary repository data

The hosted MVP accepts only public GitHub repositories that pass deterministic Safety Screening before analysis or AI usage. Repository snapshots and Change Sets remain in memory, inactive runs expire after 30 minutes, and selected source sent to the configured provider is disclosed to the user; ToolBox provides no accounts or persistent external-source storage.

## Consequences

Safety Screening rejects path traversal, symlinks, binaries/executables, sensitive files, obfuscated/minified analyzed source, dynamic code execution and suspicious install-script patterns that ToolBox explicitly recognizes, but it does not claim malware detection. A transient provider request receives one transport retry; a second failure preserves the last valid snapshot and requires a manual stage retry without repeating static analysis.

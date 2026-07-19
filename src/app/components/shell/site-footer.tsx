export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-surface-paper">
      <div className="tb-shell-console flex flex-col gap-1 px-4 py-4 text-[11px] text-text-quiet sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="tb-mono">toolbox · express domain modularization</p>
        <p>Selected source may be sent to the configured AI provider. Secrets stay server-side.</p>
      </div>
    </footer>
  );
}

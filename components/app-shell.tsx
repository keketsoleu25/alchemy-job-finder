import Link from "next/link";

const nav = [
  ["/", "Overview"],
  ["/jobs", "Jobs"],
  ["/applications", "Applications"],
  ["/companies", "Companies"],
  ["/analytics", "Analytics"],
  ["/settings", "Profile"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Alchemy Job Finder home">
          <span className="brand-mark">A</span>
          <span>
            <strong>Alchemy</strong>
            <small>Job Finder</small>
          </span>
        </Link>

        <nav className="nav" aria-label="Primary navigation">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="nav-link">
              <span className="nav-dot" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-note">
          <span className="eyebrow">SYSTEM</span>
          <strong>Direct-job intelligence</strong>
          <p>Collect, rank and track the opportunities worth your time.</p>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <span className="eyebrow">ALCHEMY JOB FINDER</span>
            <span className="topbar-copy">Your job search, distilled.</span>
          </div>
          <div className="live-chip"><span /> Collection engine ready</div>
        </header>
        <main className="page-wrap">{children}</main>
      </div>
    </div>
  );
}

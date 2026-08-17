import { addCompany } from "@/app/actions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const companies = await prisma.company.findMany({
    include: { _count: { select: { jobs: true } } },
    orderBy: [{ priority: "desc" }, { name: "asc" }],
  });

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">SOURCE REGISTRY</span>
          <h1>Control where Alchemy looks for work.</h1>
          <p>Add supported employer boards once. The generic worker handles collection from there.</p>
        </div>
        <span className="count-chip">{companies.filter((company) => company.enabled).length} active</span>
      </section>

      <section className="split-grid companies-layout">
        <article className="panel">
          <span className="eyebrow accent">ADD SOURCE</span>
          <h2>Register an employer</h2>
          <p className="muted">Prefer Greenhouse or Lever. Structured HTML reads public schema.org JobPosting data when a career page exposes it.</p>
          <form action={addCompany} className="form-grid">
            <label><span>Company name</span><input className="field" required name="name" placeholder="Example Co" /></label>
            <label><span>Slug</span><input className="field" required name="slug" placeholder="example-co" /></label>
            <label className="full-span"><span>Career URL</span><input className="field" required name="careerUrl" type="url" placeholder="https://..." /></label>
            <label className="full-span"><span>Website URL</span><input className="field" name="websiteUrl" type="url" placeholder="https://..." /></label>
            <label><span>Source type</span><select className="field" name="scraperType"><option value="GREENHOUSE">Greenhouse</option><option value="LEVER">Lever</option><option value="CUSTOM">Structured HTML</option></select></label>
            <label><span>Board token</span><input className="field" name="atsIdentifier" placeholder="Not needed for structured HTML" /></label>
            <button className="button primary full-span" type="submit">Save source</button>
          </form>
        </article>

        <article className="panel">
          <span className="eyebrow">OPERATIONS</span>
          <h2>Collection commands</h2>
          <div className="command-card"><span>Collect enabled sources</span><code>npm run scrape</code></div>
          <div className="command-card"><span>Re-score vacancies</span><code>npm run score</code></div>
          <div className="command-card"><span>Full refresh</span><code>npm run refresh</code></div>
          <p className="muted">A failed company is isolated so the worker continues to the next source.</p>
        </article>
      </section>

      <section className="panel">
        <div className="section-heading compact"><div><span className="eyebrow">REGISTERED SOURCES</span><h2>Collection health</h2></div></div>
        <div className="company-list">
          {companies.map((company) => (
            <div className="company-row" key={company.id}>
              <div className="company-avatar">{company.name.slice(0, 2).toUpperCase()}</div>
              <div className="company-main"><strong>{company.name}</strong><span>{company.scraperType} · {company.atsIdentifier || "career-page data"}</span></div>
              <div><strong>{company._count.jobs}</strong><span>jobs</span></div>
              <div><strong>{company.lastSuccessfulScrapeAt ? company.lastSuccessfulScrapeAt.toLocaleString("en-ZA") : "Never"}</strong><span>last success</span></div>
              <span className={company.lastError ? "health bad" : "health good"}>{company.lastError ? "Error" : "Healthy"}</span>
            </div>
          ))}
          {!companies.length ? <div className="empty-state"><strong>No sources yet.</strong><p>Add your first employer above.</p></div> : null}
        </div>
      </section>
    </div>
  );
}

import { updateProfile } from "@/app/actions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

function join(values: string[]): string {
  return values.join(", ");
}

export default async function SettingsPage() {
  const profile = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });

  if (!profile) {
    return (
      <div className="stack-xl">
        <section className="page-heading"><div><span className="eyebrow accent">MATCH PROFILE</span><h1>No candidate profile yet.</h1><p>Seed the default profile once, then tune it here.</p></div></section>
        <div className="empty-state"><code>npm run seed:profile</code></div>
      </div>
    );
  }

  return (
    <div className="stack-xl">
      <section className="page-heading">
        <div>
          <span className="eyebrow accent">MATCH PROFILE</span>
          <h1>Teach Alchemy what a good opportunity looks like.</h1>
          <p>These values drive deterministic scoring. Change the profile, then run scoring again.</p>
        </div>
        <span className="count-chip">Minimum {profile.minimumScore}%</span>
      </section>

      <form action={updateProfile} className="settings-grid">
        <article className="panel stack-lg">
          <div><span className="eyebrow">ROLE TARGET</span><h2>What are you looking for?</h2></div>
          <Field label="Target roles" name="targetRoles" defaultValue={join(profile.targetRoles)} hint="Comma-separated role titles" />
          <Field label="Preferred roles" name="preferredRoles" defaultValue={join(profile.preferredRoles)} />
          <Field label="Preferred keywords" name="preferredKeywords" defaultValue={join(profile.preferredKeywords)} />
          <Field label="Excluded title keywords" name="excludedKeywords" defaultValue={join(profile.excludedKeywords)} />
        </article>

        <article className="panel stack-lg">
          <div><span className="eyebrow">CAPABILITY</span><h2>Skills and experience</h2></div>
          <Field label="Core skills" name="skills" defaultValue={join(profile.skills)} />
          <Field label="Strong skills" name="strongSkills" defaultValue={join(profile.strongSkills)} />
          <Field label="Secondary skills" name="secondarySkills" defaultValue={join(profile.secondarySkills)} />
          <label className="form-label"><span>Years of experience</span><input className="field" type="number" min="0" step="0.5" name="yearsExperience" defaultValue={profile.yearsExperience} /></label>
          <label className="form-label"><span>Education summary</span><textarea className="field textarea" name="education" defaultValue={profile.education ?? ""} /></label>
        </article>

        <article className="panel stack-lg">
          <div><span className="eyebrow">WORKPLACE</span><h2>Location preferences</h2></div>
          <Field label="Preferred locations" name="preferredLocations" defaultValue={join(profile.preferredLocations)} />
          <label className="form-label"><span>Remote preference</span><select className="field" name="remotePreference" defaultValue={profile.remotePreference}><option value="FLEXIBLE">Flexible</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></select></label>
          <label className="form-label"><span>Strong-match threshold</span><input className="field" type="number" min="0" max="100" name="minimumScore" defaultValue={profile.minimumScore} /></label>
        </article>

        <article className="panel focus-panel stack-lg">
          <span className="eyebrow accent">HOW SCORING WORKS</span>
          <h2>Explainable by design.</h2>
          <p>Alchemy scores technology overlap, role fit, experience, location, education language and direct-application quality. Hard filters are deliberately conservative.</p>
          <div className="command-card"><span>Apply changes to stored jobs</span><code>npm run score</code></div>
          <button className="button primary" type="submit">Save matching profile</button>
        </article>
      </form>
    </div>
  );
}

function Field({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: string; hint?: string }) {
  return <label className="form-label"><span>{label}</span><input className="field" name={name} defaultValue={defaultValue} />{hint ? <small>{hint}</small> : null}</label>;
}

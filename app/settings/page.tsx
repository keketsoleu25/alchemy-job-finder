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
          <span className="eyebrow accent">🇿🇦 SA INTELLIGENCE · PROFILE</span>
          <h1>Teach Alchemy what a good South African opportunity looks like.</h1>
          <p>v0.2 uses this profile for SA-aware normalization, eligibility analysis, matching and the Apply / Maybe / Skip verdict.</p>
        </div>
        <span className="count-chip">Minimum {profile.minimumScore}%</span>
      </section>

      <form action={updateProfile} className="settings-grid">
        <article className="panel stack-lg">
          <div><span className="eyebrow">ROLE TARGET</span><h2>What are you looking for?</h2></div>
          <Field label="Target roles" name="targetRoles" defaultValue={join(profile.targetRoles)} hint="Include SA variants such as Software Developer, Graduate Developer, Junior Software Engineer and Application Developer." />
          <Field label="Preferred roles" name="preferredRoles" defaultValue={join(profile.preferredRoles)} />
          <Field label="Preferred keywords" name="preferredKeywords" defaultValue={join(profile.preferredKeywords)} hint="Useful terms: graduate, junior, associate, trainee, internship, learnership, React, TypeScript, C#, Java." />
          <Field label="Excluded title keywords" name="excludedKeywords" defaultValue={join(profile.excludedKeywords)} />
        </article>

        <article className="panel stack-lg">
          <div><span className="eyebrow">CAPABILITY</span><h2>Skills and experience</h2></div>
          <Field label="Core skills" name="skills" defaultValue={join(profile.skills)} />
          <Field label="Strong skills" name="strongSkills" defaultValue={join(profile.strongSkills)} />
          <Field label="Secondary skills" name="secondarySkills" defaultValue={join(profile.secondarySkills)} />
          <label className="form-label"><span>Years of experience</span><input className="field" type="number" min="0" step="0.5" name="yearsExperience" defaultValue={profile.yearsExperience} /></label>
          <label className="form-label"><span>Education summary</span><textarea className="field textarea" name="education" defaultValue={profile.education ?? ""} /><small>Describe completed study, incomplete degree study, bootcamps and relevant training accurately. Alchemy uses this to avoid treating every degree mention as an automatic rejection.</small></label>
        </article>

        <article className="panel stack-lg">
          <div><span className="eyebrow">SOUTH AFRICA</span><h2>Location preferences</h2></div>
          <Field label="Preferred locations" name="preferredLocations" defaultValue={join(profile.preferredLocations)} hint="Examples: South Africa, Gauteng, Johannesburg, Pretoria, Western Cape, Cape Town, Remote SA." />
          <label className="form-label"><span>Remote preference</span><select className="field" name="remotePreference" defaultValue={profile.remotePreference}><option value="FLEXIBLE">Flexible</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option><option value="ONSITE">On-site</option></select></label>
          <label className="form-label"><span>Strong-match threshold</span><input className="field" type="number" min="0" max="100" name="minimumScore" defaultValue={profile.minimumScore} /></label>
        </article>

        <article className="panel focus-panel stack-lg">
          <span className="eyebrow accent">V0.2 MATCHING PIPELINE</span>
          <h2>Explainable by design.</h2>
          <p>Alchemy now normalizes South African location, work mode, career level, qualification language and common ZAR salary formats before separating hard requirements from learnable gaps.</p>
          <div className="command-card"><span>Re-run analysis on stored jobs</span><code>npm run score</code></div>
          <button className="button primary" type="submit">Save SA matching profile</button>
        </article>
      </form>
    </div>
  );
}

function Field({ label, name, defaultValue, hint }: { label: string; name: string; defaultValue: string; hint?: string }) {
  return <label className="form-label"><span>{label}</span><input className="field" name={name} defaultValue={defaultValue} />{hint ? <small>{hint}</small> : null}</label>;
}

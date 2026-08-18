// Canonical skills and common aliases used by the deterministic matcher.
// Keep this list intentionally explicit: it makes scoring explainable and easy to tune.
const SKILL_ALIASES: Record<string, string[]> = {
  "JavaScript": ["javascript", "js", "ecmascript"],
  "TypeScript": ["typescript", "ts"],
  "React": ["react", "react.js", "reactjs"],
  "Next.js": ["next.js", "nextjs", "next js"],
  "Node.js": ["node.js", "nodejs", "node js"],
  "HTML": ["html", "html5"],
  "CSS": ["css", "css3"],
  "Tailwind CSS": ["tailwind", "tailwind css"],
  "PostgreSQL": ["postgresql", "postgres"],
  "SQL": ["sql"],
  "Prisma": ["prisma"],
  "Python": ["python"],
  "Flutter": ["flutter"],
  "Dart": ["dart"],
  "C#": ["c#", "c sharp", "csharp"],
  "C++": ["c++", "cpp"],
  ".NET": [".net", "dotnet", "asp.net", "aspnet"],
  "Java": ["java"],
  "Go": ["golang", "go language"],
  "Rust": ["rust", "rustlang"],
  "WebAssembly": ["webassembly", "wasm"],
  "Spring": ["spring boot", "spring framework", "spring"],
  "AWS": ["aws", "amazon web services"],
  "Azure": ["azure", "microsoft azure"],
  "Docker": ["docker", "containers"],
  "Kubernetes": ["kubernetes", "k8s"],
  "Git": ["git", "github", "gitlab"],
  "REST": ["rest api", "restful", "rest"],
  "GraphQL": ["graphql"],
  "Vue": ["vue", "vue.js", "vuejs"],
  "Angular": ["angular"],
  "MongoDB": ["mongodb", "mongo db"],
  "Redis": ["redis"],
};

function containsAlias(text: string, alias: string): boolean {
  // Word-ish boundaries prevent short aliases such as `ts` or `js` from matching
  // inside unrelated words while still allowing punctuation-heavy skills like C#.
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return regex.test(text);
}

export function extractSkills(text: string): string[] {
  const matches = Object.entries(SKILL_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => containsAlias(text, alias)))
    .map(([canonical]) => canonical);

  return matches.sort((a, b) => a.localeCompare(b));
}

export function normalizeSkillName(skill: string): string {
  const lower = skill.trim().toLowerCase();

  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (canonical.toLowerCase() === lower || aliases.includes(lower)) {
      return canonical;
    }
  }

  return skill.trim();
}

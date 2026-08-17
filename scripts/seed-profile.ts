import { prisma } from "../lib/db/prisma";

async function main() {
  const existing = await prisma.candidateProfile.findFirst({ orderBy: { createdAt: "asc" } });

  const profile = {
    name: "Primary profile",
    targetRoles: ["Frontend Developer", "Full Stack Developer", "Software Developer", "Web Developer"],
    preferredRoles: ["Frontend Engineer", "Software Engineer", "React Developer"],
    skills: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Git", "REST"],
    strongSkills: ["HTML", "CSS", "JavaScript", "TypeScript", "React", "Next.js"],
    secondarySkills: ["Tailwind CSS", "PostgreSQL", "Prisma", "Python", "Flutter"],
    yearsExperience: 2,
    preferredLocations: ["Johannesburg", "Gauteng", "Cape Town", "South Africa", "Remote"],
    remotePreference: "FLEXIBLE" as const,
    education: "Computer Science studies and software-development training",
    excludedKeywords: ["VP Engineering", "Vice President", "Director of Engineering"],
    preferredKeywords: ["frontend", "full stack", "software developer", "react", "typescript", "next.js"],
    minimumScore: 65,
  };

  if (existing) {
    await prisma.candidateProfile.update({ where: { id: existing.id }, data: profile });
    console.log(`Updated candidate profile: ${existing.id}`);
  } else {
    const created = await prisma.candidateProfile.create({ data: profile });
    console.log(`Created candidate profile: ${created.id}`);
  }
}

main()
  .catch((error) => {
    console.error("Candidate profile seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

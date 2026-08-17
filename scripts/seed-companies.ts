import { prisma } from "../lib/db/prisma";

async function main() {
  const companies = [
    {
      name: "Figma",
      slug: "figma",
      websiteUrl: "https://www.figma.com",
      careerUrl: "https://www.figma.com/careers/",
      scraperType: "GREENHOUSE" as const,
      atsIdentifier: "figma",
      enabled: true,
      priority: 10,
    },
    {
      name: "Mama Money",
      slug: "mama-money",
      websiteUrl: "https://www.mamamoney.co.za",
      careerUrl: "https://jobs.lever.co/mamamoney",
      scraperType: "LEVER" as const,
      atsIdentifier: "mamamoney",
      enabled: true,
      priority: 20,
    },
  ];

  for (const company of companies) {
    await prisma.company.upsert({
      where: {
        slug: company.slug,
      },
      update: company,
      create: company,
    });

    console.log(`Seeded: ${company.name}`);
  }

  console.log("");
  console.log(`Seeded ${companies.length} companies`);
}

main()
  .catch((error) => {
    console.error("Company seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
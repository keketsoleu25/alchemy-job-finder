export type SAJobBoard = {
  name: string;
  slug: string;
  websiteUrl: string;
  careerUrl: string;
  priority: number;
  discoveryFocus: readonly string[];
};

/** Discovery-only sources. These are intentionally separate from the curated
 * direct-employer list: board vacancies can later be deduplicated against an
 * authoritative employer/ATS vacancy without changing source semantics. */
export const SA_JOB_BOARDS: readonly SAJobBoard[] = [
  {
    name: "PNet",
    slug: "job-board-pnet",
    websiteUrl: "https://www.pnet.co.za",
    careerUrl: "https://www.pnet.co.za/jobs/software-developer/in-south-africa",
    priority: 55,
    discoveryFocus: ["software developer", "software engineer", "frontend", "full stack", "junior", "graduate"],
  },
  {
    name: "CareerJunction",
    slug: "job-board-careerjunction",
    websiteUrl: "https://www.careerjunction.co.za",
    careerUrl: "https://www.careerjunction.co.za/jobs/software-developer",
    priority: 55,
    discoveryFocus: ["software developer", "software engineer", "frontend", "full stack", "junior", "graduate"],
  },
  {
    name: "Careers24",
    slug: "job-board-careers24",
    websiteUrl: "https://www.careers24.com",
    careerUrl: "https://www.careers24.com/jobs/",
    priority: 45,
    discoveryFocus: ["software developer", "software engineer", "frontend", "full stack", "junior", "graduate"],
  },
];

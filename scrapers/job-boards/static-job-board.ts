import type { JobScraper, ScrapedJob, ScraperCompanyConfig } from "../types";

const USER_AGENT = "AlchemyJobFinder/1.0 (+public-job-discovery)";
const TIMEOUT_MS = 45_000;
const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_JOBS = 100;

function decode(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string, base: string): string { return new URL(href.replace(/&amp;/g, "&"), base).toString(); }

function externalId(url: string): string | undefined {
  return url.match(/(?:job|jobs)[^0-9]*(\d{6,})/i)?.[1] ?? url.match(/\/job\/[^/?#]*?(\d{5,})(?:[/?#]|$)/i)?.[1] ?? url.match(/(?:job|vacancy)[^0-9]*(\d{4,})/i)?.[1];
}

function boardName(url: string): "PNet" | "CareerJunction" | "Careers24" | null {
  const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  if (host.endsWith("pnet.co.za")) return "PNet";
  if (host.endsWith("careerjunction.co.za")) return "CareerJunction";
  if (host.endsWith("careers24.com")) return "Careers24";
  return null;
}

function looksLikeJobLink(board: NonNullable<ReturnType<typeof boardName>>, href: string): boolean {
  if (!href || href.startsWith("#") || href.startsWith("javascript:")) return false;
  if (board === "CareerJunction") return /\/jobs?\//i.test(href) && /\d{5,}/.test(href);
  if (board === "PNet") return /\/job\//i.test(href) || /jobid|job-id/i.test(href);
  return /\/jobs?\//i.test(href) || /vacanc/i.test(href);
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" }, signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const html = await response.text();
    if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error(`Response too large for ${url}`);
    return html;
  } finally { clearTimeout(timeout); }
}

function listingLinks(html: string, base: string, board: NonNullable<ReturnType<typeof boardName>>): string[] {
  const links = new Set<string>();
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    const href = match[1];
    if (!looksLikeJobLink(board, href)) continue;
    try { links.add(absoluteUrl(href, base)); } catch { /* malformed public link */ }
    if (links.size >= MAX_JOBS) break;
  }
  return [...links];
}

function jsonLdJobs(html: string): Record<string, unknown>[] {
  const jobs: Record<string, unknown>[] = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const values = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      for (const value of values) if (value && value["@type"] === "JobPosting") jobs.push(value);
    } catch { /* ignore malformed JSON-LD */ }
  }
  return jobs;
}

function text(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? decode(value) : undefined; }

function locationFromLd(value: Record<string, unknown>): string | undefined {
  const locations = Array.isArray(value.jobLocation) ? value.jobLocation : value.jobLocation ? [value.jobLocation] : [];
  for (const location of locations) {
    if (!location || typeof location !== "object") continue;
    const address = (location as Record<string, unknown>).address;
    if (!address || typeof address !== "object") continue;
    const a = address as Record<string, unknown>;
    const parts = [text(a.addressLocality), text(a.addressRegion), text(a.addressCountry)].filter(Boolean);
    if (parts.length) return parts.join(", ");
  }
  return undefined;
}

function fromLd(value: Record<string, unknown>, pageUrl: string, fallbackCompany: string): ScrapedJob | null {
  const title = text(value.title); const description = text(value.description);
  if (!title || !description) return null;
  const org = value.hiringOrganization;
  const company = org && typeof org === "object" ? text((org as Record<string, unknown>).name) ?? fallbackCompany : fallbackCompany;
  const location = locationFromLd(value);
  const employment = Array.isArray(value.employmentType) ? value.employmentType.join(", ") : text(value.employmentType);
  const date = text(value.datePosted); const publishedAt = date && !Number.isNaN(Date.parse(date)) ? new Date(date) : undefined;
  const applyUrl = text(value.url) ?? pageUrl;
  const identifier = value.identifier;
  const id = identifier && typeof identifier === "object" ? text((identifier as Record<string, unknown>).value) : text(identifier);
  return { externalId: id ?? externalId(pageUrl), title, company, location, remote: /remote|telecommute|work from home/i.test(`${location ?? ""} ${description} ${String(value.jobLocationType ?? "")}`), employmentType: employment, description, applyUrl, sourceUrl: pageUrl, source: "COMPANY_SITE", publishedAt, scrapedAt: new Date() };
}

function careerJunctionListing(html: string, pageUrl: string): ScrapedJob[] {
  const plain = decode(html);
  const marker = /Job\s+(\d{6,})(?:\s*-\s*Ref\s+([^\s]+))?/gi;
  const matches = [...plain.matchAll(marker)].slice(0, MAX_JOBS);
  const jobs: ScrapedJob[] = [];
  let previous = 0;
  for (const match of matches) {
    const end = match.index ?? 0;
    const chunk = plain.slice(Math.max(previous, end - 900), end + match[0].length);
    previous = end + match[0].length;
    const lines = chunk.split(/\s{2,}|\n/).map((v) => v.trim()).filter(Boolean);
    const titleCompany = chunk.match(/(?:Not for me\s+)?(.{4,180}?)\s+(.{2,100}?)\s+(?:R\s?Undisclosed|Undisclosed|R[\d,]+)/i);
    const title = titleCompany?.[1]?.replace(/^.*?(?:Show More|Not for me)\s+/i, "").trim();
    const company = titleCompany?.[2]?.trim();
    const meta = chunk.match(/(Permanent|Contract|Temporary|Learnership|Internship)\s+(?:(Junior|Intermediate|Senior|Graduate|Student|Specialist|Executive|Management)\s+)?(?:EE\s+)?position\s+(.+?)\s+Posted\s+(\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4})/i);
    if (!title || !company) continue;
    const id = match[1];
    jobs.push({ externalId: id, title, company, location: meta?.[3]?.trim(), remote: /work from home|remote/i.test(chunk), employmentType: meta?.[1], description: chunk, applyUrl: pageUrl, sourceUrl: pageUrl, source: "COMPANY_SITE", publishedAt: meta?.[4] && !Number.isNaN(Date.parse(meta[4])) ? new Date(meta[4]) : undefined, scrapedAt: new Date() });
  }
  return jobs;
}

function pnetListing(html: string, pageUrl: string): ScrapedJob[] {
  const ld = jsonLdJobs(html).map((v) => fromLd(v, pageUrl, "PNet")).filter((v): v is ScrapedJob => Boolean(v));
  if (ld.length) return ld.slice(0, MAX_JOBS);
  return [];
}

function fallbackFromHtml(html: string, pageUrl: string, fallbackCompany: string): ScrapedJob | null {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]; const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const title = decode(h1 ?? titleTag ?? "").replace(/\s*[|–-]\s*(PNet|CareerJunction|Careers24).*$/i, "").trim(); if (!title) return null;
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  const description = decode(main).slice(0, 50_000); if (description.length < 80) return null;
  const location = description.match(/(?:Location|City|Area)\s*[:\-]?\s*([A-Za-z ()'-]{2,60})/i)?.[1]?.trim();
  const employmentType = description.match(/\b(Permanent|Contract|Temporary|Internship|Learnership|Full[- ]time|Part[- ]time)\b/i)?.[1];
  return { externalId: externalId(pageUrl), title, company: fallbackCompany, location, remote: /\bremote\b|work from home/i.test(description), employmentType, description, applyUrl: pageUrl, sourceUrl: pageUrl, source: "COMPANY_SITE", scrapedAt: new Date() };
}

async function mapLimit<T, R>(values: T[], limit: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const result: R[] = new Array(values.length); let next = 0;
  async function worker() { while (true) { const index = next++; if (index >= values.length) return; result[index] = await fn(values[index]); } }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker)); return result;
}

export class StaticJobBoardScraper implements JobScraper {
  async fetch(company: ScraperCompanyConfig): Promise<ScrapedJob[]> {
    const board = boardName(company.careerUrl); if (!board) throw new Error(`Unsupported job board URL: ${company.careerUrl}`);
    const listing = await fetchHtml(company.careerUrl);
    const directLd = jsonLdJobs(listing).map((job) => fromLd(job, company.careerUrl, company.name)).filter((job): job is ScrapedJob => Boolean(job));
    if (directLd.length) return directLd.slice(0, MAX_JOBS);
    if (board === "CareerJunction") { const jobs = careerJunctionListing(listing, company.careerUrl); if (jobs.length) return jobs; }
    if (board === "PNet") { const jobs = pnetListing(listing, company.careerUrl); if (jobs.length) return jobs; }
    const links = listingLinks(listing, company.careerUrl, board);
    if (!links.length) throw new Error(`${board}: no public vacancy links or listing records found`);
    const batches = await mapLimit(links, 4, async (url) => { try { const html = await fetchHtml(url); const ld = jsonLdJobs(html).map((job) => fromLd(job, url, company.name)).find(Boolean); return ld ?? fallbackFromHtml(html, url, company.name); } catch (error) { console.warn(`  ${board}: detail skipped ${url}: ${error instanceof Error ? error.message : String(error)}`); return null; } });
    const jobs = batches.filter((job): job is ScrapedJob => Boolean(job)); if (!jobs.length) throw new Error(`${board}: vacancy pages produced no parseable jobs`); return jobs;
  }
}

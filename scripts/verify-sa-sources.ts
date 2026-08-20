import { SA_VERIFIED_SOURCES } from "../jobs/sa-source-intelligence";

const TIMEOUT_MS = 20_000;

async function verifyUrl(name: string, url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": "AlchemyJobFinder/0.2 (+source-verification)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const ok = response.ok && /^https?:\/\//i.test(response.url);
    console.log(`${ok ? "✓" : "✗"} ${name} — ${response.status} — ${response.url}`);
    return ok;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`✗ ${name} — ${message}`);
    return false;
  }
}

async function main() {
  console.log("🇿🇦 Verifying direct South African employer sources...");
  console.log("");

  let passed = 0;
  for (const source of SA_VERIFIED_SOURCES) {
    const ok = await verifyUrl(source.name, source.careerUrl);
    if (ok) passed++;
  }

  console.log("");
  console.log(`Verified ${passed}/${SA_VERIFIED_SOURCES.length} sources.`);

  // Do not make one temporarily blocked company destroy the whole hunt. The scrape
  // worker records per-company errors and keeps the remaining sources usable.
  if (passed === 0) {
    throw new Error("No South African job sources were reachable.");
  }
}

main().catch((error) => {
  console.error("Source verification failed:", error);
  process.exitCode = 1;
});

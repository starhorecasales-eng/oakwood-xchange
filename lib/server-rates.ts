import { fetchLatestRateTable } from "./frankfurter.ts";
import { PACKAGED_RATE_TABLE, type RateTable } from "./rates.ts";

const SERVER_RATE_CACHE_MS = 30 * 60 * 1000;
const SERVER_RATE_TIMEOUT_MS = 2_000;

let cachedTable: RateTable | null = null;
let cacheExpiresAt = 0;
let pendingTable: Promise<RateTable> | null = null;

export async function getServerRateTable(now = Date.now()): Promise<RateTable> {
  if (cachedTable && now < cacheExpiresAt) return cachedTable;
  if (pendingTable) return pendingTable;

  pendingTable = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SERVER_RATE_TIMEOUT_MS);
    try {
      const latest = await fetchLatestRateTable(controller.signal);
      cachedTable = latest;
      cacheExpiresAt = now + SERVER_RATE_CACHE_MS;
      return latest;
    } catch {
      return cachedTable ?? PACKAGED_RATE_TABLE;
    } finally {
      clearTimeout(timeout);
      pendingTable = null;
    }
  })();

  return pendingTable;
}

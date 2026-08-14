import { CURRENCY_CODES, type CurrencyCode } from "./currency.ts";
import { createRateTable, type RateTable } from "./rates.ts";

export const FRANKFURTER_RATES_ENDPOINT = "https://api.frankfurter.dev/v2/rates";

export async function fetchLatestRateTable(
  signal: AbortSignal,
  base: CurrencyCode = "GBP",
  fetcher: typeof fetch = fetch,
): Promise<RateTable> {
  const quotes = CURRENCY_CODES.filter((currency) => currency !== base);
  const query = new URLSearchParams({
    base,
    quotes: quotes.join(","),
  });
  const response = await fetcher(`${FRANKFURTER_RATES_ENDPOINT}?${query}`, {
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Kur alınamadı");
  return createRateTable(await response.json(), base);
}

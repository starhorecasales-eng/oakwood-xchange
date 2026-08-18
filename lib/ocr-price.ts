import type { CurrencyCode } from "./currency.ts";
import { parseMoneyText, type Money } from "./money.ts";

export type PriceCandidate = Readonly<{
  raw: string;
  money: Money;
}>;

const PRICE_TOKEN = /(?:[₺£€$]\s*)?(?:\d{1,3}(?:[\s.,'’]\d{3})+|\d+)(?:[.,]\d{1,2})?\s*(?:TRY|GBP|EUR|USD)?/giu;

export function extractPriceCandidates(
  text: string,
  currency: CurrencyCode,
): PriceCandidate[] {
  const candidates: PriceCandidate[] = [];
  const seen = new Set<number>();

  for (const match of text.matchAll(PRICE_TOKEN)) {
    const raw = match[0].trim();
    const money = parseMoneyText(raw, { currency });
    if (!money || money.amount <= 0 || money.amount > 1_000_000_000) continue;
    const key = Math.round(money.amount * 100);
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ raw, money });
  }

  return candidates.slice(0, 8);
}

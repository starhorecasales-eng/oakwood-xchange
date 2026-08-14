import {
  CURRENCY_CODES,
  isCurrencyCode,
  type CurrencyCode,
} from "./currency.ts";
import { createMoney, type Money } from "./money.ts";

export type RateQuote = Readonly<{
  date: string;
  base: CurrencyCode;
  quote: CurrencyCode;
  rate: number;
}>;

export type RateTable = Readonly<{
  version: 1;
  base: CurrencyCode;
  date: string;
  savedAt: number;
  rates: Readonly<Record<CurrencyCode, number>>;
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RATE = 1_000_000;

export const PACKAGED_RATE_TABLE: RateTable = {
  version: 1,
  base: "GBP",
  date: "2026-08-14",
  savedAt: Date.parse("2026-08-14T12:00:00Z"),
  rates: {
    GBP: 1,
    TRY: 64.564,
    EUR: 1.1692,
    USD: 1.3504,
  },
};

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + 24 * 60 * 60 * 1000;
}

function isValidRate(value: unknown): value is number {
  return typeof value === "number"
    && Number.isFinite(value)
    && value > 0
    && value < MAX_RATE;
}

export function isRateQuote(value: unknown): value is RateQuote {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RateQuote>;
  return isCurrencyCode(candidate.base)
    && isCurrencyCode(candidate.quote)
    && candidate.base !== candidate.quote
    && isValidDate(candidate.date)
    && isValidRate(candidate.rate);
}

export function createRateTable(
  payload: unknown,
  base: CurrencyCode,
  savedAt = Date.now(),
): RateTable {
  if (!Array.isArray(payload)) throw new TypeError("Rate payload must be an array.");
  const quotes = payload.filter(isRateQuote);
  const expectedQuotes = CURRENCY_CODES.filter((currency) => currency !== base);

  if (
    quotes.length !== expectedQuotes.length
    || quotes.some((quote) => quote.base !== base)
    || !expectedQuotes.every((currency) => quotes.some((quote) => quote.quote === currency))
  ) {
    throw new TypeError("Rate payload is incomplete or inconsistent.");
  }

  const dates = new Set(quotes.map((quote) => quote.date));
  if (dates.size !== 1) throw new TypeError("Rate payload dates are inconsistent.");

  const rates = Object.fromEntries([
    [base, 1],
    ...quotes.map((quote) => [quote.quote, quote.rate]),
  ]) as Record<CurrencyCode, number>;

  return {
    version: 1,
    base,
    date: quotes[0].date,
    savedAt,
    rates,
  };
}

export function isRateTable(value: unknown): value is RateTable {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RateTable>;
  if (
    candidate.version !== 1
    || !isCurrencyCode(candidate.base)
    || !isValidDate(candidate.date)
    || typeof candidate.savedAt !== "number"
    || !Number.isFinite(candidate.savedAt)
    || !candidate.rates
    || typeof candidate.rates !== "object"
  ) {
    return false;
  }

  return CURRENCY_CODES.every((currency) => {
    const rate = candidate.rates?.[currency];
    return currency === candidate.base ? rate === 1 : isValidRate(rate);
  });
}

export function rateBetween(
  table: RateTable,
  from: CurrencyCode,
  to: CurrencyCode,
): number {
  if (from === to) return 1;
  const fromRate = table.rates[from];
  const toRate = table.rates[to];
  if (!isValidRate(fromRate) || !isValidRate(toRate)) {
    throw new RangeError(`Rate unavailable for ${from}/${to}.`);
  }
  return toRate / fromRate;
}

export function convertMoney(value: Money, to: CurrencyCode, table: RateTable): Money {
  return createMoney(value.amount * rateBetween(table, value.currency, to), to);
}

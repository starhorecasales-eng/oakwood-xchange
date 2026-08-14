export const CURRENCY_CODES = ["TRY", "GBP", "EUR", "USD"] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export type CurrencyDefinition = Readonly<{
  code: CurrencyCode;
  name: string;
  symbol: string;
  flag: string;
  locale: string;
  fractionDigits: number;
}>;

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyDefinition>> = {
  TRY: {
    code: "TRY",
    name: "Türk lirası",
    symbol: "₺",
    flag: "TR",
    locale: "tr-TR",
    fractionDigits: 2,
  },
  GBP: {
    code: "GBP",
    name: "İngiliz sterlini",
    symbol: "£",
    flag: "GB",
    locale: "en-GB",
    fractionDigits: 2,
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    symbol: "€",
    flag: "EU",
    locale: "de-DE",
    fractionDigits: 2,
  },
  USD: {
    code: "USD",
    name: "Amerikan doları",
    symbol: "$",
    flag: "US",
    locale: "en-US",
    fractionDigits: 2,
  },
};

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_CODES.includes(value as CurrencyCode);
}

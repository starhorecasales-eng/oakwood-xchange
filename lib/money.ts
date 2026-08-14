import { CURRENCIES, type CurrencyCode } from "./currency.ts";

export type Money = Readonly<{
  amount: number;
  currency: CurrencyCode;
}>;

export function parseLocalizedAmount(value: string): number | null {
  const compact = value.trim().replace(/\s/g, "");
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);
  const integerPart = decimalIndex >= 0 ? compact.slice(0, decimalIndex) : compact;
  const fractionPart = decimalIndex >= 0 ? compact.slice(decimalIndex + 1) : "";
  const normalizedInteger = integerPart.replace(/[.,]/g, "");
  const normalized = decimalIndex >= 0
    ? `${normalizedInteger || "0"}.${fractionPart}`
    : normalizedInteger;

  if (!/^\d+(?:\.\d*)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function createMoney(amount: number, currency: CurrencyCode): Money {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError("Money amount must be a finite, non-negative number.");
  }
  return { amount, currency };
}

export function roundMoney(value: Money): Money {
  const factor = 10 ** CURRENCIES[value.currency].fractionDigits;
  return createMoney(
    Math.round((value.amount + Number.EPSILON) * factor) / factor,
    value.currency,
  );
}

export function formatMoney(value: Money, locale = "tr-TR"): string {
  const { fractionDigits } = CURRENCIES[value.currency];
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value.amount);
}

export function formatInputAmount(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("tr-TR", {
    useGrouping: false,
    maximumFractionDigits,
  }).format(value);
}

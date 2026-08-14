import { CURRENCIES, type CurrencyCode } from "./currency.ts";

export type Money = Readonly<{
  amount: number;
  currency: CurrencyCode;
}>;

function localeSeparators(locale: string) {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  return {
    decimal: parts.find((part) => part.type === "decimal")?.value ?? ".",
    group: parts.find((part) => part.type === "group")?.value ?? ",",
  };
}

function parseNumericText(value: string, locale: string): number | null {
  const compact = value.trim().replace(/[\s'’]/g, "");
  if (!compact) return null;
  if (!/^[0-9.,]+$/.test(compact)) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const groupingSeparator = decimalSeparator === "," ? "." : ",";
    const decimalIndex = compact.lastIndexOf(decimalSeparator);
    const integerPart = compact.slice(0, decimalIndex).split(groupingSeparator).join("");
    const fractionPart = compact.slice(decimalIndex + 1);
    if (!integerPart || !fractionPart || integerPart.includes(decimalSeparator)) return null;
    normalized = `${integerPart}.${fractionPart}`;
  } else if (lastComma >= 0 || lastDot >= 0) {
    const separator = lastComma >= 0 ? "," : ".";
    const parts = compact.split(separator);
    if (parts.some((part) => !part)) return null;
    const { group } = localeSeparators(locale);
    const looksGrouped = separator === group
      && parts.length > 1
      && parts.slice(1).every((part) => part.length === 3);
    normalized = looksGrouped
      ? parts.join("")
      : parts.length === 2
        ? `${parts[0]}.${parts[1]}`
        : "";
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function parseLocalizedAmount(value: string, locale = "tr-TR"): number | null {
  return parseNumericText(value, locale);
}

export function parseMoneyText(
  value: string,
  { currency, locale = CURRENCIES[currency].locale }: { currency: CurrencyCode; locale?: string },
): Money | null {
  let numericText = value.toUpperCase();
  for (const definition of Object.values(CURRENCIES)) {
    numericText = numericText
      .split(definition.code)
      .join("")
      .split(definition.symbol)
      .join("");
  }
  const amount = parseNumericText(numericText, locale);
  return amount === null ? null : createMoney(amount, currency);
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

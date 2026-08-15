import { isCurrencyCode, type CurrencyCode } from "./currency.ts";

export type ConversionRoute = Readonly<{
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  amountSegment: string;
  canonicalPath: string;
}>;

const CANONICAL_AMOUNT = /^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/;

export function parseConversionRoute(
  fromValue: string,
  toValue: string,
  amountValue: string,
): ConversionRoute | null {
  const from = fromValue.toUpperCase();
  const to = toValue.toUpperCase();
  if (!isCurrencyCode(from) || !isCurrencyCode(to) || from === to) return null;
  if (!CANONICAL_AMOUNT.test(amountValue)) return null;

  const amount = Number(amountValue);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const amountSegment = String(amount);

  return {
    from,
    to,
    amount,
    amountSegment,
    canonicalPath: `/convert/${from.toLowerCase()}/${to.toLowerCase()}/${amountSegment}`,
  };
}

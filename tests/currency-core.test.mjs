import assert from "node:assert/strict";
import test from "node:test";

import { CURRENCIES, isCurrencyCode, swapCurrencyPair } from "../lib/currency.ts";
import { parseConversionRoute } from "../lib/conversion-route.ts";
import { fetchLatestRateTable } from "../lib/frankfurter.ts";
import {
  createMoney,
  formatInputAmount,
  parseLocalizedAmount,
  parseMoneyText,
  roundMoney,
} from "../lib/money.ts";
import { extractPriceCandidates } from "../lib/ocr-price.ts";
import {
  LEGACY_GBP_TRY_CACHE_KEY,
  loadRateTable,
  PREVIOUS_RATE_CACHE_KEY,
  RATE_CACHE_KEY,
  saveRateTable,
} from "../lib/rate-cache.ts";
import {
  convertMoney,
  createRateTable,
  PACKAGED_RATE_TABLE,
  rateFreshness,
  rateBetween,
} from "../lib/rates.ts";

const livePayload = [
  { date: "2026-08-14", base: "GBP", quote: "EUR", rate: 1.1692 },
  { date: "2026-08-14", base: "GBP", quote: "TRY", rate: 64.564 },
  { date: "2026-08-14", base: "GBP", quote: "USD", rate: 1.3504 },
];

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test("defines the four planned currencies in one registry", () => {
  assert.deepEqual(Object.keys(CURRENCIES), ["TRY", "GBP", "EUR", "USD"]);
  assert.equal(CURRENCIES.TRY.symbol, "₺");
  assert.equal(CURRENCIES.GBP.symbol, "£");
  assert.equal(CURRENCIES.EUR.symbol, "€");
  assert.equal(CURRENCIES.USD.symbol, "$");
  assert.equal(isCurrencyCode("EUR"), true);
  assert.equal(isCurrencyCode("BTC"), false);
});

test("swaps a currency pair without changing either currency", () => {
  assert.deepEqual(swapCurrencyPair(["TRY", "GBP"]), ["GBP", "TRY"]);
  assert.deepEqual(swapCurrencyPair(["GBP", "TRY"]), ["TRY", "GBP"]);
});

test("normalizes valid conversion URLs and rejects crawl-trap variants", () => {
  assert.deepEqual(parseConversionRoute("TRY", "gbp", "1988.50"), {
    from: "TRY",
    to: "GBP",
    amount: 1988.5,
    amountSegment: "1988.5",
    canonicalPath: "/convert/try/gbp/1988.5",
  });
  assert.equal(parseConversionRoute("try", "try", "10"), null);
  assert.equal(parseConversionRoute("try", "btc", "10"), null);
  assert.equal(parseConversionRoute("try", "gbp", "01"), null);
  assert.equal(parseConversionRoute("try", "gbp", "1,000"), null);
  assert.equal(parseConversionRoute("try", "gbp", "1.234"), null);
  assert.equal(parseConversionRoute("try", "gbp", "0"), null);
});

test("parses localized amounts and rounds at currency precision", () => {
  assert.equal(parseLocalizedAmount("1.234,56"), 1234.56);
  assert.equal(parseLocalizedAmount("1,234.56"), 1234.56);
  assert.equal(parseLocalizedAmount(" 15,5 "), 15.5);
  assert.equal(parseLocalizedAmount(""), null);
  assert.equal(parseLocalizedAmount("-1"), null);
  assert.deepEqual(roundMoney(createMoney(12.345, "GBP")), {
    amount: 12.35,
    currency: "GBP",
  });
  assert.equal(formatInputAmount(15.488507527105507), "15,49");
});

test("parses OCR-style prices using the selected currency locale", () => {
  assert.equal(parseMoneyText("₺1.299", { currency: "TRY" })?.amount, 1299);
  assert.equal(parseMoneyText("1.299 ₺", { currency: "TRY" })?.amount, 1299);
  assert.equal(parseMoneyText("1.299,90 TRY", { currency: "TRY" })?.amount, 1299.9);
  assert.equal(parseMoneyText("£1,299.99", { currency: "GBP" })?.amount, 1299.99);
  assert.equal(parseMoneyText("1 299,90 €", { currency: "EUR" })?.amount, 1299.9);
  assert.equal(parseMoneyText("1'299.90 USD", { currency: "USD" })?.amount, 1299.9);
  assert.equal(parseMoneyText("1.299", { currency: "GBP" })?.amount, 1.299);
  assert.equal(parseMoneyText("free", { currency: "GBP" }), null);
  assert.equal(parseMoneyText("-£10", { currency: "GBP" }), null);
});

test("extracts deduplicated price candidates from noisy OCR text", () => {
  const tryCandidates = extractPriceCandidates(
    "ÜRÜN 84721  ₺1.299,90  eski 1.499,90 TL  ₺1.299,90",
    "TRY",
  );
  assert.deepEqual(
    tryCandidates.map((candidate) => candidate.money.amount),
    [84721, 1299.9, 1499.9],
  );

  const gbpCandidates = extractPriceCandidates("SALE £1,299.99 / now £899.50", "GBP");
  assert.deepEqual(
    gbpCandidates.map((candidate) => candidate.money.amount),
    [1299.99, 899.5],
  );
});

test("builds one rate table and derives reverse and cross rates", () => {
  const table = createRateTable(livePayload, "GBP", 1234);
  assert.equal(table.savedAt, 1234);
  assert.deepEqual(table.source, { id: "frankfurter", kind: "reference" });
  assert.equal(rateBetween(table, "GBP", "TRY"), 64.564);
  assert.ok(Math.abs(rateBetween(table, "TRY", "GBP") - 1 / 64.564) < 1e-12);
  assert.ok(Math.abs(rateBetween(table, "USD", "TRY") - 64.564 / 1.3504) < 1e-12);
  assert.ok(
    Math.abs(
      convertMoney(createMoney(1000, "TRY"), "GBP", table).amount
        - 1000 / 64.564,
    ) < 1e-12,
  );
  assert.throws(
    () => createRateTable(livePayload.slice(0, 2), "GBP"),
    /incomplete or inconsistent/,
  );
});

test("classifies rate age without blocking offline conversion", () => {
  assert.deepEqual(rateFreshness(PACKAGED_RATE_TABLE, new Date("2026-08-17T23:00:00Z")), {
    ageDays: 3,
    state: "fresh",
  });
  assert.deepEqual(rateFreshness(PACKAGED_RATE_TABLE, new Date("2026-08-18T01:00:00Z")), {
    ageDays: 4,
    state: "stale",
  });
  assert.deepEqual(rateFreshness(PACKAGED_RATE_TABLE, new Date("2026-08-22T12:00:00Z")), {
    ageDays: 8,
    state: "old",
  });
  assert.ok(convertMoney(createMoney(1000, "TRY"), "GBP", PACKAGED_RATE_TABLE).amount > 0);
});

test("caches validated tables and migrates the previous GBP/TRY cache", () => {
  const currentStorage = memoryStorage();
  saveRateTable(currentStorage, PACKAGED_RATE_TABLE);
  assert.deepEqual(loadRateTable(currentStorage), PACKAGED_RATE_TABLE);
  assert.ok(currentStorage.getItem(RATE_CACHE_KEY));

  const previousTable = {
    version: 1,
    base: "GBP",
    date: "2026-08-14",
    savedAt: 123,
    rates: { ...PACKAGED_RATE_TABLE.rates },
  };
  const previousStorage = memoryStorage({
    [PREVIOUS_RATE_CACHE_KEY]: JSON.stringify(previousTable),
  });
  const previousMigrated = loadRateTable(previousStorage);
  assert.equal(previousMigrated?.version, 2);
  assert.equal(previousMigrated?.source.id, "frankfurter");

  const legacyStorage = memoryStorage({
    [LEGACY_GBP_TRY_CACHE_KEY]: JSON.stringify({
      rate: 64.5,
      date: "2026-08-13",
      savedAt: 99,
    }),
  });
  const migrated = loadRateTable(legacyStorage);
  assert.equal(migrated?.rates.TRY, 64.5);
  assert.equal(migrated?.rates.EUR, PACKAGED_RATE_TABLE.rates.EUR);
  assert.equal(migrated?.date, "2026-08-13");
});

test("Frankfurter provider requests every planned quote and validates the response", async () => {
  let requestedUrl = "";
  const fakeFetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify(livePayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  const table = await fetchLatestRateTable(
    new AbortController().signal,
    "GBP",
    fakeFetch,
  );

  assert.match(requestedUrl, /^https:\/\/api\.frankfurter\.dev\/v2\/rates\?/);
  const query = new URL(requestedUrl).searchParams;
  assert.equal(query.get("base"), "GBP");
  assert.equal(query.get("quotes"), "TRY,EUR,USD");
  assert.equal(table.rates.USD, 1.3504);
});

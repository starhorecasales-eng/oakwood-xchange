import assert from "node:assert/strict";
import test from "node:test";

import { CURRENCIES, isCurrencyCode } from "../lib/currency.ts";
import { fetchLatestRateTable } from "../lib/frankfurter.ts";
import {
  createMoney,
  formatInputAmount,
  parseLocalizedAmount,
  roundMoney,
} from "../lib/money.ts";
import {
  LEGACY_GBP_TRY_CACHE_KEY,
  loadRateTable,
  RATE_CACHE_KEY,
  saveRateTable,
} from "../lib/rate-cache.ts";
import {
  convertMoney,
  createRateTable,
  PACKAGED_RATE_TABLE,
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

test("builds one rate table and derives reverse and cross rates", () => {
  const table = createRateTable(livePayload, "GBP", 1234);
  assert.equal(table.savedAt, 1234);
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

test("caches validated tables and migrates the previous GBP/TRY cache", () => {
  const currentStorage = memoryStorage();
  saveRateTable(currentStorage, PACKAGED_RATE_TABLE);
  assert.deepEqual(loadRateTable(currentStorage), PACKAGED_RATE_TABLE);
  assert.ok(currentStorage.getItem(RATE_CACHE_KEY));

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

import { isRateTable, PACKAGED_RATE_TABLE, type RateTable } from "./rates.ts";

export const RATE_CACHE_KEY = "cebimde-kur-rates-v2";
export const LEGACY_GBP_TRY_CACHE_KEY = "cebimde-kur-gbp-try";

type StorageReader = Pick<Storage, "getItem">;
type StorageWriter = Pick<Storage, "setItem">;

type LegacyStoredRate = {
  rate?: unknown;
  date?: unknown;
  savedAt?: unknown;
};

function readJson(storage: StorageReader, key: string): unknown {
  const stored = storage.getItem(key);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
}

function migrateLegacyRate(value: unknown): RateTable | null {
  if (!value || typeof value !== "object") return null;
  const legacy = value as LegacyStoredRate;
  const rate = Number(legacy.rate);
  const date = typeof legacy.date === "string" ? legacy.date : "";
  const savedAt = Number(legacy.savedAt);
  const candidate: RateTable = {
    ...PACKAGED_RATE_TABLE,
    date,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.parse(`${date}T12:00:00Z`),
    rates: {
      ...PACKAGED_RATE_TABLE.rates,
      TRY: rate,
    },
  };
  return isRateTable(candidate) ? candidate : null;
}

export function loadRateTable(storage: StorageReader): RateTable | null {
  const current = readJson(storage, RATE_CACHE_KEY);
  if (isRateTable(current)) return current;
  return migrateLegacyRate(readJson(storage, LEGACY_GBP_TRY_CACHE_KEY));
}

export function saveRateTable(storage: StorageWriter, table: RateTable): void {
  if (!isRateTable(table)) throw new TypeError("Cannot cache an invalid rate table.");
  storage.setItem(RATE_CACHE_KEY, JSON.stringify(table));
}

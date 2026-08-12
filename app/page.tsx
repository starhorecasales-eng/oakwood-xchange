"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type StoredRate = {
  rate: number;
  date: string;
};

const STORAGE_KEY = "cebimde-kur-gbp-try";
const RATE_URL = "https://api.frankfurter.dev/v2/rates?base=GBP&quotes=TRY";

function parseAmount(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized || normalized === ".") return null;
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function inputAmount(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("tr-TR", {
    useGrouping: false,
    maximumFractionDigits,
  }).format(value);
}

function displayAmount(value: number, currency: "TRY" | "GBP") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function readableDate(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function Home() {
  const [rate, setRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState("");
  const [tryValue, setTryValue] = useState("1000");
  const [gbpValue, setGbpValue] = useState("");
  const [activeCurrency, setActiveCurrency] = useState<"TRY" | "GBP">("TRY");
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">(
    "loading",
  );

  const convertFromTry = useCallback((value: string, currentRate: number) => {
    const amount = parseAmount(value);
    setGbpValue(amount === null ? "" : inputAmount(amount / currentRate));
  }, []);

  const convertFromGbp = useCallback((value: string, currentRate: number) => {
    const amount = parseAmount(value);
    setTryValue(amount === null ? "" : inputAmount(amount * currentRate));
  }, []);

  const refreshRate = useCallback(async () => {
    setStatus("loading");
    try {
      const response = await fetch(RATE_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("Kur alınamadı");

      const payload = (await response.json()) as Array<{
        date: string;
        base: string;
        quote: string;
        rate: number;
      }>;
      const latest = payload.find((item) => item.base === "GBP" && item.quote === "TRY");
      if (!latest || !Number.isFinite(latest.rate)) throw new Error("Geçersiz kur");

      setRate(latest.rate);
      setRateDate(latest.date);
      setStatus("live");
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ rate: latest.rate, date: latest.date } satisfies StoredRate),
      );

      if (activeCurrency === "TRY") convertFromTry(tryValue, latest.rate);
      else convertFromGbp(gbpValue, latest.rate);
    } catch {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const cached = JSON.parse(stored) as StoredRate;
          if (Number.isFinite(cached.rate) && cached.rate > 0) {
            setRate(cached.rate);
            setRateDate(cached.date);
            setStatus("cached");
            if (activeCurrency === "TRY") convertFromTry(tryValue, cached.rate);
            else convertFromGbp(gbpValue, cached.rate);
            return;
          }
        } catch {
          // Bozuk yerel veriyi sessizce yok say.
        }
      }
      setStatus("error");
    }
  }, [activeCurrency, convertFromGbp, convertFromTry, gbpValue, tryValue]);

  useEffect(() => {
    void refreshRate();
    // İlk açılışta bir kez güncelle; sonraki değişimler alan işleyicilerinde çevrilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  const handleTry = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveCurrency("TRY");
    setTryValue(cleaned);
    if (rate) convertFromTry(cleaned, rate);
  };

  const handleGbp = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveCurrency("GBP");
    setGbpValue(cleaned);
    if (rate) convertFromGbp(cleaned, rate);
  };

  const switchDirection = () => {
    setActiveCurrency((current) => (current === "TRY" ? "GBP" : "TRY"));
    const next = activeCurrency === "TRY" ? "GBP" : "TRY";
    requestAnimationFrame(() => {
      document.getElementById(next === "TRY" ? "try-input" : "gbp-input")?.focus();
    });
  };

  const summary = useMemo(() => {
    if (!rate) return "Kur bağlantısı bekleniyor";
    return `1 GBP = ${new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate)} TL`;
  }, [rate]);

  const tryNumber = parseAmount(tryValue);
  const gbpNumber = parseAmount(gbpValue);

  return (
    <main>
      <section className="converter-shell" aria-label="Türk lirası ve İngiliz sterlini dönüştürücü">
        <header className="site-header">
          <div className="brand-mark" aria-hidden="true">₺£</div>
          <div>
            <p className="eyebrow">CEBİMDE KUR</p>
            <h1>TL ↔ Sterlin</h1>
          </div>
          <button
            className={`status-pill ${status}`}
            type="button"
            onClick={() => void refreshRate()}
            aria-label="Kuru yenile"
          >
            <span aria-hidden="true" />
            {status === "loading"
              ? "Güncelleniyor"
              : status === "live"
                ? "Güncel"
                : status === "cached"
                  ? "Son kur"
                  : "Yenile"}
          </button>
        </header>

        <div className="intro-copy">
          <p>Türkiye’de hızlı fiyat hesabı</p>
          <span>Bir kutuya yaz, diğerini anında gör.</span>
        </div>

        <div className="converter-card">
          <label className={`currency-block lira ${activeCurrency === "TRY" ? "active" : ""}`}>
            <span className="currency-heading">
              <span className="flag" aria-hidden="true">TR</span>
              <span>
                <strong>Türk lirası</strong>
                <small>TRY</small>
              </span>
            </span>
            <span className="amount-row">
              <input
                id="try-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={tryValue}
                onFocus={() => setActiveCurrency("TRY")}
                onChange={(event) => handleTry(event.target.value)}
                aria-label="Türk lirası tutarı"
              />
              <b>₺</b>
            </span>
            <span className="amount-preview">
              {tryNumber === null ? "Tutar girin" : displayAmount(tryNumber, "TRY")}
            </span>
          </label>

          <div className="swap-row" aria-hidden="true"><span /></div>
          <button className="swap-button" type="button" onClick={switchDirection} aria-label="Giriş yönünü değiştir">
            <span>⇅</span>
          </button>

          <label className={`currency-block pound ${activeCurrency === "GBP" ? "active" : ""}`}>
            <span className="currency-heading">
              <span className="flag" aria-hidden="true">GB</span>
              <span>
                <strong>İngiliz sterlini</strong>
                <small>GBP</small>
              </span>
            </span>
            <span className="amount-row">
              <input
                id="gbp-input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={gbpValue}
                onFocus={() => setActiveCurrency("GBP")}
                onChange={(event) => handleGbp(event.target.value)}
                aria-label="İngiliz sterlini tutarı"
              />
              <b>£</b>
            </span>
            <span className="amount-preview">
              {gbpNumber === null ? "Tutar girin" : displayAmount(gbpNumber, "GBP")}
            </span>
          </label>
        </div>

        <footer>
          <div className="rate-line">
            <div>
              <small>GÖSTERGE KURU</small>
              <strong>{summary}</strong>
            </div>
            <button type="button" onClick={() => void refreshRate()} aria-label="Kuru tekrar yenile">↻</button>
          </div>
          {rateDate && <p>Son kur tarihi: {readableDate(rateDate)}</p>}
          {status === "error" && <p className="error-message">İnternet bağlantısını kontrol edip tekrar deneyin.</p>}
          <p className="disclaimer">Banka, kart ve döviz bürosu kurları farklı olabilir.</p>
        </footer>
      </section>
    </main>
  );
}

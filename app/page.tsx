"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StoredRate = {
  rate: number;
  date: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const STORAGE_KEY = "cebimde-kur-gbp-try";
const INSTALL_DISMISSED_KEY = "cebimde-kur-install-dismissed";
const RATE_URL = "https://api.frankfurter.dev/v2/rates?base=GBP&quotes=TRY";
const PACKAGED_RATE: StoredRate = {
  rate: 64.491,
  date: "2026-08-12",
};

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
  const [rate, setRate] = useState<number>(PACKAGED_RATE.rate);
  const [rateDate, setRateDate] = useState(PACKAGED_RATE.date);
  const [tryValue, setTryValue] = useState("1000");
  const [gbpValue, setGbpValue] = useState(
    inputAmount(1000 / PACKAGED_RATE.rate),
  );
  const [activeCurrency, setActiveCurrency] = useState<"TRY" | "GBP">("TRY");
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">(
    "cached",
  );
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [installMode, setInstallMode] = useState<"hidden" | "native" | "ios">(
    "hidden",
  );
  const [showIosSteps, setShowIosSteps] = useState(false);

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
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(RATE_URL, {
        cache: "no-store",
        signal: controller.signal,
      });
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
      setRate(PACKAGED_RATE.rate);
      setRateDate(PACKAGED_RATE.date);
      setStatus("cached");
      if (activeCurrency === "TRY") convertFromTry(tryValue, PACKAGED_RATE.rate);
      else convertFromGbp(gbpValue, PACKAGED_RATE.rate);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [activeCurrency, convertFromGbp, convertFromTry, gbpValue, tryValue]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const cached = JSON.parse(stored) as StoredRate;
        if (Number.isFinite(cached.rate) && cached.rate > 0) {
          setRate(cached.rate);
          setRateDate(cached.date);
          setStatus("cached");
          convertFromTry(tryValue, cached.rate);
        }
      } catch {
        // Paket içindeki son bilinen kur zaten kullanıma hazır.
      }
    }
    void refreshRate();
    // İlk açılışta bir kez güncelle; sonraki değişimler alan işleyicilerinde çevrilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone || localStorage.getItem(INSTALL_DISMISSED_KEY) === "yes") return;

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIos) setInstallMode("ios");

    const handleInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPrompt.current = event as BeforeInstallPromptEvent;
      setInstallMode("native");
    };
    const handleInstalled = () => {
      installPrompt.current = null;
      setInstallMode("hidden");
    };

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (installMode === "ios") {
      setShowIosSteps(true);
      return;
    }
    if (!installPrompt.current) return;
    await installPrompt.current.prompt();
    await installPrompt.current.userChoice;
    installPrompt.current = null;
    setInstallMode("hidden");
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "yes");
    setInstallMode("hidden");
  };

  const handleTry = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveCurrency("TRY");
    setTryValue(cleaned);
    convertFromTry(cleaned, rate);
  };

  const handleGbp = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveCurrency("GBP");
    setGbpValue(cleaned);
    convertFromGbp(cleaned, rate);
  };

  const switchDirection = () => {
    setActiveCurrency((current) => (current === "TRY" ? "GBP" : "TRY"));
    const next = activeCurrency === "TRY" ? "GBP" : "TRY";
    requestAnimationFrame(() => {
      document.getElementById(next === "TRY" ? "try-input" : "gbp-input")?.focus();
    });
  };

  const summary = useMemo(() => {
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

        {installMode !== "hidden" && (
          <aside className="install-card" aria-label="Uygulamayı telefona ekle">
            <button
              className="install-close"
              type="button"
              onClick={dismissInstall}
              aria-label="Uygulama önerisini kapat"
            >
              ×
            </button>
            <span className="install-icon" aria-hidden="true">₺£</span>
            <div className="install-copy">
              <strong>Cebinde hep hazır olsun</strong>
              <span>
                {installMode === "ios"
                  ? "Ana ekranına ekle, uygulama gibi tek dokunuşla aç."
                  : "Ücretsiz yükle, uygulama gibi tek dokunuşla aç."}
              </span>
              {showIosSteps && (
                <small>Safari’de Paylaş simgesine, ardından “Ana Ekrana Ekle”ye dokun.</small>
              )}
            </div>
            <button className="install-button" type="button" onClick={() => void installApp()}>
              {installMode === "ios" ? "Nasıl?" : "Yükle"}
            </button>
          </aside>
        )}
      </section>
    </main>
  );
}

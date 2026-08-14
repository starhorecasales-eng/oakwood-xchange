"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLatestRateTable } from "@/lib/frankfurter";
import {
  createMoney,
  formatInputAmount,
  formatMoney,
  parseLocalizedAmount,
} from "@/lib/money";
import { loadRateTable, saveRateTable } from "@/lib/rate-cache";
import {
  convertMoney,
  PACKAGED_RATE_TABLE,
  rateFreshness,
  rateBetween,
  type RateTable,
} from "@/lib/rates";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const INSTALL_DISMISSED_KEY = "cebimde-kur-install-dismissed";
const REFRESH_COOLDOWN_MS = 30_000;

function readableDate(date: string) {
  if (!date) return "";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

export default function Home() {
  const [rateTable, setRateTable] = useState<RateTable>(PACKAGED_RATE_TABLE);
  const [tryValue, setTryValue] = useState("1000");
  const [gbpValue, setGbpValue] = useState(
    formatInputAmount(
      convertMoney(createMoney(1000, "TRY"), "GBP", PACKAGED_RATE_TABLE).amount,
    ),
  );
  const [activeCurrency, setActiveCurrency] = useState<"TRY" | "GBP">("TRY");
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">(
    "cached",
  );
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const lastRefreshAttempt = useRef(0);
  const [installMode, setInstallMode] = useState<"hidden" | "native" | "ios">(
    "hidden",
  );
  const [showIosSteps, setShowIosSteps] = useState(false);

  const convertFromTry = useCallback((value: string, currentRates: RateTable) => {
    const amount = parseLocalizedAmount(value);
    setGbpValue(
      amount === null
        ? ""
        : formatInputAmount(
          convertMoney(createMoney(amount, "TRY"), "GBP", currentRates).amount,
        ),
    );
  }, []);

  const convertFromGbp = useCallback((value: string, currentRates: RateTable) => {
    const amount = parseLocalizedAmount(value);
    setTryValue(
      amount === null
        ? ""
        : formatInputAmount(
          convertMoney(createMoney(amount, "GBP"), "TRY", currentRates).amount,
        ),
    );
  }, []);

  const refreshRate = useCallback(async () => {
    const now = Date.now();
    if (now - lastRefreshAttempt.current < REFRESH_COOLDOWN_MS) return;
    lastRefreshAttempt.current = now;
    setStatus("loading");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    try {
      const latest = await fetchLatestRateTable(controller.signal);
      setRateTable(latest);
      setStatus("live");
      saveRateTable(localStorage, latest);

      if (activeCurrency === "TRY") convertFromTry(tryValue, latest);
      else convertFromGbp(gbpValue, latest);
    } catch {
      const cached = loadRateTable(localStorage);
      if (cached) {
        setRateTable(cached);
        setStatus("cached");
        if (activeCurrency === "TRY") convertFromTry(tryValue, cached);
        else convertFromGbp(gbpValue, cached);
        return;
      }
      setRateTable(PACKAGED_RATE_TABLE);
      setStatus("cached");
      if (activeCurrency === "TRY") convertFromTry(tryValue, PACKAGED_RATE_TABLE);
      else convertFromGbp(gbpValue, PACKAGED_RATE_TABLE);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [activeCurrency, convertFromGbp, convertFromTry, gbpValue, tryValue]);

  useEffect(() => {
    const refreshFrame = window.requestAnimationFrame(() => void refreshRate());
    return () => window.cancelAnimationFrame(refreshFrame);
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
    const iosFrame = isIos
      ? window.requestAnimationFrame(() => setInstallMode("ios"))
      : null;

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
      if (iosFrame !== null) window.cancelAnimationFrame(iosFrame);
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
    convertFromTry(cleaned, rateTable);
  };

  const handleGbp = (value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveCurrency("GBP");
    setGbpValue(cleaned);
    convertFromGbp(cleaned, rateTable);
  };

  const switchDirection = () => {
    setActiveCurrency((current) => (current === "TRY" ? "GBP" : "TRY"));
    const next = activeCurrency === "TRY" ? "GBP" : "TRY";
    requestAnimationFrame(() => {
      document.getElementById(next === "TRY" ? "try-input" : "gbp-input")?.focus();
    });
  };

  const summary = useMemo(() => {
    const rate = rateBetween(rateTable, "GBP", "TRY");
    return `1 GBP = ${new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate)} TL`;
  }, [rateTable]);
  const freshness = useMemo(() => rateFreshness(rateTable), [rateTable]);
  const displayedStatus = status === "loading" ? "loading" : freshness.state;

  const tryNumber = parseLocalizedAmount(tryValue);
  const gbpNumber = parseLocalizedAmount(gbpValue);

  return (
    <main>
      <section className="converter-shell" aria-label="Türk lirası ve İngiliz sterlini dönüştürücü">
        <header className="site-header">
          <Image
            className="brand-lockup"
            src="/brand/logo-primary-no-tagline.svg"
            alt="Cebimde Kur"
            width={1500}
            height={500}
            priority
            unoptimized
          />
          <button
            className={`status-pill ${displayedStatus}`}
            type="button"
            onClick={() => void refreshRate()}
            aria-label="Kuru yenile"
          >
            <span aria-hidden="true" />
            {status === "loading"
              ? "Güncelleniyor"
              : freshness.state === "old"
                ? "Eski kur"
                : freshness.state === "stale"
                  ? `${freshness.ageDays} günlük kur`
                  : status === "live"
                    ? "Güncel"
                    : "Son kur"}
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
              {tryNumber === null
                ? "Tutar girin"
                : formatMoney(createMoney(tryNumber, "TRY"))}
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
              {gbpNumber === null
                ? "Tutar girin"
                : formatMoney(createMoney(gbpNumber, "GBP"))}
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
          {rateTable.date && <p>Son kur tarihi: {readableDate(rateTable.date)}</p>}
          {freshness.state === "old" ? (
            <p className="old-rate-message">Eski kur kullanılıyor; sonuç yaklaşık değerdir. İnternet geldiğinde yenilenecek.</p>
          ) : freshness.state === "stale" ? (
            <p className="cached-message">{freshness.ageDays} günlük kur kullanılıyor; sonuç yaklaşık değerdir.</p>
          ) : status === "cached" && (
            <p className="cached-message">Canlı bağlantı yoksa son kurla hesaplama kesintisiz devam eder.</p>
          )}
          {status === "error" && <p className="error-message">İnternet bağlantısını kontrol edip tekrar deneyin.</p>}
          <p className="disclaimer">Banka, kart ve döviz bürosu kurları farklı olabilir.</p>
          <div className="site-credit">
            <span>Hesapladığınız tutarlar kaydedilmez.</span>
            <span>Oakwood Apps tarafından hazırlandı.</span>
          </div>
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

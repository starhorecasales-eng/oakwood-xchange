"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CameraScanner from "@/app/camera/CameraScanner";
import { CURRENCIES, swapCurrencyPair } from "@/lib/currency";
import { fetchLatestRateTable } from "@/lib/frankfurter";
import {
  createMoney,
  formatInputAmount,
  parseLocalizedAmount,
} from "@/lib/money";
import { loadRateTable, saveRateTable } from "@/lib/rate-cache";
import { PRODUCT_COPY, PRODUCT_IDENTITY } from "@/lib/product";
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

const CONVERTER_CURRENCIES = ["TRY", "GBP", "EUR"] as const;
type ConverterCurrency = (typeof CONVERTER_CURRENCIES)[number];
type ConverterOrder = readonly [ConverterCurrency, ConverterCurrency];
type ConverterSlot = "top" | "bottom";

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

function convertedInput(
  value: string,
  from: ConverterCurrency,
  to: ConverterCurrency,
  rates: RateTable,
) {
  const amount = parseLocalizedAmount(value);
  return amount === null
    ? ""
    : formatInputAmount(convertMoney(createMoney(amount, from), to, rates).amount);
}

export default function Home() {
  const [rateTable, setRateTable] = useState<RateTable>(PACKAGED_RATE_TABLE);
  const [topValue, setTopValue] = useState("1000");
  const [bottomValue, setBottomValue] = useState(
    convertedInput("1000", "TRY", "GBP", PACKAGED_RATE_TABLE),
  );
  const [activeSlot, setActiveSlot] = useState<ConverterSlot>("top");
  const [currencyOrder, setCurrencyOrder] = useState<ConverterOrder>(["TRY", "GBP"]);
  const [swapAnnouncement, setSwapAnnouncement] = useState("");
  const [status, setStatus] = useState<"loading" | "live" | "cached" | "error">(
    "cached",
  );
  const installPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const lastRefreshAttempt = useRef(0);
  const [installMode, setInstallMode] = useState<"hidden" | "native" | "ios">(
    "hidden",
  );
  const [showIosSteps, setShowIosSteps] = useState(false);

  const recalculate = useCallback((currentRates: RateTable, pair: ConverterOrder) => {
    if (activeSlot === "top") {
      setBottomValue(convertedInput(topValue, pair[0], pair[1], currentRates));
    } else {
      setTopValue(convertedInput(bottomValue, pair[1], pair[0], currentRates));
    }
  }, [activeSlot, bottomValue, topValue]);

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
      recalculate(latest, currencyOrder);
    } catch {
      const fallback = loadRateTable(localStorage) ?? PACKAGED_RATE_TABLE;
      setRateTable(fallback);
      setStatus("cached");
      recalculate(fallback, currencyOrder);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [currencyOrder, recalculate]);

  useEffect(() => {
    const refreshFrame = window.requestAnimationFrame(() => void refreshRate());
    return () => window.cancelAnimationFrame(refreshFrame);
    // İlk açılışta bir kez güncelle; sonraki değişimler alan işleyicilerinde çevrilir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
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

  const handleAmount = (slot: ConverterSlot, value: string) => {
    const cleaned = value.replace(/[^0-9.,]/g, "");
    setActiveSlot(slot);
    if (slot === "top") {
      setTopValue(cleaned);
      setBottomValue(convertedInput(cleaned, currencyOrder[0], currencyOrder[1], rateTable));
    } else {
      setBottomValue(cleaned);
      setTopValue(convertedInput(cleaned, currencyOrder[1], currencyOrder[0], rateTable));
    }
  };

  const switchDirection = () => {
    const nextOrder = swapCurrencyPair(currencyOrder);
    const nextActiveSlot: ConverterSlot = activeSlot === "top" ? "bottom" : "top";
    setCurrencyOrder(nextOrder);
    setTopValue(bottomValue);
    setBottomValue(topValue);
    setActiveSlot(nextActiveSlot);
    setSwapAnnouncement(
      `${CURRENCIES[nextOrder[0]].name} üst alana, ${CURRENCIES[nextOrder[1]].name} alt alana taşındı.`,
    );
    window.requestAnimationFrame(() => {
      document.getElementById(`${nextActiveSlot}-amount-input`)?.focus();
    });
  };

  const changeCurrency = (slot: ConverterSlot, currency: ConverterCurrency) => {
    const slotIndex = slot === "top" ? 0 : 1;
    const otherIndex = slotIndex === 0 ? 1 : 0;
    if (currency === currencyOrder[slotIndex]) return;
    if (currency === currencyOrder[otherIndex]) {
      switchDirection();
      return;
    }

    const nextOrder = [...currencyOrder] as [ConverterCurrency, ConverterCurrency];
    nextOrder[slotIndex] = currency;
    setCurrencyOrder(nextOrder);
    if (activeSlot === "top") {
      setBottomValue(convertedInput(topValue, nextOrder[0], nextOrder[1], rateTable));
    } else {
      setTopValue(convertedInput(bottomValue, nextOrder[1], nextOrder[0], rateTable));
    }
  };

  const summary = useMemo(() => {
    const rate = rateBetween(rateTable, currencyOrder[0], currencyOrder[1]);
    return `1 ${currencyOrder[0]} = ${new Intl.NumberFormat("tr-TR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(rate)} ${currencyOrder[1]}`;
  }, [currencyOrder, rateTable]);
  const freshness = useMemo(() => rateFreshness(rateTable), [rateTable]);
  const displayedStatus = status === "loading" ? "loading" : freshness.state;

  const renderCurrencyBlock = (currency: ConverterCurrency, slot: ConverterSlot) => {
    const definition = CURRENCIES[currency];
    const value = slot === "top" ? topValue : bottomValue;
    return (
      <label
        key={`${slot}-${currency}`}
        className={`currency-block ${currency.toLowerCase()} ${activeSlot === slot ? "active" : ""}`}
        data-currency={currency}
      >
        <span className="currency-heading">
          <span className="flag" aria-hidden="true">{definition.flag}</span>
          <span className="currency-select-wrap">
            <select
              value={currency}
              onChange={(event) => changeCurrency(slot, event.target.value as ConverterCurrency)}
              aria-label={`${slot === "top" ? "Üst" : "Alt"} para birimi`}
            >
              {CONVERTER_CURRENCIES.map((option) => (
                <option key={option} value={option}>{CURRENCIES[option].name} · {option}</option>
              ))}
            </select>
          </span>
        </span>
        <span className="amount-row">
          <input
            id={`${slot}-amount-input`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onFocus={() => setActiveSlot(slot)}
            onChange={(event) => handleAmount(slot, event.target.value)}
            aria-label={`${definition.name} tutarı`}
          />
          <b>{definition.symbol}</b>
        </span>
      </label>
    );
  };

  return (
    <main>
      <section className="converter-shell" aria-label="TRY, GBP ve EUR dönüştürücü">
        <header className="site-header">
          <Image
            className="brand-lockup"
            src="/brand/logo-primary-no-tagline.svg"
            alt={PRODUCT_IDENTITY.publicName}
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
                  : status === "live" ? "Güncel" : "Son kur"}
          </button>
        </header>

        <div className="intro-copy">
          <p>Hızlı çevir</p>
        </div>

        <div className="converter-card">
          {renderCurrencyBlock(currencyOrder[0], "top")}
          <div className="swap-row" aria-hidden="true"><span /></div>
          <button
            className="swap-button"
            type="button"
            onClick={switchDirection}
            aria-label="Üst ve alt para birimlerinin yerini değiştir"
          >
            <span>⇅</span>
          </button>
          {renderCurrencyBlock(currencyOrder[1], "bottom")}
          <p className="sr-only" aria-live="polite">{swapAnnouncement}</p>
        </div>

        <section className="camera-panel" aria-labelledby="camera-panel-title">
          <div className="camera-panel-heading">
            <div>
              <strong id="camera-panel-title">Kamerayla çevir</strong>
            </div>
            <span>Deneysel</span>
          </div>
          <CameraScanner compact rateTable={rateTable} />
        </section>

        <footer>
          <div className="rate-line">
            <div>
              <small>GÖSTERGE KURU</small>
              <strong>{summary}</strong>
              {rateTable.date && <span>· {readableDate(rateTable.date)}</span>}
            </div>
            <button type="button" onClick={() => void refreshRate()} aria-label="Kuru tekrar yenile">↻</button>
          </div>
          {freshness.state === "old" ? (
            <p className="old-rate-message">Eski kur kullanılıyor; sonuç yaklaşık değerdir.</p>
          ) : freshness.state === "stale" ? (
            <p className="cached-message">{freshness.ageDays} günlük kur kullanılıyor; sonuç yaklaşık değerdir.</p>
          ) : status === "cached" && (
            <p className="cached-message">Canlı bağlantı yoksa son kurla hesaplama devam eder.</p>
          )}
          <div className="site-credit">
            <span>{PRODUCT_COPY.ownerCredit}</span>
          </div>
        </footer>

        {installMode !== "hidden" && (
          <aside className="install-card" aria-label="Uygulamayı telefona ekle">
            <button className="install-close" type="button" onClick={dismissInstall} aria-label="Uygulama önerisini kapat">×</button>
            <span className="install-icon" aria-hidden="true">₺£€</span>
            <div className="install-copy">
              <strong>Cebinde hep hazır olsun</strong>
              <span>{installMode === "ios" ? "Ana ekranına ekle, tek dokunuşla aç." : "Ücretsiz yükle, tek dokunuşla aç."}</span>
              {showIosSteps && <small>Safari’de Paylaş simgesine, ardından “Ana Ekrana Ekle”ye dokun.</small>}
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

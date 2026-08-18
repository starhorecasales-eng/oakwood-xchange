"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchLatestRateTable } from "@/lib/frankfurter";
import { createMoney, formatMoney } from "@/lib/money";
import { extractPriceCandidates, type PriceCandidate } from "@/lib/ocr-price";
import { loadRateTable, saveRateTable } from "@/lib/rate-cache";
import { convertMoney, PACKAGED_RATE_TABLE, type RateTable } from "@/lib/rates";
import styles from "./CameraScanner.module.css";

type ScannerCurrency = "TRY" | "GBP";
type ScannerState = "idle" | "requesting" | "ready" | "recognizing" | "result" | "error";

type OcrWorker = {
  recognize(image: Blob): Promise<{ data: { text: string } }>;
  setParameters(parameters: Record<string, string>): Promise<unknown>;
  terminate(): Promise<unknown>;
};

const OCR_INITIALIZATION_TIMEOUT_MS = 45_000;

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Kamera izni verilmedi. Tarayıcı ayarlarından izin verebilir veya fotoğraf seçebilirsiniz.";
  }
  if (error instanceof DOMException && error.name === "NotFoundError") {
    return "Bu cihazda kullanılabilir kamera bulunamadı. Fotoğraf seçmeyi deneyin.";
  }
  return "Kamera başlatılamadı. Fotoğraf seçerek devam edebilirsiniz.";
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Görüntü hazırlanamadı"));
    }, "image/jpeg", 0.9);
  });
}

function enhanceCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * 0.299
      + image.data[index + 1] * 0.587
      + image.data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 128));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
}

export default function CameraScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<OcrWorker | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [sourceCurrency, setSourceCurrency] = useState<ScannerCurrency>("TRY");
  const [rateTable, setRateTable] = useState<RateTable>(PACKAGED_RATE_TABLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Kamera yalnızca siz istediğinizde açılır.");
  const [rawText, setRawText] = useState("");
  const [candidates, setCandidates] = useState<PriceCandidate[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const targetCurrency: ScannerCurrency = sourceCurrency === "TRY" ? "GBP" : "TRY";
  const selected = candidates[selectedIndex] ?? null;
  const converted = useMemo(
    () => selected
      ? convertMoney(createMoney(selected.money.amount, sourceCurrency), targetCurrency, rateTable)
      : null,
    [rateTable, selected, sourceCurrency, targetCurrency],
  );

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 3000);
    const hydrateRates = async () => {
      await Promise.resolve();
      if (!mountedRef.current) return;
      const cached = loadRateTable(localStorage);
      if (cached) setRateTable(cached);

      try {
        const latest = await fetchLatestRateTable(controller.signal);
        if (!mountedRef.current) return;
        setRateTable(latest);
        saveRateTable(localStorage, latest);
      } catch {
        // The packaged or last cached table keeps conversion immediately usable.
      } finally {
        window.clearTimeout(timeout);
      }
    };
    void hydrateRates();

    return () => {
      mountedRef.current = false;
      controller.abort();
      window.clearTimeout(timeout);
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      void workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [stopCamera]);

  const updatePreview = (blob: Blob) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = URL.createObjectURL(blob);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
  };

  const getWorker = async () => {
    if (workerRef.current) return workerRef.current;
    setStatusMessage("OCR motoru hazırlanıyor… İlk kullanım biraz sürebilir.");
    const tesseract = await import("tesseract.js");
    const workerPromise = tesseract.createWorker("eng", tesseract.OEM.LSTM_ONLY, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      logger: (message) => {
        if (!mountedRef.current || typeof message.progress !== "number") return;
        setProgress(Math.round(message.progress * 100));
        if (message.status === "recognizing text") {
          setStatusMessage("Fiyat aranıyor…");
        } else if (message.status.includes("language")) {
          setStatusMessage("OCR dil modeli indiriliyor…");
        } else {
          setStatusMessage("OCR motoru indiriliyor… İlk kullanım biraz sürebilir.");
        }
      },
    });

    let timeoutId = 0;
    const initializationTimeout = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error("OCR initialization timed out")),
        OCR_INITIALIZATION_TIMEOUT_MS,
      );
    });

    let worker;
    try {
      worker = await Promise.race([workerPromise, initializationTimeout]);
    } catch (error) {
      void workerPromise.then((lateWorker) => lateWorker.terminate()).catch(() => undefined);
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!mountedRef.current) {
      await worker.terminate();
      throw new Error("OCR initialization cancelled");
    }

    await worker.setParameters({
      tessedit_char_whitelist: "0123456789.,' ₺£€$TRYGBPEURUSD",
      tessedit_pageseg_mode: tesseract.PSM.SPARSE_TEXT,
    });
    workerRef.current = worker as OcrWorker;
    return workerRef.current;
  };

  const recognizeBlob = async (blob: Blob) => {
    setScannerState("recognizing");
    setProgress(0);
    setCandidates([]);
    setRawText("");
    updatePreview(blob);
    try {
      const worker = await getWorker();
      const { data } = await worker.recognize(blob);
      if (!mountedRef.current) return;
      const text = data.text.trim();
      const found = extractPriceCandidates(text, sourceCurrency);
      setRawText(text);
      setCandidates(found);
      setSelectedIndex(0);
      setScannerState(found.length ? "result" : "error");
      setStatusMessage(
        found.length
          ? `${found.length} fiyat adayı bulundu.`
          : "Fiyat okunamadı. Daha yakından ve düz açıyla tekrar deneyin.",
      );
    } catch (error) {
      if (!mountedRef.current) return;
      setScannerState("error");
      setStatusMessage(
        error instanceof Error && error.message === "OCR initialization timed out"
          ? "OCR motoru zamanında hazırlanamadı. Bağlantıyı kontrol edip fotoğrafı yeniden seçin."
          : "OCR çalıştırılamadı. Bağlantıyı kontrol edip fotoğrafı yeniden seçin.",
      );
    }
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setScannerState("error");
      setStatusMessage("Bu tarayıcı canlı kamerayı desteklemiyor. Fotoğraf seçerek devam edin.");
      return;
    }
    setScannerState("requesting");
    setStatusMessage("Kamera izni bekleniyor…");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("Video hazır değil");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScannerState("ready");
      setStatusMessage("Fiyatı orta çerçevenin içine getirin.");
    } catch (error) {
      stopCamera();
      setScannerState("error");
      setStatusMessage(cameraErrorMessage(error));
    }
  };

  const captureCamera = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
    const sourceWidth = video.videoWidth * 0.82;
    const sourceHeight = video.videoHeight * 0.38;
    const sourceX = (video.videoWidth - sourceWidth) / 2;
    const sourceY = (video.videoHeight - sourceHeight) / 2;
    canvas.width = Math.max(900, Math.round(sourceWidth * 1.5));
    canvas.height = Math.max(320, Math.round(sourceHeight * 1.5));
    const context = canvas.getContext("2d");
    context?.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      canvas.width,
      canvas.height,
    );
    enhanceCanvas(canvas);
    stopCamera();
    await recognizeBlob(await canvasBlob(canvas));
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      stopCamera();
      const bitmap = await createImageBitmap(file);
      const maxWidth = 1800;
      const scale = Math.min(1, maxWidth / bitmap.width);
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      enhanceCanvas(canvas);
      await recognizeBlob(await canvasBlob(canvas));
    } catch {
      setScannerState("error");
      setStatusMessage("Fotoğraf açılamadı. Başka bir görüntü deneyin.");
    }
  };

  const changeCurrency = (currency: ScannerCurrency) => {
    setSourceCurrency(currency);
    if (rawText) {
      const found = extractPriceCandidates(rawText, currency);
      setCandidates(found);
      setSelectedIndex(0);
    }
  };

  return (
    <div className={styles.scanner}>
      <div className={styles.currencyChoice} aria-label="Fotoğraftaki para birimi">
        <span>Fotoğraftaki para:</span>
        {(["TRY", "GBP"] as const).map((currency) => (
          <button
            key={currency}
            type="button"
            className={sourceCurrency === currency ? styles.selectedCurrency : ""}
            onClick={() => changeCurrency(currency)}
            aria-pressed={sourceCurrency === currency}
          >
            {currency === "TRY" ? "₺ TRY" : "£ GBP"}
          </button>
        ))}
      </div>

      <div className={styles.viewport}>
        {scannerState === "ready" || scannerState === "requesting" ? (
          <video ref={videoRef} muted playsInline autoPlay aria-label="Canlı kamera görüntüsü" />
        ) : previewUrl ? (
          // The blob URL stays on-device and is revoked when replaced or unmounted.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="OCR için hazırlanan fotoğraf" />
        ) : (
          <div className={styles.placeholder} aria-hidden="true"><span>₺</span><span>£</span></div>
        )}
        {(scannerState === "ready" || scannerState === "requesting") && (
          <div className={styles.roi} aria-hidden="true"><span>FİYATI BURAYA GETİRİN</span></div>
        )}
      </div>

      <canvas ref={canvasRef} hidden />

      <p className={styles.status} role="status">
        {statusMessage}
        {scannerState === "recognizing" && <span>{progress}%</span>}
      </p>

      {scannerState === "ready" ? (
        <button type="button" className={styles.primaryButton} onClick={() => void captureCamera()}>
          Fiyatı yakala ve oku
        </button>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void openCamera()}
            disabled={scannerState === "requesting" || scannerState === "recognizing"}
          >
            {scannerState === "requesting" ? "Kamera açılıyor…" : "Kamerayı aç"}
          </button>
          <label className={styles.secondaryButton}>
            Fotoğraf çek veya seç
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => void choosePhoto(event.target.files?.[0])}
              disabled={scannerState === "recognizing"}
            />
          </label>
        </div>
      )}

      {selected && converted && (
        <section className={styles.result} aria-label="Okunan fiyat sonucu">
          <small>SEÇİLEN FİYAT</small>
          <strong>{formatMoney(selected.money, "tr-TR")}</strong>
          <span>yaklaşık</span>
          <b>{formatMoney(converted, "tr-TR")}</b>
          {candidates.length > 1 && (
            <div className={styles.candidates}>
              <p>Başka bir fiyat mı?</p>
              {candidates.map((candidate, index) => (
                <button
                  key={`${candidate.raw}-${candidate.money.amount}`}
                  type="button"
                  className={index === selectedIndex ? styles.activeCandidate : ""}
                  onClick={() => setSelectedIndex(index)}
                >
                  {formatMoney(candidate.money, "tr-TR")}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      <p className={styles.privacy}>Kamera karesi ve OCR metni bu cihazdan gönderilmez.</p>
    </div>
  );
}

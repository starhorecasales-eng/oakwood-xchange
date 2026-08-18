import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_IDENTITY } from "@/lib/product";
import CameraScanner from "./CameraScanner";
import styles from "./CameraScanner.module.css";

export const metadata: Metadata = {
  title: `Kamerayla fiyat oku | ${PRODUCT_IDENTITY.publicName}`,
  description: "Telefon kamerasıyla görünen bir fiyatı cihaz üzerinde okuyup TL ve sterlin arasında çevirin.",
  robots: { index: false, follow: true },
};

export default function CameraPage() {
  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="camera-title">
        <header className={styles.header}>
          <Link href="/" className={styles.back}>← Dönüştürücü</Link>
          <span>Deneysel</span>
        </header>
        <div className={styles.intro}>
          <p>KAMERAYLA FİYAT OKU</p>
          <h1 id="camera-title">Fiyatı çerçeveye getir</h1>
          <span>Fotoğraf cihazınızda işlenir; sunucuya yüklenmez veya kaydedilmez.</span>
        </div>
        <CameraScanner />
      </section>
    </main>
  );
}

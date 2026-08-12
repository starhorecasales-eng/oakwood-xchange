import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#102b25",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;

  return {
    metadataBase,
    title: "Cebimde Kur — TL ↔ Sterlin",
    description: "Türk lirası ve İngiliz sterlini arasında hızlı, iki yönlü döviz çevirici.",
    applicationName: "Cebimde Kur",
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
      apple: "/icon-180.png",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Cebimde Kur",
    },
    openGraph: {
      title: "Cebimde Kur — TL ↔ Sterlin",
      description: "Türkiye’de hızlı fiyat hesabı. TL ve sterlin arasında anında çevir.",
      type: "website",
      images: metadataBase ? [{ url: new URL("/og.png", metadataBase).toString() }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: "Cebimde Kur — TL ↔ Sterlin",
      description: "Türkiye’de hızlı fiyat hesabı. TL ve sterlin arasında anında çevir.",
      images: metadataBase ? [new URL("/og.png", metadataBase).toString()] : [],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

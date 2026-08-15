import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { PRODUCT_COPY, PRODUCT_IDENTITY } from "@/lib/product";
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
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const metadataBase = host ? new URL(`${protocol}://${host}`) : undefined;

  return {
    metadataBase,
    title: PRODUCT_COPY.title,
    description: PRODUCT_COPY.description,
    applicationName: PRODUCT_IDENTITY.publicName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.svg?v=3",
      shortcut: "/favicon.svg?v=3",
      apple: "/icon-180.png?v=3",
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: PRODUCT_IDENTITY.publicName,
    },
    openGraph: {
      title: PRODUCT_COPY.title,
      description: PRODUCT_COPY.socialDescription,
      type: "website",
      images: metadataBase ? [{ url: new URL("/og.png", metadataBase).toString() }] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: PRODUCT_COPY.title,
      description: PRODUCT_COPY.socialDescription,
      images: metadataBase ? [new URL("/og.png", metadataBase).toString()] : [],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={PRODUCT_IDENTITY.defaultLanguage}>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

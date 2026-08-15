import type { MetadataRoute } from "next";
import { PRODUCT_COPY, PRODUCT_IDENTITY } from "@/lib/product";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: PRODUCT_COPY.title,
    short_name: PRODUCT_IDENTITY.publicName,
    description: PRODUCT_COPY.manifestDescription,
    start_url: "/",
    display: "standalone",
    background_color: "#f4eedf",
    theme_color: "#102b25",
    lang: PRODUCT_IDENTITY.defaultLanguage,
    icons: [
      {
        src: "/icon-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cebimde Kur — TL ↔ Sterlin",
    short_name: "Cebimde Kur",
    description: "Türk lirası ve İngiliz sterlini arasında hızlı döviz çevirici.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eedf",
    theme_color: "#102b25",
    lang: "tr",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}

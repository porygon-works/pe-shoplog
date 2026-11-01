import type { MetadataRoute } from "next";

// 色は globals.css の --ai（藍）と同じ値。
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PEショップログ",
    short_name: "ショップログ",
    description: "社内向けのお店の記録アプリ",
    start_url: "/map",
    scope: "/",
    display: "standalone",
    lang: "ja",
    theme_color: "#24407a",
    background_color: "#eef0f3",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

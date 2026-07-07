import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MacroLog — calorie & macro tracker",
    short_name: "MacroLog",
    description: "Scan, log, and track your calories and macros.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0c0f",
    theme_color: "#0b0c0f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

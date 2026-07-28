import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.shortName} — Resident Portal`,
    short_name: siteConfig.shortName,
    description:
      "Your documents, house rules, safety information, and support contacts.",
    // Installed copies open straight into the resident portal.
    start_url: "/me",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fffdf9",
    theme_color: "#fffdf9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

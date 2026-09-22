import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

const routes: { path: string; priority: number }[] = [
  { path: "/", priority: 1 },
  { path: "/apply", priority: 0.9 },
  { path: "/features", priority: 0.8 },
  { path: "/about", priority: 0.7 },
  { path: "/contact", priority: 0.7 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return routes.map(({ path, priority }) => ({
    url: `${siteConfig.url}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "monthly",
    priority,
  }));
}

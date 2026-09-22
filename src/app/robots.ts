import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything below is either behind a login or a private one-off link,
      // so crawling it only produces redirects and soft 404s in Search Console.
      disallow: ["/app", "/me", "/login", "/install", "/pay", "/sign", "/api"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
    host: siteConfig.url,
  };
}

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://clerkme.com.ng/",
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}

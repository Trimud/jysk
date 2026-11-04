import type { Metadata } from "next";

export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "Trimud/jysk";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/** Where the site lives, for share cards, the sitemap and absolute links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://assemble.help").replace(/\/$/, "");

/** AI (Together, on the visitor's own key) and the voice are off for launch: hidden everywhere unless NEXT_PUBLIC_AI=1. */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI === "1";

/** The manual scanner (/scan) is parked for a later version: hidden everywhere unless NEXT_PUBLIC_SCAN=1. */
export const SCAN_ENABLED = process.env.NEXT_PUBLIC_SCAN === "1";

/**
 * A page's metadata with its own share tags. Next swaps a page's openGraph for the layout's whole rather than merging
 * them, so a page that only set a title would share the home page's title, words and address.
 */
export function pageMeta(title: string, description: string, path: string, more: Metadata = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: "website", siteName: "assemble.help", title, description, url: path },
    twitter: { card: "summary_large_image", title, description },
    ...more,
  };
}

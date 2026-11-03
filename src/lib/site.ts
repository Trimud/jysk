export const GITHUB_REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "Trimud/jysk";
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

/** Where the site lives, for share cards, the sitemap and absolute links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://monta.online").replace(/\/$/, "");

/** AI (Together, on the visitor's own key) and the voice are off for launch: hidden everywhere unless NEXT_PUBLIC_AI=1. */
export const AI_ENABLED = process.env.NEXT_PUBLIC_AI === "1";

/** The manual scanner (/scan) is parked for a later version: hidden everywhere unless NEXT_PUBLIC_SCAN=1. */
export const SCAN_ENABLED = process.env.NEXT_PUBLIC_SCAN === "1";

import type { MetadataRoute } from "next";
import { AI_ENABLED } from "@/lib/site";

/** Add to home screen: opens straight into the search, full screen, in the page's own colours. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "assemble.help: JYSK assembly, step by step",
    short_name: "assemble.help",
    description: `JYSK furniture assembly in 3D, step by step${AI_ENABLED ? ", read out loud" : ""}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

import { OG_SIZE, drawing, pageCard } from "@/lib/og/card";

export const alt = "Your workshop on assemble.help: the JYSK builds you started, ready to pick up where you left off";
export const size = OG_SIZE;
export const contentType = "image/png";

// read when the module loads, so the card is drawn at build time
const art = await drawing("hero-bygga");

export default function Image() {
  return pageCard({ kicker: "Your workshop", title: "Pick up where you left off", line: "Every build you started", cta: "Open your workshop", art: art ? [art] : [] });
}

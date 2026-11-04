import { OG_SIZE, drawing, pageCard } from "@/lib/og/card";
import { PRODUCT_COUNT } from "@/lib/search";

export const alt = "All JYSK assembly guides on assemble.help: a wardrobe, a sofa, a bed and a dining table drawn in 3D";
export const size = OG_SIZE;
export const contentType = "image/png";

const ART = ["wardrobe-limfjorden-180x200-3-doors-3-drawers-beige", "sofa-dalshuse-3-seater-beige-fabric", "bed-frame-limfjorden-double-3-drawers-white", "dining-table-marstrand-d110-110x200-white-natural"];

// read when the module loads, so the card is drawn at build time
const art = (await Promise.all(ART.map(drawing))).filter((d): d is string => !!d);

export default function Image() {
  return pageCard({ kicker: "All guides", title: "All JYSK guides", line: `${PRODUCT_COUNT} products, every step in 3D`, cta: "Find your guide", art });
}

import { OG_SIZE, pageCard } from "@/lib/og/card";

export const alt = "assemble.help privacy and terms: no accounts, no cookies, no ads";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return pageCard({ kicker: "Privacy and terms", title: "No accounts. No cookies. No ads.", line: "Here is exactly what goes where" });
}

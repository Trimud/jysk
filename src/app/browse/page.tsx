import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Browse from "./Browse";

export const metadata: Metadata = pageMeta(
  "All JYSK assembly guides",
  "Step-by-step 3D assembly guides for JYSK furniture: wardrobes, chests of drawers, beds, desks, shelving, tables, chairs, sofas and garden furniture. Search by name or article number.",
  "/browse",
);

export default Browse;

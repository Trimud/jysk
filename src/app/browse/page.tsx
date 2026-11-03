import type { Metadata } from "next";
import Browse from "./Browse";

export const metadata: Metadata = {
  title: "All guides",
  description: "Step-by-step 3D assembly guides for JYSK furniture: wardrobes, chests of drawers, beds, desks, shelving, tables, chairs, sofas and garden furniture. Search by name or article number.",
  alternates: { canonical: "/browse" },
};

export default Browse;

// Server only: reads src/data/recipes with fs, so ~550 recipes never reach a client bundle. Never import it from a "use client" file.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CustomParams, ModelId, ProductSpec, RecipeVerified } from "./types";

/** A product's parts and steps drawn from its manual (src/data/recipes/<slug>.json), built by buildCustom. */
export type RecipeFile = {
  params: CustomParams;
  spec?: Partial<Pick<ProductSpec, "size" | "minutes" | "people" | "difficulty">>;
  model: ModelId;
  verified?: RecipeVerified;
};

/** The catalog spec with its recipe, when src/data/recipes has one for its slug; otherwise the spec unchanged. */
export function withRecipe(spec: ProductSpec): ProductSpec;
export function withRecipe(spec: ProductSpec | null): ProductSpec | null;
export function withRecipe(spec: ProductSpec | null): ProductSpec | null {
  // the slug names a file: only a plain one
  if (!spec || spec.source !== "catalog" || !spec.slug || !/^[\w-]+$/.test(spec.slug)) return spec;
  let text: string;
  try {
    text = readFileSync(join(process.cwd(), "src/data/recipes", `${spec.slug}.json`), "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return spec;
    throw e;
  }
  // a broken recipe throws: jysk:check (prebuild) stops it deploying
  const r = JSON.parse(text) as RecipeFile;
  if (!Array.isArray(r.params?.parts) || !Array.isArray(r.params.steps)) throw new Error(`recipe ${spec.slug}: no parts or steps`);
  return { ...spec, ...r.spec, custom: r.params, recipe: r.verified ? { verified: r.verified } : {} };
}

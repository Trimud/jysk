import type { Plan, ProductSpec } from "../types";
import { PlanBuilder } from "./builder";
import { buildShelf } from "./shelf";
import { buildDrawers } from "./drawers";
import { buildTable } from "./table";
import { buildBed } from "./bed";
import { buildCabinet } from "./cabinet";
import { buildSeat } from "./seat";
import { buildSofa } from "./sofa";
import { buildCustom } from "./custom";
import { buildRow } from "./row";
import { buildUnits } from "./units";
import { FAMILIES } from "./families";
import { familyOf, type Family } from "./families/family";

const cache = new Map<string, Plan>();

export function buildPlan(spec: ProductSpec): Plan {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;
  const b = new PlanBuilder(spec);
  // drawn from the manual: a family built it (or every unit of a row)
  let manual = true;
  const one = (bb: PlanBuilder, s: ProductSpec) => {
    if (!buildOne(bb, s)) manual = false;
  };
  // a recipe (src/data/recipes) draws the whole product, catalog identity kept; approximate until it is verified
  if (spec.recipe && spec.custom) {
    buildCustom(b, spec);
    manual = !!spec.recipe.verified;
  } else if (spec.row && familyRow(b, spec)) {
    // a family that draws its own sets of frames goes first
  } else if (spec.row?.units) buildUnits(b, spec, one);
  else if (spec.row) buildRow(b, spec, one);
  else one(b, spec);
  let plan = b.build();
  if (!manual && spec.source === "catalog") plan = { ...plan, approximate: true };
  // the manual's two-person mark on every step (TRAPPEDAL's p10) outweighs the listing's one
  if (plan.steps.length && plan.steps.every((st) => st.people === 2) && plan.spec.people !== 2) plan = { ...plan, spec: { ...plan.spec, people: 2 } };
  cache.set(key, plan);
  return plan;
}

/** `spec.layout` with option `id` picked: option ids are unique across a plan's choices, so it replaces its own choice's pick. */
export function repick(plan: Plan, id: string) {
  return (plan.layouts ?? []).map((c) => (c.options.some((o) => o.id === id) ? id : c.pick)).join(",");
}

const byName = new Map<string, Family[]>();
// a family file still being written may not export its family yet; skip it rather than break every guide
for (const f of FAMILIES) if (f?.names) for (const n of f.names) byName.set(n, [...(byName.get(n) ?? []), f]);

function familyRow(b: PlanBuilder, spec: ProductSpec) {
  for (const f of byName.get(familyOf(spec)) ?? []) if (f.row?.(b, spec)) return true;
  return false;
}

/** A family that knows how its product really goes together (from JYSK's manual) builds it; otherwise its kind does. */
function buildFamily(b: PlanBuilder, spec: ProductSpec) {
  if (spec.archetype === "custom") return false;
  for (const f of byName.get(familyOf(spec)) ?? []) {
    if (f.build?.(b, spec)) return true;
    const custom = f.recipe?.(spec);
    if (custom) {
      buildCustom(b, { ...spec, custom });
      return true;
    }
  }
  return false;
}

/** Builds one piece; true when a family drew it from the manual, false for its kind's typical build. */
function buildOne(b: PlanBuilder, spec: ProductSpec): boolean {
  if (buildFamily(b, spec)) return true;
  buildKind(b, spec);
  return false;
}

function buildKind(b: PlanBuilder, spec: ProductSpec) {
  switch (spec.archetype) {
    case "shelf":
      return buildShelf(b, spec);
    case "drawers":
      return buildDrawers(b, spec);
    case "table":
      return buildTable(b, spec);
    case "bed":
      return buildBed(b, spec);
    case "cabinet":
      return buildCabinet(b, spec);
    case "seat":
      return buildSeat(b, spec);
    case "sofa":
      return buildSofa(b, spec);
    case "custom":
      return buildCustom(b, spec);
  }
}

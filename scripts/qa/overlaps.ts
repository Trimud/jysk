/**
 * Finds what's wrong with a guide's model: npm run qa:overlaps [-- --only <slug>] [-- --jysk] [-- --why]
 * (--why prints where the two boxes of each clash are). Exits 1 on any. Three checks:
 * - closed: every part (and each piece of a part made of several) against every other, and cabinet and drawer runners
 *   against the parts they aren't screwed to, as rotated boxes, on the finished piece. Parts that only touch don't count.
 * - open: the same with each door and drawer opened as "Open all" does, alone and all together; only clashes where
 *   something moved are reported (a door that swings into the drawer beside it).
 * - floating: a fitting whose fixing point isn't on or in the part it belongs to, which X-ray shows hanging in the air.
 *
 * Left out on purpose:
 * - a board 8 mm thick or less (a back, a drawer bottom) reaching up to 12 mm into another part: its groove or rebate
 * - joints meant to overlap, listed by part names in MEANT (crossed feet, a cap over a pole...)
 * - soft parts (cushions, mattresses), which sink into what they sit on
 * - runner against runner: a cabinet runner and its drawer runner interlock
 * - other fittings (dowels, screws, cams...), which go into the parts by design
 * ponytail: a cylinder is the square inside it (so a clash under 15% of its width goes unseen), and half discs and bent
 * tubes are skipped, and so are shaped boards that aren't rectangles. Upgrade: test those shapes exactly when a real case needs it.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { OBB } from "three/examples/jsm/math/OBB.js";
import { PRODUCTS, baseSlug, catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import type { HwItem, Opening, PartItem, PartPiece, PartType, Plan, Vec3 } from "@/lib/types";
import { RUNNER } from "@/engine/sizes";
import { JYSK_ROWS } from "@/data/jysk-rows";
import { decodeRows } from "@/lib/ikea";

const TOUCH = 2; // mm of overlap that still counts as touching: a tilted leg's end corner, too small to see
const GROOVE = 12; // mm a thin board may reach into another part
const THIN = 8; // mm: hardboard and MDF backs and bottoms, which sit in grooves

/** Joints that are meant to overlap, by the two parts' names. */
const MEANT: [RegExp, RegExp, string][] = [
  [/^Foot$/, /^Foot$/, "feet crossed in a halving joint"],
  [/^Cross brace$/, /^Cross brace$/, "X braces cross"],
  [/^Leg frame$/, /^Leg frame$/, "X stretchers cross"],
  [/^Pole section$/, /^Top cap$/, "the cap goes over the pole"],
  [/pole$/i, /^Wire shelf$/, "the shelf's corner sleeves go round the poles"],
  [/^Leg$/, /^Table top half$/, "the apron is tenoned into the leg"],
  [/^Spreader bar$/, /^Upper frame$/, "the bar's ends go into the uprights"],
  [/^Armrest$/, /^Mechanism$/, "armrests bolt under the seat beside the mechanism, drawn as one block"],
];
const meant = (a: string, b: string) => MEANT.some(([x, y]) => (x.test(a) && y.test(b)) || (x.test(b) && y.test(a)));

interface Solid {
  name: string;
  moved: boolean; // opened, in an open state
  part: string; // its part type's name, without the piece
  owner: string; // the part key it belongs to (a runner: the part it's screwed to)
  thin: boolean;
  soft: boolean;
  runner: boolean;
  obb: OBB;
}

const quat = (e: Vec3 = [0, 0, 0]) => new Quaternion().setFromEuler(new Euler(e[0], e[1], e[2], "XYZ"));
const frame = (pos: Vec3, rot?: Vec3) => new Matrix4().compose(new Vector3(...pos), quat(rot), new Vector3(1, 1, 1));

/** A box of half sizes `half` around `center` in the frame `m`. OBB.applyMatrix4 moves a box's centre without turning it, so the offset goes into the matrix. */
function obbOf(center: Vec3, half: Vec3, m: Matrix4) {
  return new OBB(new Vector3(), new Vector3(...half)).applyMatrix4(m.clone().multiply(new Matrix4().makeTranslation(...center)));
}

/** A part type's pieces: its own, or itself as one. */
const piecesOf = (t: PartType): PartPiece[] => t.pieces ?? [{ shape: t.shape, size: t.size, pos: [0, 0, 0] }];

/**
 * A piece's box in its part's frame: [centre, half sizes], or null for shapes this check skips. `full`: every piece's
 * whole bounding box, for asking whether a point is on it rather than whether something runs through it.
 */
function pieceBox(p: PartPiece, full = false): [Vec3, Vec3] | null {
  const half: Vec3 = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
  if (full || p.shape === "box") return [p.pos, half];
  // a cylinder (along y) as the square inside it: tubes meeting at an angle or end to side don't clash at their corners
  if (p.shape === "cyl") return [p.pos, [half[0] / Math.SQRT2, half[1], half[2] / Math.SQRT2]];
  // a shaped board only when it is a plain rectangle: a curved one's box is far bigger than it
  if (p.shape === "slab" && p.outline && p.outline.length === 4 && p.outline.every(([x, z]) => p.outline!.filter((c) => c[0] === x).length === 2 && p.outline!.filter((c) => c[1] === z).length === 2)) {
    const xs = p.outline.map((c) => c[0]), zs = p.outline.map((c) => c[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return [[p.pos[0] + (x0 + x1) / 2, p.pos[1], p.pos[2] + (z0 + z1) / 2], [(x1 - x0) / 2, p.size[1] / 2, (z1 - z0) / 2]];
  }
  return null;
}

/** A plan's parts, part types and fittings by id, and each part's frame on the finished piece. */
function indexOf(plan: Plan) {
  const parts = plan.items.filter((i): i is PartItem => i.kind === "part");
  return {
    plan,
    parts,
    byKey: new Map(parts.map((p) => [p.key, p])),
    types: new Map(plan.parts.map((t) => [t.id, t])),
    hw: new Map(plan.hardware.map((h) => [h.id, h])),
    world: new Map(parts.map((p) => [p.key, frame(p.final.pos, p.final.rot)])),
  };
}
type Index = ReturnType<typeof indexOf>;

/** How the engine holds a fitting: its local -y along `dir`, turned by `twist` about it, in its parent's frame. */
function holder(it: HwItem, parent?: Matrix4) {
  const dir = new Vector3(...it.dir).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir);
  if (it.twist) q.premultiply(new Quaternion().setFromAxisAngle(dir, it.twist));
  const m = new Matrix4().compose(new Vector3(...it.pos), q, new Vector3(1, 1, 1));
  return parent ? m.premultiply(parent) : m;
}

/** The finished piece as boxes, with the parts in `moves` moved by their matrix (opened). */
function solids(ix: Index, moves = new Map<string, Matrix4>(), full = false): Solid[] {
  const world = (k: string) => (moves.has(k) ? ix.world.get(k)!.clone().premultiply(moves.get(k)!) : ix.world.get(k)!);
  const out: Solid[] = [];
  for (const p of ix.parts) {
    const t = ix.types.get(p.ref)!;
    const m = world(p.key);
    piecesOf(t).forEach((pc, i) => {
      const box = pieceBox(pc, full);
      if (!box) return;
      // a piece turns about its own centre
      const obb = obbOf([0, 0, 0], box[1], m.clone().multiply(frame(box[0], pc.rot)));
      out.push({ part: t.name, name: t.pieces ? `${t.name} (piece ${i + 1})` : t.name, owner: p.key, moved: moves.has(p.key), soft: t.material === "soft", runner: false, thin: Math.min(...box[1]) * 2 <= THIN, obb });
    });
  }
  const depth = RUNNER.body + RUNNER.lip;
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || it.wall) continue;
    const h = ix.hw.get(it.ref)!;
    if (h.kind !== "runner") continue;
    const obb = obbOf([0, depth / 2, 0], [RUNNER.w / 2, depth / 2, h.len / 2], holder(it, it.parent ? world(it.parent) : undefined));
    out.push({ name: h.name, part: h.name, owner: it.parent ?? it.key, moved: !!it.parent && moves.has(it.parent), thin: false, soft: false, runner: true, obb });
  }
  return out;
}

const WHY = process.argv.includes("--why");
/** "Name: x a..b, y a..b, z a..b" in mm, the world box round it, for reading a clash. */
function where(s: Solid) {
  const pts = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [-1, 1].map((k) => new Vector3(i * s.obb.halfSize.x, j * s.obb.halfSize.y, k * s.obb.halfSize.z).applyMatrix3(s.obb.rotation).add(s.obb.center))));
  const r = (k: "x" | "y" | "z") => `${k} ${Math.min(...pts.map((p) => p[k])).toFixed(1)}..${Math.max(...pts.map((p) => p[k])).toFixed(1)}`;
  return `${s.name}: ${r("x")}, ${r("y")}, ${r("z")}`;
}

const shrunk = (o: OBB, by: (h: Vector3) => Vector3) => Object.assign(o.clone(), { halfSize: by(o.halfSize.clone()) });
const groove = (v: number) => (v <= THIN / 2 ? v : Math.max(0, v - GROOVE));

/** Pairs of solids that run through each other; with `moves`, only pairs where something moved. */
function clashes(ix: Index, moves?: Map<string, Matrix4>): string[] {
  const s = solids(ix, moves);
  // touching doesn't count: each box less TOUCH, once
  const touch = s.map((x) => shrunk(x.obb, (h) => h.subScalar(TOUCH / 2).max(new Vector3())));
  const found = new Set<string>();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      if (a.owner === b.owner || a.soft || b.soft || (a.runner && b.runner) || meant(a.part, b.part)) continue;
      if (moves && !a.moved && !b.moved) continue;
      if (!touch[i].intersectsOBB(touch[j])) continue;
      // a thin board whose edges reach into another part: test again with GROOVE mm off its edges
      if (a.thin || b.thin) {
        const [thin, other] = a.thin ? [a, touch[j]] : [b, touch[i]];
        if (!shrunk(thin.obb, (h) => new Vector3(groove(h.x), groove(h.y), groove(h.z))).intersectsOBB(other)) continue;
      }
      found.add([a.name, b.name].sort().join(" x ") + (WHY ? `\n    ${where(a)}\n    ${where(b)}` : ""));
    }
  return [...found];
}

/** How "Open all" moves an opening's parts: a drawer slides, a door turns about its hinge line. */
function openMatrix(o: Opening) {
  if (o.slide) return new Matrix4().makeTranslation(...o.slide);
  const h = o.hinge!;
  const at = new Vector3(...h.at);
  return new Matrix4()
    .makeTranslation(at.x, at.y, at.z)
    .multiply(new Matrix4().makeRotationAxis(new Vector3(...h.axis).normalize(), h.angle))
    .multiply(new Matrix4().makeTranslation(-at.x, -at.y, -at.z));
}

/** Clashes with each opening open on its own, then with all of them open. */
function openClashes(ix: Index): string[] {
  const opens = ix.plan.opens ?? [];
  const found = new Set<string>();
  const states = opens.map((o) => [o]);
  if (opens.length > 1) states.push(opens);
  for (const st of states) {
    const moves = new Map(st.flatMap((o) => o.parts.map((k) => [k, openMatrix(o)] as const)));
    const label = st.length > 1 ? "all open" : `${ix.types.get(ix.byKey.get(st[0].parts[0])!.ref)!.name} open`;
    for (const c of clashes(ix, moves)) found.add(`${label}: ${c}`);
  }
  return [...found];
}

const PIN = 5; // mm a fitting's fixing point may sit off its part's surface: a bolt head on a washer
/** Fittings whose fixing point is on nothing: not their part, nor anything else (a runner's screws sit on the
 *  runner, a leg in its cup). They hang in the air in X-ray. */
function floating(ix: Index): string[] {
  const all = solids(ix, undefined, true).map((x) => shrunk(x.obb, (h) => h.addScalar(PIN)));
  // spacers and leg cups are something to sit on too: drawn as a cylinder `len` out of the face
  for (const it of ix.plan.items) {
    const h = it.kind === "hw" ? ix.hw.get(it.ref)! : null;
    if (it.kind === "hw" && h?.kind === "spacer") all.push(obbOf([0, h.len / 2, 0], [h.dia / 2 + PIN, h.len / 2 + PIN, h.dia / 2 + PIN], holder(it, it.parent ? ix.world.get(it.parent) : undefined)));
  }
  const found = new Set<string>();
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || !it.parent || it.wall) continue;
    const at = new Vector3(...it.pos).applyMatrix4(ix.world.get(it.parent)!);
    if (all.some((o) => o.containsPoint(at))) continue;
    const t = ix.types.get(ix.byKey.get(it.parent)!.ref)!;
    found.add(`floating: ${ix.hw.get(it.ref)!.name} off the ${t.name}` + (WHY ? ` at [${it.pos.map((v) => v.toFixed(1)).join(", ")}] in its frame, the part ${t.size.join(" x ")}${t.pieces ? ` in ${t.pieces.length} pieces: ${t.pieces.map((pc) => `${pc.shape} ${pc.size.map((v) => Math.round(v)).join("x")} at ${pc.pos.map((v) => Math.round(v)).join(",")}`).join("; ")}` : ""}` : ""));
  }
  return [...found];
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const slugs = only
  ? [only]
  : args.includes("--jysk")
    ? decodeRows(JYSK_ROWS).map((r) => r.slug ?? baseSlug(r.name, r.variant))
    : PRODUCTS.map((p) => p.slug);

let bad = 0;
for (const slug of slugs) {
  const spec = catalogSpec(slug);
  if (!spec) continue;
  const ix = indexOf(buildPlan(spec));
  const list = [...clashes(ix), ...openClashes(ix), ...floating(ix)];
  if (!list.length) continue;
  bad++;
  for (const c of list) console.log(`FAIL ${slug}: ${c}`);
}
console.log(`${slugs.length - bad} of ${slugs.length} guides have no clashes, closed or open, and no floating fittings`);
if (bad) process.exit(1);


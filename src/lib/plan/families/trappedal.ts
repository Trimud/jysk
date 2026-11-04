import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import { box, ladder as tubeFrame } from "./_metal";
import type { Family } from "./family";

/**
 * JYSK TRAPPEDAL steel-frame pieces, read from their manuals: the shelving units 70x109x30, 5 shelves (3600987,
 * 3601268, 18 pages) and 70x178x30, 7 shelves (3601018, 3601269, 3601428, 18 pages, the same steps with three small
 * and three wide shelves), and the hallway unit 90x178x40 (3699059, 3690569, 29 pages, below). The other TRAPPEDAL
 * pieces (cabinet, console, desk, wall shelf) aren't these: they fall to their kinds.
 *
 * The shelving: a black square-tube frame: two side ladders (2 left, 3 right), each two 16 mm posts with a cross bar at every shelf
 * and a top bar, and a shorter middle ladder (4) between the bottom and the top. The wooden shelves (top 1, bottom 7,
 * two narrow 5 on the left, two wide 6 on the right, staggered) each sit in a pair of metal edge rails, and every
 * joint is an M6 countersunk bolt (A) through a post into a rail end. It is built lying on its left side: the small
 * shelves onto the left ladder, the middle ladder, the bottom, the top (on the middle posts, two short bolts B down
 * into them), the wide shelves, the right ladder; then the anti-tip bracket, stood up, levelled on its feet and fixed.
 *
 * The hallway unit: two side ladders (2, 3), the top (1), a middle and a bottom shelf (7), a hanging rail (4) under the
 * top on the left, and on the right a middle ladder (5) over the middle shelf with two small shelves (6), carried to
 * the floor by two bars (8) under the middle shelf and two short ones (9) under the bottom one. Bolted the same way
 * lying on its back, the middle ladder on long bolts (C), then two anti-tip brackets (D) on short bolts (B).
 */

const T = 16; // tube, rail and board thickness
const A: HwDef = { kind: "bolt", len: 35, dia: 6, flush: true }; // M6x35, countersunk into the tube
const B: HwDef = { kind: "bolt", len: 12, dia: 6, flush: true }; // M6x12, its head level with the top
const C: HwDef = { kind: "bracket", len: 75, dia: 25, name: "Anti-tip bracket" };
const LONG: HwDef = { kind: "stud", len: 50, dia: 6, name: "Long bolt" }; // M6x50, the hallway unit's C

// heights in mm (centres of the boards), from the manual's dimensions: legs 91, then 234/334/367 left, 360/360/215 right
// the 7-shelf: legs 91, then 325/424/424/436 left, 454/454/454/247 right; h, the posts' height
type Heights = { h: number; bottom: number; s5: number[]; s6: number[]; top: number };
const SIZES: Record<number, Heights> = {
  109: { h: 1090, bottom: 99, s5: [349, 699], s6: [475, 851], top: 1082 },
  178: { h: 1780, bottom: 99, s5: [440, 880, 1320], s6: [569, 1039, 1509], top: 1772 },
};
const XL = -350, XR = 350; // outer faces of the side ladders
const XM = [-80, -64]; // the middle ladder's faces: 254 mm to its left, 398 to its right
const XMC = (XM[0] + XM[1]) / 2; // and its centre
const ZP = 142; // the posts' centres, front (+) and back (-)

function shelving(b: PlanBuilder, Y: Heights) {
  const words = ["no", "one", "two", "three", "four"];

  /* ---------- parts, the manual's numbers as labels; frames metal, shelves wood in metal edge rails ---------- */
  /** One part type drawn from pieces (where the first one goes), placed at each height in `ys` (the first is the pieces' own). */
  const part = (name: string, label: string, pieces: PartPiece[], material: "metal" | "board", ys: number[] = [pieces[0].pos[1]]) => {
    const { type, mid } = b.compound(name, pieces, { material, label });
    return ys.map((y) => b.place(type, [mid[0], mid[1] + y - ys[0], mid[2]]));
  };
  const ladder = (name: string, label: string, x: number, y0: number, y1: number, bars: number[]) =>
    part(name, label, [
      ...[-ZP, ZP].map((z): PartPiece => ({ shape: "box", size: [T, y1 - y0, T], pos: [x, (y0 + y1) / 2, z] })),
      ...bars.map((y): PartPiece => ({ shape: "box", size: [T, T, 2 * ZP - T], pos: [x, y, 0] })),
    ], "metal")[0];
  const shelves = (name: string, label: string, x0: number, x1: number, ys: number[]) =>
    part(name, label, [
      { shape: "box", size: [x1 - x0, T, 266], pos: [(x0 + x1) / 2, ys[0], 0], material: "board" },
      ...[-141, 141].map((z): PartPiece => ({ shape: "box", size: [x1 - x0, T, T], pos: [(x0 + x1) / 2, ys[0], z], material: "metal" })),
    ], "board", ys);
  const [top] = shelves("Top", "1", XL + T, XR - T, [Y.top]);
  const left = ladder("Left frame", "2", XL + T / 2, 0, Y.h, [Y.bottom, ...Y.s5, Y.top]);
  const right = ladder("Right frame", "3", XR - T / 2, 0, Y.h, [Y.bottom, ...Y.s6, Y.top]);
  const middle = ladder("Middle frame", "4", XMC, 108, Y.h - 17, [...Y.s5, ...Y.s6]);
  const s5 = shelves("Small shelf", "5", XL + T, XM[0], Y.s5);
  const s6 = shelves("Wide shelf", "6", XM[1], XR - T, Y.s6);
  const [bottom] = shelves("Bottom shelf", "7", XL + T, XR - T, [Y.bottom]);
  // each small and wide shelf with its height, for the bolts into it
  const at5 = Y.s5.map((y, i): [number, string] => [y, s5[i]]);
  const at6 = Y.s6.map((y, i): [number, string] => [y, s6[i]]);

  /* ---------- helpers ---------- */
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "+x", ...d }, body);
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  /** Bolts A through a ladder's posts (front and back) at height y, from face x the way `dir` goes, into a shelf's rails. */
  const bolts = (on: string, x: number, dir: number, ys: [number, string][]) => {
    b.fits(A, ys.flatMap(([y, mate]) => [ZP, -ZP].map((z): FitOpts => ({ on, at: [x, y, z], dir: [dir, 0, 0], mate }))), 0.08);
    b.then(0.1);
  };

  /* ---------- lying on its left side on a rug ---------- */
  step({ title: `Bolt the ${words[Y.s5.length]} small shelves to the left frame`, detail: `Lay the left frame (2) flat, feet at the bottom end. Stand the small shelves (5) on it at its cross bars and bolt each through the front and back post with the Allen key: ${2 * Y.s5.length} bolts. The posts' hole ends go up.`, kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    put([left], [-200, 0, 0]);
    put(s5, [200, 0, 0]);
    bolts(left, XL, 1, at5);
  });
  step({ title: "Bolt the middle frame on", detail: `The middle frame (4) onto the other ends of the small shelves, the hole in its posts' ends at the top: ${2 * Y.s5.length} bolts.`, kind: "bolts", tools: ["allen"] }, () => {
    put([middle], [200, 0, 0]);
    bolts(middle, XM[1], -1, at5);
  });
  step({ title: "Bolt on the bottom shelf", detail: "The bottom shelf (7): two bolts through the left frame into its end, two up through its rails into the middle frame's posts.", kind: "bolts", tools: ["allen"] }, () => {
    put([bottom], [200, 0, 0]);
    bolts(left, XL, 1, [[Y.bottom, bottom]]);
    b.fits(A, [ZP, -ZP].map((z): FitOpts => ({ on: bottom, at: [XMC, Y.bottom - T / 2, z], dir: [0, 1, 0], mate: middle })), 0.08);
  });
  step({ title: "Slide the top onto the middle frame", detail: "Its two square sockets underneath go over the ends of the middle frame's posts.", kind: "join" }, () => put([top], [0, 250, 0]));
  step({ title: "Bolt the top on", detail: "Two bolts through the left frame into the top's end, then the two short bolts (B) down through the top into the middle frame's posts.", kind: "bolts", tools: ["allen"] }, () => {
    bolts(left, XL, 1, [[Y.top, top]]);
    b.fits(B, [ZP, -ZP].map((z): FitOpts => ({ on: top, at: [XMC, Y.top + T / 2, z], dir: [0, -1, 0] })), 0.1);
  });
  step({ title: `Bolt the ${words[Y.s6.length]} wide shelves to the middle frame`, detail: `The wide shelves (6) at the middle frame's other cross bars: ${2 * Y.s6.length} bolts through its posts.`, kind: "bolts", tools: ["allen"] }, () => {
    put(s6, [200, 0, 0]);
    bolts(middle, XM[0], 1, at6);
  });
  step({ title: "Bolt on the right frame", detail: `The right frame (3) over the ends of the bottom, the ${words[Y.s6.length]} wide shelves and the top: ${2 * (Y.s6.length + 2)} bolts.`, kind: "bolts", tools: ["allen"], people: 2 }, () => {
    put([right], [200, 0, 0]);
    bolts(right, XR, -1, [[Y.bottom, bottom], ...at6, [Y.top, top]]);
  });
  step({ title: "Screw the anti-tip bracket to the top", detail: "On the back rail of the top, in the middle, with the third short bolt (B). Tighten it to about 80%: fully once it is against the wall.", kind: "screws", tools: ["allen"] }, () => {
    b.fit(C, { on: top, at: [0, Y.top, -149], dir: [0, 0, 1], travel: 60, wall: true });
    b.then(0.1);
    b.fit(B, { on: top, at: [0, Y.top, -151], dir: [0, 0, 1], wall: true });
  });

  /* ---------- standing ---------- */
  step({ title: "Stand it up and level it", detail: "Two of you: tip it up onto its feet. Lay a spirit level on the top and turn the feet under the posts until it stands level and doesn't rock.", kind: "standup", tools: ["level"], pose: "+y", people: 2, warnings: ["two"] });
  step({ title: "Fix it to the wall", detail: "Push it against the wall, mark through the bracket, drill, plug and screw it to the wall, then tighten the bracket's bolt fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer", "allen"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fit(HW.plug, { at: [0, Y.h + 10, -175], dir: [0, 0, -1] });
    b.then(0.05);
    b.fit(HW.wallScrew, { at: [0, Y.h + 10, -173], dir: [0, 0, -1] });
  });
  step({ title: "Keep to the weight limits", detail: "5 kg on each shelf and on the top.", kind: "general", pose: "+y" });
}

/* ---------------- the hallway unit ---------------- */

function hallway(b: PlanBuilder) {
  const W = 900, H = 1780, DEP = 400, BD = 398, LOW = 95, NARROW = 254;
  const XS = W / 2 - T / 2, XM = XS - T / 2 - NARROW - T / 2; // the side frames' and the middle frame's centres
  const bottom = LOW + T, middle = bottom + 330 + T; // the bottom and middle shelves' tops
  const smalls = [middle + 330 + T, middle + 2 * (330 + T)]; // the two small shelves' tops
  const PZ = DEP / 2 - T / 2;

  const f2 = b.compound("Side frame", tubeFrame(H, DEP, T, [bottom, middle, H]), { material: "metal", label: "2" });
  const f3 = b.compound("Side frame", tubeFrame(H, DEP, T, [bottom, middle, ...smalls, H]), { material: "metal", label: "3" });
  const left = b.place(f2.type, [f2.mid[0] - XS, f2.mid[1], f2.mid[2]]);
  const right = b.place(f3.type, [f3.mid[0] + XS, f3.mid[1], f3.mid[2]]);
  const f5 = b.compound("Middle frame", tubeFrame(H - T, DEP, T, [middle + T, ...smalls, H - T], middle), { material: "metal", label: "5" });
  const mid = b.place(f5.type, [f5.mid[0] + XM, f5.mid[1], f5.mid[2]]);

  const full = W - 2 * T;
  const top = b.place(b.part("Top shelf", [full, T, BD], { label: "1" }), [0, H - T / 2, 0]);
  const p7 = b.part("Shelf", [full, T, BD], { label: "7" });
  const mshelf = b.place(p7, [0, middle - T / 2, 0]);
  const low = b.place(p7, [0, bottom - T / 2, 0]);
  const p6 = b.part("Small shelf", [NARROW, T, BD], { label: "6" });
  const small = smalls.map((y) => b.place(p6, [(XM + XS) / 2, y - T / 2, 0]));

  const RAIL_X = XM - T / 2 - 20; // the hanging rail runs under the top on the left, from frame 2 almost to the middle frame
  const drop = 80;
  const railT = b.compound(
    "Hanging rail",
    [box([RAIL_X + XS - T / 2, T, T], [(RAIL_X - XS + T / 2) / 2, H - T - drop + T / 2, 0]), ...[-XS + T / 2 + 8, RAIL_X - 8].map((x) => box([T, drop, T], [x, H - T - drop / 2, 0]))],
    { material: "metal", label: "4" },
  );
  const rail = b.place(railT.type, railT.mid);
  const bar8 = b.part("Support bar", [T, 330, T], { material: "metal", label: "8" });
  const bars = [-PZ, PZ].map((z) => b.place(bar8, [XM, bottom + 165, z]));
  const bar9 = b.part("Foot bar", [T, 90, T], { material: "metal", label: "9" });
  const feet = [-PZ, PZ].map((z) => b.place(bar9, [XM, LOW - 45, z]));

  const through = (frame: string, x: number, g: number, board: string, y: number): FitOpts[] =>
    [-120, 120].map((z) => ({ on: frame, at: [x - (g * T) / 2, y - T / 2, z], dir: [g, 0, 0], mate: board }));
  const ends = (board: string, y: number) => [...through(left, -XS + T / 2, 1, board, y), ...through(right, XS - T / 2, -1, board, y)];

  b.step(
    {
      title: "Bolt the top shelf between the side frames",
      detail: "This builds it with the hanging rail on the left and the shelves on the right (the manual shows three other ways round). Lay the side frames (2, 3) on the floor on a rug, the top shelf (1) between their top rungs, and two bolts (A) through each rung into it: about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    () => {
      b.add(left, [-250, 0, 0]);
      b.add(right, [250, 0, 0]);
      b.then(0.12);
      b.add(top, [0, 250, 0]);
      b.then(0.12);
      b.fits(A, ends(top, H), 0.06);
    },
  );
  b.step(
    { title: "Bolt on the hanging rail", detail: "The hanging rail (4) under the top shelf on frame 2's side, a bolt (A) up through each of its ends into the shelf: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.add(rail, [0, -200, 0]);
      b.then(0.12);
      b.fits(A, [-XS + T / 2 + 8, RAIL_X - 8].map((x): FitOpts => ({ on: rail, at: [x, H - T - drop, 0], dir: [0, 1, 0], mate: top })), 0.08);
    },
  );
  b.step(
    { title: "Screw two long bolts into the middle frame", detail: "A long bolt (C) into the foot of each post of the middle frame (5), about half way: these go through the middle shelf later.", kind: "general", pose: "+z" },
    () => {
      b.add(mid, [0, -250, 0]);
      b.then(0.12);
      b.fits(LONG, [-PZ, PZ].map((z): FitOpts => ({ on: mid, at: [XM, middle - 20, z], dir: [0, 1, 0], hole: false })), 0.08);
    },
  );
  b.step(
    { title: "Bolt the middle frame to the top shelf", detail: "Stand the middle frame under the top shelf, 254 mm in from frame 3, and two bolts (A) down through the top shelf into it: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => b.fits(A, [-120, 120].map((z): FitOpts => ({ on: top, at: [XM, H, z], dir: [0, -1, 0], mate: mid })), 0.08),
  );
  b.step(
    { title: "Bolt in the two small shelves", detail: "The small shelves (6) between the middle frame and frame 3, two bolts (A) into each end: 8 in all, about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.stagger(0.1);
      small.forEach((k) => b.add(k, [0, 0, 250]));
      b.stagger(0);
      b.then(0.12);
      b.fits(A, small.flatMap((k, i) => [...through(mid, XM + T / 2, 1, k, smalls[i]), ...through(right, XS - T / 2, -1, k, smalls[i])]), 0.05);
    },
  );
  b.step(
    { title: "Bolt in the middle shelf", detail: "A long shelf (7) under the middle frame, its long bolts through the holes in it, and two bolts (A) through each side frame's rung into its ends: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.add(mshelf, [0, -250, 0]);
      b.then(0.12);
      b.fits(A, ends(mshelf, middle), 0.06);
    },
  );
  b.step({ title: "Screw long bolts into the support bars", detail: "A long bolt (C) into the top of each support bar (8), about half way.", kind: "general", pose: "+z" }, () => {
    b.add(bars[0], [0, -250, 0]);
    b.add(bars[1], [0, -250, 0]);
    b.then(0.12);
    b.fits(LONG, bars.map((k, i): FitOpts => ({ on: k, at: [XM, middle - T - 20, i ? PZ : -PZ], dir: [0, 1, 0], hole: false })), 0.08);
  });
  b.step({ title: "Screw the support bars under the middle shelf", detail: "Each bar's bolt up into the hole under the middle shelf, below the middle frame's posts, turned till the bar is tight to the shelf.", kind: "general", pose: "+z" }, () => {});
  b.step(
    { title: "Bolt in the bottom shelf", detail: "The other long shelf (7) across the frames' lowest rungs, the support bars standing on it, and two bolts (A) through each rung into its ends: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.add(low, [0, -250, 0]);
      b.then(0.12);
      b.fits(A, ends(low, bottom), 0.06);
    },
  );
  b.step({ title: "Tighten every bolt", detail: "Tighten all the bolts the whole way with the allen key (E).", kind: "bolts", tools: ["allen"], pose: "+z" }, () => {});
  b.step({ title: "Fit the foot bars", detail: "The two short foot bars (9) under the bottom shelf, in line with the support bars above it, screwed in till tight.", kind: "legs", pose: "+z" }, () => {
    b.add(feet[0], [0, -150, 0]);
    b.add(feet[1], [0, -150, 0]);
  });
  b.step(
    { title: "Screw the anti-tip brackets on", detail: "A bracket (D) under the back edge of the top shelf at each side, its tab up, with a short bolt (B): about 80% tight for now.", kind: "screws", tools: ["allen"] },
    () => {
      b.fits(C, [-1, 1].map((g): FitOpts => ({ on: top, at: [g * (XS - 80), H - T, -BD / 2 + 10], dir: [0, 1, 0], travel: 60 })), 0.1);
      b.then(0.1);
      b.fits(B, [-1, 1].map((g): FitOpts => ({ on: top, at: [g * (XS - 80), H - T - 3, -BD / 2 + 25], dir: [0, 1, 0] })), 0.1);
    },
  );
  b.step({ title: "Stand it up and level it", detail: "Two of you: stand it up and turn its feet till it stands level and doesn't rock.", kind: "standup", tools: ["level"], people: 2, warnings: ["two", "square"] }, () => {});
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it back against the wall, mark through both brackets' tabs, drill, plug and screw them to the wall, then tighten the brackets' bolts fully. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      const xs = [-1, 1].map((g) => g * (XS - 80));
      b.fits({ kind: "plug", len: 35, dia: 8, notIncluded: true }, xs.map((x): FitOpts => ({ at: [x, H - T - 15, -BD / 2 - 20], dir: [0, 0, -1] })), 0.08);
      b.then(0.05);
      b.fits({ kind: "screw", len: 50, dia: 5, notIncluded: true }, xs.map((x): FitOpts => ({ at: [x, H - T - 15, -BD / 2 - 18], dir: [0, 0, -1] })), 0.08);
    },
  );
  b.step({ title: "Keep to the weight limit", detail: "5 kg on each shelf and on the hanging rail.", kind: "general" }, () => {});
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "shelf") return false;
  const w = Math.round(s.size.w), h = Math.round(s.size.h), d = Math.round(s.size.d);
  if (w === 70 && d === 30 && SIZES[h]) {
    shelving(b, SIZES[h]);
    return true;
  }
  if (w === 90 && d === 40 && h === 178) {
    hallway(b);
    return true;
  }
  return false;
}

const family: Family = { names: ["TRAPPEDAL"], build };
export default family;

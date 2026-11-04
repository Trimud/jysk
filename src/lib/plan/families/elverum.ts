import type { PartPiece, ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { box, post } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK ELVERUM hallway unit, 3 shelves 60x175x40 (3690404), read from its 18-page manual (Rev 4, 28.06.2024).
 * A low black steel bench of two side frames (1: Ø31 posts, 400 deep, a rung at each shelf) joined by six Ø15 rails
 * (2), a front and a back one under each of the three wire shoe shelves (3: 483x380). The back posts carry on up as
 * two Ø31 tubes each (4 below, 5 above) to 1750, with two 535x90 boards between the upper ones (6 lower, 7 upper)
 * for the seven hooks (8). Built: plugs (A) and caps (C) knocked into the tube ends, feet (B), shelves on their rails,
 * rails bolted between the frames (D), tightened, boards bolted between the upper tubes (E), tightened, tubes stacked
 * on the back posts, fixed to the wall (F), hooks on.
 */

const A: HwDef = { kind: "cap", len: 15, dia: 31, name: "Threaded plug" }; // Ø31x15, for the feet
const B: HwDef = { kind: "foot", len: 35, dia: 37.5, name: "Foot" }; // Ø37.5x35
const C: HwDef = { kind: "cap", len: 15, dia: 32, name: "End cap" }; // Ø32x15
const D: HwDef = { kind: "bolt", len: 45, dia: 6 }; // M6x45
const E: HwDef = { kind: "bolt", len: 50, dia: 6.3, name: "Connector bolt" }; // 6.3x50
const F: HwDef = { kind: "spacer", len: 27.5, dia: 15, name: "Wall fitting" }; // Ø15x27.5
const H: HwDef = { kind: "hook", len: 70, dia: 37, name: "Hook" }; // 70x37x20

const W = 600, DEP = 400, P = 31, R = 15, FOOT = 35, TUBE = 600, BW = 535, BH = 90, BT = 15;
const X0 = W / 2 - P / 2, Z0 = DEP / 2 - P / 2; // the posts' centres
const LEVELS = [90, 250, 410]; // the shelves' tops: 90, then 160 apart
const TOP = FOOT + 450; // the side frames' posts stop here; the back ones carry on in tubes 4 and 5
const BOARDS = [FOOT + 2 * TUBE + 450 - 345, FOOT + 2 * TUBE + 450 - 45]; // the two boards' middles, 300 apart

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 60 || Math.round(s.size.d) !== 40 || Math.round(s.size.h) !== 175) return false;

  /* ---------- parts ---------- */

  const frameT = b.compound(
    "Side frame",
    [post(0, -Z0, FOOT, TOP, P), post(0, Z0, FOOT, TOP, P), ...LEVELS.map((y): PartPiece => ({ shape: "cyl", size: [R, DEP - P, R], pos: [0, y - 25, 0], rot: [Math.PI / 2, 0, 0] }))],
    { material: "metal", label: "1" },
  );
  const sides = [-1, 1].map((g) => b.place(frameT.type, [frameT.mid[0] + g * X0, frameT.mid[1], frameT.mid[2]]));

  const railT = b.compound("Rail", [{ shape: "cyl", size: [R, BW, R], pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] }], { material: "metal", label: "2" });
  const RZ = Z0; // the rails meet the posts
  const rails = LEVELS.flatMap((y) => [-RZ, RZ].map((z) => b.place(railT.type, [0, y - R / 2, z])));

  const grid: PartPiece[] = [
    ...Array.from({ length: 8 }, (_, i) => box([483, 4, 4], [0, 0, -190 + ((i + 0.5) * 380) / 8])),
    ...[-1, 0, 1].map((g) => box([4, 6, 380], [g * 160, -2, 0])),
  ];
  const shT = b.compound("Wire shelf", grid, { material: "metal", label: "3" });
  const shelves = LEVELS.map((y) => b.place(shT.type, [0, y - 2, 0]));

  const t4 = b.compound("Post extension", [post(0, 0, 0, TUBE, P)], { material: "metal", label: "4" });
  const t5 = b.compound("Upper post", [post(0, 0, 0, TUBE, P)], { material: "metal", label: "5" });
  const lows = [-1, 1].map((g) => b.place(t4.type, [g * X0, TOP + TUBE / 2, -Z0]));
  const ups = [-1, 1].map((g) => b.place(t5.type, [g * X0, TOP + TUBE + TUBE / 2, -Z0]));
  const board6 = b.part("Hook board", [BW, BH, BT], { material: "board", label: "6" });
  const board7 = b.part("Top board", [BW, BH, BT], { material: "board", label: "7" });
  const boards = [b.place(board6, [0, BOARDS[0], -Z0]), b.place(board7, [0, BOARDS[1], -Z0])];

  /* ---------- fittings ---------- */

  const postsAt = [-1, 1].flatMap((g) => [-Z0, Z0].map((z) => [g * X0, z, g < 0 ? 0 : 1] as const));
  const dBolts = rails.flatMap((rk, i) =>
    [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [g * (X0 + P / 2), LEVELS[i >> 1] - R / 2, i % 2 ? RZ : -RZ], dir: [-g, 0, 0], mate: rk })),
  );
  const eBolts = boards.flatMap((bk, j) =>
    [-1, 1].flatMap((g) => [-20, 20].map((dy): FitOpts => ({ on: ups[g < 0 ? 0 : 1], at: [g * (X0 + P / 2), BOARDS[j] + dy, -Z0], dir: [-g, 0, 0], mate: bk }))),
  );

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Knock in the plugs and caps",
      detail: "With a rubber mallet: a threaded plug (A) into the bottom of each side frame post (1), and an end cap (C) into the top of both front posts and of both upper posts (5).",
      kind: "general",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], [-250, 0, 0]);
      b.add(sides[1], [250, 0, 0]);
      b.then(0.12);
      b.fits(A, postsAt.map(([x, z, k]): FitOpts => ({ on: sides[k], at: [x, FOOT, z], dir: [0, 1, 0], hole: false })), 0.06);
      b.then(0.08);
      b.fits(C, [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [g * X0, TOP, Z0], dir: [0, -1, 0], hole: false })), 0.06);
    },
  );
  b.step({ title: "Screw the feet in", detail: "A foot (B) into each plug, by hand.", kind: "legs" }, () =>
    b.fits(B, postsAt.map(([x, z, k]): FitOpts => ({ on: sides[k], at: [x, FOOT - 2, z], dir: [0, 1, 0], hole: false, spin: 2 })), 0.06),
  );
  b.step(
    { title: "Put each shelf on its rails", detail: "Lay each wire shelf (3) on two rails (2), one along the front edge and one along the back, its wires hooked over them: three shelves, six rails.", kind: "shelves" },
    () => {
      b.stagger(0.08);
      rails.forEach((k) => b.add(k, [0, 0, 300]));
      b.then(0.1);
      shelves.forEach((k) => b.add(k, [0, 0, 300]));
      b.stagger(0);
    },
  );
  b.step(
    {
      title: "Bolt the rails between the side frames",
      detail: "Hold the shelves between the side frames (1), the posts with the extra holes at the back. A bolt (D) through the post into each rail end, with the allen key (G): 12 in all, about 80% tight. Don't cross-thread them.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => b.fits(D, dBolts, 0.04),
  );
  b.step({ title: "Tighten the bench", detail: "Stand it on its feet so it doesn't rock, then tighten all 12 bolts the whole way.", kind: "bolts", tools: ["allen"], warnings: ["square"] }, () => {});
  b.step(
    {
      title: "Bolt the hook boards between the upper posts",
      detail: "Lay the two upper posts (5) down, caps at the top, and the boards between them: the plain one (6) lower, the one with the wall holes (7) at the top, 300 mm apart. Two connector bolts (E) through each post into each board end: 8 in all, about 80% tight. Screw them in straight.",
      kind: "bolts",
      tools: ["allen"],
      warnings: ["floor"],
    },
    () => {
      ups.forEach((k, i) => b.add(k, [(i ? 1 : -1) * 250, 0, 0]));
      b.then(0.12);
      boards.forEach((k) => b.add(k, [0, 0, 250]));
      b.then(0.12);
      b.fits(E, eBolts, 0.05);
      b.then(0.05);
      b.fits(C, ups.map((k, i): FitOpts => ({ on: k, at: [(i ? 1 : -1) * X0, TOP + 2 * TUBE, -Z0], dir: [0, -1, 0], hole: false })), 0.06);
    },
  );
  b.step({ title: "Tighten the hook boards", detail: "Tighten all 8 bolts the whole way.", kind: "bolts", tools: ["allen"] }, () => {});
  b.step(
    {
      title: "Build the back up",
      detail: "Screw a post extension (4) onto each back post of the bench, then the hook board frame onto those, turning each tube till it meets the one below with no gap and the boards face front.",
      kind: "general",
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.stagger(0.1);
      lows.forEach((k) => b.add(k, [0, 300, 0], { spin: 2 }));
      b.stagger(0);
    },
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it back against the wall, mark through the two holes in the top board (7), drill, plug and screw it to the wall with a wall fitting (F) behind each hole. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => b.fits(F, [-1, 1].map((g): FitOpts => ({ at: [g * 200, BOARDS[1], -Z0 - BT / 2 - 14], dir: [0, 0, -1], wall: true })), 0.1),
  );
  b.step({ title: "Hang the hooks on", detail: "Hook the seven hooks (8) over the top edge of the boards: four on the top board, three on the lower one.", kind: "general" }, () =>
    b.fits(
      H,
      [...[-1.5, -0.5, 0.5, 1.5].map((k) => [k * 120, 1] as const), ...[-1, 0, 1].map((k) => [k * 140, 0] as const)].map(
        ([x, j]): FitOpts => ({ on: boards[j], at: [x, BOARDS[j] + 15, -Z0 + BT / 2], dir: [0, 0, -1], hole: false }),
      ),
      0.06,
    ),
  );
  b.step({ title: "Keep to the weight limits", detail: "5 kg on each shoe shelf and 3 kg on each hook.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["ELVERUM"], build };
export default family;

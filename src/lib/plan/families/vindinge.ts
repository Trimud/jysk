import type { PartPiece, ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { box, post } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK VINDINGE shelving unit, 6 shelves 90x180x36 (3605020), read from its 26-page manual (Rev 4, 28.10.2025).
 * Chrome wire shelving: six wire shelves (1: 902x345x32) on four Ø19 poles, each pole two 888 mm lengths (2 below,
 * 3 above) screwed together on a threaded connector (B). Each shelf's corner collars slide down over the poles onto a
 * pair of plastic split sleeves (A) clipped round the pole at a groove: 8 sleeves a shelf, 48 in all. Steps 1 to 6 build
 * the lower three shelves; step 7 (p9) then offers A: one tall unit (pp. 10 to 14: connectors B, the upper poles, three
 * more shelves, caps D, knocked tight, two wall clips) or B: two low units side by side (pp. 15 to 20: the third shelf,
 * caps D on the lower poles, the upper poles stood on their own feet C in foot sleeves E, three shelves on them, caps D,
 * knocked tight, four wall clips).
 */

const A: HwDef = { kind: "clip", len: 32, dia: 23, name: "Split sleeve", form: "sleeve" }; // 32x23x16, a pair round each pole
const B: HwDef = { kind: "rod", len: 21, dia: 18, name: "Pole connector" }; // Ø18x21, a headless threaded sleeve (p10)
const C: HwDef = { kind: "foot", len: 14, dia: 19, name: "Levelling foot" }; // M6/Ø19x32 overall: a short base under its stud (p6)
const D: HwDef = { kind: "cap", len: 3, dia: 19, name: "Pole cap" }; // Ø19x16/3
const F: HwDef = { kind: "clamp", len: 63, dia: 23, name: "Wall clip, short", form: "omega" }; // F, 63x23x12: round a back pole, its ears on the wall
const G: HwDef = { kind: "clamp", len: 63, dia: 40, name: "Wall clip, long", form: "omega" }; // G, 63x40x12: F's deeper twin, for 10 to 20 mm off the wall
const E: HwDef = { kind: "rod", len: 11, dia: 19, name: "Foot sleeve" }; // Ø19x11 (p16): screwed into an upper pole's threaded end, a foot (C) into it
// every fitting at the legend's count (p8): each build leaves some in the box (the tall one 4 feet, 4 caps, the foot
// sleeves and 2 of each wall clip; the low ones the connectors), so both list the same box
const BOX: [HwDef, number][] = [[A, 48], [B, 4], [C, 8], [D, 8], [E, 4], [F, 4], [G, 4]];

const LAYOUTS = [
  { id: "A", label: "One tall unit, six shelves" },
  { id: "B", label: "Two low units, three shelves each" },
];

const W = 902, DEP = 345, ST = 32, P = 19, PL = 888, FOOT = 19;
const PX = W / 2 - 16, PZ = 350 / 2 - 16; // the poles' centres
// each shelf's top, bottom up. The poles' grooves are 25 mm apart, the first 19 mm below the top (p6): the second
// shelf's sleeves at groove 17 down from the lower pole's top (p7), the third's and the top one's just under their
// pole's end, the end standing about 12 mm above the sleeves and the collar about 5 mm short of it (p8 step 6 and p12
// step 13 insets, p13), and the fourth and fifth evenly between
const LEVELS = [60, 508, FOOT + PL - 8, 1202, 1495, FOOT + 2 * PL - 8];
// the low build's second unit, to the right of the first, 30 mm apart (a guess: p19 draws them nearly touching); its
// shelves at the first's levels (pp. 16, 17: sleeves at the bottom, at groove 17 from the top, and at the top)
const DX = W + 30;

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 90 || Math.round(s.size.d) !== 36 || Math.round(s.size.h) !== 180) return false;
  const corners = [-1, 1].flatMap((gx) => [-1, 1].map((gz) => [gx * PX, gz * PZ] as const));
  const tall = b.pick(LAYOUTS) === "A";
  const dx = tall ? 0 : DX; // the upper poles' and top three shelves' x
  const level = (i: number) => (tall || i < 3 ? LEVELS[i] : LEVELS[i - 3]);

  /* ---------- parts ---------- */

  // the wire shelf (p17, p21): a rim of two wires with a zigzag between them on every side, 12 wires along its width on
  // top, 4 supports front to back under them splitting it in 5 bays, and a collar at each corner
  const RX = W / 2 - 18, RZ = DEP / 2 - 2, RY = ST / 2 - 2;
  /** n zigzag strokes between the rim's two wires, along x (or z) over `len`, at the side's other coordinate `at` */
  const zigzag = (alongX: boolean, len: number, at: number, n: number): PartPiece[] => {
    const dx = len / n, a = Math.atan2(2 * RY, dx), l = Math.hypot(dx, 2 * RY);
    return Array.from({ length: n }, (_, i): PartPiece => {
      const u = -len / 2 + (i + 0.5) * dx, t = (i % 2 ? -1 : 1) * a;
      return alongX ? { shape: "box", size: [l, 2, 2], pos: [u, 0, at], rot: [0, 0, t] } : { shape: "box", size: [2, 2, l], pos: [at, 0, u], rot: [t, 0, 0] };
    });
  };
  const wires: PartPiece[] = [
    ...[-1, 1].flatMap((g) => [...[-1, 1].map((h) => box([2 * RX, 4, 4], [0, h * RY, g * RZ])), ...zigzag(true, 2 * RX - 30, g * RZ, 18)]),
    ...[-1, 1].flatMap((g) => [...[-1, 1].map((h) => box([4, 4, DEP - 40], [g * RX, h * RY, 0])), ...zigzag(false, DEP - 60, g * RX, 6)]),
    ...Array.from({ length: 12 }, (_, i) => box([2 * RX, 3, 3], [0, ST / 2 - 2, -140 + (i * 280) / 11])),
    ...Array.from({ length: 4 }, (_, i) => box([3, 3, DEP - 8], [-W / 2 + ((i + 1) * W) / 5, ST / 2 - 5, 0])),
    ...corners.map(([x, z]): PartPiece => ({ shape: "cyl", size: [30, ST + 6, 30], pos: [x, 0, z] })),
  ];
  const sh = b.compound("Wire shelf", wires, { material: "metal", label: "1" });
  const shelves = LEVELS.map((_, i) => b.place(sh.type, [i < 3 ? 0 : dx, level(i) - ST / 2, 0]));

  const lowT = b.compound("Lower pole", [post(0, 0, 0, PL, P)], { material: "metal", label: "2" });
  const upT = b.compound("Upper pole", [post(0, 0, 0, PL, P)], { material: "metal", label: "3" });
  const lows = corners.map(([x, z]) => b.place(lowT.type, [x, FOOT + PL / 2, z]));
  const ups = corners.map(([x, z]) => b.place(upT.type, [x + dx, (tall ? FOOT + PL : FOOT) + PL / 2, z]));

  /* ---------- fittings ---------- */

  // a pair of sleeves round each pole, just under the shelf's collar: each half drawn from the pole's axis (so sunk),
  // turned so its wider end is down
  // shelf i's: on the lower poles under the first three, the upper ones under the rest
  const sleeves = (i: number): FitOpts[] => {
    const y = level(i) - ST / 2 - 4, [poles, ox] = i < 3 ? [lows, 0] : [ups, dx]; // y: the pair's middle
    return corners.flatMap(([x, z], k) =>
      [-1, 1].map((g): FitOpts => ({ on: poles[k], at: [x + ox, y, z], dir: [-g, 0, 0], twist: g < 0 ? Math.PI : 0, hole: false, travel: 30, sunk: true })),
    );
  };
  /** a cap (D) on the top of each of these poles, at x offset ox */
  const caps = (poles: string[], ox: number) =>
    b.fits(D, poles.map((k, i): FitOpts => ({ on: k, at: [corners[i][0] + ox, FOOT + PL + 3 + (poles === ups && tall ? PL : 0), corners[i][1]], dir: [0, -1, 0], hole: false })), 0.08);
  const slide = (i: number) => b.add(shelves[i], [0, 500, 0]);
  const clipAndSlide = (i: number) => {
    b.fits(A, sleeves(i), 0.03);
    b.then(0.15);
    slide(i);
  };
  const SLEEVE = "Snap a pair of split sleeves (A) round each pole at the groove";
  const LIP = "the wider end down, the lip on the inside, squeezed till they click";
  const UP = "the right way up, the slot in each corner collar at the bottom"; // p7 warning box

  /* ---------- steps ---------- */

  b.step(
    { title: "Screw the feet into the lower poles", detail: "A levelling foot (C) into the threaded end of each of the four lower poles (2): the end you see a thread inside is the bottom, not the plain open end.", kind: "legs" },
    () => {
      b.stagger(0.08);
      lows.forEach((k) => b.add(k, [0, 200, 0]));
      b.stagger(0);
      b.then(0.12);
      // its base on the floor, a little of its stud showing under the pole
      b.fits(C, corners.map(([x, z], i): FitOpts => ({ on: lows[i], at: [x, FOOT - 5, z], dir: [0, 1, 0], hole: false })), 0.06);
    },
  );
  b.step({ title: "Clip on the sleeves for the bottom shelf", detail: `${SLEEVE} just above the feet, ${LIP}: 8 sleeves. Every pole at the same groove, or the shelf won't sit level.`, kind: "shelves" }, () =>
    b.fits(A, sleeves(0), 0.03),
  );
  b.step({ title: "Slide on the bottom shelf", detail: `Stand the four poles up and lower a shelf (1) over them, ${UP}, its corner collars round the poles, down onto the sleeves.`, kind: "shelves" }, () => slide(0));
  b.step({ title: "Clip on the sleeves for the second shelf", detail: `${SLEEVE} 17 grooves down from the top of each lower pole, ${LIP}: 8 more.`, kind: "shelves" }, () => b.fits(A, sleeves(1), 0.03));
  b.step({ title: "Slide on the second shelf", detail: `Lower the next shelf (1) over the poles, ${UP}, onto the sleeves.`, kind: "shelves" }, () => slide(1));
  b.step({ title: "Clip on the sleeves for the third shelf", detail: `${SLEEVE} right at the top of each lower pole, just under its threaded end, ${LIP}: 8 more. Leave the shelf off for now.`, kind: "shelves" }, () => b.fits(A, sleeves(2), 0.03));
  const WALL = "Push it against the wall and mark through each clip. Move it away, drill and plug the holes, then push it back and screw each clip to the wall. Wall plugs and screws aren't included: pick ones made for your wall.";
  const wallStep = (n: string, detail: string, at: [string, number][], y: number) =>
    b.step(
      { title: "Fix it to the wall", detail: `${n} wall clips round the back poles near the top${detail}: the short ones (F) if it stands right against the wall, the long ones (G) if it stands 10 to 20 mm off it. ${WALL}`, kind: "anchor", tools: ["drill", "pencil", "screwdriver", "hammer"], wall: true, warnings: ["wall", "tip"] },
      // centred on each back pole, the loop round its front, the ears flat on the wall behind it
      () => b.fits(F, at.map(([k, x]): FitOpts => ({ on: k, at: [x, y, -PZ], dir: [0, 0, -1], hole: false, wall: true })), 0.1),
    );
  const knock = () =>
    b.step({ title: "Knock every shelf down tight", detail: "With a rubber mallet, or a hammer on a block of wood, tap down on each shelf corner right by the pole, so the collars lock onto the sleeves.", kind: "square", tools: ["hammer"] }, () => {});

  b.layouts(LAYOUTS);
  b.step(
    {
      title: "Choose: one tall unit or two low ones",
      detail: "The manual gives two ways to build it: pick one. A: one tall unit, the upper poles screwed onto the lower ones and three more shelves above. B: two low units of three shelves side by side, the upper poles standing on their own feet. Either way, some fittings stay in the box.",
      kind: "general",
    },
    () => b.ghost([...ups, ...shelves.slice(3)]),
  );
  if (tall) {
    b.step(
      { title: "Screw the pole connectors in", detail: "A connector (B) into the top of each lower pole, by hand till it stops.", kind: "general" },
      // half of it into the lower pole, half standing up for the upper one
      () => b.fits(B, lows.map((k, i): FitOpts => ({ on: k, at: [corners[i][0], FOOT + PL, corners[i][1]], dir: [0, -1, 0], hole: false, spin: 2 })), 0.08),
    );
    b.step({ title: "Screw the upper poles on", detail: "An upper pole (3) onto each connector, its threaded end down: look into the end first, you should see a thread, not a plain empty ring. Turn it by hand till it meets the lower pole with no gap.", kind: "general" }, () => {
      b.stagger(0.08);
      ups.forEach((k) => b.add(k, [0, 300, 0], { spin: 2 }));
      b.stagger(0);
    });
    b.step({ title: "Slide on the third shelf", detail: `Lower a shelf (1) over the full poles, ${UP}, down onto the sleeves you clipped on earlier.`, kind: "shelves" }, () => slide(2));
    b.step({ title: "Fourth shelf: sleeves, then the shelf", detail: `${SLEEVE} for the fourth shelf, ${LIP}, then lower the shelf onto them, collar slots at the bottom.`, kind: "shelves" }, () => clipAndSlide(3));
    b.step({ title: "Fifth shelf: sleeves, then the shelf", detail: `${SLEEVE} for the fifth shelf, then the shelf, collar slots at the bottom.`, kind: "shelves" }, () => clipAndSlide(4));
    b.step({ title: "Top shelf: sleeves, then the shelf", detail: `${SLEEVE} right at the top of each upper pole, just under its end, then the last shelf, collar slots at the bottom.`, kind: "shelves" }, () => clipAndSlide(5));
    b.step({ title: "Cap the poles", detail: "Push a cap (D) onto the top of each pole. The other four caps, four feet and the foot sleeves (E) are for the two-unit build: keep them.", kind: "general" }, () => caps(ups, 0));
    knock();
    wallStep("Two", "", [[ups[0], -PX], [ups[2], PX]], LEVELS[5] - 120);
  } else {
    b.step({ title: "Slide on the third shelf", detail: `Lower a shelf (1) over the poles, ${UP}, down onto the sleeves at their tops.`, kind: "shelves" }, () => slide(2));
    b.step({ title: "Cap the first unit", detail: "Push a cap (D) onto the top of each lower pole, over its thread. The pole connectors (B) aren't used in this build: keep them.", kind: "general" }, () => caps(lows, 0));
    b.step(
      {
        title: "Feet for the second unit",
        detail: "Screw a foot sleeve (E) into the threaded end of each upper pole (3): look into the end first, you should see a thread, not a plain empty ring. Then a levelling foot (C) into each sleeve.",
        kind: "legs",
      },
      () => {
        b.stagger(0.08);
        ups.forEach((k) => b.add(k, [0, 200, 0]));
        b.stagger(0);
        b.then(0.12);
        // the sleeve half in the pole's end, half below it, the foot's stud in the sleeve as in a lower pole
        b.fits(E, corners.map(([x, z], i): FitOpts => ({ on: ups[i], at: [x + DX, FOOT, z], dir: [0, 1, 0], hole: false, spin: 2 })), 0.06);
        b.then(0.1);
        b.fits(C, corners.map(([x, z], i): FitOpts => ({ on: ups[i], at: [x + DX, FOOT - 5, z], dir: [0, 1, 0], hole: false })), 0.06);
      },
    );
    b.step({ title: "Clip on the sleeves for its bottom shelf", detail: `${SLEEVE} just above the feet, ${LIP}: 8 sleeves, every pole at the same groove.`, kind: "shelves" }, () => b.fits(A, sleeves(3), 0.03));
    b.step({ title: "Slide on its bottom shelf", detail: `Stand the four upper poles up and lower a shelf (1) over them, ${UP}, down onto the sleeves.`, kind: "shelves" }, () => slide(3));
    b.step({ title: "Its second shelf: sleeves, then the shelf", detail: `${SLEEVE} 17 grooves down from the top of each pole, ${LIP}, then lower the shelf onto them, collar slots at the bottom.`, kind: "shelves" }, () => clipAndSlide(4));
    b.step({ title: "Its top shelf: sleeves, then the shelf", detail: `${SLEEVE} right at the top of each pole, just under its end, then the last shelf, collar slots at the bottom.`, kind: "shelves" }, () => clipAndSlide(5));
    b.step({ title: "Cap the second unit", detail: "Push a cap (D) onto the top of each upper pole.", kind: "general" }, () => caps(ups, DX));
    knock();
    wallStep("Four", ", two on each unit", [[lows[0], -PX], [lows[2], PX], [ups[0], DX - PX], [ups[2], DX + PX]], LEVELS[2] - 120);
  }
  b.step({ title: "Keep to the weight limit", detail: "10 kg on each shelf, spread out.", kind: "general" }, () => {});
  // ponytail: the fittings a build leaves in the box listed by setting their count by hand, as the builder has no spare
  // fitting (build() only counts up from it)
  for (const [d, n] of BOX) {
    const id = b.hwType(d);
    b.hw.get(id)!.qty = n - b.items.filter((it) => it.kind === "hw" && it.ref === id).length;
  }
  return true;
}

const family: Family = { names: ["VINDINGE"], build };
export default family;

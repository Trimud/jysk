import type { PartPiece, ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { box, post } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK VINDINGE shelving unit, 6 shelves 90x180x36 (3605020), read from its 26-page manual (Rev 4, 28.10.2025).
 * Chrome wire shelving: six wire shelves (1: 902x345x32) on four Ø19 poles, each pole two 888 mm lengths (2 below,
 * 3 above) screwed together on a threaded connector (B). Each shelf's corner collars slide down over the poles onto a
 * pair of plastic split sleeves (A) clipped round the pole at a groove: 8 sleeves a shelf, 48 in all. The manual also
 * builds it as two 3-shelf units side by side (its B steps, with the E foot sleeves); this is the tall build, its A
 * steps: feet (C), the three lower shelves, the poles joined, the three upper shelves, caps (D), knocked tight, the wall.
 */

const A: HwDef = { kind: "clip", len: 32, dia: 23, name: "Split sleeve" }; // 32x23x16, a pair round each pole
const B: HwDef = { kind: "stud", len: 21, dia: 18, name: "Pole connector" }; // Ø18x21
const C: HwDef = { kind: "foot", len: 32, dia: 19, name: "Levelling foot" }; // M6/Ø19x32
const D: HwDef = { kind: "cap", len: 3, dia: 19, name: "Pole cap" }; // Ø19x16/3
const F: HwDef = { kind: "clamp", len: 63, dia: 23, name: "Wall clip" }; // 63x23x12, standing against the wall

const W = 902, DEP = 345, ST = 32, P = 19, PL = 888, FOOT = 19;
const PX = W / 2 - 16, PZ = 350 / 2 - 16; // the poles' centres
const LEVELS = [60, 400, 740, 1080, 1420, 1765]; // each shelf's top, bottom up

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 90 || Math.round(s.size.d) !== 36 || Math.round(s.size.h) !== 180) return false;
  const corners = [-1, 1].flatMap((gx) => [-1, 1].map((gz) => [gx * PX, gz * PZ] as const));

  /* ---------- parts ---------- */

  // the wire shelf: a rim, wires both ways, and a collar at each corner
  const wires: PartPiece[] = [
    ...[-1, 1].map((g) => box([W - 40, ST, 4], [0, 0, g * (DEP / 2 - 2)])),
    ...[-1, 1].map((g) => box([4, ST, DEP - 40], [g * (W / 2 - 18), 0, 0])),
    ...Array.from({ length: 13 }, (_, i) => box([3, 3, DEP - 8], [-W / 2 + 18 + ((i + 0.5) * (W - 36)) / 13, ST / 2 - 2, 0])),
    ...Array.from({ length: 5 }, (_, i) => box([W - 36, 3, 3], [0, ST / 2 - 5, -DEP / 2 + ((i + 1) * DEP) / 6])),
    ...corners.map(([x, z]): PartPiece => ({ shape: "cyl", size: [30, ST + 6, 30], pos: [x, 0, z] })),
  ];
  const sh = b.compound("Wire shelf", wires, { material: "metal", label: "1" });
  const shelves = LEVELS.map((y) => b.place(sh.type, [0, y - ST / 2, 0]));

  const lowT = b.compound("Lower pole", [post(0, 0, 0, PL, P)], { material: "metal", label: "2" });
  const upT = b.compound("Upper pole", [post(0, 0, 0, PL, P)], { material: "metal", label: "3" });
  const lows = corners.map(([x, z]) => b.place(lowT.type, [x, FOOT + PL / 2, z]));
  const ups = corners.map(([x, z]) => b.place(upT.type, [x, FOOT + PL + PL / 2, z]));

  /* ---------- fittings ---------- */

  // a pair of sleeves round each pole, just under the shelf's collar
  const sleeves = (y: number): FitOpts[] =>
    corners.flatMap(([x, z]) => [-1, 1].map((g): FitOpts => ({ at: [x + g * 12, y - ST / 2 - 4, z], dir: [-g, 0, 0], hole: false, travel: 30 })));
  const slide = (i: number) => b.add(shelves[i], [0, 500, 0]);
  const clipAndSlide = (i: number) => {
    b.fits(A, sleeves(LEVELS[i]), 0.03);
    b.then(0.15);
    slide(i);
  };
  const SLEEVE = "Snap a pair of split sleeves (A) round each pole at the groove";
  const LIP = "the wider end down, the lip on the inside, squeezed till they click";

  /* ---------- steps ---------- */

  b.step(
    { title: "Screw the feet into the lower poles", detail: "A levelling foot (C) into the bottom of each of the four lower poles (2): the poles' plain end is the bottom.", kind: "legs", warnings: ["floor"] },
    () => {
      b.stagger(0.08);
      lows.forEach((k) => b.add(k, [0, 200, 0]));
      b.stagger(0);
      b.then(0.12);
      b.fits(C, corners.map(([x, z], i): FitOpts => ({ on: lows[i], at: [x, FOOT, z], dir: [0, 1, 0], hole: false })), 0.06);
    },
  );
  b.step({ title: "Clip on the sleeves for the bottom shelf", detail: `${SLEEVE} just above the feet, ${LIP}: 8 sleeves. Every pole at the same groove, or the shelf won't sit level.`, kind: "shelves" }, () =>
    b.fits(A, sleeves(LEVELS[0]), 0.03),
  );
  b.step({ title: "Slide on the bottom shelf", detail: "Stand the four poles up and lower a shelf (1) over them, its corner collars round the poles, down onto the sleeves.", kind: "shelves", people: 2, warnings: ["two"] }, () => slide(0));
  b.step({ title: "Clip on the sleeves for the second shelf", detail: `${SLEEVE} about a third of the way up, ${LIP}: 8 more.`, kind: "shelves" }, () => b.fits(A, sleeves(LEVELS[1]), 0.03));
  b.step({ title: "Slide on the second shelf", detail: "Lower the next shelf (1) over the poles onto the sleeves.", kind: "shelves", people: 2 }, () => slide(1));
  b.step({ title: "Clip on the sleeves for the third shelf", detail: `${SLEEVE} near the top of the lower poles, ${LIP}: 8 more. Leave the shelf off for now.`, kind: "shelves" }, () => b.fits(A, sleeves(LEVELS[2]), 0.03));
  b.step(
    {
      title: "Screw the pole connectors in",
      detail: "This is the tall unit. (Built as two low units side by side instead, it takes the manual's other steps, with the foot sleeves E.) A connector (B) into the top of each lower pole, by hand till it stops.",
      kind: "general",
    },
    () => b.fits(B, lows.map((k, i): FitOpts => ({ on: k, at: [corners[i][0], FOOT + PL + 10, corners[i][1]], dir: [0, -1, 0], hole: false })), 0.08),
  );
  b.step({ title: "Screw the upper poles on", detail: "An upper pole (3) onto each connector, turned by hand till it meets the lower pole with no gap.", kind: "general" }, () => {
    b.stagger(0.08);
    ups.forEach((k) => b.add(k, [0, 300, 0], { spin: 2 }));
    b.stagger(0);
  });
  b.step({ title: "Slide on the third shelf", detail: "Lower a shelf (1) over the full poles, down onto the sleeves you clipped on earlier.", kind: "shelves", people: 2, warnings: ["two"] }, () => slide(2));
  b.step({ title: "Fourth shelf: sleeves, then the shelf", detail: `${SLEEVE} for the fourth shelf, ${LIP}, then lower the shelf onto them.`, kind: "shelves", people: 2 }, () => clipAndSlide(3));
  b.step({ title: "Fifth shelf: sleeves, then the shelf", detail: `${SLEEVE} for the fifth shelf, then the shelf.`, kind: "shelves", people: 2 }, () => clipAndSlide(4));
  b.step({ title: "Top shelf: sleeves, then the shelf", detail: `${SLEEVE} near the top of the poles, then the last shelf.`, kind: "shelves", people: 2 }, () => clipAndSlide(5));
  b.step({ title: "Cap the poles", detail: "Push a cap (D) onto the top of each pole.", kind: "general" }, () =>
    b.fits(D, ups.map((k, i): FitOpts => ({ on: k, at: [corners[i][0], FOOT + 2 * PL + 3, corners[i][1]], dir: [0, -1, 0], hole: false })), 0.08),
  );
  b.step(
    {
      title: "Knock every shelf down tight",
      detail: "With a rubber mallet, or a hammer on a block of wood, tap down on each shelf corner right by the pole, so the collars lock onto the sleeves. Then turn the feet till it stands level.",
      kind: "square",
      tools: ["hammer", "level"],
      warnings: ["square"],
    },
    () => {},
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Two wall clips round the back poles near the top: the short ones (F) if it stands right against the wall, the long ones (G) if it stands 10 to 20 mm off it. Mark, drill, plug and screw each to the wall. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => b.fits(F, [-1, 1].map((g): FitOpts => ({ at: [g * PX, LEVELS[5] - 120, -PZ - 20], dir: [0, 0, 1], wall: true })), 0.1),
  );
  b.step({ title: "Keep to the weight limit", detail: "10 kg on each shelf, spread out.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["VINDINGE"], build };
export default family;

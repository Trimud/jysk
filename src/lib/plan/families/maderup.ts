import type { PartPiece, ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * MADERUP garden table W90xL150 (JYSK 3700214), read from its 17-page manual (Rev 8, 30.04.2024).
 * A black aluminium frame of four flat welded frames: two end frames (1, 4: 890x740x23, two legs and a top rail) and
 * two side frames (2: 1450x725x23) standing just inside them, plus the top (3: 1450x890x60), four composite slats on
 * metal cross bars. Built upright: the side frames bolt into the end frames (A, from inside the side legs); then upside
 * down the top is screwed to the side frames (C) and the end frames (B), everything tightened, the bolt heads capped
 * (E), and it is turned over and levelled on its feet. Part numbers are the manual's; sizes in mm are its parts page.
 */

// fittings as the manual lists them on page 12 (F, the T25 key, is the "allen" tool here)
const A: HwDef = { kind: "bolt", len: 60, dia: 6, name: "Torx bolt" }; // M6x60
const B: HwDef = { kind: "bolt", len: 25, dia: 6, name: "Torx bolt" }; // M6x25
const C: HwDef = { kind: "bolt", len: 20, dia: 6, name: "Torx bolt" }; // M6x20
const D: HwDef = { kind: "washer", len: 1.5, dia: 14 }; // 6/14
const E: HwDef = { kind: "cap", len: 2, dia: 16 };

// x along the table (1500), y up from the floor, z across (890); the frame tube is 23 thick
const T = 23;
const XE = 750 - T / 2; // end frames' centre plane (their outer faces at ±750)
const XS = 725; // side frames' and the top's ends (1450 long, 2 mm inside the end frames)
const ZS = 445 - T / 2; // side frames' centre plane (outer faces flush with the top's edges, ±445)
const g2 = [-1, 1];
const YA = [150, 550]; // A bolt heights, where the end frames' holes are on the parts page
const XB = [-450, 0, 450]; // the top's cross bars, under the side frames' screw holes
const ZB = [-300, 0, 300]; // B screws through each end frame's top rail
const YC = 692, YB = 705; // C screws through the cross bars' end tabs, B through the end plates

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "table" || s.size.w !== 150 || s.size.h !== 74 || s.size.d !== 90) return false;

  /* ---------- parts ---------- */

  // end frame: legs 42.5 wide, a 45 mm rail across the top (805 x 695 inside, as page 2 draws it)
  const endPieces = (x: number): PartPiece[] => [
    ...g2.map((g): PartPiece => ({ shape: "box", size: [T, 740, 42.5], pos: [x, 370, g * 423.75] })),
    { shape: "box", size: [T, 45, 805], pos: [x, 717.5, 0] },
  ];
  const endFrame = (g: number, label: string) => {
    const { type, mid } = b.compound("End frame", endPieces(g * XE), { material: "metal", label });
    return b.place(type, mid);
  };
  const end1 = endFrame(-1, "1");
  const end4 = endFrame(1, "4");
  // side frame: legs 45 wide, a 45 mm rail along the top (1360 x 680 inside)
  const side = b.compound(
    "Side frame",
    [
      ...g2.map((g): PartPiece => ({ shape: "box", size: [45, 725, T], pos: [g * 702.5, 362.5, -ZS] })),
      { shape: "box", size: [1360, 45, T], pos: [0, 702.5, -ZS] },
    ],
    { material: "metal", label: "2" },
  );
  const sides = g2.map((g) => b.place(side.type, [side.mid[0], side.mid[1], g * ZS]));
  // the top: four 15 mm composite slats (725..740) on three cross bars and two end plates, metal, 60 deep in all.
  // ponytail: the bars are drawn as flat bars with 3 mm tabs at their ends, not the real folded profile
  const top = b.compound(
    "Table top",
    [
      ...[0, 1, 2, 3].map((i): PartPiece => ({ shape: "box", size: [2 * XS, 15, 220], pos: [0, 732.5, -335 + (i * 670) / 3], material: "wood" })),
      ...XB.flatMap((x): PartPiece[] => [
        { shape: "box", size: [40, 20, 838], pos: [x, 715, 0], material: "metal" },
        ...g2.map((g): PartPiece => ({ shape: "box", size: [40, 45, 3], pos: [x, 702.5, g * 420.5], material: "metal" })),
      ]),
      ...g2.flatMap((g): PartPiece[] => [
        { shape: "box", size: [3, 45, 844], pos: [g * (XS - 1.5), 702.5, 0], material: "metal" },
        { shape: "box", size: [40, 10, 844], pos: [g * (XS - 20), 720, 0], material: "metal" },
      ]),
    ],
    { material: "wood", label: "3" },
  );
  const top3 = b.place(top.type, top.mid);
  const ends = [end1, end4];

  /* ---------- fittings, where they end up ---------- */

  /** A washer (D) under each bolt: both start at the face the bolt goes in through. */
  const washered = (def: HwDef, list: FitOpts[]) => {
    for (const o of list) {
      b.fit(D, { ...o, mate: undefined, hole: false });
      b.fit(def, o);
    }
  };
  // A: from the inner face of each side frame leg (680 from the middle) out into the end frame's leg
  const boltsA = g2.flatMap((gx, i) =>
    g2.flatMap((gz, k) => YA.map((y): FitOpts => ({ on: sides[k], at: [gx * (XS - 45), y, gz * ZS], dir: [gx, 0, 0], mate: ends[i] }))),
  );
  // C: through the tabs at the cross bars' ends (inner faces at ±419) out into the side frames' rails
  const screwsC = g2.flatMap((gz, k) => XB.map((x): FitOpts => ({ on: top3, at: [x, YC, gz * 419], dir: [0, 0, gz], mate: sides[k] })));
  // B: through the top's end plates (inner faces at ±722) out into the end frames' rails
  const screwsB = g2.flatMap((gx, i) => ZB.map((z): FitOpts => ({ on: top3, at: [gx * (XS - 3), YB, z], dir: [gx, 0, 0], mate: ends[i] })));

  /* ---------- steps, as the manual numbers them ---------- */

  b.step(
    {
      title: "Bolt the side frames (2) between the end frames (1 and 4)",
      detail:
        "Two of you, on a rug. Stand the side frames just inside the end frames, holes lined up. At each corner, two 60 mm bolts (A), each with a washer (D), from inside through the side frame's leg into the end frame. Turn them only about 80% of the way in with the T25 key (F).",
      tools: ["allen"],
      people: 2,
      kind: "bolts",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.25);
      b.add(end1, [-300, 0, 0]);
      sides.forEach((k, i) => b.add(k, [0, 0, g2[i] * 300]));
      b.add(end4, [300, 0, 0]);
      b.then(0.15);
      b.stagger(0.06);
      washered(A, boltsA);
    },
  );
  b.step(
    {
      title: "Turn the frame over onto the top (3) and screw them together",
      detail:
        "Lay the top face down on the rug and lower the frame over it, upside down. Six 20 mm screws (C), each with a washer (D), through the tabs at the ends of the top's three cross bars into the side frames, about 80% of the way in. Use C here, not the longer B.",
      tools: ["allen"],
      people: 2,
      pose: "-y",
      kind: "screws",
      warnings: ["floor", "two"],
    },
    () => {
      b.add(top3, [0, -300, 0]);
      b.then(0.15);
      b.stagger(0.06);
      washered(C, screwsC);
    },
  );
  b.step(
    {
      title: "Screw the top to the end frames",
      detail: "Three 25 mm screws (B), each with a washer (D), through each of the top's end plates into the end frame's rail, about 80% of the way in.",
      tools: ["allen"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.06);
      washered(B, screwsB);
    },
  );
  b.step(
    {
      title: "Tighten everything fully",
      detail:
        "First check the top lies flush with the frame's edges, not sticking out, and with no gap at the corners: press it down. Then turn all 20 bolts and screws the whole way with the T25 key.",
      tools: ["allen"],
      pose: "-y",
      kind: "bolts",
    },
    () => {},
  );
  b.step(
    { title: "Cap the bolt heads (E)", detail: "Press a cap over each of the eight bolt heads on the inside of the legs.", pose: "-y", kind: "general" },
    () => {
      b.stagger(0.08);
      for (const o of boltsA) b.fit(E, { on: o.on, at: o.at, dir: o.dir, hole: false });
    },
  );
  b.step(
    {
      title: "Turn it over and level it",
      detail: "Two of you: stand it on its legs and turn the adjustable feet until it doesn't rock. 50 kg at most on the top; clean it with water and a soft cloth.",
      people: 2,
      pose: "+y",
      kind: "standup",
      warnings: ["two"],
    },
    () => {},
  );
  return true;
}

const family: Family = { names: ["MADERUP"], build };
export default family;

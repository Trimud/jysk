import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { rod } from "./_seat";
import { box, ladder } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK GLUDSTED shelving unit, 5 shelves 110x151x33 (3630153), read from its 16-page manual (Rev 1, 03.02.2026).
 * Two chrome ladder frames (3: 1505 tall, 330 deep, 19 mm tube, a rung at each shelf) are joined by ten 730 mm
 * rails (2), a front and a back one at each level, and five oval glass shelves (1: 1100x290x5) lie on them on felt
 * pads, overhanging the frames at both ends. An X brace of two Ø6 rods (4) crosses the back over the two lowest bays.
 * Built lying on its back: the brace crossed and bolted at the middle (A, nut C), bolted to the frames (A), the rails
 * between the frames (B, two per rail), every bolt tightened, then the pads (F), fixed to the wall (G), the glass on.
 */

const A: HwDef = { kind: "bolt", len: 12, dia: 6 }; // M6x12
const B: HwDef = { kind: "bolt", len: 30, dia: 6 }; // M6x30
const C: HwDef = { kind: "nut", len: 5, dia: 6, name: "Nut" }; // M6/10
const F: HwDef = { kind: "glide", len: 3, dia: 20, name: "Felt pad" }; // Ø20
const G: HwDef = { kind: "clamp", len: 20, dia: 19, name: "Wall clip" }; // Ø19x20

const W = 1100, FW = 725, DEP = 330, T = 19, RT = 15, GD = 290, GT = 5, HT = 1505;
const X0 = FW / 2 + T / 2; // the frames' centres
const LEVELS = [254, 598, 892, 1186, 1480]; // each rung's top, bottom up: 235, 325 and 3 x 275 clear between them
const RZ = 292 / 2; // the rails, front and back, at the posts' inner faces

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 110 || Math.round(s.size.d) !== 33 || Math.round(s.size.h) !== 151) return false;

  /* ---------- parts ---------- */

  const frame = b.compound("Side frame", ladder(HT, DEP, T, LEVELS), { material: "metal", label: "3" });
  const sides = [-1, 1].map((g) => b.place(frame.type, [frame.mid[0] + g * X0, frame.mid[1], frame.mid[2]]));

  const rail = b.part("Rail", [FW, RT, RT], { material: "metal", label: "2" });
  const rails = LEVELS.flatMap((y) => [-RZ, RZ].map((z) => b.place(rail, [0, y - RT / 2, z])));

  // the X brace: one rod, placed twice and turned over to make the other diagonal
  const zb = -DEP / 2 - 4;
  const y0 = LEVELS[0] + 16, y1 = LEVELS[2] - 16;
  const r = b.compound("Cross brace", [rod([-X0, y0, zb], [X0, y1, zb], 6)], { material: "metal", label: "4" });
  const braces = [b.place(r.type, r.mid), b.place(r.type, r.mid, [0, Math.PI, 0])];
  const mid: Vec3 = [0, (y0 + y1) / 2, zb];

  // the oval glass: a straight middle and a round end each side
  const flat = W - GD;
  const glass = b.compound(
    "Glass shelf",
    [box([flat, GT, GD], [0, 0, 0]), ...[-1, 1].map((g): PartPiece => ({ shape: "cyl", size: [GD, GT, GD], pos: [(g * flat) / 2, 0, 0] }))],
    { material: "glass", label: "1" },
  );
  const shelves = LEVELS.map((y) => b.place(glass.type, [0, y + 3 + GT / 2, 0]));

  /* ---------- fittings, where they end up ---------- */

  const ends = (k: number): Vec3[] => [
    [-X0, y0, zb],
    [X0, y1, zb],
  ].map((e) => (k ? [-e[0], e[1], e[2]] : e) as Vec3);
  const bBolts = rails.flatMap((rk, i) =>
    [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [g * (X0 + T / 2), LEVELS[i >> 1] - RT / 2, i % 2 ? RZ : -RZ], dir: [-g, 0, 0], mate: rk })),
  );

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Bolt the two brace rods together",
      detail: "Cross the two thin rods (4) at their middle holes. One short bolt (A) through both and the nut (C) on the back: hold the nut with the spanner (E) and turn the bolt with the allen key (D).",
      kind: "bolts",
      tools: ["allen", "wrench"],
      warnings: ["floor"],
    },
    () => {
      b.add(braces[0], [0, 0, -250]);
      b.then(0.1);
      b.add(braces[1], [0, 0, -250]);
      b.then(0.15);
      b.fit(A, { on: braces[0], at: [0, mid[1], zb - 4], dir: [0, 0, 1], mate: braces[1] });
      b.then(0.05);
      b.fit(C, { on: braces[1], at: [0, mid[1], zb + 4], dir: [0, 0, -1], hole: false });
    },
  );
  b.step(
    {
      title: "Bolt the brace to the side frames",
      detail: "Lay the two side frames (3) on the floor, rungs facing each other, and lay the brace across their back posts over the two lowest bays. A short bolt (A) through each rod end into the post: about 80% tight. Mind that the bolt holes for the rails face inward.",
      kind: "bolts",
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], [-300, 0, 0]);
      b.add(sides[1], [300, 0, 0]);
      b.then(0.15);
      b.fits(
        A,
        [0, 1].flatMap((k) => ends(k).map((e): FitOpts => ({ on: braces[k], at: [e[0], e[1], e[2] - 4], dir: [0, 0, 1], mate: sides[e[0] < 0 ? 0 : 1] }))),
        0.08,
      );
    },
  );
  b.step(
    {
      title: "Bolt the ten rails between the frames",
      detail: "A rail (2) at the front and the back of every rung, with the holes for the pads facing up. Two of the long bolts (B) through the posts into each rail, one at each end: 20 in all, about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.06);
      rails.forEach((k) => b.add(k, [0, 0, 250]));
      b.stagger(0);
      b.then(0.12);
      b.fits(B, bBolts, 0.04);
    },
  );
  b.step(
    {
      title: "Stand it up and tighten every bolt",
      detail: "Two of you: stand it on its feet, check it stands square and doesn't rock, then tighten all the bolts the whole way with the allen key (D).",
      kind: "standup",
      tools: ["allen"],
      people: 2,
      warnings: ["two", "square"],
    },
    () => {},
  );
  b.step(
    {
      title: "Press in the felt pads",
      detail: "Three pads (F) into the holes along the top of each rail: 30 in all. The glass sits on these, never on bare metal.",
      kind: "general",
    },
    () => {
      b.fits(
        F,
        rails.flatMap((rk, i) => [-300, 0, 300].map((x): FitOpts => ({ on: rk, at: [x, LEVELS[i >> 1] + 3, i % 2 ? RZ : -RZ], dir: [0, -1, 0], hole: false }))),
        0.03,
      );
    },
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it back against the wall, mark where the two wall clips (G) meet it on the back posts near the top, drill, plug and screw the clips to the wall, then snap them round the posts. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      b.fits(G, [-1, 1].map((g): FitOpts => ({ at: [g * X0, HT - 120, -DEP / 2 - 12], dir: [0, 0, 1], wall: true })), 0.1);
    },
  );
  b.step(
    {
      title: "Lay the glass shelves on",
      detail: "Each oval glass shelf (1) centred on its pads, its round ends overhanging the frames by the same amount (about 170 mm) each side. Lower it on, don't slide it.",
      kind: "shelves",
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.stagger(0.15);
      shelves.forEach((k) => b.add(k, [0, 200, 0]));
      b.stagger(0);
    },
  );
  b.step({ title: "Keep to the weight limit", detail: "5 kg on each glass shelf.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["GLUDSTED"], build };
export default family;

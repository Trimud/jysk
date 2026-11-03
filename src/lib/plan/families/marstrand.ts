import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { add, mul, range } from "../math";
import type { Family } from "./family";

/*
 * MARSTRAND dining table D110/110x200 (JYSK 3601197 and its colours), read from JYSK's 15-page manual (Rev.4, 25.07.2025).
 * The top (1) comes as one piece: two half-round boards on a split apron frame, the extension slides and the corner
 * plates already fitted. It lies upside down while the four wooden legs (2) are bolted to the corner plates, gets its
 * felt pads and is turned over. The two leaves (5) each get two apron rails (3, 4) screwed on, then the halves are
 * pulled apart, the leaves dropped in and the latches closed: 1100 round becomes 2000 long.
 * The guide builds it closed; its finished piece is the table extended, as the manual's cover and last step show,
 * because the loose leaves have to end up somewhere. Sizes in mm are the manual's.
 */

// fittings, as the manual lists them on page 7 (B, the 5 mm allen key, is a tool here)
const A: HwDef = { kind: "bolt", len: 55, dia: 8 };
const C: HwDef = { kind: "washer", len: 1.6, dia: 19 };
const D: HwDef = { kind: "washer", len: 2, dia: 14, name: "Spring washer" };
const E: HwDef = { kind: "glide", len: 3, dia: 30 };
const F: HwDef = { kind: "screw", len: 60, dia: 5 };

// closed, centred (x along the extension, y up, z across): 18 mm boards on an 85 mm apron, 750 high
const TY = 732; // underside of the boards
const AY = TY - 42.5; // apron centre
const LX = 349.5, LZ = 355; // leg centres: 644 and 655 between them, as the manual measures
const XA = LX - 9, ZA = LZ - 9; // end and side aprons, their outer faces through the leg centres (the legs' slots wrap the corners)
const OPEN = 450; // each half moves out by a leaf's width
const g2 = [-1, 1];

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "table" || s.size.w !== 110 || s.size.d !== 110) return false;

  /* ---------- parts, in their finished (extended) places ---------- */

  // the left half of the top, split at x = 0; the right half is the same turned round
  const plate = (sz: number): PartPiece => ({ shape: "box", size: [70, 60, 4], pos: [-(XA - 9) + 25, AY, sz * (ZA - 9 - 25)], rot: [0, -sz * Math.PI / 4, 0], material: "metal" });
  const half = b.compound(
    "Table top half",
    [
      { shape: "halfcyl", size: [1100, 18, 550], pos: [-275, TY + 9, 0], rot: [0, -Math.PI / 2, 0] },
      { shape: "box", size: [18, 85, 2 * LZ], pos: [-XA, AY, 0], tone: 1 },
      ...g2.map((sz): PartPiece => ({ shape: "box", size: [XA - 9, 85, 18], pos: [-(XA - 9) / 2, AY, sz * ZA], tone: 1 })),
      // ponytail: each half's part of the extension slides, drawn as a plain bar; the latches aren't drawn
      ...g2.map((sz): PartPiece => ({ shape: "box", size: [XA - 14, 30, 40], pos: [-(XA + 5) / 2, TY - 15, sz * 250], material: "metal" })),
      ...g2.map(plate),
    ],
    { label: "1" },
  );
  const m = half.mid;
  const halves = g2.map((g) => b.place(half.type, [g * (Math.abs(m[0]) + OPEN), m[1], -g * m[2]], [0, g < 0 ? 0 : Math.PI, 0]));
  // the legs taper from 55 to 40 over 730, drawn as five short cylinders
  const legT = b.compound(
    "Leg",
    range(5).map((i): PartPiece => ({ shape: "cyl", size: [40 + (15 * i) / 4, 146, 40 + (15 * i) / 4], pos: [0, -292 + 146 * i, 0] })),
    { material: "wood", label: "2", tone: 1 },
  ).type;
  const corners = g2.flatMap((gx) => g2.map((gz) => ({ gx, gz })));
  const legs = corners.map(({ gx, gz }) => b.place(legT, [gx * (LX + OPEN), 4 + 365, gz * LZ]));

  const leafT = b.part("Leaf", [450, 18, 1100], { label: "5" });
  // the rails carry the frame on under the leaves: the frame's tone (natural wood under a white top)
  const railT = [b.part("Leaf rail", [450, 85, 18], { label: "3", tone: 1 }), b.part("Leaf rail", [450, 85, 18], { label: "4", tone: 1 })];
  const leaves = g2.map((g) => ({ x: g * 225, leaf: b.place(leafT, [g * 225, TY + 9, 0]), rails: g2.map((gz, i) => b.place(railT[i], [g * 225, AY, gz * ZA])) }));

  /* ---------- fittings, where they end up ---------- */

  // two bolts through each corner plate into the leg, on a flat and a spring washer, along the diagonal to the leg
  const legFits = corners.flatMap(({ gx, gz }, i) => {
    const u: Vec3 = [gx * Math.SQRT1_2, 0, gz * Math.SQRT1_2];
    const c: Vec3 = [gx * (LX + OPEN), 0, gz * LZ];
    const face = 25 * Math.SQRT2 + 18 * Math.SQRT2 + 2; // the plate's inner face, from the leg's centre line
    return [AY - 18, AY + 18].map((y) => {
      const at = (d: number) => add([c[0], y, c[2]], mul(u, -d));
      const on = halves[gx < 0 ? 0 : 1];
      return { C: { on, at: at(face), dir: u, hole: false }, D: { on, at: at(face + 1.6), dir: u, hole: false }, A: { on, at: at(face + 3.6), dir: u, mate: legs[i] } } as Record<"A" | "C" | "D", FitOpts>;
    });
  });
  const pads = corners.map(({ gx, gz }, i): FitOpts => ({ on: legs[i], at: [gx * (LX + OPEN), 4, gz * LZ], dir: [0, 1, 0], hole: false }));
  // ponytail: the rails' holes are counterbored, so the 60 mm screws reach through 85 mm of rail into the leaf
  const railScrews = leaves.flatMap((l) => l.rails.flatMap((r, i) => [-180, 0, 180].map((dx): FitOpts => ({ on: r, at: [l.x + dx, TY - 49, g2[i] * ZA], dir: [0, 1, 0], mate: l.leaf }))));

  /* ---------- steps ---------- */

  const closed = (k: string, g: number, from?: Vec3) => {
    const f = b.partItem(k).final;
    b.stage(k, [f.pos[0] - g * OPEN, f.pos[1], f.pos[2]], f.rot, from);
  };
  b.step(
    {
      title: "Bolt the four legs (2) to the top (1)",
      detail: "Lay the top upside down on something soft, closed. Each leg's slot goes over the corner of the frame; two long bolts through the corner plate into it, each on a flat washer (C) and a spring washer (D), tightened with the allen key.",
      tools: ["allen"],
      people: 2,
      pose: "-y",
      kind: "legs",
      warnings: ["floor"],
    },
    () => {
      g2.forEach((g, i) => closed(halves[i], g, [0, -200, 0]));
      b.then(0.15);
      b.stagger(0.25);
      corners.forEach(({ gx }, i) => closed(legs[i], gx, [0, -300, 0]));
      b.then(0.15);
      b.fits(C, legFits.map((f) => f.C), 0.05);
      b.then(0.05);
      b.fits(D, legFits.map((f) => f.D), 0.05);
      b.then(0.05);
      b.fits(A, legFits.map((f) => f.A), 0.1);
    },
  );
  b.step({ title: "Stick a felt pad under each leg", detail: "Peel off the backing and press one onto the end of each leg.", pose: "-y", kind: "general" }, () => b.fits(E, pads, 0.15));
  b.step({ title: "Turn the table over", detail: "With a second person, lift it onto its legs. Don't drag it by them.", people: 2, pose: "+y", kind: "flip" }, () => {});
  b.step(
    {
      title: "Screw two rails under each leaf (5)",
      detail: "Lay the leaves face down. A rail 3 and a rail 4 across each end, latch to the latch side, each on three 60 mm screws.",
      tools: ["screwdriver"],
      scene: "leaves",
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.stagger(0.2);
      b.stageAround(leaves.map((l) => l.leaf), [0, TY, 0], [0, -150, 0]);
      b.then(0.1);
      b.stageAround(leaves.flatMap((l) => l.rails), [0, TY, 0], [0, -200, 0]);
      b.then(0.15);
      b.fits(F, railScrews, 0.06);
    },
  );
  b.step(
    {
      title: "Pull the table open and put the leaves in",
      detail: "Pull the two halves apart as far as they go. Lay the leaves in, rails down, push the halves together and close all the latches under the top.",
      people: 2,
      kind: "join",
    },
    () => {
      b.stagger(0);
      for (const k of [...halves, ...legs]) b.add(k);
      b.then(0.3);
      for (const l of leaves) {
        b.stagger(0);
        for (const k of [l.leaf, ...l.rails]) b.add(k, [0, 300, 0]);
        b.wait(0.4);
      }
    },
  );
  b.step({ title: "Mind the load limit", detail: "40 kg at most on the top.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["MARSTRAND"], build };
export default family;

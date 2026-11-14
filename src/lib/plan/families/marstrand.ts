import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { add, mul } from "../math";
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
const D: HwDef = { kind: "washer", len: 2, dia: 14, name: "Spring washer", form: "split" };
const E: HwDef = { kind: "glide", len: 3, dia: 30 };
const F: HwDef = { kind: "screw", len: 60, dia: 5 };

// closed, centred (x along the extension, y up, z across): 18 mm boards on an 85 mm apron, 750 high
const TY = 732; // underside of the boards
const AY = TY - 42.5; // apron centre
const LX = 349.5, LZ = 355; // leg centres: 644 and 655 between them, as the manual measures
const XA = LX - 9, ZA = LZ - 9; // end and side aprons, their outer faces through the leg centres (the legs' slots wrap the corners)
const OPEN = 450; // each half moves out by a leaf's width
const g2 = [-1, 1];

// p9, p13, p14: toggle latches and their catch plates, fitted at every seam, under the top's boards near both ends
// and on the aprons' outer faces. A leaf has its latches (and its dowels) along one long edge, the catches along the
// other (p13 at 300 dpi); rails 3 and 4 are mirror images, each with its latch at that same edge. So every leaf goes in
// latches to +x, the left half has the latches at the split and the right half the catches.
// Drawn closed (p14 III): the latch a base plate and a lever lying flat, its wire loop reaching over the seam and
// round the catch's hook; the catch a two-screw plate with its hook standing up. ponytail: the lever doesn't move
const ZT = 470; // the board latches, out past the aprons
const OVER = 40; // the halves pulled out past where they end up, for the leaves to go in (p14)
/** A latch (or a catch) at an edge on x = `edge`, reaching in towards `inward`, sitting on a face at `face` along `out`. */
const lock = (latch: boolean, edge: number, inward: number, face: Vec3, out: Vec3): PartPiece[] => {
  const flat = !!out[1]; // under a board (out along y), else on an apron's side (out along z)
  const o = flat ? out[1] : out[2];
  // c: in from the edge, n: out from the face, w: across
  const pos = (c: number, n: number, w: number): Vec3 => [edge + inward * c, face[1] + (flat ? o * n : w), face[2] + (flat ? w : o * n)];
  const size = (c: number, n: number, w: number): Vec3 => (flat ? [c, n, w] : [c, w, n]);
  const piece = (shape: "box" | "cyl" | "arc", c0: number, c1: number, n0: number, n1: number, w: number, at = 0, extra: Partial<PartPiece> = {}): PartPiece =>
    ({ shape, size: size(c1 - c0, n1 - n0, w), pos: pos((c0 + c1) / 2, (n0 + n1) / 2, at), material: "metal", ...extra });
  const across: Vec3 = flat ? [0, 0, 0] : [Math.PI / 2, 0, 0]; // a screw head's axis along the face's normal
  if (!latch)
    return [
      piece("box", 1, 25, 0, 2, 30),
      piece("box", 14, 17, 2, 9, 10), // the hook
      ...[-10, 10].map((w): PartPiece => ({ shape: "cyl", size: [5, 1, 5], pos: pos(7, 2.5, w), rot: across, material: "metal" })),
    ];
  const R = 8, WIRE = 2.4, N = 5.5; // the loop's bend radius, its wire, its height off the face
  return [
    piece("box", 4, 40, 0, 2, 24),
    piece("box", 6, 46, 2, 9, 16), // the lever, pressed flat
    // the loop's two legs from under the lever out over the seam, and its bend round the catch's hook
    ...[-R, R].map((w): PartPiece => ({ shape: "cyl", size: [WIRE, 26, WIRE], pos: pos(1, N, w), rot: [0, 0, Math.PI / 2], material: "metal" })),
    { shape: "arc", size: [WIRE, R + WIRE / 2, 2 * R + WIRE], pos: pos(-12 - (R + WIRE / 2) / 2, N, 0), rot: flat ? [0, 0, (inward * Math.PI) / 2] : [-Math.PI / 2, 0, (inward * Math.PI) / 2], material: "metal" },
  ];
};

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "table" || s.size.w !== 110 || s.size.d !== 110) return false;

  /* ---------- parts, in their finished (extended) places ---------- */

  // the left half of the top, split at x = 0; the right half is drawn the same and turned round, with catches
  // where the left has latches
  const plate = (sz: number): PartPiece => ({ shape: "box", size: [70, 60, 4], pos: [-(XA - 9) + 25, AY, sz * (ZA - 9 - 25)], rot: [0, -sz * Math.PI / 4, 0], material: "metal" });
  const half = (latch: boolean) => b.compound(
    "Table top half",
    [
      { shape: "halfcyl", size: [1100, 18, 550], pos: [-275, TY + 9, 0], rot: [0, -Math.PI / 2, 0] },
      { shape: "box", size: [18, 85, 2 * LZ], pos: [-XA, AY, 0], tone: 1 },
      ...g2.map((sz): PartPiece => ({ shape: "box", size: [XA - 9, 85, 18], pos: [-(XA - 9) / 2, AY, sz * ZA], tone: 1 })),
      // ponytail: each half's part of the extension slides, drawn as a plain bar
      ...g2.map((sz): PartPiece => ({ shape: "box", size: [XA - 14, 30, 40], pos: [-(XA + 5) / 2, TY - 15, sz * 250], material: "metal" })),
      ...g2.map(plate),
      // at the split, under the board near each end and on each side apron
      ...g2.flatMap((sz) => [...lock(latch, 0, -1, [0, TY, sz * ZT], [0, -1, 0]), ...lock(latch, 0, -1, [0, AY, sz * (ZA + 9)], [0, 0, sz])]),
    ],
    { label: "1" },
  );
  const halves = g2.map((g) => {
    const { type, mid: m } = half(g < 0);
    return b.place(type, [g * (Math.abs(m[0]) + OPEN), m[1], -g * m[2]], [0, g < 0 ? 0 : Math.PI, 0]);
  });
  // the legs taper from 55 at the top to 40 at the floor over 730
  const legT = b.compound("Leg", [{ shape: "cyl", size: [55, 730, 55], foot: 40, pos: [0, 0, 0] }], { material: "wood", label: "2", tone: 1 }).type;
  const corners = g2.flatMap((gx) => g2.map((gz) => ({ gx, gz })));
  const legs = corners.map(({ gx, gz }) => b.place(legT, [gx * (LX + OPEN), 4 + 365, gz * LZ]));

  // a leaf: latches near both ends of its +x edge, catches on its -x edge. ponytail: its four edge dowels (p13) aren't
  // drawn: 5 mm under the top, their outlines showed through it at every seam
  const leafT = b.compound(
    "Leaf",
    [{ shape: "box", size: [450, 18, 1100], pos: [0, 0, 0] }, ...g2.flatMap((ex) => g2.flatMap((sz) => lock(ex > 0, ex * 225, -ex, [0, -9, sz * ZT], [0, -1, 0])))],
    { label: "5" },
  );
  // the rails carry the frame on under the leaves: the frame's tone (natural wood under a white top). Rail 4 on the
  // +z end, rail 3 on the -z end, each with its latch on its outer face at the leaf's latch edge (p13's inset)
  const railT = g2.map((gz, i) =>
    b.compound("Leaf rail", [{ shape: "box", size: [450, 85, 18], pos: [0, 0, 0] }, ...g2.flatMap((ex) => lock(ex > 0, ex * 225, -ex, [0, 0, gz * 9], [0, 0, gz]))], {
      label: i ? "4" : "3",
      tone: 1,
    }),
  );
  const at = (t: { mid: Vec3 }, p: Vec3) => add(p, t.mid);
  const leaves = g2.map((g) => ({ x: g * 225, leaf: b.place(leafT.type, at(leafT, [g * 225, TY + 9, 0])), rails: g2.map((gz, i) => b.place(railT[i].type, at(railT[i], [g * 225, AY, gz * ZA]))) }));

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
  const railScrews = leaves.flatMap((l) => l.rails.flatMap((r, i) => [-180, 0, 180].map((dx): FitOpts => ({ on: r, at: [l.x + dx, TY - 49, g2[i] * ZA], dir: [0, 1, 0], mate: l.leaf, sunk: true })))); // up a counterbore from the rail's bottom edge

  /* ---------- steps ---------- */

  const closed = (k: string, g: number, from?: Vec3) => {
    const f = b.partItem(k).final;
    b.stage(k, [f.pos[0] - g * OPEN, f.pos[1], f.pos[2]], f.rot, from);
  };
  b.step(
    {
      page: 10,
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
  b.step({ page: 11, title: "Stick a felt pad under each leg", detail: "Peel off the backing and press one onto the end of each leg.", pose: "-y", kind: "general" }, () => b.fits(E, pads, 0.15));
  b.step({ page: 12, title: "Turn the table over", detail: "With a second person, lift it onto its legs. Don't drag it by them.", people: 2, pose: "+y", kind: "flip" }, () => {});
  b.step(
    {
      page: 13,
      title: "Screw two rails under each leaf (5)",
      detail: "Lay the leaves face down. A rail 4 across one end and a rail 3 across the other, each rail's latch at the leaf's long edge with the latches, each on three 60 mm screws.",
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
      page: 14,
      title: "Pull the table open and put the leaves in",
      detail: "Pull the two halves apart as far as they go. Lay the leaves in, rails down, push the halves in and close all the latches under the top: hook each latch over its catch, then press it flat.",
      people: 2,
      kind: "join",
    },
    () => {
      // pulled out a little past their places, as p14 draws them, then pushed in once the leaves are down
      b.stagger(0);
      for (const k of [...halves, ...legs]) {
        const f = b.partItem(k).final;
        b.stage(k, [f.pos[0] + Math.sign(f.pos[0]) * OVER, f.pos[1], f.pos[2]], f.rot);
      }
      for (const l of leaves) {
        b.stagger(0);
        for (const k of [l.leaf, ...l.rails]) b.add(k, [0, 300, 0]);
        b.wait(0.4);
      }
      b.then(0.2);
      b.stagger(0);
      for (const k of [...halves, ...legs]) b.add(k);
      b.then(0.2);
      // a latch hooked over its catch, under the split between the leaves (p14 inset); just under the catch, so the
      // circle, looking up from the +x side, sees past it
      b.look(leaves[0].leaf, [0, TY - 6, ZT], { dir: [0, 1, 0], size: 45 });
    },
  );
  b.step({ page: 15, title: "Mind the load limit", detail: "40 kg at most on the top.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["MARSTRAND"], build };
export default family;

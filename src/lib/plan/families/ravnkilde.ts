import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { HwDef, PlanBuilder } from "../builder";
import { rod } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK RAVNKILDE hallway unit, 4 shelves 100x150x40 (3650029), read from its 12-page manual (Rev 1, 26.04.2024).
 * Three A-frames of Ø16 tube, 395 deep at the floor and rounded at the top, each a lower U (2 for the left, 4 for the
 * other two) and an upper U pushed into it (1 left, 3 middle, 5 right), with a spreader bar (7) across. Between the
 * left and the middle frame: two 597 rails (8) at the bottom for the big shelf (9) and one along the top to hang coats
 * on. Between the middle and the right frame: eight 345 rails (6), a front and a back one at four heights, for four
 * shelves that get shallower as the frames close in (13 at the bottom up to 10 at the top). Every bolt takes a curved
 * washer (C); the two long bolts (B) go through the middle frame into a rail each side at once.
 */

const A: HwDef = { kind: "bolt", len: 30, dia: 6, flush: true, form: "countersunk" }; // M6x30, countersunk: its head sits in the leg's dimple (p6)
const B: HwDef = { kind: "rod", len: 80, dia: 6 }; // M6x80, no head: rail 8 and rail 6 screw onto its ends
const C: HwDef = { kind: "washer", len: 5, dia: 16, name: "Curved washer", form: "saddle" }; // Ø16x5, hollowed to sit on the tube (drawn along its local x)

const P = 16; // tube
const XL = -1005 / 2 + P / 2, XM = XL + P + 603, XR = XM + P + 354; // the three frames' centres
// heights from the parts page (p7): the upper U 745 down from the 1510 crest, so the seam at 765. The lower U's 798
// takes in the narrowed ends that push 33 into the upper. ponytail: those ends not drawn, so ours stops at the seam.
// p2's rail labels are not to scale between them, so they don't place the seam.
const JOIN = 765, APEX = 1420, R0 = 195; // where the U halves meet, where the round top starts (its crest's top at 1510), the legs' line at the floor (395 across their outsides where they meet the bends)
const hz = (y: number) => R0 - ((R0 - 82) * Math.min(y, APEX)) / APEX; // the legs' distance from the middle at height y
const LEVELS = [174, 533, 902, 1261]; // the right-hand shelves' rails, bottom up; the big shelf's at the first
const SPREAD = 790; // the spreader bar, about 25 over the seam (p2's front view scaled to the 1510 height): the 250 bar and its washers just span the legs
const TOP_RAIL = APEX + hz(APEX); // the hanging rail, through the crest of the round (p2, p10)

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 100 || Math.round(s.size.d) !== 40 || Math.round(s.size.h) !== 150) return false;

  /* ---------- parts ---------- */

  const legs = (y0: number, y1: number) => [-1, 1].map((g) => rod([0, y0, g * hz(y0)], [0, y1, g * hz(y1)], P));
  // the round top: one bent tube, so it reads as a smooth bend
  const r = hz(APEX);
  const arch: PartPiece[] = [{ shape: "arc", size: [P, r + P / 2, 2 * r + P], pos: [0, APEX + (r + P / 2) / 2, 0] }];
  // the lower U bends round into its floor bar (bend radius about 54 to the tube's middle) and stands on a 43 long pad
  // under each corner, the tube 5 off the floor (p2's side view, p7). The legs keep their line; the bend meets them
  // where they run tangent to it. ponytail: each bend drawn as four short straight pieces, each pad as a plain box
  const RB = 54, yb = 5 + P / 2;
  const sl = -(R0 - 82) / APEX, nl = Math.hypot(1, sl), nz = 1 / nl, ny = -sl / nl; // the legs' slope, and their outward normal (z, y)
  const ty = yb + RB + RB * ny, cz = hz(ty) - RB * nz; // where a leg meets its bend, and the bend's centre (z; y is yb + RB)
  const bend = (g: number) => Array.from({ length: 4 }, (_, i) => {
    const a = (k: number) => -Math.PI / 2 + ((Math.atan2(ny, nz) + Math.PI / 2) * k) / 4;
    const pt = (k: number): Vec3 => [0, yb + RB + RB * Math.sin(a(k)), g * (cz + RB * Math.cos(a(k)))];
    return rod(pt(i), pt(i + 1), P);
  });
  const lowerPieces: PartPiece[] = [
    ...[-1, 1].map((g) => rod([0, ty, g * hz(ty)], [0, JOIN, g * hz(JOIN)], P)),
    ...[-1, 1].flatMap(bend),
    rod([0, yb, -cz], [0, yb, cz], P),
    // the pads under where the bends start, rising with them to their outer ends
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [P, 14, 43], pos: [0, 7, g * (cz + 10)] })),
  ];
  const upperPieces = [...legs(JOIN, APEX), ...arch];
  const make = (name: string, pieces: PartPiece[], label: string) => b.compound(name, pieces, { material: "metal", label });
  const at = (t: { type: string; mid: Vec3 }, x: number) => b.place(t.type, [t.mid[0] + x, t.mid[1], t.mid[2]]);

  const low2 = make("Lower frame", lowerPieces, "2"), low4 = make("Lower frame", lowerPieces, "4");
  const up1 = make("Upper frame", upperPieces, "1"), up3 = make("Upper frame", upperPieces, "3"), up5 = make("Upper frame", upperPieces, "5");
  const xs = [XL, XM, XR];
  const lowers = [at(low2, XL), at(low4, XM), at(low4, XR)];
  const uppers = [at(up1, XL), at(up3, XM), at(up5, XR)];

  const sp = make("Spreader bar", [rod([0, SPREAD, -125], [0, SPREAD, 125], P)], "7"); // 250 (p7)
  const spreaders = xs.map((x) => at(sp, x));

  // centred between two frames; the curved washers fill the gap at each end (p7: 597 and 345 in 603 and 354)
  const along = (x0: number, x1: number, len: number) => rod([(x0 + x1 - len) / 2, 0, 0], [(x0 + x1 + len) / 2, 0, 0], P);
  const r8 = make("Long rail", [along(XL, XM, 597)], "8");
  const r6 = make("Short rail", [along(XM, XR, 345)], "6");
  const rail = (t: { type: string; mid: Vec3 }, x0: number, y: number, z: number) => b.place(t.type, [t.mid[0] + x0, y, z]);
  const bigRails = [-1, 1].map((g) => rail(r8, 0, LEVELS[0], g * hz(LEVELS[0])));
  const topRail = rail(r8, 0, TOP_RAIL, 0);
  const shortRails = LEVELS.flatMap((y) => [-1, 1].map((g) => rail(r6, 0, y, g * hz(y))));

  const big = b.place(b.part("Big shelf", [590, 20, 385], { material: "metal", label: "9" }), [(XL + XM) / 2, LEVELS[0] + P / 2 + 10, 0]);
  // 13 at the bottom up to 10 at the top, each as deep as the frames are there
  const DEPTHS = [385, 322, 268, 205];
  const shelves = LEVELS.map((y, i) => b.place(b.part("Shelf", [340, 20, DEPTHS[i]], { material: "metal", label: String(13 - i) }), [(XM + XR) / 2, y + P / 2 + 10, 0]));

  /* ---------- fittings ---------- */

  /** A bolt from outside frame x (going `g` way) into a rail end at y, z, its washer between the leg and the rail (p9 to p11 insets). */
  const bolt = (def: HwDef, frame: string, x: number, g: number, y: number, z: number, mate?: string, twist?: number) => {
    b.fit(C, { on: frame, at: [x + (g * P) / 2, y, z], dir: [-g, 0, 0], twist, hole: false });
    b.fit(def, { on: frame, at: [x - (g * P) / 2, y, z], dir: [g, 0, 0], mate });
    b.then(0.06);
  };
  const frameAt = (k: number, y: number) => (y > JOIN ? uppers[k] : lowers[k]);

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Join the upper and lower half of each A-frame",
      detail: "Push each upper half into its lower half: 1 into 2 for the left frame, 3 into a 4 for the middle, 5 into the other 4 for the right, till the seam closes. Turn each upper half so the dimpled (countersunk) side of its holes faces the side the bolts go in from.",
      kind: "join",
      warnings: ["floor"],
      scene: "frames",
    },
    () => {
      // the frames are made side by side, apart from each other: the middle one goes up first (step 3), the right one
      // over its rails (5), the left one last (7)
      b.stagger(0.12);
      b.stageAround(lowers, [0, 0, 0], [0, 0, 300]);
      b.then(0.12);
      b.stageAround(uppers, [0, 0, 0], [0, 300, 0]);
      b.stagger(0);
    },
  );
  b.step(
    {
      title: "Bolt a spreader bar across each frame",
      detail: "A spreader bar (7) across each A-frame, just above the seam, with a curved washer (C) between each end and the leg and a bolt (A) through the leg into it: 6 in all. Tighten them the whole way with the allen key (D).",
      kind: "bolts",
      tools: ["allen"],
      scene: "frames",
    },
    () => {
      b.stagger(0.1);
      b.stageAround(spreaders, [0, 0, 0], [0, 0, 250]);
      b.stagger(0);
      b.then(0.1);
      spreaders.forEach((k, i) =>
        [-1, 1].forEach((g) => {
          // the bolt from outside, the washer on the leg's inside against the bar's end (p8 inset)
          const leg = frameAt(i, SPREAD);
          b.fit(C, { on: leg, at: [xs[i], SPREAD, g * (hz(SPREAD) - P / 2)], dir: [0, 0, g], twist: Math.PI / 2, hole: false }); // its hollow along the leg
          b.fit(A, { on: leg, at: [xs[i], SPREAD, g * (hz(SPREAD) + P / 2)], dir: [0, 0, -g], mate: k });
          b.then(0.05);
        }),
      );
    },
  );
  b.step(
    {
      title: "Screw the bottom rails onto the middle frame",
      detail: "Stand the middle frame (3 and 4) up. A threaded rod (B) through each of its lowest holes, front and back, half sticking out each side, and a washer (C) over it on both sides of the leg. Turn a long rail (8) onto it on the left and a short rail (6) on the right, by hand, till both are tight against the leg.",
      kind: "join",
      turn: -1.24, // from the front left, the long rails' side, as p9 draws it
    },
    () => {
      const y = LEVELS[0];
      b.add(lowers[1], [0, 0, 0]);
      b.add(uppers[1], [0, 0, 0]);
      b.add(spreaders[1], [0, 0, 0]);
      b.then(0.12);
      [-1, 1].forEach((g) => {
        const z = g * hz(y);
        // the rod through the leg, a washer each side, half of it into each rail end (the manual's inset, p9)
        const leg = frameAt(1, y);
        b.fit(B, { on: leg, at: [XM, y, z], dir: [1, 0, 0], sunk: true }); // centred in the leg
        b.fit(C, { on: leg, at: [XM - P / 2, y, z], dir: [1, 0, 0], hole: false });
        b.fit(C, { on: leg, at: [XM + P / 2, y, z], dir: [-1, 0, 0], hole: false });
        b.then(0.08);
      });
      b.then(0.1);
      // ponytail: slid on, not turned (a part's spin turns it about its up axis, across a rail)
      bigRails.forEach((k) => b.add(k, [-200, 0, 0]));
      shortRails.slice(0, 2).forEach((k) => b.add(k, [200, 0, 0]));
    },
  );
  b.step(
    {
      title: "Bolt the other short rails to the middle frame",
      detail: "A short rail (6) front and back at each of the three higher holes on the middle frame's right side, a bolt (A) through the leg into each, with a curved washer (C) between the leg and the rail: 6 in all, about 80% tight. Each bolt head sits flush in the dimpled side of the leg's hole.",
      kind: "bolts",
      tools: ["allen"],
      turn: -1.24, // from the bolt heads' side (p9)
    },
    () => {
      b.stagger(0.08);
      shortRails.slice(2).forEach((k) => b.add(k, [0, 200, 0]));
      b.stagger(0);
      b.then(0.12);
      shortRails.slice(2).forEach((k, j) => {
        const y = LEVELS[1 + (j >> 1)], z = (j % 2 ? 1 : -1) * hz(y);
        bolt(A, frameAt(1, y), XM, 1, y, z, k);
      });
    },
  );
  b.step(
    {
      title: "Bolt on the right frame",
      detail: "The right frame against the free ends of all eight short rails, a curved washer (C) between each rail and the leg and a bolt (A) through the leg into it: 8 in all, about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      [lowers[2], uppers[2], spreaders[2]].forEach((k) => b.add(k, [250, 0, 0]));
      b.then(0.12);
      shortRails.forEach((k, j) => {
        const y = LEVELS[j >> 1], z = (j % 2 ? 1 : -1) * hz(y);
        bolt(A, frameAt(2, y), XR, -1, y, z, k);
      });
    },
  );
  b.step(
    {
      title: "Bolt the top rail to the middle frame",
      detail: "The third long rail (8) against the top of the middle frame's round, a curved washer (C) between them and a bolt (A) through the round into the rail: about 80% tight. This is the one you hang coats on.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      b.add(topRail, [-200, 0, 0]);
      b.then(0.12);
      bolt(A, uppers[1], XM, -1, TOP_RAIL, 0, topRail, Math.PI / 2); // the washer's hollow along the crest, which runs front to back
    },
  );
  b.step(
    {
      title: "Bolt on the left frame",
      detail: "The left frame against the free ends of the three long rails, a curved washer (C) between each rail and the leg and a bolt (A) through the leg into it: 3 in all, about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      turn: -1.24, // from the left frame's outside (p11)
    },
    () => {
      [lowers[0], uppers[0], spreaders[0]].forEach((k) => b.add(k, [-250, 0, 0]));
      b.then(0.12);
      bigRails.forEach((k, i) => bolt(A, lowers[0], XL, 1, LEVELS[0], (i ? 1 : -1) * hz(LEVELS[0]), k));
      bolt(A, uppers[0], XL, 1, TOP_RAIL, 0, topRail, Math.PI / 2);
    },
  );
  b.step(
    {
      title: "Lay the shelves in",
      detail: "The big shelf (9) on the two long bottom rails. On the right, from the top down: the shallowest (10), then 11, 12, and the deepest (13) at the bottom.",
      kind: "shelves",
    },
    () => {
      b.add(big, [0, 250, 0]);
      b.then(0.1);
      b.stagger(0.15);
      [...shelves].reverse().forEach((k) => b.add(k, [0, 250, 0]));
      b.stagger(0);
    },
  );
  b.step(
    {
      title: "Stand it square and tighten the rail bolts",
      detail: "Stand it on the floor, press down on it so all three frames sit flat and upright, not leaning, then tighten the 18 rail bolts the whole way with the allen key (D).",
      kind: "bolts",
      tools: ["allen"],
      warnings: ["square"],
    },
    () => {},
  );
  b.step({ title: "Keep to the weight limits", detail: "10 kg on the hanging rail and 5 kg on each shelf.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["RAVNKILDE"], build };
export default family;

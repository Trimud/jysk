import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
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

const A: HwDef = { kind: "bolt", len: 30, dia: 6 }; // M6x30
const B: HwDef = { kind: "bolt", len: 80, dia: 6 }; // M6x80
const C: HwDef = { kind: "washer", len: 5, dia: 16, name: "Curved washer" }; // Ø16x5

const P = 16; // tube
const XL = -1005 / 2 + P / 2, XM = XL + P + 603, XR = XM + P + 354; // the three frames' centres
const JOIN = 798, APEX = 1430, R0 = 190; // where the U halves meet, where the round top starts, half the foot's depth
const hz = (y: number) => R0 - ((R0 - 82) * Math.min(y, APEX)) / APEX; // the legs' distance from the middle at height y
const LEVELS = [174, 533, 902, 1261]; // the right-hand shelves' rails, bottom up; the big shelf's at the first
const SPREAD = 862; // the spreader bar, where the frame is 250 wide
const TOP_RAIL = APEX + hz(APEX) - P; // the hanging rail, just under the top of the round

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 100 || Math.round(s.size.d) !== 40 || Math.round(s.size.h) !== 150) return false;

  /* ---------- parts ---------- */

  const legs = (y0: number, y1: number) => [-1, 1].map((g) => rod([0, y0, g * hz(y0)], [0, y1, g * hz(y1)], P));
  const arch: PartPiece[] = Array.from({ length: 6 }, (_, i) => {
    const a0 = (i * Math.PI) / 6, a1 = ((i + 1) * Math.PI) / 6, r = hz(APEX);
    return rod([0, APEX + r * Math.sin(a0), r * Math.cos(a0)], [0, APEX + r * Math.sin(a1), r * Math.cos(a1)], P);
  });
  const lowerPieces = [...legs(P / 2, JOIN), rod([0, P / 2, -R0], [0, P / 2, R0], P)];
  const upperPieces = [...legs(JOIN, APEX), ...arch];
  const make = (name: string, pieces: PartPiece[], label: string) => b.compound(name, pieces, { material: "metal", label });
  const at = (t: { type: string; mid: Vec3 }, x: number) => b.place(t.type, [t.mid[0] + x, t.mid[1], t.mid[2]]);

  const low2 = make("Lower frame", lowerPieces, "2"), low4 = make("Lower frame", lowerPieces, "4");
  const up1 = make("Upper frame", upperPieces, "1"), up3 = make("Upper frame", upperPieces, "3"), up5 = make("Upper frame", upperPieces, "5");
  const xs = [XL, XM, XR];
  const lowers = [at(low2, XL), at(low4, XM), at(low4, XR)];
  const uppers = [at(up1, XL), at(up3, XM), at(up5, XR)];

  const sp = make("Spreader bar", [rod([0, SPREAD, -hz(SPREAD)], [0, SPREAD, hz(SPREAD)], P)], "7");
  const spreaders = xs.map((x) => at(sp, x));

  const along = (x0: number, x1: number, y: number, z: number) => rod([x0 + P / 2, y, z], [x1 - P / 2, y, z], P);
  const r8 = make("Long rail", [along(XL, XM, 0, 0)], "8");
  const r6 = make("Short rail", [along(XM, XR, 0, 0)], "6");
  const rail = (t: { type: string; mid: Vec3 }, x0: number, y: number, z: number) => b.place(t.type, [t.mid[0] + x0, y, z]);
  const bigRails = [-1, 1].map((g) => rail(r8, 0, LEVELS[0], g * hz(LEVELS[0])));
  const topRail = rail(r8, 0, TOP_RAIL, 0);
  const shortRails = LEVELS.flatMap((y) => [-1, 1].map((g) => rail(r6, 0, y, g * hz(y))));

  const big = b.place(b.part("Big shelf", [590, 20, 385], { material: "metal", label: "9" }), [(XL + XM) / 2, LEVELS[0] + P / 2 + 10, 0]);
  // 13 at the bottom up to 10 at the top, each as deep as the frames are there
  const DEPTHS = [385, 322, 268, 205];
  const shelves = LEVELS.map((y, i) => b.place(b.part("Shelf", [340, 20, DEPTHS[i]], { material: "metal", label: String(13 - i) }), [(XM + XR) / 2, y + P / 2 + 10, 0]));

  /* ---------- fittings ---------- */

  /** A bolt with its washer, from outside frame x (going `g` way) into a rail end at y, z. */
  const bolt = (def: HwDef, frame: string, x: number, g: number, y: number, z: number, mate?: string) => {
    const o: FitOpts = { on: frame, at: [x - (g * P) / 2, y, z], dir: [g, 0, 0], mate };
    b.fit(C, { ...o, mate: undefined, hole: false });
    b.fit(def, o);
    b.then(0.06);
  };
  const frameAt = (k: number, y: number) => (y > JOIN ? uppers[k] : lowers[k]);

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Push the three A-frames together",
      detail: "Each upper half into its lower half: 1 into 2 for the left frame, 3 into a 4 for the middle, 5 into the other 4 for the right. Push till the seam closes, with the bolt holes lined up on the same side.",
      kind: "join",
      warnings: ["floor"],
    },
    () => {
      b.stagger(0.12);
      lowers.forEach((k) => b.add(k, [0, 0, 300]));
      b.then(0.12);
      uppers.forEach((k) => b.add(k, [0, 300, 0]));
      b.stagger(0);
    },
  );
  b.step(
    {
      title: "Bolt a spreader bar across each frame",
      detail: "A spreader bar (7) across each A-frame, a bolt (A) with a curved washer (C) through each leg into its ends: 6 in all, about 80% tight, with the allen key (D).",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      b.stagger(0.1);
      spreaders.forEach((k) => b.add(k, [0, 0, 250]));
      b.stagger(0);
      b.then(0.1);
      spreaders.forEach((k, i) =>
        [-1, 1].forEach((g) => {
          const o: FitOpts = { on: lowers[i], at: [xs[i], SPREAD, g * (hz(SPREAD) + P / 2)], dir: [0, 0, -g], mate: k };
          b.fit(C, { ...o, mate: undefined, hole: false });
          b.fit(A, o);
          b.then(0.05);
        }),
      );
    },
  );
  b.step(
    {
      title: "Bolt the bottom rails through the middle frame",
      detail: "Hold a long rail (8) on the left and a short rail (6) on the right of the middle frame's lowest holes, front and back. One long bolt (B) with a washer (C) each side goes through one rail end, the leg and into the other rail: 2 bolts, 4 washers.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      const y = LEVELS[0];
      [bigRails[0], shortRails[0], bigRails[1], shortRails[1]].forEach((k) => b.add(k, [0, 200, 0]));
      b.then(0.12);
      [-1, 1].forEach((g, i) => {
        const z = g * hz(y);
        b.fit(C, { on: bigRails[i], at: [XM - P / 2 - 20, y, z], dir: [1, 0, 0], hole: false });
        b.fit(C, { on: shortRails[i], at: [XM + P / 2 + 20, y, z], dir: [-1, 0, 0], hole: false });
        b.fit(B, { on: bigRails[i], at: [XM - P / 2 - 40, y, z], dir: [1, 0, 0], mate: shortRails[i] });
        b.then(0.08);
      });
    },
  );
  b.step(
    {
      title: "Bolt the other short rails to the middle frame",
      detail: "A short rail (6) front and back at each of the three higher holes on the middle frame's right side, a bolt (A) with a washer (C) into each: 6 in all, about 80% tight. The rail ends' flats go against the leg.",
      kind: "bolts",
      tools: ["allen"],
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
      detail: "The right frame over the free ends of all eight short rails, a bolt (A) with a washer (C) into each: 8 in all, about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      people: 2,
    },
    () => {
      shortRails.forEach((k, j) => {
        const y = LEVELS[j >> 1], z = (j % 2 ? 1 : -1) * hz(y);
        bolt(A, frameAt(2, y), XR, -1, y, z, k);
      });
    },
  );
  b.step(
    {
      title: "Bolt the top rail to the middle frame",
      detail: "The third long rail (8) into the hole near the top of the middle frame's left side, with a bolt (A) and washer (C): about 80% tight. This is the one you hang coats on.",
      kind: "bolts",
      tools: ["allen"],
    },
    () => {
      b.add(topRail, [-200, 0, 0]);
      b.then(0.12);
      bolt(A, uppers[1], XM, -1, TOP_RAIL, 0, topRail);
    },
  );
  b.step(
    {
      title: "Bolt on the left frame",
      detail: "The left frame over the free ends of the three long rails, a bolt (A) with a washer (C) into each: about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      people: 2,
    },
    () => {
      bigRails.forEach((k, i) => bolt(A, lowers[0], XL, 1, LEVELS[0], (i ? 1 : -1) * hz(LEVELS[0]), k));
      bolt(A, uppers[0], XL, 1, TOP_RAIL, 0, topRail);
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
      title: "Stand it square and tighten every bolt",
      detail: "Stand it on the floor, press down on it so all three frames sit flat and upright, not leaning, then tighten every bolt the whole way with the allen key (D).",
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

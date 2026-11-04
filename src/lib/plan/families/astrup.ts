import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rod } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK ASTRUP shelving unit, 4 shelves 59x112x24 (3650042) and 6 shelves 59x176x24 (3650043), read from their
 * 15-page manuals (Rev 1, 29.01.2024). Two black steel ladder frames (3: 235 deep, 13 mm square tube, a rung under
 * every shelf and one between) hold 560x235x12 shelves: the bracket shelf (1) and the rest (2), the lowest 30 mm off
 * the floor, 308 mm apart, the posts standing 120 mm over the top one. An X brace of two Ø5 rods (4) crosses the back
 * over the second and third bays. Built lying on its back: the anti-tip bracket onto shelf 1 first, the shelves
 * between the frames (A, two through each post end), stood up, the brace on (B into the posts, C over its eyes),
 * then fixed to the wall. The other ASTRUP pieces (TV bench, desk, trolley) aren't these: they fall to their kinds.
 */

const A: HwDef = { kind: "bolt", len: 40, dia: 6.3, flush: true, name: "Connector bolt" }; // 6.3x40, the 4 mm allen key (F)
const B: HwDef = { kind: "stud", len: 8, dia: 4, name: "Threaded stud" }; // M4x8
const C: HwDef = { kind: "bolt", len: 12, dia: 4, name: "Cap bolt" }; // M4x12
const D: HwDef = { kind: "screw", len: 12, dia: 4.2 }; // 4.2x12
const E: HwDef = { kind: "bracket", len: 75, dia: 25, name: "Anti-tip bracket" }; // 75x25x15

const W = 586, DEP = 235, T = 13, SH = 12; // overall width and depth, tube, shelf thickness
const X0 = W / 2 - T / 2, Z0 = DEP / 2 - T / 2; // the posts' centres
const LOW = 30, GAP = 308, OVER = 120; // under the bottom shelf, between shelves, posts over the top one

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "shelf" || Math.round(s.size.w) !== 59 || Math.round(s.size.d) !== 24) return false;
  const H = s.size.h * 10;
  const n = Math.round((H - LOW - OVER + GAP) / (GAP + SH));
  if (n !== 4 && n !== 6) return false;
  const HT = LOW + n * SH + (n - 1) * GAP + OVER; // 1122 or 1762, the manual's height
  const ys = Array.from({ length: n }, (_, i) => LOW + SH / 2 + i * (GAP + SH)); // shelf centres, bottom up
  const brk = n === 4 ? n - 1 : n - 2; // the bracket shelf (1): the top one of four, the second from the top of six

  /* ---------- parts ---------- */

  // a ladder frame: front and back posts, a rung under every shelf, one halfway between, and one across the top
  const rungs = [...ys.map((y) => y - SH / 2 - T / 2), ...ys.slice(0, -1).map((y) => y + (GAP + SH) / 2), HT - T / 2];
  const frame = b.compound(
    "Side frame",
    [
      ...[-Z0, Z0].map((z): PartPiece => ({ shape: "box", size: [T, HT, T], pos: [0, HT / 2, z] })),
      ...rungs.map((y): PartPiece => ({ shape: "box", size: [T, T, DEP - 2 * T], pos: [0, y, 0] })),
    ],
    { material: "metal", label: "3" },
  );
  // the two frames are the same: one type, placed at each side
  const sides = [-1, 1].map((g) => b.place(frame.type, [frame.mid[0] + g * X0, frame.mid[1], frame.mid[2]]));
  const shelf1 = b.part("Shelf", [W - 2 * T, SH, DEP], { material: "board", label: "1" });
  const shelf2 = b.part("Shelf", [W - 2 * T, SH, DEP], { material: "board", label: "2" });
  const shelves = ys.map((y, i) => b.place(i === brk ? shelf1 : shelf2, [0, y, 0]));

  // the X brace on the back posts' back faces, over the second and third bays
  const zb = -DEP / 2 - 3;
  const y0 = ys[1] + 40, y1 = ys[3] - 40;
  const ends: Vec3[] = [[-X0, y0, zb], [X0, y1, zb], [X0, y0, zb], [-X0, y1, zb]];
  const xb = b.compound("Cross brace", [rod(ends[0], ends[1], 5), rod(ends[2], ends[3], 5)], { material: "metal", label: "4" });
  const brace = b.place(xb.type, xb.mid);

  /* ---------- fittings, where they end up ---------- */

  const top = ys[brk] + SH / 2;
  const aBolts = ys.flatMap((y, i) =>
    [0, 1].flatMap((k) => [-Z0, Z0].map((z): FitOpts => ({ on: sides[k], at: [(k ? 1 : -1) * (W / 2), y, z], dir: [k ? -1 : 1, 0, 0], mate: shelves[i] }))),
  );

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Screw the anti-tip bracket to shelf 1",
      detail: `Shelf 1 is the one with two small holes near its back edge${n === 6 ? " (it goes second from the top)" : " (it goes at the top)"}. The bracket (E) over them, its tab up at the back edge, with the two short screws (D): about 80% tight for now.`,
      kind: "screws",
      tools: ["screwdriver"],
      warnings: ["floor"],
    },
    () => {
      b.add(shelves[brk], [0, 0, 250]);
      b.then(0.15);
      b.fit(E, { on: shelves[brk], at: [0, top, -DEP / 2 + 10], dir: [0, -1, 0], travel: 60 });
      b.then(0.1);
      b.fits(D, [-20, 20].map((x): FitOpts => ({ on: shelves[brk], at: [x, top + 2, -DEP / 2 + 25], dir: [0, -1, 0] })), 0.1);
    },
  );
  b.step(
    {
      title: `Bolt the ${n} shelves between the side frames`,
      detail: `Lay one side frame (3) on the floor, stand the shelves in it at its rungs with shelf 1 ${n === 6 ? "second from the top" : "at the top"} and its bracket at the back, then lay the other frame over them. Two connector bolts (A) through the posts into each shelf end, with the allen key (F): ${n * 4} in all.`,
      kind: "bolts",
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], [-250, 0, 0]);
      b.then(0.12);
      b.stagger(0.12);
      ys.forEach((_, i) => i !== brk && b.add(shelves[i], [0, 0, 250]));
      b.then(0.12);
      b.add(sides[1], [250, 0, 0]);
      b.then(0.12);
      b.fits(A, aBolts, n > 4 ? 0.03 : 0.05);
    },
  );
  b.step(
    {
      title: "Stand it up and fit the X brace",
      detail: "Two of you: tip it up onto its posts. Screw the four threaded studs (B) into the holes in the back posts, hook the brace's eyes (4) over them, crossing in the middle, and screw a cap bolt (C) into each.",
      kind: "screws",
      tools: ["screwdriver"],
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.add(brace, [0, 0, -250]);
      b.then(0.15);
      for (const e of ends) {
        b.fit(B, { on: sides[e[0] < 0 ? 0 : 1], at: [e[0], e[1], -DEP / 2], dir: [0, 0, 1], hole: false });
        b.then(0.05);
        b.fit(C, { on: brace, at: e, dir: [0, 0, 1], hole: false });
        b.then(0.08);
      }
    },
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it back against the wall, mark through the bracket's tab, drill, plug and screw it to the wall, then tighten the bracket's two screws (D) fully. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      b.fit(HW.plug, { at: [0, top + 15, -DEP / 2 - 20], dir: [0, 0, -1] });
      b.then(0.05);
      b.fit(HW.wallScrew, { at: [0, top + 15, -DEP / 2 - 18], dir: [0, 0, -1] });
    },
  );
  b.step({ title: "Keep to the weight limit", detail: "5 kg on each shelf.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["ASTRUP"], build };
export default family;

import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rod } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK ASTRUP shelving unit, 4 shelves 59x112x24 (3650042) and 6 shelves 59x176x24 (3650043), read from their
 * 15-page manuals (Rev 1, 29.01.2024). Two black steel ladder frames (3: 235 deep, 13 mm square tube, a rung between
 * each two shelves and one across the top, open legs under the bottom shelf) hold 560x235x12 shelves: the bracket
 * shelf (1) and the rest (2), the lowest 30 mm off the floor, 308 mm apart, the posts standing 120 mm over the top
 * one. An X brace of two Ø5 rods (4) crosses the back over the second and third bays. Built lying on its front: the
 * anti-tip bracket under shelf 1 first, the shelves between the frames (A, two through each post end), stood up, the
 * brace on (C through each eye into a back post, B into it from the post's front), then fixed to the wall. The other ASTRUP pieces (TV bench, desk, trolley) aren't these: they fall to their kinds.
 */

const A: HwDef = { kind: "bolt", len: 40, dia: 6.3, flush: true, name: "Connector bolt" }; // 6.3x40, the 4 mm allen key (F)
const B: HwDef = { kind: "screw", len: 8, dia: 4, name: "Machine screw" }; // M4x8, a Phillips pan head
const C: HwDef = { kind: "barrel", len: 12, dia: 4 }; // M4x12, a plain sleeve threaded inside with a Phillips head (p13)
const D: HwDef = { kind: "screw", len: 12, dia: 4.2 }; // 4.2x12
const E: HwDef = { kind: "bracket", len: 75, dia: 25, name: "Anti-tip bracket" }; // 75x25x15
// not included: shorter than HW's, so their ends, seen through the wall, stay under shelf 1 in the finished view
const PLUG: HwDef = { ...HW.plug, len: 30 }, WALL_SCREW: HwDef = { ...HW.wallScrew, len: 35 };

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

  // a ladder frame: front and back posts, a rung 141 mm over each shelf but the top one (p11: about 177, 499, 816 on
  // the 4 shelf frame, under midway), and one across the top; nothing at the shelves, open legs under the bottom one
  const rungs = [...ys.slice(0, -1).map((y) => y + 141), HT - T / 2];
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

  // the X brace on the back posts' back faces, over the second and third bays: each rod end flattened into an eye
  // (p10, p13 inset), a disc 11 across and 2 thick flat on the post, C through its hole; the rods stop at its rim
  const zb = -DEP / 2 - 3, ze = -DEP / 2 - 1;
  const y0 = ys[1] + 40, y1 = ys[3] - 40;
  const ends: Vec3[] = [[-X0, y0, zb], [X0, y1, zb], [X0, y0, zb], [-X0, y1, zb]];
  const bar = (a: Vec3, c: Vec3) => {
    const v = c.map((k, i) => k - a[i]), l = Math.hypot(...v);
    return rod(a.map((k, i) => k + (v[i] * 5) / l) as Vec3, c.map((k, i) => k - (v[i] * 5) / l) as Vec3, 5);
  };
  const eyes = ends.map((e): PartPiece => ({ shape: "cyl", size: [11, 2, 11], pos: [e[0], e[1], ze], rot: [Math.PI / 2, 0, 0] }));
  const xb = b.compound("Cross brace", [bar(ends[0], ends[1]), bar(ends[2], ends[3]), ...eyes], { material: "metal", label: "4" });
  const brace = b.place(xb.type, xb.mid);

  /* ---------- fittings, where they end up ---------- */

  const under = ys[brk] - SH / 2; // shelf 1's underside: the bracket goes there, its tab down behind the back edge (p13, p14)
  const aBolts = ys.flatMap((y, i) =>
    [0, 1].flatMap((k) => [-Z0, Z0].map((z): FitOpts => ({ on: sides[k], at: [(k ? 1 : -1) * (W / 2), y, z], dir: [k ? -1 : 1, 0, 0], mate: shelves[i] }))),
  );

  /* ---------- steps ---------- */

  b.step(
    {
      title: "Screw the anti-tip bracket to shelf 1",
      detail: `Shelf 1 is the one with two small holes near its back edge${n === 6 ? " (it goes second from the top)" : " (it goes at the top)"}: lay it with those holes up, as that face goes underneath. The bracket (E) over them with the two short screws (D), its tab over the back edge (pointing down once the shelf is in): about 80% tight for now.`,
      kind: "screws",
      tools: ["screwdriver"],
      pose: "-y",
      turn: Math.PI, // p12: the bracket on the far long edge
      warnings: ["floor"],
    },
    () => {
      b.add(shelves[brk], [0, 0, 250]);
      b.then(0.15);
      b.brackets(E, D, [{ on: shelves[brk], at: [0, under, -DEP / 2 + 10], dir: [0, 1, 0], travel: 60 }], 0.1);
    },
  );
  b.step(
    {
      title: `Bolt the ${n} shelves between the side frames`,
      detail: `Lay it on its front: the two side frames (3) on edge, turned so the small brace holes in their back posts face up, and the shelves standing between them, shelf 1 ${n === 6 ? "second from the top" : "at the top"} with its bracket at the upper (back) edge. Two connector bolts (A) through the posts into each shelf end, with the allen key (F): ${n * 4} in all.`,
      kind: "bolts",
      tools: ["allen"],
      pose: "-z",
      turn: Math.PI, // p12: seen from the legs' end, shelf 1 at the far end
      warnings: ["floor"],
    },
    () => {
      b.add(sides[0], [-250, 0, 0]);
      b.then(0.12);
      b.stagger(0.12);
      ys.forEach((_, i) => i !== brk && b.add(shelves[i], [0, 0, -250]));
      b.then(0.12);
      b.add(sides[1], [250, 0, 0]);
      b.then(0.12);
      b.fits(A, aBolts, n > 4 ? 0.03 : 0.05);
    },
  );
  b.step(
    {
      title: "Stand it up and fit the X brace",
      detail: "Two of you: stand it up. Hold each eye of the brace (4) over the hole in a back post, the rods crossing in the middle, push a barrel nut (C) through the eye into the post from behind and screw a machine screw (B) into it from the front of the post, with the screwdriver: four of each.",
      kind: "screws",
      tools: ["screwdriver"],
      people: 2,
      turn: Math.PI, // the manual draws it from behind (p13)
      warnings: ["two"],
    },
    () => {
      b.add(brace, [0, 0, -250]);
      b.then(0.15);
      // C through the eye into the post from behind, B into it from the post's front face (p13 inset); the post's
      // back face has its hole for C, which p12 step 2 has facing up
      for (const e of ends) {
        b.hole(sides[e[0] < 0 ? 0 : 1], [e[0], e[1], -DEP / 2], [0, 0, -1], 2.5);
        b.fit(C, { on: brace, at: [e[0], e[1], ze - 1], dir: [0, 0, 1], hole: false }); // its head on the eye
        b.then(0.05);
        b.fit(B, { on: sides[e[0] < 0 ? 0 : 1], at: [e[0], e[1], -DEP / 2 + T], dir: [0, 0, -1], hole: false });
        b.then(0.08);
      }
    },
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it back against the wall and mark through the hole in the bracket's tab under shelf 1. Move it away, drill and plug the hole, then push it back, screw it to the wall through the tab and tighten the bracket's two screws (D) fully. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      // through the tab's hole, 17 mm under the shelf (p14 insets I, IV, V): the tab's back face (6 mm behind the
      // posts, BRACKET.bend 16 from its origin) on the wall, the screw's head on its front face. The screw goes with
      // shelf 1, which holds the tab, so its circle draws the tab round it
      const tab = -DEP / 2 - 6;
      b.fit(PLUG, { at: [0, under - 17, tab - 3], dir: [0, 0, -1] });
      b.then(0.1);
      b.fit(WALL_SCREW, { on: shelves[brk], at: [0, under - 17, tab + 2], dir: [0, 0, -1], hole: false });
    },
  );
  b.step({ title: "Keep to the weight limit", detail: "5 kg on each shelf.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["ASTRUP"], build };
export default family;

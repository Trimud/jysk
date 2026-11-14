import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rod } from "./_seat";
import { ladder } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK GLUDSTED shelving unit, 5 shelves 110x151x33 (3630153), read from its 16-page manual (Rev 1, 03.02.2026).
 * Two chrome ladder frames (3: 1505 tall, 330 deep, 19 mm tube, a rung at each shelf) are joined by ten 730 mm
 * rails (2), a front and a back one at each level, and five oval glass shelves (1: 1100x290x5) lie on them on felt
 * pads, overhanging the frames at both ends. An X brace of two Ø6 rods (4) crosses the back over the two lowest bays.
 * The brace crossed and bolted at the middle (A, nut C), then bolted to the frames lying front down (A, p12); stood up,
 * the rails go between the frames' rungs (B, two per rail, p13), every bolt tightened, then the pads (F), fixed to the wall
 * (G, p15), the glass slid on from the side (p16).
 */

const A: HwDef = { kind: "bolt", len: 12, dia: 6 }; // M6x12
const B: HwDef = { kind: "bolt", len: 30, dia: 6 }; // M6x30
const C: HwDef = { kind: "nut", len: 5, dia: 6, name: "Nut" }; // M6/10
const F: HwDef = { kind: "glide", len: 3, dia: 20, name: "Felt pad" }; // Ø20
const G: HwDef = { kind: "spacer", len: 20, dia: 19, name: "Wall spacer", form: "saddle" }; // Ø19x20: between the back post and the wall, its hollow end on the post
const SCREW: HwDef = { ...HW.wallScrew, len: 70 }; // not included: through the post (19) and G (20) into the plug

const W = 1100, FW = 725, DEP = 330, T = 19, RT = 15, GD = 290, GT = 5, HT = 1505;
const X0 = FW / 2 + T / 2; // the frames' centres
const LEVELS = [254, 598, 892, 1186, 1480]; // each rung's top, bottom up: 235, 325 and 3 x 275 clear between them
const RZ = 86; // the rails, front and back, into each rung 86 off its middle: its two holes, 79 in from the frame's edges (p11)
const PZ = 120; // the pads on each rung, between the post and the rail (p14, not to scale: estimated)

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

  // the oval glass, one piece: a straight middle and a round end each side, traced as one outline (the corners
  // rounded off fully, so the points read as a smooth curve, not facets)
  const flat = W - GD;
  const oval: [number, number][] = [-1, 1].flatMap((g) =>
    Array.from({ length: 13 }, (_, i): [number, number] => {
      const a = -Math.PI / 2 + (i * Math.PI) / 12;
      return [g * (flat / 2 + (GD / 2) * Math.cos(a)), g * (GD / 2) * Math.sin(a)];
    }),
  );
  const piece: PartPiece = { shape: "slab", size: [W, GT, GD], pos: [0, 0, 0], outline: oval, round: 1000 };
  const glass = b.compound("Glass shelf", [piece], { material: "glass", label: "1" });
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
      page: 12,
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
      page: 12,
      title: "Bolt the brace to the side frames",
      detail: "Lay the two side frames (3) on the floor on their front posts, rungs facing each other, so the back posts are on top. Lay the brace across the back posts over the two lowest bays and drop a short bolt (A) through each rod end into the post: about 80% tight. Mind that the bolt holes for the rails face inward.",
      kind: "bolts",
      tools: ["allen"],
      pose: "-z", // front down, back up, the brace on top (p12)
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
      page: 13,
      title: "Bolt the ten rails between the frames",
      detail: "Two of you: stand the frames up on their feet. Then a rail (2) at the front and the back of every rung, with the holes for the pads facing up. Two of the long bolts (B) through the rungs into each rail, one at each end: 20 in all, about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      people: 2,
      turn: Math.PI, // seen from behind, the brace on the near side (p13)
      warnings: ["two"],
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
      page: 13,
      title: "Tighten every bolt",
      detail: "Check it stands square and doesn't rock, then tighten all the bolts the whole way with the allen key (D): the rails' and the brace's.",
      kind: "bolts",
      tools: ["allen"],
      turn: Math.PI, // from behind again (p13)
      warnings: ["square"],
    },
    () => {},
  );
  b.step(
    {
      page: 14,
      title: "Press in the felt pads",
      detail: "One pad (F) into the hole in the middle of each rail and two into the holes at the ends of each frame's rung, by the posts: 30 in all. The glass sits on these, never on bare metal.",
      kind: "general",
    },
    () => {
      b.fits(
        F,
        LEVELS.flatMap((y, l) => [
          // one in the middle of each rail, then two on each frame's rung (p14)
          ...[-RZ, RZ].map((z, k): FitOpts => ({ on: rails[2 * l + k], at: [0, y + 3, z], dir: [0, -1, 0], hole: false })),
          ...sides.flatMap((f, k) => [-PZ, PZ].map((z): FitOpts => ({ on: f, at: [(k ? 1 : -1) * X0, y + 3, z], dir: [0, -1, 0], hole: false }))),
        ]),
        0.03,
      );
    },
  );
  b.step(
    {
      page: 15,
      title: "Fix it to the wall",
      detail: "Push it back against the wall. Through the hole in each back post, just under the second rung from the top, mark the wall. Move the shelf away, drill and plug the marks, then put it back with a spacer (G) between each post and the wall, its hollow end against the post, and drive a screw through the post and the spacer into the plug. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "hammer"],
      turn: -0.35, // 3/4 from the front left with the wall behind, the two back posts' fixings apart (p15)
      wall: true,
      warnings: ["wall", "tip"],
    },
    () => {
      // through the hole in each back post just under the rung of the second level from the top (p15, insets I and IV):
      // the plug in the wall, G between the post's back and the wall, its hollow end on the post, and the screw from
      // the room side through the post and G into the plug. The wall's face is at the brace's back (stage's ensureWall),
      // 7 behind the posts: G's back on it, its hollow end round the post
      const yc = LEVELS[3] - RT - 15, wz = zb - 3;
      const xs = [-1, 1].map((g) => g * X0);
      b.fits(HW.plug, xs.map((x): FitOpts => ({ at: [x, yc, wz], dir: [0, 0, -1], wall: true })), 0.1);
      b.then(0.1);
      b.fits(G, xs.map((x, k): FitOpts => ({ on: sides[k], at: [x, yc, wz], dir: [0, 0, -1], hole: false, wall: true })), 0.1);
      b.then(0.1);
      b.fits(SCREW, xs.map((x, k): FitOpts => ({ on: sides[k], at: [x, yc, -DEP / 2 + T], dir: [0, 0, -1], wall: true })), 0.1);
    },
  );
  b.step(
    {
      page: 16,
      title: "Slide the glass shelves on",
      detail: "Slide each oval glass shelf (1) in from the side, round end first, between the posts and over its pads. Centre it so it overhangs both frames by the same amount, about 170 mm: measure it with the tape.",
      kind: "shelves",
      tools: ["tape"],
      people: 2,
      warnings: ["two"],
    },
    () => {
      // in from the right end at its own level, as the manual's arrows (p16): 290 wide between posts 292 apart
      b.stagger(0.15);
      shelves.forEach((k) => b.add(k, [1000, 0, 0]));
      b.stagger(0);
    },
  );
  b.step({ page: 16, title: "Keep to the weight limit", detail: "5 kg on each glass shelf.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["GLUDSTED"], build };
export default family;

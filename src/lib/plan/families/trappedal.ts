import type { LayoutOption, PartPiece, ProductSpec, Vec3 } from "../../types";
import { BRACKET } from "@/engine/sizes";
import { HW, holeR, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import { STEP_CAM } from "../sight";
import { box, ladder as tubeFrame } from "./_metal";
import type { Family } from "./family";

/**
 * JYSK TRAPPEDAL steel-frame pieces, read from their manuals: the shelving units 70x109x30, 5 shelves (3600987,
 * 3601268, 18 pages) and 70x178x30, 7 shelves (3601018, 3601269, 3601428, 18 pages, the same steps with three small
 * and three wide shelves), and the hallway unit 90x178x40 (3699059, 3690569, 29 pages, below). The other TRAPPEDAL
 * pieces (cabinet, console, desk, wall shelf) aren't these: they fall to their kinds.
 *
 * The shelving: a black square-tube frame: two side ladders (2 left, 3 right), each two 16 mm posts with a cross bar at every shelf
 * and a top bar, and a shorter middle ladder (4) between the bottom and the top. The wooden shelves (top 1, bottom 7,
 * two narrow 5 on the left, two wide 6 on the right, staggered) each sit in a pair of metal edge rails, and every
 * joint is an M6 countersunk bolt (A) through a post into a rail end. It is built lying on its front, back up (p12 to
 * p15, the ladders on edge): the small shelves onto the left ladder, the middle ladder, the bottom, the top (its two
 * sockets over the middle posts, two short bolts B through their sides), the wide shelves, the right ladder; then the
 * anti-tip bracket on the top's back rail, stood up, levelled on its feet and fixed.
 *
 * The hallway unit: two side ladders (3 left, three rungs; 2 right, five), the top (1), a middle and a bottom shelf (7),
 * a hanging rail (4) under the top the full width, and on the right a middle ladder (5) over the middle shelf with two
 * small shelves (6), carried to the floor by two bars (8) under the middle shelf and two short ones (9) under the bottom
 * one, all screwed together on long bolts (C). Bolted the same way
 * lying on its back, the middle ladder on long bolts (C), then two anti-tip brackets (D) on short bolts (B).
 */

const T = 16; // tube, rail and board thickness
const A: HwDef = { kind: "bolt", len: 35, dia: 6, flush: true }; // M6x35, countersunk into the tube
const B: HwDef = { kind: "bolt", len: 12, dia: 6 }; // M6x12, a raised round head (p14, p19)
const C: HwDef = { kind: "bracket", len: 75, dia: 25, name: "Anti-tip bracket" };
// M6x50, the hallway unit's C: no head, threaded both ends, a thin round flange about 12 mm from one end; that short
// end screws into a post or bar up to the flange, the long end sticks out (p14, p16): the rod "collar" form
const LONG: HwDef = { kind: "rod", len: 50, dia: 6, name: "Long bolt", form: "collar" };

// heights in mm (centres of the boards), from the manual's dimensions: legs 91, then 234/334/367 left, 360/360/215 right
// the 7-shelf: legs 91, then 325/424/424/436 left, 454/454/454/247 right; h, the posts' height
type Heights = { h: number; bottom: number; s5: number[]; s6: number[]; top: number };
const SIZES: Record<number, Heights> = {
  109: { h: 1090, bottom: 99, s5: [349, 699], s6: [475, 851], top: 1082 },
  178: { h: 1780, bottom: 99, s5: [440, 880, 1320], s6: [569, 1039, 1509], top: 1772 },
};
const XL = -350, XR = 350; // outer faces of the side ladders
const XM = [-80, -64]; // the middle ladder's faces: 254 mm to its left, 398 to its right
const XMC = (XM[0] + XM[1]) / 2; // and its centre
const ZP = 142; // the posts' centres, front (+) and back (-)

function shelving(b: PlanBuilder, Y: Heights) {
  const words = ["no", "one", "two", "three", "four"];

  /* ---------- parts, the manual's numbers as labels; frames metal, shelves wood in metal edge rails ---------- */
  /** One part type drawn from pieces (where the first one goes), placed at each height in `ys` (the first is the pieces' own). */
  const part = (name: string, label: string, pieces: PartPiece[], material: "metal" | "board", ys: number[] = [pieces[0].pos[1]]) => {
    const { type, mid } = b.compound(name, pieces, { material, label });
    return ys.map((y) => b.place(type, [mid[0], mid[1] + y - ys[0], mid[2]]));
  };
  // the side ladders stand on screw-in levelling feet, pre-fitted (p12 and p15 insets, p16): a round glide and a
  // short stud up into the post end
  const FOOT = 10;
  const foot = (x: number, z: number): PartPiece[] => [
    { shape: "cyl", size: [22, 7, 22], pos: [x, 3.5, z] },
    { shape: "cyl", size: [8, FOOT - 7 + 2, 8], pos: [x, (7 + FOOT + 2) / 2, z] },
  ];
  const ladder = (name: string, label: string, x: number, y0: number, y1: number, bars: number[], feet = false) =>
    part(name, label, [
      ...[-ZP, ZP].map((z): PartPiece => ({ shape: "box", size: [T, y1 - y0, T], pos: [x, (y0 + y1) / 2, z] })),
      ...bars.map((y): PartPiece => ({ shape: "box", size: [T, T, 2 * ZP - T], pos: [x, y, 0] })),
      ...(feet ? [-ZP, ZP].flatMap((z) => foot(x, z)) : []),
    ], "metal")[0];
  const shelves = (name: string, label: string, x0: number, x1: number, ys: number[], extra: PartPiece[] = []) =>
    part(name, label, [
      { shape: "box", size: [x1 - x0, T, 266], pos: [(x0 + x1) / 2, ys[0], 0], material: "board" },
      ...[-141, 141].map((z): PartPiece => ({ shape: "box", size: [x1 - x0, T, T], pos: [(x0 + x1) / 2, ys[0], z], material: "metal" })),
      ...extra,
    ], "board", ys);
  // the top's two square sockets under its rails, over the middle posts' ends (p11 part 1, p13 inset): an open tube,
  // 2 mm walls round the 16 mm post, SOCK deep
  const SOCK = 30, yS = Y.top - T / 2 - SOCK / 2;
  const socket = (z: number): PartPiece[] => [
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [2, SOCK, T + 4], pos: [XMC + g * (T / 2 + 1), yS, z], material: "metal" })),
    ...[-1, 1].map((g): PartPiece => ({ shape: "box", size: [T, SOCK, 2], pos: [XMC, yS, z + g * (T / 2 + 1)], material: "metal" })),
  ];
  const [top] = shelves("Top", "1", XL + T, XR - T, [Y.top], [...socket(-ZP), ...socket(ZP)]);
  const left = ladder("Left frame", "2", XL + T / 2, FOOT, Y.h, [Y.bottom, ...Y.s5, Y.top], true);
  const right = ladder("Right frame", "3", XR - T / 2, FOOT, Y.h, [Y.bottom, ...Y.s6, Y.top], true);
  const middle = ladder("Middle frame", "4", XMC, 108, Y.h - 17, [...Y.s5, ...Y.s6]);
  const s5 = shelves("Small shelf", "5", XL + T, XM[0], Y.s5);
  const s6 = shelves("Wide shelf", "6", XM[1], XR - T, Y.s6);
  const [bottom] = shelves("Bottom shelf", "7", XL + T, XR - T, [Y.bottom]);
  // each small and wide shelf with its height, for the bolts into it
  const at5 = Y.s5.map((y, i): [number, string] => [y, s5[i]]);
  const at6 = Y.s6.map((y, i): [number, string] => [y, s6[i]]);

  /* ---------- helpers ---------- */
  // the manual's two-person mark heads the whole build (p10)
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "-z", people: 2, ...d }, body);
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  const DOWN: Vec3 = [0, 0, -250]; // lowered in from above, lying on its front
  /** Bolts A through a ladder's posts (front and back) at height y, from face x the way `dir` goes, into a shelf's rails. */
  const bolts = (on: string, x: number, dir: number, ys: [number, string][]) => {
    b.fits(A, ys.flatMap(([y, mate]) => [ZP, -ZP].map((z): FitOpts => ({ on, at: [x, y, z], dir: [dir, 0, 0], mate }))), 0.08);
    b.then(0.1);
  };

  /* ---------- lying on its front on a rug, back up: the ladders on edge (p12 to p15) ---------- */
  step({ page: 12, title: `Bolt the ${words[Y.s5.length]} small shelves to the left frame`, detail: `Stand the left frame (2) on its front edge on a rug, feet at the bottom end. Stand the small shelves (5) on their front edges beside it at its cross bars and bolt each through the front and back post from outside with the Allen key: ${2 * Y.s5.length} bolts.`, kind: "bolts", tools: ["allen"], warnings: ["floor"], turn: Math.PI }, () => {
    put([left], DOWN);
    put(s5, [200, 0, 0]);
    bolts(left, XL, 1, at5);
  });
  step({ page: 12, title: "Bolt the middle frame on", detail: `The middle frame (4), on its front edge too, onto the other ends of the small shelves, the holes in its posts' sides at the top end: ${2 * Y.s5.length} bolts.`, kind: "bolts", tools: ["allen"] }, () => {
    put([middle], [200, 0, 0]);
    bolts(middle, XM[1], -1, at5);
  });
  step({ page: 13, title: "Bolt on the bottom shelf", detail: "The bottom shelf (7): two bolts through the left frame into its end, two through its rails into the feet of the middle frame's posts.", kind: "bolts", tools: ["allen"], turn: Math.PI }, () => {
    put([bottom], DOWN);
    bolts(left, XL, 1, [[Y.bottom, bottom]]);
    b.fits(A, [ZP, -ZP].map((z): FitOpts => ({ on: bottom, at: [XMC, Y.bottom - T / 2, z], dir: [0, 1, 0], mate: middle })), 0.08);
  });
  step({ page: 13, title: "Slide the top onto the middle frame", detail: "Its two square sockets underneath go over the ends of the middle frame's posts.", kind: "join", turn: Math.PI }, () => put([top], [0, 250, 0]));
  // B through the hole in each socket's side into the post's side, both from the back (p14): the back one from
  // outside, the front one from inside the unit
  step({ page: 14, title: "Bolt the top on", detail: "Two bolts through the left frame into the top's end, then the two short bolts (B) through the holes in the sides of the top's sockets into the middle frame's posts.", kind: "bolts", tools: ["allen"], turn: Math.PI }, () => {
    bolts(left, XL, 1, [[Y.top, top]]);
    b.fits(B, [-ZP, ZP].map((z): FitOpts => ({ on: top, at: [XMC, yS, z - T / 2 - 2], dir: [0, 0, 1], mate: middle })), 0.1);
  });
  step({ page: 14, title: `Bolt the ${words[Y.s6.length]} wide shelves to the middle frame`, detail: `The wide shelves (6), on their front edges, at the middle frame's other cross bars: ${2 * Y.s6.length} bolts through its posts.`, kind: "bolts", tools: ["allen"], turn: Math.PI }, () => {
    put(s6, [200, 0, 0]);
    bolts(middle, XM[0], 1, at6);
  });
  step({ page: 15, title: "Bolt on the right frame", detail: `The right frame (3) over the ends of the bottom, the ${words[Y.s6.length]} wide shelves and the top: ${2 * (Y.s6.length + 2)} bolts.`, kind: "bolts", tools: ["allen"] }, () => {
    put([right], [200, 0, 0]);
    bolts(right, XR, -1, [[Y.bottom, bottom], ...at6, [Y.top, top]]);
  });
  // the bracket's slotted leg flat on the top's back rail, running front to back, its short leg down behind the rail
  // (p15 inset, p17 I and IV); B through the slot into the hole in the middle of the rail (p11 part 1). The fitting's
  // short leg stands against its dir, so dir points up to hang it down.
  const BR: Vec3 = [0, Y.top + T / 2 + 2, -139];
  step({ page: 15, title: "Screw the anti-tip bracket to the top", detail: "On the top, in the middle of its back edge: the bracket's slotted leg flat on the top, running front to back, its short leg down over the back edge, and the third short bolt (B) through the slot into the top's back rail. Tighten it to about 80%: fully once it is against the wall.", kind: "screws", tools: ["allen"] }, () => {
    b.fit(C, { on: top, at: BR, dir: [0, 1, 0], travel: 0, hole: false, wall: true });
    b.then(0.1);
    b.fit(B, { on: top, at: BR, dir: [0, -1, 0], wall: true });
  });

  /* ---------- standing ---------- */
  step({ page: 16, title: "Stand it up and level it", detail: "Two of you: tip it up onto its feet. Lay a spirit level on the top and turn the feet under the posts until it stands level and doesn't rock.", kind: "standup", tools: ["level"], pose: "+y", warnings: ["two"] });
  // through the hole in the bracket's short leg, 7 mm under the top (p17 IV)
  step({ page: 17, title: "Fix it to the wall", detail: "Push it against the wall, mark through the hole in the bracket's short leg, drill, plug and screw it to the wall, then tighten the bracket's bolt fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer", "allen"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fit(HW.plug, { at: [0, Y.top - 7, -170], dir: [0, 0, -1] });
    b.then(0.05);
    b.fit(HW.wallScrew, { at: [0, Y.top - 7, -153], dir: [0, 0, -1] });
  });
  step({ page: 18, title: "Keep to the weight limits", detail: "5 kg on each shelf and on the top.", kind: "general", pose: "+y" });
}

/* ---------------- the hallway unit ---------------- */

// p18 step 12: the same unit stood four ways against the wall, each on its own pages; nothing moves but the brackets.
// A and B (pp. 19 to 22) put two brackets on one long edge of the top or the other; C and D (pp. 23 to 28) take the
// hanging rail's bolt out of one side frame's top rung, put it back through one bracket and stand that end to the wall
const LAYOUTS: LayoutOption[] = [
  { id: "A", label: "Back to the wall: hanging rail on the left, shelves on the right" },
  { id: "B", label: "Turned round: shelves on the left, hanging rail on the right" },
  { id: "C", label: "End to the wall, the shelves' side frame against it", leaves: "one anti-tip bracket and the short bolts" },
  { id: "D", label: "End to the wall, the hanging rail's side frame against it", leaves: "one anti-tip bracket and the short bolts" },
];

function hallway(b: PlanBuilder) {
  const lay = b.pick(LAYOUTS);
  // C and D: the side frame that goes to the wall (frame 2 on the right, frame 3 on the left), else 0
  const endS = lay === "C" ? 1 : lay === "D" ? -1 : 0;
  const W = 900, H = 1780, DEP = 400, BD = 398, LOW = 95, NARROW = 254;
  const XS = W / 2 - T / 2, XM = XS - T / 2 - NARROW - T / 2; // the side frames' and the middle frame's centres
  const bottom = LOW + T, middle = bottom + 330 + T; // the bottom and middle shelves' tops
  const smalls = [middle + 330 + T, middle + 2 * (330 + T)]; // the two small shelves' tops
  const PZ = DEP / 2 - T / 2;
  // pre-fitted levelling glides in the side frames' post ends and the foot bars' free ends (p11, p18 step 11 inset,
  // p19 step 14): a round glide a little narrower than the tube on a short stud, inside the parts' sizes
  const FOOT = 10;
  const glide = (x: number, y: number, z: number): PartPiece[] => [
    { shape: "cyl", size: [14, 5, 14], pos: [x, y + 2.5, z] },
    { shape: "cyl", size: [6, FOOT - 5 + 2, 6], pos: [x, y + 5 + (FOOT - 3) / 2, z] },
  ];
  const sideFeet = [-PZ, PZ].flatMap((z) => glide(0, 0, z));

  // p11: frame 2 has five rungs (the shelves' side, right), frame 3 three (the hanging rail's, left)
  const f3 = b.compound("Side frame", [...tubeFrame(H, DEP, T, [bottom, middle, H], FOOT), ...sideFeet], { material: "metal", label: "3" });
  const f2 = b.compound("Side frame", [...tubeFrame(H, DEP, T, [bottom, middle, ...smalls, H], FOOT), ...sideFeet], { material: "metal", label: "2" });
  const left = b.place(f3.type, [f3.mid[0] - XS, f3.mid[1], f3.mid[2]]);
  const right = b.place(f2.type, [f2.mid[0] + XS, f2.mid[1], f2.mid[2]]);
  // p11: 1310 long, two rungs only, at the small shelves; its post ends open (1.5 mm into the shelves at each end, so 1310)
  const f5 = b.compound("Middle frame", tubeFrame(H - T + 1.5, DEP, T, smalls, middle - 1.5), { material: "metal", label: "5" });
  const mid = b.place(f5.type, [f5.mid[0] + XM, f5.mid[1], f5.mid[2]]);

  const full = W - 2 * T;
  const top = b.place(b.part("Top shelf", [full, T, BD], { label: "1" }), [0, H - T / 2, 0]);
  const p7 = b.part("Shelf", [full, T, BD], { label: "7" });
  const mshelf = b.place(p7, [0, middle - T / 2, 0]);
  const low = b.place(p7, [0, bottom - T / 2, 0]);
  const p6 = b.part("Small shelf", [NARROW, T, BD], { label: "6" });
  const small = smalls.map((y) => b.place(p6, [(XM + XS) / 2, y - T / 2, 0]));

  // the hanging rail (900x80, p11): a U the full width at mid depth, its arms hanging from the side frames' top rungs
  // (p13), the bar passing between the middle frame's posts
  const drop = 80;
  const railT = b.compound(
    "Hanging rail",
    [box([W, T, T], [0, H - T - drop + T / 2, 0]), ...[-XS, XS].map((x) => box([T, drop - T, T], [x, H - T - (drop - T) / 2, 0]))],
    { material: "metal", label: "4" },
  );
  const rail = b.place(railT.type, railT.mid);
  const bar8 = b.part("Support bar", [T, 330, T], { material: "metal", label: "8" });
  const bars = [-PZ, PZ].map((z) => b.place(bar8, [XM, bottom + 165, z]));
  // 90 with its glide (p11), from the bottom shelf down: the glide turned out the last 5 mm to the floor when levelling
  const bar9 = b.compound("Foot bar", [box([T, 90 - FOOT, T], [0, LOW - (90 - FOOT) / 2, 0]), ...glide(0, LOW - 90, 0)], { material: "metal", label: "9" });
  const feet = [-PZ, PZ].map((z) => b.place(bar9.type, [XM + bar9.mid[0], bar9.mid[1], z + bar9.mid[2]]));

  const through = (frame: string, x: number, g: number, board: string, y: number): FitOpts[] =>
    [-120, 120].map((z) => ({ on: frame, at: [x - g * T, y - T / 2, z], dir: [g, 0, 0], mate: board })); // x: the rung's inner face; the bolt goes in at its outer one
  const ends = (board: string, y: number) => [...through(left, -XS + T / 2, 1, board, y), ...through(right, XS - T / 2, -1, board, y)];
  // the manual's two-person mark heads the whole build (p10)
  const step = (d: StepDef, body: () => void) => b.step({ people: 2, ...d }, body);

  step(
    {
      title: "Bolt the top shelf between the side frames",
      detail: "The build is the same whichever of the manual's four ways it will stand: you pick one once the foot bars are on. Lay the side frames (2, 3) on the floor on a rug, each one's countersunk holes facing out, the top shelf (1) between their top rungs with the tabs on its edge rails underneath, and two bolts (A) through each rung into it: about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      pose: "+z",
      warnings: ["floor"],
    },
    () => {
      b.add(left, [-250, 0, 0]);
      b.add(right, [250, 0, 0]);
      b.then(0.12);
      b.add(top, [0, 250, 0]);
      b.then(0.12);
      b.fits(A, ends(top, H), 0.06);
    },
  );
  // p13 looks in from the feet end, but the bolts go into the rungs' head ends: a three-quarter view from frame 2's
  // side shows both the rail and the bolt heads
  step(
    { title: "Bolt on the hanging rail", detail: "The hanging rail (4) under the top shelf, across from frame 3 to frame 2: a bolt (A) through each frame's top rung into the end of the rail's arm, about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z", turn: Math.PI * 0.35 },
    () => {
      b.add(rail, [0, -200, 0]);
      b.then(0.12);
      // ponytail: C and D later take one of these out and put it back through a bracket (p23, p26), but a fitting goes
      // in once: that one sits 2 mm proud from here, where it ends up over the bracket, its hole still in the rung
      b.fits(A, [-1, 1].map((g): FitOpts => (g === endS ? { on: g < 0 ? left : right, at: [g * XS, H + BRACKET.t, 0], dir: [0, -1, 0], mate: rail, hole: false } : { on: g < 0 ? left : right, at: [g * XS, H, 0], dir: [0, -1, 0], mate: rail })), 0.08);
      if (endS) b.hole(endS < 0 ? left : right, [endS * XS, H, 0], [0, 1, 0], holeR(A));
    },
  );
  // p14: frame 5 on its own first, a long bolt into each post's foot; it joins the build in the next step
  const midAt: Vec3 = [XM, (middle + H - T) / 2, 0];
  step(
    { title: "Screw two long bolts into the middle frame", detail: "On its own: a long bolt (C) into the foot of each post of the middle frame (5), its short end in, up to its flange. They go through the middle shelf later.", kind: "general", scene: "mid", pose: "+z" },
    () => {
      b.stageAround([mid], midAt, [0, 0, 200]);
      b.then(0.12);
      b.fits(LONG, [-PZ, PZ].map((z): FitOpts => ({ on: mid, at: [XM, middle, z], dir: [0, 1, 0], hole: false })), 0.08);
    },
  );
  step(
    { title: "Bolt the middle frame to the top shelf", detail: "Lay the middle frame in under the top shelf, 254 mm in from frame 2, its long bolts towards the feet and its countersunk holes towards frame 3 (the side the small shelves' bolts go in from), and two bolts (A) through the top shelf into its posts: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z", turn: Math.PI },
    () => {
      b.add(mid, [0, 0, 250]);
      b.then(0.12);
      b.fits(A, [-PZ, PZ].map((z): FitOpts => ({ on: top, at: [XM, H, z], dir: [0, -1, 0], mate: mid })), 0.08);
    },
  );
  step(
    { title: "Bolt in the two small shelves", detail: "The small shelves (6) between the middle frame and frame 2, two bolts (A) into each end: 8 in all, about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.stagger(0.1);
      small.forEach((k) => b.add(k, [0, 0, 250]));
      b.stagger(0);
      b.then(0.12);
      b.fits(A, small.flatMap((k, i) => [...through(mid, XM + T / 2, 1, k, smalls[i]), ...through(right, XS - T / 2, -1, k, smalls[i])]), 0.05);
    },
  );
  step(
    { title: "Bolt in the middle shelf", detail: "A long shelf (7) under the middle frame, its long bolts through the holes in it, and two bolts (A) through each side frame's rung into its ends: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.add(mshelf, [0, -250, 0]);
      b.then(0.12);
      b.fits(A, ends(mshelf, middle), 0.06);
    },
  );
  // p16: each support bar on its own, a long bolt into one end; then screwed onto the middle frame's long bolts, its
  // own long bolt down through the bottom shelf for the foot bars (p18)
  step({ title: "Screw long bolts into the support bars", detail: "On their own: a long bolt (C) into one end of each support bar (8), its short end in, up to its flange.", kind: "general", scene: "bars", pose: "+z" }, () => {
    b.stagger(0.2);
    b.stageAround(bars, [XM, bottom + 165, 0], [0, 0, 200]);
    b.then(0.12);
    b.fits(LONG, bars.map((k, i): FitOpts => ({ on: k, at: [XM, bottom, i ? PZ : -PZ], dir: [0, 1, 0], hole: false })), 0.08);
  });
  step({ title: "Screw the support bars under the middle shelf", detail: "Screw each support bar (8) onto the long bolt sticking out under the middle shelf, its own long bolt pointing towards the feet, until tight.", kind: "general", pose: "+z" }, () => {
    b.stagger(0.25);
    bars.forEach((k) => b.add(k, [0, -250, 0], { spin: 2 }));
  });
  step(
    { title: "Bolt in the bottom shelf", detail: "The other long shelf (7) across the frames' lowest rungs, the support bars' long bolts through the holes in it, and two bolts (A) through each rung into its ends: about 80% tight.", kind: "bolts", tools: ["allen"], pose: "+z" },
    () => {
      b.add(low, [0, -250, 0]);
      b.then(0.12);
      b.fits(A, ends(low, bottom), 0.06);
    },
  );
  step({ title: "Tighten every bolt", detail: "Tighten all the bolts the whole way with the allen key (E).", kind: "bolts", tools: ["allen"], pose: "+z" }, () => {});
  step({ title: "Fit the foot bars", detail: "The two short foot bars (9), glide end down, screwed onto the long bolts under the bottom shelf, in line with the support bars above it, till tight.", kind: "legs", pose: "+z" }, () => {
    b.stagger(0.25);
    feet.forEach((k) => b.add(k, [0, -150, 0], { spin: 2 }));
    b.then(0.1);
    // the glide in a foot bar's free end, as p18's inset draws it
    b.look(feet[1], [XM, LOW - 90 + 6, PZ], { size: 28 });
  });
  // p18 step 12: the manual's four ways to stand it, each on its own pages (see LAYOUTS)
  b.layouts(LAYOUTS);
  step(
    {
      page: 18,
      title: "Choose which way it stands",
      detail: "The manual gives four ways to stand it against the wall: pick one. A: its back to the wall, the hanging rail on the left and the shelves on the right. B: turned round, its other face to the wall, so the shelves are on the left. C: one end to the wall, the shelves' side frame (2) against it, on one bracket. D: the same with the hanging rail's side frame (3) against the wall.",
      kind: "general",
      pose: "+z",
      turn: Math.PI,
    },
    () => {},
  );
  // the view round from the front of it as it stands: B turned round, C and D seen from their open end
  const turn = { A: 0, B: Math.PI, C: -Math.PI / 2, D: Math.PI / 2 }[lay] ?? 0;
  const pages = { A: [19, 19, 20], B: [21, 21, 22], C: [23, 24, 25], D: [26, 27, 28] }[lay] ?? [19, 19, 20];
  const plug: HwDef = { kind: "plug", len: 35, dia: 8, notIncluded: true };
  const screw: HwDef = { kind: "screw", len: 50, dia: 5, notIncluded: true };
  // the wall on the face it stands with to it, looked at from the other side: B's front; C's and D's end, its face 1 mm
  // past the bracket's bend, as A's is behind the back edge
  if (lay === "B") b.view({ az: STEP_CAM.az + turn, wall: "+z" });
  if (endS) b.view({ az: STEP_CAM.az + turn, wall: endS > 0 ? "+x" : "-x", wallZ: endS * (XS + BRACKET.bend + 1) });
  if (!endS) {
    // A (p19, p20) and B (p21, p22), still lying: the slotted leg flat on the top, B down through the slot, the short
    // leg standing up at the edge, one 125 mm in from each end over the end holes in the top's edge rail (p11). A: the
    // back edge, on the floor as it lies; B: the front edge, facing up, so that face goes to the wall
    const g = lay === "B" ? 1 : -1;
    const brX = [-(full / 2 - 125), full / 2 - 125];
    const BZ = g * (BD / 2 - BRACKET.bend); // the short leg's outer face on the edge
    const edge = g < 0 ? "back edge (the one on the floor)" : "front edge (the one facing up)";
    step(
      { page: pages[0], title: "Screw the anti-tip brackets on", detail: `Two brackets (D) on the top shelf at its ${edge}, one 125 mm in from each end over the holes in its edge rail: the slotted leg flat on the top, the short leg up at the edge, and a short bolt (B) down through the slot: about 80% tight for now.${g > 0 ? " That edge goes to the wall." : ""}`, kind: "screws", tools: ["allen"], pose: "+z", turn: Math.PI },
      () => {
        b.fits(C, brX.map((x): FitOpts => ({ on: top, at: [x, H, BZ], dir: [0, -1, 0], travel: 60, ...(g > 0 ? { twist: Math.PI } : {}) })), 0.1);
        b.then(0.1);
        b.fits(B, brX.map((x): FitOpts => ({ on: top, at: [x, H + 2, BZ - g * 6], dir: [0, -1, 0] })), 0.1);
      },
    );
    standUp(pages[1]);
    step(
      {
        page: pages[2],
        title: "Fix it to the wall",
        detail: "Push it back against the wall, mark through both brackets' short legs, drill, plug and screw them to the wall, then tighten the brackets' bolts fully with the allen key. Wall plugs and screws aren't included: pick ones made for your wall.",
        kind: "anchor",
        tools: ["drill", "pencil", "screwdriver", "hammer", "allen"],
        wall: true,
        warnings: ["wall", "tip"],
        ...(turn ? { turn } : {}),
      },
      () => {
        // through the hole in each short leg, 17 mm above the top (p20 IV)
        b.fits(plug, brX.map((x): FitOpts => ({ at: [x, H + 17, g * (BD / 2 + 21)], dir: [0, 0, g] })), 0.08);
        b.then(0.05);
        b.fits(screw, brX.map((x): FitOpts => ({ at: [x, H + 17, g * (BD / 2 - 2)], dir: [0, 0, g] })), 0.08);
      },
    );
  } else {
    // C (p23 to p25) and D (p26 to p28): the hanging rail's bolt in that frame's top rung comes out, and goes back in
    // through one bracket's slot; the bracket's flat leg across the rung and onto the top, the short leg up 16 mm out
    // past the frame, where the wall will be
    const frame = endS > 0 ? right : left;
    const fx = endS * XS, bend = endS * (XS + BRACKET.bend);
    const which = endS > 0 ? "frame 2 (the shelves' side)" : "frame 3 (the hanging rail's side)";
    step({ page: pages[0], title: "Take out one hanging rail bolt", detail: `Undo the bolt (A) in the middle of ${which}'s top rung, the one holding the hanging rail's arm, and keep it: it goes back in through the bracket.`, kind: "bolts", tools: ["allen"], pose: "+z", turn: Math.PI }, () => {
      b.look(frame, [fx, H, 0], { dir: [0, -1, 0], size: 30 });
    });
    step(
      { page: pages[0], title: "Bolt the anti-tip bracket on", detail: `One bracket (D) on ${which}'s top rung, its slotted leg flat across the rung, its short leg up just outside the frame, and the bolt (A) back in through the slot into the rail's arm: about 80% tight for now. That end goes to the wall.`, kind: "bolts", tools: ["allen"], pose: "+z", turn: Math.PI },
      () => {
        b.fit(C, { on: frame, at: [fx, H, 0], dir: [0, -1, 0], twist: (endS * Math.PI) / 2, travel: 60, hole: false });
      },
    );
    standUp(pages[1]);
    step(
      {
        page: pages[2],
        title: "Fix it to the wall",
        detail: `Push ${which} against the wall, mark through the bracket's short leg, drill, plug and screw it to the wall, then tighten its bolt fully with the allen key. Wall plugs and screws aren't included: pick ones made for your wall.`,
        kind: "anchor",
        tools: ["drill", "pencil", "screwdriver", "hammer", "allen"],
        wall: true,
        warnings: ["wall", "tip"],
        turn,
      },
      () => {
        b.fit(plug, { at: [bend + endS * 21, H + 17, 0], dir: [endS, 0, 0] });
        b.then(0.05);
        b.fit(screw, { at: [bend - endS * 2, H + 17, 0], dir: [endS, 0, 0] });
      },
    );
  }
  function standUp(page: number) {
    step({ page, title: "Stand it up and level it", detail: "Two of you: stand it up and turn the glides under the posts and foot bars till it stands level and doesn't rock.", kind: "standup", tools: ["level"], warnings: ["two", "square"], ...(turn ? { turn } : {}) }, () => {
      // a glide under a post on the side it is seen from, as p19's inset draws it
      if (endS) b.look(endS > 0 ? left : right, [-endS * (XS + 7), 6, PZ], { dir: [endS, 0, 0], size: 30 });
      else if (lay === "B") b.look(right, [XS, 6, -PZ - 7], { dir: [0, 0, 1], size: 30 });
      else b.look(right, [XS, 6, PZ + 7], { dir: [0, 0, -1], size: 30 });
    });
  }
  b.step({ page: 29, title: "Keep to the weight limit", detail: "5 kg on each shelf and on the top.", kind: "general" }, () => {});
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "shelf") return false;
  const w = Math.round(s.size.w), h = Math.round(s.size.h), d = Math.round(s.size.d);
  if (w === 70 && d === 30 && SIZES[h]) {
    shelving(b, SIZES[h]);
    return true;
  }
  if (w === 90 && d === 40 && h === 178) {
    hallway(b);
    return true;
  }
  return false;
}

const family: Family = { names: ["TRAPPEDAL"], build };
export default family;

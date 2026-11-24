import type { PartPiece, ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { box, post } from "./_metal";
import type { Family } from "./family";

/*
 * JYSK ELVERUM hallway unit, 3 shelves 60x175x40 (3690404), read from its 18-page manual (Rev 4, 28.06.2024).
 * A low black steel bench of two side frames (1: Ø31 posts, 400 deep, the back post 600 and the front one 464, a flat
 * rung at each shelf) joined by six Ø15 rails (2), a front and a back one at each of the three wire shoe shelves
 * (3: 483x380, its four cross wires pinned into the rails' holes). The back posts carry on up as two Ø31 tubes each
 * (4 below, its ends going into the posts, 5 above) to 1750, with two 535x90 boards between the upper ones (6 lower,
 * 7 upper) for the seven hooks (8). Built: plugs (A) and caps (C) knocked into the tube ends, feet (B), shelves on their rails,
 * rails bolted between the frames (D), tightened, boards bolted between the upper tubes (E), tightened, tubes stacked
 * on the back posts, fixed to the wall (F), hooks on.
 */

const A: HwDef = { kind: "cap", len: 15, dia: 31, name: "Threaded plug" }; // Ø31x15, for the feet
const B: HwDef = { kind: "foot", len: 35, dia: 37.5, name: "Foot" }; // Ø37.5x35
const C: HwDef = { kind: "cap", len: 15, dia: 32, name: "End cap" }; // Ø32x15
const D: HwDef = { kind: "bolt", len: 45, dia: 6, flush: true, form: "countersunk" }; // M6x45, countersunk hex socket (p9, p13)
const E: HwDef = { kind: "bolt", len: 50, dia: 6.3, name: "Connector bolt" }; // 6.3x50
const F: HwDef = { kind: "spacer", len: 27.5, dia: 15, name: "Wall fitting" }; // Ø15x27.5

const W = 600, DEP = 400, P = 31, R = 15, FOOT = 35, TUBE = 600, BW = 535, BH = 90, BT = 15, H = 1750;
const X0 = W / 2 - P / 2, Z0 = DEP / 2 - P / 2; // the posts' centres
// p11 (to scale): the frame's back post 600, its front one 464; the rail holes 69, 246 and 424 up the posts, each
// rung a flat bar 20 tall whose top is 40 over its hole, the top one level with the front post's top
const LEVELS = [69, 246.5, 424].map((y) => FOOT + y); // the rails' (and shelves') middles, 177 apart (p2: 160 clear)
const FRONT = FOOT + 464, BACK = FOOT + TUBE; // the side frame's post tops
const T4 = H - BACK - TUBE; // tube 4 between its ends (p11: 504, the rest is its two ends inside the posts)
const T5 = BACK + T4; // where tube 5 starts
// p2: the top board 60 under the posts' tops (p11's holes in tube 5 agree), the lower one 300 under it
const BOARDS = [H - 60 - 300, H - 60];

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 60 || Math.round(s.size.d) !== 40 || Math.round(s.size.h) !== 175) return false;

  /* ---------- parts ---------- */

  const frameT = b.compound(
    "Side frame",
    [post(0, -Z0, FOOT, BACK, P), post(0, Z0, FOOT, FRONT, P), ...LEVELS.map((y) => box([8, 20, DEP - 2 * P], [0, y + 30, 0]))],
    { material: "metal", label: "1" },
  );
  const sides = [-1, 1].map((g) => b.place(frameT.type, [frameT.mid[0] + g * X0, frameT.mid[1], frameT.mid[2]]));

  const railT = b.compound("Rail", [{ shape: "cyl", size: [R, BW, R], pos: [0, 0, 0], rot: [0, 0, Math.PI / 2] }], { material: "metal", label: "2" });
  const RZ = Z0; // the rails meet the posts
  const rails = LEVELS.flatMap((y) => [-RZ, RZ].map((z) => b.place(railT.type, [0, y, z])));

  // p11, p13: six long wires 54 apart on top of four cross wires 161 apart, whose ends go into the rails' holes
  const grid: PartPiece[] = [
    ...[-2.5, -1.5, -0.5, 0.5, 1.5, 2.5].map((k) => box([483, 4, 4], [0, 4, k * 54])),
    ...[-1.5, -0.5, 0.5, 1.5].map((k) => box([4, 4, 380], [k * 161, 0, 0])),
  ];
  const shT = b.compound("Wire shelf", grid, { material: "metal", label: "3" });
  const shelves = LEVELS.map((y) => b.place(shT.type, [shT.mid[0], y + shT.mid[1], shT.mid[2]]));

  // ponytail: tube 4's narrower stub ends (p11, p15) aren't drawn: inside the posts they read as clashes
  const t4 = b.compound("Post extension", [post(0, 0, 0, T4, P)], { material: "metal", label: "4" });
  const t5 = b.compound("Upper post", [post(0, 0, 0, TUBE, P)], { material: "metal", label: "5" });
  const lows = [-1, 1].map((g) => b.place(t4.type, [g * X0 + t4.mid[0], BACK + t4.mid[1], -Z0 + t4.mid[2]]));
  const ups = [-1, 1].map((g) => b.place(t5.type, [g * X0, T5 + TUBE / 2, -Z0]));
  const board6 = b.part("Hook board", [BW, BH, BT], { material: "board", label: "6" });
  const board7 = b.part("Top board", [BW, BH, BT], { material: "board", label: "7" });
  const boards = [b.place(board6, [0, BOARDS[0], -Z0]), b.place(board7, [0, BOARDS[1], -Z0])];
  // p11: board 7's two wall holes, 49 in from its ends at mid height, through it (p14, p15 draw them from the start)
  const WH = BW / 2 - 49.5;
  for (const g of [-1, 1]) for (const f of [-1, 1]) b.hole(boards[1], [g * WH, BOARDS[1], -Z0 + (f * BT) / 2], [0, 0, f], 3);
  // the hook (8, 70x37x20, p11): a bent steel strip over a board's top edge, a short tab behind, a long leg down the
  // front and a J at its foot. Drawn on a board's top edge, its middle at the origin
  const t = 2, J = 37 - BT - 2 * t;
  const hookT = b.compound(
    "Hook",
    [
      box([20, t, BT + 2 * t], [0, t / 2, 0]),
      box([20, 20, t], [0, t - 10, -BT / 2 - t / 2]),
      box([20, 70, t], [0, t - 35, BT / 2 + t / 2]),
      box([20, t, J], [0, t - 70 + t / 2, BT / 2 + t + J / 2]),
      box([20, 16, t], [0, t - 70 + 8, BT / 2 + t + J - t / 2]),
    ],
    { material: "metal", label: "8" },
  );
  // p17: four on the top board, three on the lower one, all 143 apart (p2)
  const hooks = [...[-1.5, -0.5, 0.5, 1.5].map((k) => [k * 143, 1] as const), ...[-1, 0, 1].map((k) => [k * 140, 0] as const)].map(([x, j]) =>
    b.place(hookT.type, [x + hookT.mid[0], BOARDS[j] + BH / 2 + hookT.mid[1], -Z0 + hookT.mid[2]]),
  );

  /* ---------- fittings ---------- */

  const postsAt = [-1, 1].flatMap((g) => [-Z0, Z0].map((z) => [g * X0, z, g < 0 ? 0 : 1] as const));
  const dBolts = rails.flatMap((rk, i) =>
    [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [g * (X0 + P / 2), LEVELS[i >> 1], i % 2 ? RZ : -RZ], dir: [-g, 0, 0], mate: rk })),
  );
  const eBolts = boards.flatMap((bk, j) =>
    [-1, 1].flatMap((g) => [-30, 30].map((dy): FitOpts => ({ on: ups[g < 0 ? 0 : 1], at: [g * (X0 + P / 2), BOARDS[j] + dy, -Z0], dir: [-g, 0, 0], mate: bk }))),
  );

  /* ---------- steps ---------- */

  const FLAT: [number, number, number] = [0, 0, Math.PI / 2]; // a tube lying along x, its top end to the left (p12)
  b.step(
    {
      page: 12,
      title: "Knock in the plugs and caps",
      detail: "With a rubber mallet: a threaded plug (A) into the bottom of each side frame post (1), and an end cap (C) into the top of both front posts and of both upper posts (5).",
      kind: "general",
      scene: "tubes",
      tools: ["hammer"],
      warnings: ["floor"],
    },
    () => {
      // p12: both side frames and both upper posts lying flat on the floor
      sides.forEach((k, i) => b.stage(k, [0, P / 2, i ? 140 : -280], FLAT, [0, 200, 0]));
      ups.forEach((k, i) => b.stage(k, [0, P / 2, i ? 470 : 400], FLAT, [0, 200, 0]));
      b.then(0.12);
      b.fits(A, postsAt.map(([x, z, k]): FitOpts => ({ on: sides[k], at: [x, FOOT, z], dir: [0, 1, 0], hole: false })), 0.06);
      b.then(0.08);
      b.fits(C, [-1, 1].map((g): FitOpts => ({ on: sides[g < 0 ? 0 : 1], at: [g * X0, FRONT, Z0], dir: [0, -1, 0], hole: false })), 0.06);
      b.then(0.05);
      b.fits(C, ups.map((k, i): FitOpts => ({ on: k, at: [(i ? 1 : -1) * X0, H, -Z0], dir: [0, -1, 0], hole: false })), 0.06);
    },
  );
  // p12 step 2 draws only the side frames, still lying flat
  b.step({ page: 12, title: "Screw the feet in", detail: "A foot (B) into each plug, by hand.", kind: "legs", scene: "feet" }, () => {
    sides.forEach((k, i) => b.stage(k, [0, P / 2, i ? 210 : -210], FLAT));
    b.then(0.1);
    b.fits(B, postsAt.map(([x, z, k]): FitOpts => ({ on: sides[k], at: [x, FOOT - 2, z], dir: [0, 1, 0], hole: false, spin: 2 })), 0.06);
  });
  b.step(
    {
      page: 13,
      title: "Put each shelf on its rails",
      detail: "Push the ends of each wire shelf's four cross wires into the holes of two rails (2), one along the front edge and one along the back: three shelves, six rails.",
      kind: "shelves",
      scene: "shelves",
    },
    () => {
      // p13: the three shelves on their rails, laid out on the floor apart from the frames
      b.stagger(0.08);
      LEVELS.forEach((y, i) => b.stageAround([rails[2 * i], rails[2 * i + 1]], [0, y - R / 2, (1 - i) * 440], [0, 120, 0]));
      b.then(0.1);
      LEVELS.forEach((y, i) => b.stageAround([shelves[i]], [0, y - R / 2, (1 - i) * 440], [0, 150, 0]));
      b.stagger(0);
    },
  );
  b.step(
    {
      page: 13,
      title: "Bolt the rails between the side frames",
      detail: "With the bench on its back, hold the shelves between the side frames (1), the posts with the extra holes at the back. A bolt (D) through the post into each rail end, with the allen key (G): 12 in all, about 80% tight. Check each shelf is the right way up before you bolt it: its long wires on top, the four cross wires under them, as the close-up shows.",
      kind: "bolts",
      pose: "+z", // p13: lying on its back, the feet towards you
      tools: ["allen"],
    },
    () => {
      sides.forEach((k, i) => b.add(k, [(i ? 1 : -1) * 250, 0, 0]));
      b.then(0.1);
      b.stagger(0);
      [...rails, ...shelves].forEach((k) => b.add(k, [0, 0, 300]));
      b.stagger(0.22);
      b.then(0.1);
      b.fits(D, dBolts, 0.04);
      // p13 warning: the close-up of a shelf's wires crossing, as each shelf must lie (p13 step 3 and p14: the long
      // wires over the cross wires)
      b.look(shelves[1], [161 / 2, LEVELS[1] + 2, 27], { size: 45 });
    },
  );
  b.step({ page: 14, title: "Tighten the bench", detail: "Stand it on its feet so it doesn't rock, then tighten all 12 bolts the whole way.", kind: "bolts", tools: ["allen"] }, () => {});
  b.step(
    {
      page: 14,
      title: "Bolt the hook boards between the upper posts",
      detail: "Take the two upper posts (5), caps at the top, and put the boards between them: the plain one (6) lower, the one with the wall holes (7) at the top, 300 mm apart. Two connector bolts (E) through each post into each board end: 8 in all, about 80% tight. Screw them in straight.",
      kind: "bolts",
      scene: "boards",
      tools: ["allen"],
      warnings: ["square"], // p14 step 6: the bolts going in straight, against two crossed ones
    },
    () => {
      // p14: the hook board frame made on its own, apart from the bench
      const c: [number, number, number] = [0, T5 + TUBE / 2, -Z0];
      ups.forEach((k, i) => b.stageAround([k], c, [(i ? 1 : -1) * 250, 0, 0]));
      b.then(0.12);
      b.stageAround(boards, c, [0, 0, 250]);
      b.then(0.12);
      b.fits(E, eBolts, 0.05);
    },
  );
  b.step({ page: 15, title: "Tighten the hook boards", detail: "Tighten all 8 bolts the whole way.", kind: "bolts", scene: "boards", tools: ["allen"] }, () => {});
  b.step(
    {
      page: 15,
      title: "Build the back up",
      detail: "Screw a post extension (4) onto each back post of the bench, then the hook board frame onto those, turning each tube till it meets the one below with no gap and the boards face front. Check the top board (7) is the right way round, its two wall holes facing you.",
      kind: "general",
    },
    () => {
      b.stagger(0.1);
      lows.forEach((k) => b.add(k, [0, 300, 0], { spin: 2 }));
      // p15: the finished frame comes down onto tubes 4 in one piece
      b.then(0.12);
      b.stagger(0);
      [...ups, ...boards].forEach((k) => b.add(k, [0, 400, 0]));
      // p15 warning and its dashed detail: board 7's wall hole at the front
      b.then(0.1);
      b.look(boards[1], [WH, BOARDS[1], -Z0 + BT / 2], { dir: [0, 0, -1], size: 40 });
    },
  );
  b.step(
    {
      page: 16,
      title: "Fix it to the wall",
      detail: "Push it back to the wall and mark through the two holes in the top board (7). Move it away, drill and plug the holes, then push it back and screw it to the wall. If a skirting board keeps it off the wall, put a wall fitting (F) behind each hole; if it stands right against the wall, leave F out. Wall plugs and screws aren't included: pick ones made for your wall.",
      kind: "anchor",
      tools: ["drill", "pencil", "screwdriver", "hammer"],
      wall: true,
      warnings: ["wall", "tip"],
    },
    // p11: the wall holes 49 in from the board's ends; F drawn for the skirting board case (p16 left)
    () => b.fits(F, [-1, 1].map((g): FitOpts => ({ at: [g * 218, BOARDS[1], -Z0 - BT / 2 - 14], dir: [0, 0, -1], wall: true })), 0.1),
  );
  b.step({ page: 17, title: "Hang the hooks on", detail: "Hook the seven hooks (8) over the top edge of the boards, the long leg with its J down the front: four on the top board, three on the lower one.", kind: "general" }, () => {
    b.stagger(0.06);
    hooks.forEach((k) => b.add(k, [0, 120, 0]));
    b.stagger(0);
  });
  b.step({ page: 18, title: "Keep to the weight limits", detail: "5 kg on each shoe shelf and 3 kg on each hook.", kind: "general" }, () => {});
  return true;
}

const family: Family = { names: ["ELVERUM"], build };
export default family;

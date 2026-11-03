import type { ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { add, sg, sub } from "../math";
import type { Family } from "./family";

/*
 * BILLUND children's bed frame with storage, Euro Single 90 x 200 (JYSK 3681951; its 23-page manual, Rev.1,
 * 19.12.2018). The headboard (1) takes cam bolts and glides, and a block (10) on the drawer side; the two side rails
 * (5, 6), each with its slat ledge, hook onto it. The middle divider (8) stands on glides between two posts (9),
 * screwed to the rails' ledges; then the foot board (2) with its block. Each of the two drawers is built on its front
 * (3): sides (11, 12) on cam bolts, the bottom (4) slid in, a brace (13), the back (7) screwed on, corner blocks under
 * the bottom and four castors. The manual builds it with the drawers on the right (R) or the left (L); this is R,
 * drawers out to +x. Panel numbers are the manual's; sizes in mm are from its parts pages. Mattress not included.
 */

// fittings, as the manual lists them on page 8 (its letters); A is the allen key
const B: HwDef = { kind: "castor", len: 32.5, dia: 25 };
const C: HwDef = { kind: "cap", len: 2, dia: 14, name: "Screw cap" };
const D: HwDef = { kind: "cap", len: 2, dia: 20, name: "Cover cap, frame" };
const E: HwDef = { kind: "cap", len: 2, dia: 20, name: "Cover cap, drawer" };
const F: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const G: HwDef = HW.cam; // 15 mm
const H: HwDef = { kind: "bolt", len: 50, dia: 6.3, flush: true };
const I: HwDef = HW.dowel; // 8 x 30
const J: HwDef = { kind: "glide", len: 5, dia: 15, name: "Nail-in glide" };
const K: HwDef = { kind: "screw", len: 30, dia: 4 };
const L: HwDef = { kind: "screw", len: 12, dia: 4 };
const M: HwDef = { kind: "clip", len: 11, dia: 15, name: "Corner block" };

// x across the bed (the drawers come out at +x), y up from the floor, z from the head (-) to the foot (+)
const GL = 5; // the nail-in glides
const ZH = -1007, ZT = 1007; // inner faces of the headboard and the foot board: the rails are 2014 long between
const RX = 486, RI = 477, LI = 457; // a rail's centre, its inner face, and its slat ledge's inner face (914 between)
const RAIL = GL + 280; // underside of the rails: their tops are level with the foot board's
const LEDGE = RAIL + 46; // top of the slat ledges
const DX = RI; // the drawer fronts' inner face, under rail 6
const DZ = [-503, 503]; // drawer centres along the bed (fronts 1001 wide, 5 apart in the middle)
const BOX = 32.5; // underside of a drawer box: the castors' height
const DEPTH = 600; // a drawer's sides, front to back

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "bed" || s.bed?.mattressW !== 90 || s.bed?.mattressL !== 200) return false;

  /* ---------- the panels ---------- */

  // two-tone ("White+Concrete", "Travertine+Beige"): the end boards and drawer fronts take the second colour, the rails the first

  const head = b.place(b.part("Headboard", [990, 745, 18], { label: "1", tone: 1 }), [0, GL + 372.5, ZH - 9]);
  const foot = b.place(b.part("Foot board", [990, 470, 18], { label: "2", tone: 1 }), [0, GL + 235, ZT + 9]);
  // a rail: the board and its slat ledge along the inside, 46 high, which the divider's posts are screwed to
  const rail = (label: string, i: number) => {
    const g = sg(i);
    const { type, mid } = b.compound("Side rail", [
      { shape: "box", size: [18, 190, 2014], pos: [g * RX, RAIL + 95, 0] },
      { shape: "box", size: [20, 46, 2014], pos: [g * (LI + 10), RAIL + 23, 0] },
    ], { label });
    return b.place(type, mid);
  };
  const rails = [rail("5", 0), rail("6", 1)];
  const divider = b.place(b.part("Divider", [878, 300, 18], { label: "8" }), [0, GL + 150, 0]);
  const postT = b.part("Divider post", [18, 300, 100], { label: "9" });
  const posts = [0, 1].map((i) => b.place(postT, [sg(i) * (LI - 9), GL + 150, 0]));
  const blockT = b.part("Block", [110, 300, 18], { label: "10" });
  // against the end of rail 6's ledge, on the drawer side
  const blocks = [b.place(blockT, [LI - 55, GL + 150, ZH + 9]), b.place(blockT, [LI - 55, GL + 150, ZT - 9])];

  // a drawer, its front's inner face at x = DX: the front (3), sides (11, 12), back (7), bottom (4) and brace (13)
  const types = {
    front: b.part("Drawer front", [18, 220, 1001], { label: "3", tone: 1 }),
    sides: [b.part("Drawer side, left", [DEPTH, 170, 18], { label: "11" }), b.part("Drawer side, right", [DEPTH, 170, 18], { label: "12" })],
    back: b.part("Drawer back", [18, 170, 893], { label: "7" }),
    bottom: b.part("Drawer bottom", [596, 2.5, 874], { label: "4", material: "fiber" }),
    brace: b.part("Drawer brace", [582, 96, 18], { label: "13" }),
  };
  const drawers = DZ.map((zc) => {
    const P = (x: number, y: number, z: number): Vec3 => [DX + x, y, zc + z]; // x back from the front, z from its centre
    const sz = 438.5; // side centres
    const front = b.place(types.front, P(9, GL + 40 + 110, 0));
    const sides = [0, 1].map((i) => b.place(types.sides[i], P(-DEPTH / 2, BOX + 85, sg(i) * sz)));
    const back = b.place(types.back, P(-DEPTH - 9, BOX + 85, 0));
    const bottom = b.place(types.bottom, P(-3 - 298, BOX + 13.75, 0));
    const brace = b.place(types.brace, P(-291, BOX + 15 + 48, 0));
    const per = (fn: (g: number, side: string) => FitOpts[]) => [0, 1].flatMap((i) => fn(sg(i), sides[i]));
    const fits: [HwDef, FitOpts[]][] = [
      [F, per((g, sd) => [80, 170].map((y): FitOpts => ({ on: front, at: P(0, BOX + y, g * sz), dir: [1, 0, 0], mate: sd, mateHole: 4 })))],
      [G, per((g, sd) => [80, 170].map((y): FitOpts => ({ on: sd, at: P(-25, BOX + y, g * (sz - 9)), dir: [0, 0, g] })))],
      [E, per((g, sd) => [80, 170].map((y): FitOpts => ({ on: sd, at: P(-25, BOX + y, g * (sz - 9)), dir: [0, 0, g], hole: false })))],
      [I, [-20, 20].flatMap((dy): FitOpts[] => [
        { on: brace, at: P(0, BOX + 63 + dy, 0), dir: [-1, 0, 0], mate: front },
        { on: brace, at: P(-582, BOX + 63 + dy, 0), dir: [1, 0, 0] },
      ])],
      [H, per((g, sd) => [60, 120].map((y): FitOpts => ({ on: back, at: P(-DEPTH - 18, BOX + y, g * sz), dir: [1, 0, 0], mate: sd })))],
      [C, per((g) => [60, 120].map((y): FitOpts => ({ on: back, at: P(-DEPTH - 18, BOX + y, g * sz), dir: [1, 0, 0], hole: false })))],
      // under the bottom, in the corner between it and each side
      [M, per((g, sd) => [-80, -300, -520].map((x): FitOpts => ({ on: sd, at: P(x, BOX + 6, g * (sz - 9)), dir: [0, 0, g], hole: false })))],
      [B, per((g, sd) => [-70, -DEPTH + 70].map((x): FitOpts => ({ on: sd, at: P(x, BOX, g * sz), dir: [0, 1, 0], hole: false })))],
      [L, per((g, sd) => [-70, -DEPTH + 70].flatMap((x) => [-14, 14].map((dx): FitOpts => ({ on: sd, at: P(x + dx, BOX, g * sz), dir: [0, 1, 0] }))))],
    ];
    return { c: P(0, 0, 0), front, sides, back, bottom, brace, fits, parts: [front, ...sides, back, bottom, brace] };
  });
  const fitsOf = (d: (typeof drawers)[number], def: HwDef) => d.fits.find(([k]) => k === def)![1];

  /* ---------- the frame ---------- */

  const show = (keys: string[], centre: Vec3, from: Vec3) => {
    b.stagger(0.15);
    b.stageAround(keys, centre, from);
    b.then(0.15);
  };
  const railDowels = (i: number): FitOpts[] => [ZH, ZT].flatMap((z) => [RAIL + 60, RAIL + 140].map((y): FitOpts => ({ on: rails[i], at: [sg(i) * RX, y, z], dir: [0, 0, z < 0 ? 1 : -1], mate: z < 0 ? head : foot })));
  for (const i of [0, 1])
    b.step({ title: `Tap four dowels into the side rail (${i ? "6" : "5"})`, detail: "Two in each end.", tools: ["hammer"], scene: "rails", kind: "dowels", warnings: ["floor"] }, () => {
      show([rails[i]], [sg(i) * RX, 0, 0], [0, 120, 0]);
      b.fits(I, railDowels(i), 0.08);
    });

  // each end board: three cam bolts per rail (two into the board, one into the ledge), cam locks in the rails
  const endBolts = (k: string, z: number): FitOpts[] =>
    [0, 1].flatMap((i) => [
      ...[RAIL + 100, RAIL + 160].map((y): FitOpts => ({ on: k, at: [sg(i) * RX, y, z], dir: [0, 0, z < 0 ? -1 : 1], mate: rails[i], mateHole: 4 })),
      { on: k, at: [sg(i) * (LI + 10), RAIL + 23, z], dir: [0, 0, z < 0 ? -1 : 1], mate: rails[i], mateHole: 4 },
    ]);
  const endCams = (z: number): FitOpts[] =>
    [0, 1].flatMap((i) => [
      ...[RAIL + 100, RAIL + 160].map((y): FitOpts => ({ on: rails[i], at: [sg(i) * RI, y, z + (z < 0 ? 25 : -25)], dir: [sg(i), 0, 0] })),
      { on: rails[i], at: [sg(i) * LI, RAIL + 23, z + (z < 0 ? 25 : -25)], dir: [sg(i), 0, 0] },
    ]);
  const caps = (z: number): FitOpts[] => endCams(z).filter((o) => o.at[1] > LEDGE).map((o) => ({ ...o, hole: false }));
  const glides = (k: string, z: number): FitOpts[] => [-400, 0, 400].map((x) => ({ on: k, at: [x, GL, z], dir: [0, 1, 0], hole: false }));
  const blockScrews = (k: string, z: number): FitOpts[] =>
    [LI - 85, LI - 25].flatMap((x) => [GL + 60, GL + 240].map((y): FitOpts => ({ on: k, at: [x, y, z], dir: [0, 0, z < 0 ? -1 : 1] })));
  const endBoard = (k: string, label: string, block: string, z: number, zo: number) => {
    b.step(
      { title: `Fit six cam bolts and three glides to the ${label}`, detail: "Lay it inside face up. Cam bolts screwed in straight, glides tapped into the bottom edge.", tools: ["screwdriver", "hammer"], scene: "ends", kind: "cams" },
      () => {
        show([k], [0, 0, z], [0, 120, 0]);
        b.fits(F, endBolts(k, z), 0.08);
        b.then(0.1);
        b.fits(J, glides(k, zo), 0.12);
      },
    );
    b.step(
      { title: `Screw the block (10) onto the ${label}`, detail: "At the bottom corner on the drawer side, four 30 mm screws. (On an L bed it goes at the other corner.)", tools: ["screwdriver"], scene: "ends", kind: "screws" },
      () => {
        show([block], [0, 0, z], [0, 0, z < 0 ? 160 : -160]);
        b.fits(K, blockScrews(block, z < 0 ? z + 18 : z - 18), 0.1);
      },
    );
  };

  endBoard(head, "headboard (1)", blocks[0], ZH, ZH - 9);
  b.step(
    { title: "Hook both rails onto the headboard and lock them", detail: "Rail 6 goes on the drawer side. Turn the six cam locks, then press caps over the four on the boards.", tools: ["screwdriver"], kind: "cams", people: 2 },
    () => {
      b.stagger(0.2);
      b.add(head, [0, 0, -300]);
      b.add(blocks[0], [0, 0, -300]);
      for (const i of [0, 1]) b.add(rails[i], [0, 0, 400]);
      b.then(0.15);
      b.fits(G, endCams(ZH), 0.1);
      b.then(0.1);
      b.fits(D, caps(ZH), 0.1);
    },
  );
  b.step(
    { title: "Tap three glides and four dowels into the divider (8)", detail: "Glides in the bottom edge, two dowels in each end.", tools: ["hammer"], scene: "divider", kind: "dowels" },
    () => {
      show([divider], [0, 0, 0], [0, 120, 0]);
      b.fits(J, glides(divider, 0), 0.1);
      b.then(0.1);
      b.fits(I, [0, 1].flatMap((i) => [GL + 110, GL + 190].map((y): FitOpts => ({ on: divider, at: [sg(i) * (LI - 18), y, 0], dir: [-sg(i), 0, 0], mate: posts[i] }))), 0.08);
    },
  );
  b.step({ title: "Screw two cam bolts into each post (9)", detail: "In its inside face.", tools: ["screwdriver"], scene: "divider", kind: "cams" }, () => {
    show(posts, [0, 0, 0], [0, 120, 0]);
    b.fits(F, [0, 1].flatMap((i) => [GL + 70, GL + 230].map((y): FitOpts => ({ on: posts[i], at: [sg(i) * (LI - 18), y, 0], dir: [sg(i), 0, 0], mate: divider, mateHole: 4 }))), 0.1);
  });
  const divCams: FitOpts[] = [0, 1].flatMap((i) => [GL + 70, GL + 230].map((y): FitOpts => ({ on: divider, at: [sg(i) * (LI - 18 - 25), y, 9], dir: [0, 0, -1] })));
  b.step({ title: "Join the posts to the divider", detail: "Onto the dowels and cam bolts; turn the four cam locks and cap them.", tools: ["screwdriver"], scene: "divider", kind: "cams" }, () => {
    b.fits(G, divCams, 0.1);
    b.then(0.1);
    b.fits(E, divCams.map((o) => ({ ...o, hole: false })), 0.1);
  });
  b.step(
    { title: "Push the divider in under the rails and screw the posts on", detail: "Halfway along, the posts against the rails' ledges: two 30 mm screws through each post.", tools: ["screwdriver"], kind: "screws" },
    () => {
      b.stagger(0.1);
      for (const k of [divider, ...posts]) b.add(k, [0, 0, 400]);
      b.then(0.15);
      b.fits(K, [0, 1].flatMap((i) => [-30, 30].map((z): FitOpts => ({ on: posts[i], at: [sg(i) * (LI - 18), RAIL + 10, z], dir: [sg(i), 0, 0] }))), 0.1);
    },
  );
  endBoard(foot, "foot board (2)", blocks[1], ZT, ZT + 9);
  b.step(
    { title: "Put the foot board on and lock it", detail: "Onto the rails' dowels; turn the six cam locks and cap the four on the boards.", tools: ["screwdriver"], kind: "cams", people: 2 },
    () => {
      b.stagger(0.2);
      b.add(foot, [0, 0, 300]);
      b.add(blocks[1], [0, 0, 300]);
      b.then(0.15);
      b.fits(G, endCams(ZT), 0.1);
      b.then(0.1);
      b.fits(D, caps(ZT), 0.1);
    },
  );

  /* ---------- the drawers: one shown, the other the same ---------- */

  const d0 = drawers[0];
  const dstep = (d: StepDef, body: () => void) => b.step({ scene: "drawer", repeat: 2, ...d }, body);
  dstep({ title: "Screw four cam bolts into each drawer front (3)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    show([d0.front], d0.c, [160, 0, 0]);
    b.fits(F, fitsOf(d0, F), 0.1);
  });
  dstep({ title: "Stand the sides (11 and 12) on it and lock them", detail: "Turn the four cam locks and cap them.", tools: ["screwdriver"], kind: "cams" }, () => {
    show(d0.sides, d0.c, [0, 160, 0]);
    b.fits(G, fitsOf(d0, G), 0.1);
    b.then(0.1);
    b.fits(E, fitsOf(d0, E), 0.1);
  });
  dstep({ title: "Tap four dowels into the brace (13)", detail: "Two in each end.", tools: ["hammer"], kind: "dowels" }, () => {
    b.stage(d0.brace, add(sub(b.partItem(d0.brace).final.pos, d0.c), [0, 0, 600]), [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(I, fitsOf(d0, I), 0.08);
  });
  dstep({ title: "Slide the bottom (4) in", detail: "Along the grooves, right down to the front.", kind: "drawer" }, () => show([d0.bottom], d0.c, [-300, 0, 0]));
  dstep({ title: "Stand the brace on the bottom", detail: "In the middle, its dowels into the front.", kind: "drawer" }, () => show([d0.brace], d0.c, [0, 160, 0]));
  dstep({ title: "Put the back (7) on", detail: "Over the sides' ends and the brace's dowels.", kind: "drawer" }, () => show([d0.back], d0.c, [-160, 0, 0]));
  dstep({ title: "Screw the back on", detail: "Four long allen screws with the allen key until flush, then a cap over each.", tools: ["allen"], kind: "bolts" }, () => {
    b.fits(H, fitsOf(d0, H), 0.12);
    b.then(0.1);
    b.fits(C, fitsOf(d0, C), 0.08);
  });
  dstep({ title: "Screw six corner blocks under the bottom", detail: "Turn the drawer over. They hold the bottom to the sides, the front and the back.", tools: ["screwdriver"], kind: "screws", pose: "-y" }, () => b.fits(M, fitsOf(d0, M), 0.08));
  dstep({ title: "Screw on the four castors", detail: "7 cm in from the front and the back, two 12 mm screws each.", tools: ["screwdriver", "tape"], kind: "screws", pose: "-y" }, () => {
    b.fits(B, fitsOf(d0, B), 0.15);
    b.then(0.1);
    b.fits(L, fitsOf(d0, L), 0.05);
  });
  b.step(
    { title: "Slide both drawers in", detail: "Under rail 6, one each side of the divider; each holds 6 kg at most. Then the slats and a 90 x 200 cm mattress, which aren't included.", kind: "drawer" },
    () => {
      for (const [n, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of d.parts) b.add(k, [520, 0, 0]);
        if (n > 0) for (const [def, list] of d.fits) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
      // not in the box: drawn so the finished bed looks as it's used, on the slat ledges (the slats aren't drawn)
      b.add(b.place(b.part("Your mattress", [900, 180, 2000], { material: "soft", extra: true }), [0, LEDGE + 90, 0]), [0, 420, 0]);
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  // the brace comes out with the drawer too
  for (const d of drawers) b.openDrawer(d.parts, DEPTH, [1, 0, 0]);
  return true;
}

const family: Family = { names: ["BILLUND"], build };
export default family;

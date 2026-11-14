import type { ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { sg } from "../math";
import type { Family } from "./family";
import { STEP_CAM } from "../sight";

/*
 * BILLUND children's bed frame with storage, Euro Single 90 x 200 (JYSK 3681951; its 23-page manual, Rev.1,
 * 19.12.2018). The headboard (1) takes cam bolts and glides, and a block (10) on the drawer side; the two side rails
 * (5, 6), each with its slat ledge, hook onto it. The middle divider (8) stands on glides between two posts (9),
 * screwed to the rails' ledges; then the foot board (2) with its block. Each of the two drawers is built on its front
 * (3): sides (11, 12) on cam bolts, the bottom (4) slid in, a brace (13), the back (7) screwed on, corner blocks under
 * the bottom and four castors. The manual builds it either way round (p. 1): seen from the drawer side, the headboard
 * on the left (R, as all its main drawings are: pp. 9, 14, 16) or on the right (L). Only steps 4, 11 and 22 draw both
 * (pp. 13, 17, 23): the blocks (10) at the other bottom corner of the end boards and the drawers in from the other
 * side. So L is R with the rails, blocks and drawers across the bed (x) the other way; the end boards, divider and posts
 * stay, and each drawer is R's turned half round, not mirrored (11 stays on its left). Panel numbers are the manual's;
 * sizes in mm are from its parts pages. Mattress not included.
 */

// fittings, as the manual lists them on page 8 (its letters); A is the allen key
const B: HwDef = { kind: "castor", len: 32.5, dia: 25, form: "plate" }; // one wheel on a plate, two screws through it (p. 22)
const C: HwDef = { kind: "cap", len: 2, dia: 14, name: "Screw cap" };
const D: HwDef = { kind: "cap", len: 2, dia: 20, name: "Cover cap, frame" };
const E: HwDef = { kind: "cap", len: 2, dia: 20, name: "Cover cap" }; // on the divider and the drawers
const F: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const G: HwDef = HW.cam; // 15 mm
const H: HwDef = { kind: "bolt", len: 50, dia: 6.3, flush: true };
const I: HwDef = HW.dowel; // 8 x 30
const J: HwDef = { kind: "glide", len: 5, dia: 15, name: "Nail-in glide" };
const K: HwDef = { kind: "screw", len: 30, dia: 4 };
const L: HwDef = { kind: "screw", len: 12, dia: 4 };
const M: HwDef = { kind: "wedge", len: 15, dia: 11, name: "Corner block" }; // 15/15/11

/** The manual's two ways round (p. 1), R first as it lists them. */
const LAYOUTS = [
  { id: "R", label: "Seen from the drawer side, the headboard on the left" },
  { id: "L", label: "Seen from the drawer side, the headboard on the right" },
];

// x across the bed (R: rail 5 at +x, rail 6 and the drawers at -x; L the other way), y up from the floor, z from the
// head (-) to the foot (+)
const GL = 5; // the nail-in glides
const ZH = -1007, ZT = 1007; // inner faces of the headboard and the foot board: the rails are 2014 long between
// the rails stand 20 in from the end boards' edges: the posts (9) and blocks (10) go against their inner faces, under
// the ledges, so the divider (878) plus two posts spans them (914 between, p. 10 and the p. 16 insets)
const RX = 466, RI = 457, LI = 437; // a rail's centre, its inner face, and its slat ledge's inner face
const RAIL = GL + 300 - 36; // underside of the rails: the posts and blocks (300) reach up to the ledges' undersides
const LEDGE = RAIL + 82; // top of the slat ledges: 36 to 82 up the rail (p. 11)
const DX = RI; // the drawer fronts' inner face is at x = -DX (R) or DX (L), under rail 6
const DZ = [-503, 503]; // drawer centres along the bed (fronts 1001 wide, 5 apart in the middle)
const BOX = 32.5; // underside of a drawer box: the castors' height
const DEPTH = 600; // a drawer's sides, front to back
// the block's screws, 26 and 259 up the end boards (measured on the headboard's to-scale drawing, p. 10 at 600 dpi)
const BLOCKY = [GL + 26, GL + 259];
// across, the block butts the rail's inner face (the p. 2 end view draws the two as one line down to the floor), its
// screws 60 apart about its middle. p. 10 draws them 71 and 131 in from the boards' edges, 8 further in, but it draws
// the rails' own holes 8 too far in as well (473 from the middle; p. 2's 914 between the rails, which the divider and
// posts fill, puts them at 466), so its board drawings run about 8 mm off at the edges
const BX = RI - 55, BLOCKX = [RI - 85, RI - 25];

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "bed" || s.bed?.mattressW !== 90 || s.bed?.mattressL !== 200) return false;
  const m = b.pick(LAYOUTS) === "L" ? -1 : 1; // the drawer side: -x (R) or +x (L)
  const sx = (i: number) => -m * sg(i); // rail 5 (i = 0) away from the drawers, rail 6 over them
  // the main build seen from the drawer side, from near the foot, the headboard on the left (R: pp. 14, 16) or right
  const TURN = m > 0 ? -2 * STEP_CAM.az : 0;
  // finished, it is seen from the drawer side
  b.view({ az: -m * STEP_CAM.az });

  /* ---------- the panels ---------- */

  // two-tone ("White+Concrete", "Travertine+Beige"): the end boards and drawer fronts take the second colour, the rails the first

  const head = b.place(b.part("Headboard", [990, 745, 18], { label: "1", tone: 1 }), [0, GL + 372.5, ZH - 9]);
  const foot = b.place(b.part("Foot board", [990, 470, 18], { label: "2", tone: 1 }), [0, GL + 235, ZT + 9]);
  // a rail: the board and its slat ledge along the inside, 46 high and 36 up from the bottom (p. 11); the divider's
  // posts are screwed to the board under it
  const rail = (label: string, i: number) => {
    const g = sx(i);
    const { type, mid } = b.compound("Side rail", [
      { shape: "box", size: [18, 190, 2014], pos: [g * RX, RAIL + 95, 0] },
      { shape: "box", size: [20, 46, 2014], pos: [g * (LI + 10), RAIL + 59, 0] },
    ], { label });
    return b.place(type, mid);
  };
  const rails = [rail("5", 0), rail("6", 1)];
  const divider = b.place(b.part("Divider", [878, 300, 18], { label: "8" }), [0, GL + 150, 0]);
  const postT = b.part("Divider post", [18, 300, 100], { label: "9" });
  const posts = [0, 1].map((i) => b.place(postT, [sg(i) * (RI - 9), GL + 150, 0]));
  const blockT = b.part("Block", [110, 300, 18], { label: "10" });
  // against rail 6 under its ledge, on the drawer side
  const blocks = [b.place(blockT, [-m * BX, GL + 150, ZH + 9]), b.place(blockT, [-m * BX, GL + 150, ZT - 9])];
  // the end boards' pilot holes for a block, at both bottom corners (p. 10): one block or the other, as the bed goes
  for (const [k, z, n] of [[head, ZH, 1], [foot, ZT, -1]] as const)
    for (const x of BLOCKX) for (const g of [-1, 1]) for (const y of BLOCKY) b.hole(k, [g * x, y, z], [0, 0, n], 1.6);

  // a drawer, its front's inner face at x = -m DX: the front (3), sides (11, 12), back (7), bottom (4) and brace (13);
  // seen from its front, 11 is on the left (it stands at the near left end on pp. 19, 20, the open top towards us)
  const types = {
    front: b.part("Drawer front", [18, 220, 1001], { label: "3", tone: 1 }),
    sides: [b.part("Drawer side, left", [DEPTH, 170, 18], { label: "11" }), b.part("Drawer side, right", [DEPTH, 170, 18], { label: "12" })],
    back: b.part("Drawer back", [18, 170, 893], { label: "7" }),
    bottom: b.part("Drawer bottom", [596, 2.5, 874], { label: "4", material: "fiber" }),
    brace: b.part("Drawer brace", [582, 96, 18], { label: "13" }),
  };
  const drawers = DZ.map((zc) => {
    // x back from the front, z from its centre; L's drawer is R's turned half round (z flips too)
    const P = (x: number, y: number, z: number): Vec3 => [-m * (DX + x), y, zc + m * z];
    const D = (x: number, y: number, z: number): Vec3 => [-m * x, y, m * z]; // a direction in the same terms
    const sz = 438.5; // side centres
    // the bottom's groove is 28 up the front (p. 10), so the front hangs below the box
    const front = b.place(types.front, P(9, BOX + 12.5 - 28 + 110, 0));
    const sides = [0, 1].map((i) => b.place(types.sides[i], P(-DEPTH / 2, BOX + 85, sg(i) * sz)));
    const back = b.place(types.back, P(-DEPTH - 9, BOX + 85, 0));
    const bottom = b.place(types.bottom, P(-3 - 298, BOX + 13.75, 0));
    const brace = b.place(types.brace, P(-291, BOX + 15 + 48, 0));
    const per = (fn: (g: number, side: string) => FitOpts[]) => [0, 1].flatMap((i) => fn(sg(i), sides[i]));
    // the sides' cam locks 47 and 137 up from their bottom edge (p. 10), in their outer faces (pp. 19, 20)
    const camY = [47, 137];
    const fits: [HwDef, FitOpts[]][] = [
      [F, per((g, sd) => camY.map((y): FitOpts => ({ on: front, at: P(0, BOX + y, g * sz), dir: D(1, 0, 0), mate: sd, mateHole: 4 })))],
      [G, per((g, sd) => camY.map((y): FitOpts => ({ on: sd, at: P(-25, BOX + y, g * (sz + 9)), dir: D(0, 0, -g) })))],
      [E, per((g, sd) => camY.map((y): FitOpts => ({ on: sd, at: P(-25, BOX + y, g * (sz + 9)), dir: D(0, 0, -g), hole: false })))],
      [I, [-20, 20].flatMap((dy): FitOpts[] => [
        { on: brace, at: P(0, BOX + 63 + dy, 0), dir: D(-1, 0, 0), mate: front },
        { on: brace, at: P(-582, BOX + 63 + dy, 0), dir: D(1, 0, 0) },
      ])],
      [H, per((g, sd) => [60, 120].map((y): FitOpts => ({ on: back, at: P(-DEPTH - 18, BOX + y, g * sz), dir: D(1, 0, 0), mate: sd })))],
      [C, per((g) => [60, 120].map((y): FitOpts => ({ on: back, at: P(-DEPTH - 18, BOX + y, g * sz), dir: D(1, 0, 0), hole: false })))],
      // under the bottom, in its corners with the panels: one mid-way along each side, two along the front and the
      // back, either side of the brace (p. 22); each turned so its upright face meets the bottom's underside (BOX + 12.5)
      [M, [
        // (a fitting's frame follows its world direction, so each twist goes by that, the same for R and L)
        ...per((g, sd): FitOpts[] => [{ on: sd, at: P(-300, BOX + 5, g * (sz - 9)), dir: D(0, 0, g), twist: m * g > 0 ? 0 : Math.PI, hole: false }]),
        ...[-220, 220].flatMap((z): FitOpts[] => [
          { on: front, at: P(0, BOX + 5, z), dir: D(1, 0, 0), twist: (-m * Math.PI) / 2, hole: false },
          { on: back, at: P(-DEPTH, BOX + 5, z), dir: D(-1, 0, 0), twist: (m * Math.PI) / 2, hole: false },
        ]),
      ]],
      // the plate along the side (its local z turned to x), its two screws 32 apart through it, heads on its 2 mm plate
      [B, per((g, sd) => [-70, -DEPTH + 70].map((x): FitOpts => ({ on: sd, at: P(x, BOX, g * sz), dir: [0, 1, 0], hole: false, twist: m > 0 ? Math.PI / 2 : -Math.PI / 2 })))],
      [L, per((g, sd) => [-70, -DEPTH + 70].flatMap((x) => [-16, 16].map((dx): FitOpts => ({ on: sd, at: P(x + dx, BOX - 2, g * sz), dir: [0, 1, 0] }))))],
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
  const railDowels = (i: number): FitOpts[] => [ZH, ZT].flatMap((z) => [RAIL + 60, RAIL + 140].map((y): FitOpts => ({ on: rails[i], at: [sx(i) * RX, y, z], dir: [0, 0, z < 0 ? 1 : -1], mate: z < 0 ? head : foot })));
  // the way round, picked first as p. 1 offers it: the whole bed shown faded as the pick builds it
  b.layouts(LAYOUTS);
  b.step(
    { title: "Choose which way round it goes", detail: "The manual builds it either way: pick one. R: seen from the drawer side, the headboard is on the left. L: it is on the right.", kind: "general", turn: TURN },
    () => b.ghost([head, foot, ...rails, divider, ...posts, ...blocks, ...drawers.flatMap((d) => d.parts)]),
  );
  // laid flat, inside face (and ledge) up, seen from the bottom edge as p. 12 draws them; no tool in the manual's box
  for (const i of [0, 1])
    b.step({ title: `Tap four dowels into the side rail (${i ? "6" : "5"})`, detail: "Two in each end.", tools: [], scene: "rails", pose: sx(i) > 0 ? "-x" : "+x", turn: m > 0 ? Math.PI : 0, kind: "dowels", warnings: ["floor"] }, () => {
      show([rails[i]], [sx(i) * RX, 0, 0], [-sx(i) * 120, 0, 0]);
      b.fits(I, railDowels(i), 0.08);
    });

  // each end board: three cam bolts per rail into its end, one under the ledge and two above it (pp. 11, 14), cam
  // locks in the rails' inner faces
  const camY = [RAIL + 25, RAIL + 100, RAIL + 160];
  const endBolts = (k: string, z: number): FitOpts[] =>
    [0, 1].flatMap((i) => camY.map((y): FitOpts => ({ on: k, at: [sx(i) * RX, y, z], dir: [0, 0, z < 0 ? -1 : 1], mate: rails[i], mateHole: 4 })));
  const endCams = (z: number): FitOpts[] =>
    [0, 1].flatMap((i) => camY.map((y): FitOpts => ({ on: rails[i], at: [sx(i) * RI, y, z + (z < 0 ? 25 : -25)], dir: [sx(i), 0, 0] })));
  const caps = (z: number): FitOpts[] => endCams(z).filter((o) => o.at[1] > LEDGE).map((o) => ({ ...o, hole: false }));
  const glides = (k: string, z: number): FitOpts[] => [-400, 0, 400].map((x) => ({ on: k, at: [x, GL, z], dir: [0, 1, 0], hole: false }));
  const blockScrews = (k: string, z: number): FitOpts[] =>
    BLOCKX.map((x) => -m * x).flatMap((x) => BLOCKY.map((y): FitOpts => ({ on: k, at: [x, y, z], dir: [0, 0, z < 0 ? -1 : 1] })));
  // the board lies flat, inside face up, for both its steps (pp. 13, 17)
  const endBoard = (k: string, label: string, block: string, z: number, zo: number) => {
    const pose = z < 0 ? "+z" : "-z";
    b.step(
      { title: `Fit six cam bolts and three glides to the ${label}`, detail: "Lay it inside face up. Cam bolts screwed in straight, glides tapped into the bottom edge.", tools: ["screwdriver", "hammer"], scene: "ends", pose, kind: "cams" },
      () => {
        show([k], [0, 0, z], [0, 0, z < 0 ? 120 : -120]);
        b.fits(F, endBolts(k, z), 0.08);
        b.then(0.1);
        b.fits(J, glides(k, zo), 0.12);
      },
    );
    b.step(
      { title: `Screw the block (10) onto the ${label}`, detail: "At the bottom corner on the drawer side, four 30 mm screws.", tools: ["screwdriver"], scene: "ends", pose, kind: "screws" },
      () => {
        show([block], [0, 0, z], [0, 0, z < 0 ? 160 : -160]);
        b.fits(K, blockScrews(block, z < 0 ? z + 18 : z - 18), 0.1);
      },
    );
  };

  endBoard(head, "headboard (1)", blocks[0], ZH, ZH - 9);
  b.step(
    { title: "Hook both rails onto the headboard and lock them", detail: "Rail 6 goes on the drawer side. Turn the six cam locks, then press caps over the four on the boards.", tools: ["screwdriver"], kind: "cams", people: 2, turn: TURN },
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
    // laid flat, cam lock face (+z) up, the glide edge away from you (p. 14)
    { title: "Tap three glides and four dowels into the divider (8)", detail: "Glides in the bottom edge, two dowels in each end.", tools: ["hammer"], scene: "divider", pose: "+z", turn: Math.PI, kind: "dowels" },
    () => {
      show([divider], [0, 0, 0], [0, 0, 120]);
      b.fits(J, glides(divider, 0), 0.1);
      b.then(0.1);
      b.fits(I, [0, 1].flatMap((i) => [GL + 110, GL + 190].map((y): FitOpts => ({ on: divider, at: [sg(i) * (RI - 18), y, 0], dir: [-sg(i), 0, 0], mate: posts[i] }))), 0.08);
    },
  );
  // the posts' cam bolts and the divider's cam locks on one line, 33 in from the top and bottom edges (p. 10)
  const POSTY = [GL + 33, GL + 267];
  // the posts on their own, each laid inside face up (p. 15), until the next step joins them to the divider
  b.step({ title: "Screw two cam bolts into each post (9)", detail: "In its inside face.", tools: ["screwdriver"], scene: "posts", kind: "cams" }, () => {
    b.stagger(0.15);
    for (const i of [0, 1]) b.stage(posts[i], [0, 9, sg(i) * 90], [0, 0, (-sg(i) * Math.PI) / 2], [0, 120, 0]);
    b.then(0.15);
    b.fits(F, [0, 1].flatMap((i) => POSTY.map((y): FitOpts => ({ on: posts[i], at: [sg(i) * (RI - 18), y, 0], dir: [sg(i), 0, 0], mate: divider, mateHole: 4 }))), 0.1);
  });
  const divCams: FitOpts[] = [0, 1].flatMap((i) => POSTY.map((y): FitOpts => ({ on: divider, at: [sg(i) * (RI - 18 - 25), y, 9], dir: [0, 0, -1] })));
  b.step({ title: "Join the posts to the divider", detail: "Onto the dowels and cam bolts; turn the four cam locks and cap them.", tools: ["screwdriver"], scene: "divider", kind: "cams" }, () => {
    b.stagger(0.15);
    for (const i of [0, 1]) b.add(posts[i], [sg(i) * 200, 0, 0]);
    b.then(0.15);
    b.fits(G, divCams, 0.1);
    b.then(0.1);
    b.fits(E, divCams.map((o) => ({ ...o, hole: false })), 0.1);
  });
  b.step(
    { title: "Push the divider in under the rails and screw the posts on", detail: "Halfway along, the posts against the rails, up under their ledges: two 30 mm screws through each post into the rail.", tools: ["screwdriver"], kind: "screws", turn: TURN },
    () => {
      b.stagger(0.1);
      for (const k of [divider, ...posts]) b.add(k, [0, 0, 400]);
      b.then(0.15);
      // into the rail board under the ledge, at its two pilot holes: 12 from the post's top, 20 in from its edges (pp. 10, 11)
      b.fits(K, [0, 1].flatMap((i) => [-30, 30].map((z): FitOpts => ({ on: posts[i], at: [sg(i) * (RI - 18), GL + 288, z], dir: [sg(i), 0, 0] }))), 0.1);
    },
  );
  endBoard(foot, "foot board (2)", blocks[1], ZT, ZT + 9);
  b.step(
    { title: "Put the foot board on and lock it", detail: "Onto the rails' dowels; turn the six cam locks and cap the four on the boards.", tools: ["screwdriver"], kind: "cams", people: 2, turn: TURN },
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
  // built standing on its front, outer face down, until it is turned over for the corner blocks (pp. 18 to 22), seen
  // from its open top's side with side 11 nearest, as pp. 19 to 21 draw it; L's drawer is R's turned half round, so its
  // camera turns half round too and the pictures are R's
  const half = m > 0 ? 0 : Math.PI;
  const up: Vec3 = [m * 160, 0, 0]; // arriving from above it, as it stands
  const dstep = (d: StepDef, body: () => void) => b.step({ scene: "drawer", repeat: 2, pose: m > 0 ? "+x" : "-x", turn: Math.PI + half, ...d }, body);
  dstep({ title: "Screw four cam bolts into each drawer front (3)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], kind: "cams", warnings: ["face"] }, () => {
    show([d0.front], d0.c, up);
    b.fits(F, fitsOf(d0, F), 0.1);
  });
  dstep({ title: "Stand the sides (11 and 12) on it and lock them", detail: "Turn the four cam locks and cap them.", tools: ["screwdriver"], kind: "cams" }, () => {
    show(d0.sides, d0.c, up);
    b.fits(G, fitsOf(d0, G), 0.1);
    b.then(0.1);
    b.fits(E, fitsOf(d0, E), 0.1);
  });
  // the brace on its own, laid flat (p. 19), out of the drawer's picture until step 17 stands it in
  dstep({ title: "Tap four dowels into the brace (13)", detail: "Two in each end.", tools: [], kind: "dowels", scene: "brace", pose: "+y", turn: Math.PI }, () => {
    // L's brace has its front end (the dowels sunk deeper into it) at the other end: turned end for end, it lies as R's
    b.stage(d0.brace, [0, 9, 0], [Math.PI / 2, 0, m > 0 ? 0 : Math.PI], [0, 120, 0]);
    b.then(0.15);
    b.fits(I, fitsOf(d0, I), 0.08);
  });
  dstep({ title: "Slide the bottom (4) in", detail: "Along the grooves, right down to the front.", kind: "drawer" }, () => show([d0.bottom], d0.c, [m * 300, 0, 0]));
  dstep({ title: "Stand the brace on the bottom", detail: "In the middle, its dowels into the front.", kind: "drawer" }, () => show([d0.brace], d0.c, up));
  dstep({ title: "Put the back (7) on", detail: "Over the sides' ends and the brace's dowels.", kind: "drawer" }, () => show([d0.back], d0.c, up));
  dstep({ title: "Screw the back on", detail: "Four long allen screws with the allen key until flush, then a cap over each.", tools: ["allen"], kind: "bolts" }, () => {
    b.fits(H, fitsOf(d0, H), 0.12);
    b.then(0.1);
    b.fits(C, fitsOf(d0, C), 0.08);
  });
  // turned over, seen with the front at the back, as p. 22 draws it
  dstep({ title: "Screw six corner blocks under the bottom", detail: "Turn the drawer over. They hold the bottom to the sides, the front and the back.", tools: ["screwdriver"], kind: "screws", pose: "-y", turn: half }, () => b.fits(M, fitsOf(d0, M), 0.08));
  dstep({ title: "Screw on the four castors", detail: "7 cm in from the front and the back, two 12 mm screws each.", tools: ["screwdriver", "tape"], kind: "screws", pose: "-y", turn: half }, () => {
    b.fits(B, fitsOf(d0, B), 0.15);
    b.then(0.1);
    b.fits(L, fitsOf(d0, L), 0.05);
  });
  b.step(
    { title: "Slide both drawers in", detail: "Under rail 6, one each side of the divider; each holds 6 kg at most. Then the slats and a 90 x 200 cm mattress, which aren't included.", kind: "drawer", turn: TURN },
    () => {
      for (const [n, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of d.parts) b.add(k, [-m * 520, 0, 0]);
        if (n > 0) for (const [def, list] of d.fits) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
      // not in the box: drawn so the finished bed looks as it's used, on the slat ledges (the slats aren't drawn)
      b.add(b.place(b.part("Your mattress", [900, 180, 2000], { material: "soft", extra: true }), [0, LEDGE + 90, 0]), [0, 420, 0]);
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  // the brace comes out with the drawer too
  for (const d of drawers) b.openDrawer(d.parts, DEPTH, [-m, 0, 0]);
  return true;
}

const family: Family = { names: ["BILLUND"], build };
export default family;

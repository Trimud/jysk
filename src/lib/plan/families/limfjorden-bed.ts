import type { ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { add, mul, sg, spread } from "../math";
import type { Family } from "./family";

/*
 * LIMFJORDEN Double bed frame with 3 drawers (JYSK 3670459, 3670469; its 31-page manual, Rev.2, 26.03.2025).
 * The three drawers come first: the foot drawer (back 14 between sides 16 and 17, three battens underneath, two of
 * them on castors, front 13 on cam bolts) and the two side drawers the same way, bigger (back 15, sides 18 and 19,
 * battens 10, 11, 10, front 12). Then the foot board (rail 3 between the corner pieces 7 and 6 on double cam bolts,
 * with the slat ledge 8 and its angle bracket screwed on behind), the headboard (1 on 2, dowels and double cam
 * bolts, an angle bracket), the two side frames 4 and 5, bolted into the headboard and hooked onto the foot board's
 * cam bolts, the middle beam 22 on two adjustable legs, the drawers, and the pins for the slats.
 * Panel numbers are the manual's; sizes in mm are from its parts pages. Slats and mattress aren't included.
 * Hole positions are measured off the parts pages 10-12, which draw each panel to scale with its face holes; edge
 * holes the parts pages don't show come from the step drawings (noted where they're used).
 */

// fittings, as the manual lists them on pages 7-8 (its letters)
const A: HwDef = HW.dowel; // 8 x 30
const B: HwDef = { kind: "dowel", len: 50, dia: 8 };
const C: HwDef = HW.cam; // 15 mm
const D: HwDef = { kind: "camScrew", len: 45, dia: 7.5 };
const E: HwDef = { kind: "stud", len: 68, dia: 7, name: "Double cam bolt" };
const F: HwDef = { kind: "bolt", len: 70, dia: 6, flush: true };
const G: HwDef = { kind: "nut", len: 14, dia: 10, name: "Barrel nut" };
const H: HwDef = { kind: "camScrew", len: 52, dia: 7 };
const J: HwDef = { kind: "cam", len: 13.5, dia: 15, name: "Cam housing" };
const K: HwDef = { kind: "nut", len: 6, dia: 8, name: "Grub screw" };
const M: HwDef = { kind: "bolt", len: 50, dia: 7, flush: true };
const N: HwDef = { kind: "castor", len: 27, dia: 25 };
const P: HwDef = { kind: "screw", len: 32, dia: 4.2 };
const Q: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const R: HwDef = { kind: "glide", len: 5, dia: 15, name: "Nail-in glide" };
const S: HwDef = { kind: "angle", len: 55, dia: 45 };
const T: HwDef = { kind: "dowel", len: 40, dia: 10 };
const U: HwDef = { kind: "screw", len: 13, dia: 6.3 };
const V: HwDef = { kind: "foot", len: 238, dia: 50, name: "Adjustable leg" };
const W: HwDef = { kind: "spacer", len: 48, dia: 59, name: "Leg cup" };

// x across the bed, y up from the floor, z from the head (-) to the foot (+)
const GL = 5; // the nail-in glides lift everything: 5 + 450 = 455 at the sides, 5 + 900 = 905 at the headboard
const ZH = -952.5, ZT = 952.5; // inner faces of the headboard and the foot board: the side frames are 1905 long between
const SX = 689, SI = 680; // centre and inner face of a side frame's outer board (the frame is 50 deep with its slat ledge)
const LEDGE = 316; // top of the slat ledges and the middle beam: 139 under the top of the sides
const BAND = GL + 280; // underside of the sides' top band and the foot rail: a finger gap over the drawer fronts
const HEAD_LEG = 475, FOOT_LEG = 238; // the side frames' legs at each end, either side of the drawer opening (p. 11)
const DZ = (ZH + HEAD_LEG + ZT - FOOT_LEG) / 2; // the side drawers' centre along the bed
const BEAM_L = 1875;
const BEAM_Z = (ZH + ZT - 18) / 2; // the middle beam, between the headboard and the foot ledge (8)
const BOX = 27; // underside of a drawer box: the castors' height
const HB_JOINT = GL + 250; // where the headboard's two panels meet
// an angle bracket's four screws into the headboard, 16 and 17 either side of the joint (p. 12); the ledge's the same
const BRACKET_X = [-15.5, 15.5], BRACKET_Y = [HB_JOINT - 17, HB_JOINT + 16];


/** A drawer kind: the manual's numbers and sizes, and where its castors go (w: back from the front's inner face). */
interface DrawerKind {
  front: [string, number]; // label, width
  sides: [string, string]; // labels, u < 0 then u > 0
  back: [string, number]; // label, length between the sides
  bottom: [string, number, number]; // label, width, depth
  depth: number; // the sides' length
  // castors: w of each castor's middle; dowels: the two end dowels' offsets from the batten's middle (u)
  battens: { label: string; u: number; castors: number[]; dowels: number[]; edge: boolean }[];
}
// p. 10: the backs (14, 15) and fronts (13, 12) have each outer batten's two dowel holes 31 apart, ~4 mm off its
// middle towards the side (32 and 62 in from the side); a middle batten's are 30 either side of the back's long screw
const OUTER = (g: number) => [g * 18, g * -12.5];
const FOOT: DrawerKind = {
  front: ["13", 890],
  sides: ["17", "16"],
  back: ["14", 840],
  bottom: ["20", 850, 240],
  depth: 250,
  battens: [
    { label: "9", u: -370, castors: [-195, -36], dowels: OUTER(-1), edge: false }, // castors 35 in from each end
    { label: "23", u: 0, castors: [], dowels: [-30, 30], edge: false },
    { label: "9", u: 370, castors: [-195, -36], dowels: OUTER(1), edge: false },
  ],
};
const LONG: DrawerKind = {
  front: ["12", 1149],
  sides: ["19", "18"],
  back: ["15", 1099],
  bottom: ["21", 1109, 630],
  depth: 640,
  battens: [
    { label: "10", u: -499.5, castors: [-539, -83], dowels: OUTER(-1), edge: true }, // castors 82 in from each end
    { label: "11", u: 0, castors: [-310], dowels: [-30, 30], edge: false },
    { label: "10", u: 499.5, castors: [-539, -83], dowels: OUTER(1), edge: true },
  ],
};

/**
 * One drawer of a kind, its front's inner face centred on `c` (y = 0), coming out along `out`, its width along
 * `across`: the panels placed and every fitting listed in the drawer's own frame (u across, y up, w out).
 */
function placeDrawer(b: PlanBuilder, k: DrawerKind, types: Map<string, string>, c: Vec3, out: Vec3, across: Vec3) {
  const P3 = (u: number, y: number, w: number): Vec3 => add(add(c, mul(across, u)), add([0, y, 0], mul(out, w)));
  const D3 = (u: number, y: number, w: number): Vec3 => add(mul(across, u), add([0, y, 0], mul(out, w)));
  const size = (u: number, y: number, w: number): Vec3 => add(mul(across.map(Math.abs) as Vec3, u), add([0, y, 0], mul(out.map(Math.abs) as Vec3, w)));
  const type = (label: string, name: string, sz: Vec3, material?: "fiber") => {
    const key = `${label} ${sz.join("x")}`;
    if (!types.has(key)) types.set(key, b.part(name, sz, { label, material }));
    return types.get(key)!;
  };
  const ib = k.back[1] / 2; // inner faces of the sides
  const wb = -k.depth + 9; // the back's centre
  // p. 10: the front's batten holes are 24 above its bottom edge and its groove 34, so it hangs 15 below the box
  const front = b.place(type(k.front[0], "Drawer front", size(k.front[1], 253, 18)), P3(0, BOX - 15 + 126.5, 9));
  const sides = [0, 1].map((i) => b.place(type(k.sides[i], `Drawer side, ${i ? "right" : "left"}`, size(18, 180, k.depth)), P3(sg(i) * (ib + 9), BOX + 90, -k.depth / 2)));
  const back = b.place(type(k.back[0], "Drawer back", size(k.back[1], 178, 18)), P3(0, BOX + 89, wb));
  const bottom = b.place(type(k.bottom[0], "Drawer bottom", size(k.bottom[1], 2.5, k.bottom[2]), "fiber"), P3(0, BOX + 19.25, -1 - k.bottom[2] / 2));
  const bl = k.depth - 20; // batten length: between the back and the front
  const battens = k.battens.map((t) => b.place(type(t.label, t.castors.length ? "Batten with castors" : "Batten", size(100, 18, bl)), P3(t.u, BOX + 9, -(k.depth - 18) / 2)));
  const mid = battens[1];
  // heights over the box's bottom, p. 10: the sides' back ends have the long screws at 52 and 148 with the back's
  // dowels at 83 and 115 between them; the front has its cam bolts at 53 and 152, the sides' dowels at 85 and 118
  const fits = {
    backDowels: [0, 1].flatMap((i) => [83, 115].map((y): FitOpts => ({ on: back, at: P3(sg(i) * ib, BOX + y, wb), dir: D3(-sg(i), 0, 0), mate: sides[i] }))),
    sideDowels: [0, 1].flatMap((i) => [85, 118].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 9), BOX + y, 0), dir: D3(0, 0, -1), mate: front }))),
    battenDowels: (j: number): FitOpts[] => {
      const t = k.battens[j], on = battens[j];
      const ends = t.dowels.flatMap((du): FitOpts[] => [
        { on, at: P3(t.u + du, BOX + 9, 0), dir: D3(0, 0, -1), mate: front },
        { on, at: P3(t.u + du, BOX + 9, -k.depth + 18), dir: D3(0, 0, 1), mate: back },
      ]);
      const g = Math.sign(t.u);
      // an outer batten's long edge: 118 and 502 back from the front, by the sides' holes (p. 10)
      return t.edge ? [...ends, ...[-502, -118].map((w): FitOpts => ({ on, at: P3(t.u + g * 50, BOX + 9, w), dir: D3(-g, 0, 0), mate: sides[g < 0 ? 0 : 1] }))] : ends;
    },
    castors: (j: number): FitOpts[] => k.battens[j].castors.map((w) => ({ on: battens[j], at: P3(k.battens[j].u, BOX, w), dir: [0, 1, 0], hole: false })),
    // a castor's two screws are 32 apart along the batten (p. 10)
    castorScrews: (j: number): FitOpts[] => k.battens[j].castors.flatMap((w) => [-16, 16].map((dw): FitOpts => ({ on: battens[j], at: P3(k.battens[j].u, BOX, w + dw), dir: [0, 1, 0] }))),
    sideBolts: [0, 1].flatMap((i) => [52, 148].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 18), BOX + y, wb), dir: D3(-sg(i), 0, 0), mate: back }))),
    backBolt: [{ on: back, at: P3(0, BOX + 9, -k.depth), dir: D3(0, 0, 1), mate: mid }] as FitOpts[],
    camBolts: [
      ...[0, 1].flatMap((i) => [53, 152].map((y): FitOpts => ({ on: front, at: P3(sg(i) * (ib + 9), BOX + y, 0), dir: D3(0, 0, 1), mate: sides[i], mateHole: 4 }))),
      { on: front, at: P3(0, BOX + 9, 0), dir: D3(0, 0, 1), mate: mid, mateHole: 4 },
    ] as FitOpts[],
    cams: [
      // the sides' cam locks go in from their outside faces, the middle batten's from underneath (step 6), 34 behind
      // its front end (p. 10, the face with the castor screws); the sides' at the same distance, for the same cam bolts
      ...[0, 1].flatMap((i) => [53, 152].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 18), BOX + y, -35), dir: D3(-sg(i), 0, 0) }))),
      { on: mid, at: P3(0, BOX, -35), dir: [0, 1, 0] },
    ] as FitOpts[],
  };
  return { c, out, depth: bl, front, sides, back, bottom, battens, fits, parts: [front, ...sides, back, bottom, ...battens] };
}
type Drawer = ReturnType<typeof placeDrawer>;

/** Every fitting of a drawer, in the order it's built (for the ones that come ready-built when they slide in). */
const allFits = (d: Drawer): [HwDef, FitOpts[]][] => [
  [A, d.fits.backDowels],
  [A, d.fits.sideDowels],
  ...d.battens.flatMap((_, j): [HwDef, FitOpts[]][] => [[A, d.fits.battenDowels(j)], [N, d.fits.castors(j)], [Q, d.fits.castorScrews(j)]]),
  [M, d.fits.backBolt],
  [M, d.fits.sideBolts],
  [D, d.fits.camBolts],
  [C, d.fits.cams],
];

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "bed" || s.bed?.mattressW !== 135 || s.bed?.mattressL !== 190 || !/drawer/i.test(s.variant)) return false;
  const types = new Map<string, string>();

  /* ---------- the drawers' panels, then the frame's ---------- */

  const foot = placeDrawer(b, FOOT, types, [0, 0, ZT], [0, 0, 1], [1, 0, 0]);
  const longs = [1, 0].map((i) => {
    const g = sg(i);
    return placeDrawer(b, LONG, types, [g * SI, 0, DZ], [g, 0, 0], [0, 0, g]);
  });
  const hb = [
    b.place(b.part("Headboard, top", [1396, 650, 18], { label: "1" }), [0, HB_JOINT + 325, ZH - 9]),
    b.place(b.part("Headboard, bottom", [1396, 250, 18], { label: "2" }), [0, GL + 125, ZH - 9]),
  ];
  const hbAt = (y: number) => (y > HB_JOINT ? hb[0] : hb[1]);
  // a side frame: its outer board (a top band over two legs) and the slat ledge along its inside
  const sideFrame = (label: string, g: number) => {
    const { type, mid } = b.compound("Side frame", [
      { shape: "box", size: [18, 170, 1905], pos: [g * SX, BAND + 85, 0] },
      { shape: "box", size: [18, 280, HEAD_LEG], pos: [g * SX, GL + 140, ZH + HEAD_LEG / 2] },
      { shape: "box", size: [18, 280, FOOT_LEG], pos: [g * SX, GL + 140, ZT - FOOT_LEG / 2] },
      { shape: "box", size: [32, 70, 1905], pos: [g * (SI - 16), LEDGE - 35, 0] },
    ], { label });
    return b.place(type, mid);
  };
  const sides = [sideFrame("4", -1), sideFrame("5", 1)];
  const corners = [
    b.place(b.part("Foot corner, left", [250, 450, 18], { label: "7" }), [-573, GL + 225, ZT + 9]),
    b.place(b.part("Foot corner, right", [250, 450, 18], { label: "6" }), [573, GL + 225, ZT + 9]),
  ];
  const rail = b.place(b.part("Foot rail", [896, 170, 18], { label: "3" }), [0, BAND + 85, ZT + 9]);
  const ledge = b.place(b.part("Foot ledge", [1270, 85, 18], { label: "8" }), [0, LEDGE - 42.5, ZT - 9]);
  const beam = b.place(b.part("Middle beam", [60, 30, BEAM_L], { label: "22", material: "wood" }), [0, LEDGE - 15, BEAM_Z]);

  /* ---------- the foot drawer ---------- */

  // parts shown in their own scene, one after another
  const show = (keys: string[], centre: Vec3, from: Vec3) => {
    b.stagger(0.15);
    b.stageAround(keys, centre, from);
    b.then(0.15);
  };
  b.step({ title: "Tap four dowels into the foot drawer's back (14)", detail: "Two in each end.", tools: ["hammer"], scene: "drawer", kind: "dowels", warnings: ["floor"] }, () => {
    show([foot.back], foot.c, [0, 120, 0]);
    b.fits(A, foot.fits.backDowels, 0.08);
  });
  b.step({ title: "Tap two dowels into each of its sides (16 and 17)", detail: "In the end that goes against the front.", tools: ["hammer"], scene: "drawer", kind: "dowels" }, () => {
    show(foot.sides, foot.c, [0, 120, 0]);
    b.fits(A, foot.fits.sideDowels, 0.08);
  });
  b.step(
    { title: "Fit the castors to the two battens (9) and dowel all three", detail: "Two castors on each 9, two short 16 mm screws each; four dowels in each batten's ends, the middle one (23) too.", tools: ["hammer", "screwdriver"], scene: "drawer", pose: "-y", kind: "screws" },
    () => {
      show(foot.battens, foot.c, [0, 120, 0]);
      for (const j of [0, 2]) {
        b.fits(N, foot.fits.castors(j), 0.15);
        b.fits(Q, foot.fits.castorScrews(j), 0.05);
      }
      b.then(0.1);
      for (const j of [0, 1, 2]) b.fits(A, foot.fits.battenDowels(j), 0.05);
    },
  );
  b.step(
    { title: "Bolt the sides and the battens to the back", detail: "The battens go under the back's bottom edge, the sides on its ends: four long allen screws through the sides, one through the back into the middle batten. Stop when they're flush.", tools: ["allen"], scene: "drawer", turn: Math.PI, kind: "bolts" },
    () => {
      b.fits(M, foot.fits.sideBolts, 0.12);
      b.then(0.1);
      b.fits(M, foot.fits.backBolt, 0.12);
    },
  );
  b.step({ title: "Screw five cam bolts into the foot drawer's front (13)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], scene: "drawer", pose: "-z", kind: "cams", warnings: ["face"] }, () => {
    show([foot.front], foot.c, [0, 0, 160]);
    b.fits(D, foot.fits.camBolts, 0.1);
  });
  b.step(
    { title: "Slide the bottom in, put the front on and lock it", detail: "The bottom (20) runs in the grooves; then the front onto the dowels and cam bolts, and five cam locks.", tools: ["flathead"], scene: "drawer", kind: "cams" },
    () => {
      show([foot.bottom], foot.c, [0, 0, 300]);
      b.fits(C, foot.fits.cams, 0.12);
    },
  );

  /* ---------- the two side drawers: one shown, the other the same ---------- */

  const d0 = longs[0];
  const lstep = (d: StepDef, body: () => void) => b.step({ scene: "long", repeat: 2, ...d }, body);
  lstep({ title: "Tap four dowels into each side drawer's back (15)", detail: "Two in each end.", tools: ["hammer"], kind: "dowels" }, () => {
    show([d0.back], d0.c, [0, 120, 0]);
    b.fits(A, d0.fits.backDowels, 0.08);
  });
  lstep({ title: "Tap two dowels into each of its sides (18 and 19)", detail: "In the end that goes against the front.", tools: ["hammer"], kind: "dowels" }, () => {
    show(d0.sides, d0.c, [0, 120, 0]);
    b.fits(A, d0.fits.sideDowels, 0.08);
  });
  lstep({ title: "Fit a castor and four dowels to the middle batten (11)", detail: "One castor in the middle, on two 16 mm screws, and two dowels in each end.", tools: ["hammer", "screwdriver"], pose: "-y", kind: "screws" }, () => {
    show([d0.battens[1]], d0.c, [0, 120, 0]);
    b.fits(N, d0.fits.castors(1), 0.15);
    b.fits(Q, d0.fits.castorScrews(1), 0.05);
    b.then(0.1);
    b.fits(A, d0.fits.battenDowels(1), 0.05);
  });
  lstep({ title: "Fit two castors and six dowels to each outer batten (10)", detail: "Two castors near the ends, two dowels in each end and two in the long edge that goes against the side.", tools: ["hammer", "screwdriver"], pose: "-y", kind: "screws" }, () => {
    show([d0.battens[0], d0.battens[2]], d0.c, [0, 120, 0]);
    for (const j of [0, 2]) {
      b.fits(N, d0.fits.castors(j), 0.15);
      b.fits(Q, d0.fits.castorScrews(j), 0.05);
      b.then(0.1);
      b.fits(A, d0.fits.battenDowels(j), 0.05);
    }
  });
  lstep({ title: "Bolt the battens to the back", detail: "One long allen screw through the back into the middle batten.", tools: ["allen"], turn: Math.PI, kind: "bolts" }, () => b.fits(M, d0.fits.backBolt, 0.12));
  lstep({ title: "Bolt the sides on", detail: "Two long allen screws through each side into the back, until they're flush.", tools: ["allen"], kind: "bolts" }, () => b.fits(M, d0.fits.sideBolts, 0.12));
  lstep({ title: "Screw five cam bolts into each side drawer's front (12)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], pose: "-x", kind: "cams" }, () => {
    show([d0.front], d0.c, [160, 0, 0]);
    b.fits(D, d0.fits.camBolts, 0.1);
  });
  lstep({ title: "Slide the bottom in, put the front on and lock it", detail: "The bottom (21) runs in the grooves; then the front, and five cam locks.", tools: ["flathead"], kind: "cams" }, () => {
    show([d0.bottom], d0.c, [300, 0, 0]);
    b.fits(C, d0.fits.cams, 0.12);
  });

  /* ---------- the foot board ---------- */

  const fc: Vec3 = [0, 0, ZT];
  // the foot board's cam bolts into the side frames: the corner pieces' holes and the sides' cam housings (pp. 11-12)
  const sideY = [GL + 45, GL + 205, GL + 429];
  b.step({ title: "Tap four dowels into the foot rail (3)", detail: "Two in each end.", tools: ["hammer"], scene: "foot", kind: "dowels" }, () => {
    show([rail], fc, [0, 120, 0]);
    b.fits(A, [0, 1].flatMap((i) => [BAND + 20, BAND + 150].map((y): FitOpts => ({ on: rail, at: [sg(i) * 448, y, ZT + 9], dir: [-sg(i), 0, 0], mate: corners[i] }))), 0.08);
  });
  for (const [i, label] of [[1, "6"], [0, "7"]] as const) {
    const k = corners[i], g = sg(i);
    b.step(
      { title: `Fit three cam bolts and two glides to the corner piece (${label})`, detail: "The long 52 mm cam bolts in its inside face; the glides tapped into its bottom edge.", tools: ["screwdriver", "hammer"], scene: "foot", pose: "-z", kind: "cams" },
      () => {
        show([k], fc, [0, 120, 0]);
        b.fits(H, sideY.map((y): FitOpts => ({ on: k, at: [g * SX, y, ZT], dir: [0, 0, 1], mate: sides[i], mateHole: 4 })), 0.1);
        b.then(0.1);
        b.fits(R, [-80, 80].map((dx): FitOpts => ({ on: k, at: [g * 573 + dx, GL, ZT + 9], dir: [0, 1, 0], hole: false })), 0.12);
      },
    );
  }
  // p. 12: the rail's and corner pieces' cam locks, 53 and 117 under the top, 33 and 34 either side of the joint
  const eY = [BAND + 53, BAND + 117];
  b.step(
    { title: "Join the corner pieces to the foot rail", detail: "Two double cam bolts in each end of the rail, push the corner pieces onto its dowels, then turn the eight cam locks.", tools: ["flathead"], scene: "foot", pose: "-z", kind: "cams" },
    () => {
      b.fits(E, [0, 1].flatMap((i) => eY.map((y): FitOpts => ({ on: rail, at: [sg(i) * 424, y, ZT + 9], dir: [sg(i), 0, 0], hole: false }))), 0.1);
      b.then(0.1);
      b.fits(C, [0, 1].flatMap((i) => eY.flatMap((y): FitOpts[] => [{ on: rail, at: [sg(i) * 415, y, ZT], dir: [0, 0, 1] }, { on: corners[i], at: [sg(i) * 482, y, ZT], dir: [0, 0, 1] }])), 0.08);
    },
  );
  b.step(
    {
      title: "Screw the slat ledge (8) behind the foot board",
      detail: "Four dowels in the face that goes against the rail. Its top 31 mm overlaps the bottom of the rail's inside face, the dowels in the rail's holes; six 32 mm screws, then the angle bracket in the middle, on four short screws.",
      tools: ["hammer", "screwdriver"],
      scene: "foot",
      pose: "-z", kind: "screws",
    },
    () => {
      show([ledge], fc, [0, 0, -160]);
      // p. 12: every hole is 15 under the ledge's top, by the rail's dowel holes 16 over its bottom (p. 10); the outer
      // two screws go into the corner pieces
      b.fits(A, [-366, -92, 92, 366].map((x): FitOpts => ({ on: ledge, at: [x, LEDGE - 15, ZT], dir: [0, 0, -1], mate: rail })), 0.08);
      b.then(0.1);
      b.fits(P, [-585, -308, -154, 154, 308, 585].map((x): FitOpts => ({ on: ledge, at: [x, LEDGE - 15, ZT - 18], dir: [0, 0, 1] })), 0.08);
      b.then(0.1);
      b.fit(S, { on: ledge, at: [0, LEDGE - 56.5, ZT - 18], dir: [0, 0, 1], twist: Math.PI, hole: false });
      b.fits(U, BRACKET_X.flatMap((x) => BRACKET_Y.map((y): FitOpts => ({ on: ledge, at: [x, y, ZT - 20], dir: [0, 0, 1] }))), 0.06);
    },
  );

  /* ---------- the headboard and the side frames ---------- */

  const hc: Vec3 = [0, 0, ZH];
  // p. 12: the cam locks 34 either side of the joint, 65 and 466 in from each end; the 50 mm dowels ~60 inside each
  // double cam bolt (step 20: the parts pages don't draw edge holes)
  const jx = [-633, -232, 232, 633];
  b.step(
    { title: "Join the two headboard panels (1 and 2)", detail: "Four long 50 mm dowels and four double cam bolts along the joint, then the eight cam locks on the inside face.", tools: ["hammer", "flathead"], scene: "head", kind: "cams", people: 2 },
    () => {
      show(hb, hc, [0, 120, 0]);
      b.fits(B, [-572, -170, 170, 572].map((x): FitOpts => ({ on: hb[1], at: [x, HB_JOINT, ZH - 9], dir: [0, -1, 0], mate: hb[0] })), 0.08);
      b.then(0.1);
      b.fits(E, jx.map((x): FitOpts => ({ on: hb[0], at: [x, HB_JOINT - 24, ZH - 9], dir: [0, 1, 0], hole: false })), 0.08);
      b.then(0.1);
      b.fits(C, jx.flatMap((x): FitOpts[] => [{ on: hb[0], at: [x, HB_JOINT + 34, ZH], dir: [0, 0, -1] }, { on: hb[1], at: [x, HB_JOINT - 34, ZH], dir: [0, 0, -1] }]), 0.06);
    },
  );
  b.step(
    { title: "Screw the angle bracket on and tap in three glides", detail: "The bracket in the middle of the inside face, on four short screws, for the middle beam; the glides in the bottom edge.", tools: ["screwdriver", "hammer"], scene: "head", kind: "screws" },
    () => {
      b.fit(S, { on: hb[0], at: [0, LEDGE - 56.5, ZH], dir: [0, 0, -1], hole: false });
      b.fits(U, BRACKET_X.flatMap((x) => BRACKET_Y.map((y): FitOpts => ({ on: hbAt(y), at: [x, y, ZH + 2], dir: [0, 0, -1] }))), 0.06);
      b.then(0.1);
      b.fits(R, [-500, 0, 500].map((x): FitOpts => ({ on: hb[1], at: [x, GL, ZH - 9], dir: [0, 1, 0], hole: false })), 0.1);
    },
  );
  // p. 12: the headboard's dowel holes by its bolt holes, the corner pieces' by their cam bolts; the side frames' ends
  // match (four dowels at the head, two at the foot)
  const headDowelY = [GL + 77, GL + 173, GL + 302, GL + 397], footDowelY = [GL + 109, GL + 365];
  for (const [i, label] of [[0, "4"], [1, "5"]] as const) {
    const g = sg(i);
    b.step(
      { title: `Tap dowels and glides into the side frame (${label})`, detail: "Four dowels in the head end, two in the foot end; two glides under each leg.", tools: ["hammer"], scene: "sides", kind: "dowels" },
      () => {
        show([sides[i]], [g * 400, 0, 0], [0, 120, 0]);
        b.fits(A, [
          ...headDowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZH], dir: [0, 0, 1], mate: hbAt(y) })),
          ...footDowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZT], dir: [0, 0, -1], mate: corners[i] })),
        ], 0.08);
        b.then(0.1);
        b.fits(R, [ZH + 60, ZH + HEAD_LEG - 60, ZT - FOOT_LEG + 60, ZT - 60].map((z): FitOpts => ({ on: sides[i], at: [g * SX, GL, z], dir: [0, 1, 0], hole: false })), 0.1);
      },
    );
  }
  const boltY = [sideY[0], sideY[1], GL + 333, sideY[2]]; // pp. 11-12: the barrel nuts 46 from the sides' head ends
  b.step(
    {
      title: "Bolt the side frames to the headboard",
      detail: "Drop a barrel nut into each hole on the sides' inside faces, slot towards the bolt, then the eight long bolts through the headboard with the allen key.",
      tools: ["allen", "flathead"],
      people: 2,
      turn: Math.PI, kind: "bolts",
    },
    () => {
      b.stagger(0.2);
      for (const k of hb) b.add(k, [0, 0, -300]);
      for (const i of [0, 1]) b.add(sides[i], [sg(i) * 300, 0, 0]);
      b.then(0.15);
      b.fits(G, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 14), y, ZH + 46], dir: [sg(i), 0, 0], hole: false }))), 0.06);
      b.then(0.1);
      b.fits(F, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: hbAt(y), at: [sg(i) * SX, y, ZH - 18], dir: [0, 0, 1], mate: sides[i] }))), 0.1);
    },
  );
  b.step(
    {
      title: "Hook the foot board onto the side frames",
      detail: "A cam housing in each hole near the sides' foot ends, then push the foot board onto the sides' dowels so its cam bolts go into the housings, turn each housing to lock, and a grub screw in each with the allen key.",
      tools: ["flathead", "allen"],
      people: 2,
      kind: "cams",
    },
    () => {
      // p. 11: the cam housings' holes are 33 from the sides' foot ends
      b.fits(J, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * SI, y, ZT - 33], dir: [sg(i), 0, 0] }))), 0.1);
      b.then(0.1);
      b.stagger(0.1);
      for (const k of [rail, ...corners, ledge]) b.add(k, [0, 0, 300]);
      b.then(0.15);
      b.fits(K, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 6), y, ZT - 33], dir: [sg(i), 0, 0], hole: false }))), 0.06);
    },
  );

  /* ---------- the middle beam ---------- */

  // p. 11: the beam's two leg holes are 304 either side of its middle, the brackets' screw holes 39 in from its ends
  const legZ = [BEAM_Z - 304, BEAM_Z + 304];
  b.step(
    {
      title: "Fit the two legs under the middle beam (22)",
      detail: "Screw each cup on with four short screws, 13 mm in from the edges, then push a leg into it.",
      tools: ["screwdriver"],
      scene: "beam",
      pose: "-y", kind: "legs",
    },
    () => {
      show([beam], [0, 0, BEAM_Z], [0, 120, 0]);
      b.fits(W, legZ.map((z): FitOpts => ({ on: beam, at: [0, LEDGE - 30, z], dir: [0, 1, 0], hole: false })), 0.15);
      b.then(0.05);
      b.fits(Q, legZ.flatMap((z) => [-1, 1].flatMap((dx) => [-1, 1].map((dz): FitOpts => ({ on: beam, at: [dx * 17, LEDGE - 30, z + dz * 17], dir: [0, 1, 0] })))), 0.04);
      b.then(0.1);
      b.fits(V, legZ.map((z): FitOpts => ({ on: beam, at: [0, LEDGE - 78, z], dir: [0, 1, 0], hole: false })), 0.15);
    },
  );
  b.step(
    { title: "Lay the beam on the two angle brackets and screw it on", detail: "Two screws up through each bracket.", tools: ["screwdriver"], kind: "screws" },
    () => {
      b.add(beam, [0, 300, 0]);
      b.then(0.15);
      b.fits(U, [BEAM_Z - BEAM_L / 2 + 39, BEAM_Z + BEAM_L / 2 - 39].flatMap((z) => BRACKET_X.map((x): FitOpts => ({ on: beam, at: [x, LEDGE - 30, z], dir: [0, 1, 0] }))), 0.08);
    },
  );
  b.step(
    { title: "Turn the legs down to the floor", detail: "Until each leg is 1-2 mm off the floor: the beam shouldn't lift.", kind: "general" },
    () => {},
  );

  /* ---------- the drawers in ---------- */

  b.step(
    { title: "Slide in the three drawers", detail: "The two big ones under the sides, the small one under the foot. They run on their own castors.", kind: "drawer" },
    () => {
      for (const [i, d] of [foot, ...longs].entries()) {
        b.stagger(0);
        for (const k of d.parts) b.add(k, mul(d.out, 520));
        if (i === 2) for (const [def, list] of allFits(d)) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  // the battens and their castors come out with each drawer
  for (const d of [...longs, foot]) b.openDrawer(d.parts, d.depth, d.out);

  b.step(
    {
      title: "With slats: tap the four pins into the middle beam",
      detail: "They hold the slats in place. Without slats (a mattress straight on), leave them out.",
      tools: ["hammer"],
      kind: "dowels",
    },
    () => b.fits(T, spread(BEAM_Z - 700, BEAM_Z + 700, 4).map((z): FitOpts => ({ on: beam, at: [0, LEDGE, z], dir: [0, -1, 0] })), 0.1),
  );
  b.step(
    { title: "Lay the slats and the mattress on", detail: "The slats and the 135 x 190 cm mattress aren't included: follow the slats' own instructions. Each drawer holds 5 kg at most.", kind: "general", weight: 0.8 }, // the mattress adds no assembly time
    () => {
      // not in the box: drawn so the finished bed looks as it's used, on the slat level (the slats under it aren't drawn)
      const mattress = b.place(b.part("Your mattress", [1350, 180, 1900], { material: "soft", extra: true }), [0, LEDGE + 90, 0]);
      b.add(mattress, [0, 420, 0]);
    },
  );
  return true;
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

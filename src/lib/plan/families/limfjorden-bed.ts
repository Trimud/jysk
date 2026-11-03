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
const BAND = GL + 280; // underside of the sides' top band and the foot rail: the drawer fronts end here
const HEAD_LEG = 494, FOOT_LEG = 233; // the side frames' legs at each end, either side of the drawer opening
const DZ = (ZH + HEAD_LEG + ZT - FOOT_LEG) / 2; // the side drawers' centre along the bed
const BEAM_Z = (ZH + ZT - 18) / 2; // the middle beam, between the headboard and the foot ledge (8)
const BOX = 27; // underside of a drawer box: the castors' height
const HB_JOINT = GL + 250; // where the headboard's two panels meet


/** A drawer kind: the manual's numbers and sizes, and where its castors go (w: back from the front's inner face). */
interface DrawerKind {
  front: [string, number]; // label, width
  sides: [string, string]; // labels, u < 0 then u > 0
  back: [string, number]; // label, length between the sides
  bottom: [string, number, number]; // label, width, depth
  depth: number; // the sides' length
  battens: { label: string; u: number; castors: number[]; edge: boolean }[];
}
const FOOT: DrawerKind = {
  front: ["13", 890],
  sides: ["17", "16"],
  back: ["14", 840],
  bottom: ["20", 850, 240],
  depth: 250,
  battens: [
    { label: "9", u: -370, castors: [-190, -40], edge: false },
    { label: "23", u: 0, castors: [], edge: false },
    { label: "9", u: 370, castors: [-190, -40], edge: false },
  ],
};
const LONG: DrawerKind = {
  front: ["12", 1149],
  sides: ["19", "18"],
  back: ["15", 1099],
  bottom: ["21", 1109, 630],
  depth: 640,
  battens: [
    { label: "10", u: -499.5, castors: [-540, -80], edge: true },
    { label: "11", u: 0, castors: [-310], edge: false },
    { label: "10", u: 499.5, castors: [-540, -80], edge: true },
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
  const front = b.place(type(k.front[0], "Drawer front", size(k.front[1], 253, 18)), P3(0, BAND - 126.5, 9));
  const sides = [0, 1].map((i) => b.place(type(k.sides[i], `Drawer side, ${i ? "right" : "left"}`, size(18, 180, k.depth)), P3(sg(i) * (ib + 9), BOX + 90, -k.depth / 2)));
  const back = b.place(type(k.back[0], "Drawer back", size(k.back[1], 178, 18)), P3(0, BOX + 89, wb));
  const bottom = b.place(type(k.bottom[0], "Drawer bottom", size(k.bottom[1], 2.5, k.bottom[2]), "fiber"), P3(0, BOX + 19.25, -1 - k.bottom[2] / 2));
  const bl = k.depth - 20; // batten length: between the back and the front
  const battens = k.battens.map((t) => b.place(type(t.label, t.castors.length ? "Batten with castors" : "Batten", size(100, 18, bl)), P3(t.u, BOX + 9, -(k.depth - 18) / 2)));
  const mid = battens[1];
  const fits = {
    backDowels: [0, 1].flatMap((i) => [80, 160].map((y): FitOpts => ({ on: back, at: P3(sg(i) * ib, BOX + y, wb), dir: D3(-sg(i), 0, 0), mate: sides[i] }))),
    sideDowels: [0, 1].flatMap((i) => [100, 150].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 9), BOX + y, 0), dir: D3(0, 0, -1), mate: front }))),
    battenDowels: (j: number): FitOpts[] => {
      const t = k.battens[j], on = battens[j];
      const ends = [-25, 25].flatMap((du): FitOpts[] => [
        { on, at: P3(t.u + du, BOX + 9, 0), dir: D3(0, 0, -1), mate: front },
        { on, at: P3(t.u + du, BOX + 9, -k.depth + 18), dir: D3(0, 0, 1), mate: back },
      ]);
      const g = Math.sign(t.u);
      return t.edge ? [...ends, ...[-420, -200].map((w): FitOpts => ({ on, at: P3(t.u + g * 50, BOX + 9, w), dir: D3(-g, 0, 0), mate: sides[g < 0 ? 0 : 1] }))] : ends;
    },
    castors: (j: number): FitOpts[] => k.battens[j].castors.map((w) => ({ on: battens[j], at: P3(k.battens[j].u, BOX, w), dir: [0, 1, 0], hole: false })),
    castorScrews: (j: number): FitOpts[] => k.battens[j].castors.flatMap((w) => [-14, 14].map((du): FitOpts => ({ on: battens[j], at: P3(k.battens[j].u + du, BOX, w), dir: [0, 1, 0] }))),
    sideBolts: [0, 1].flatMap((i) => [80, 160].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 18), BOX + y, wb), dir: D3(-sg(i), 0, 0), mate: back }))),
    backBolt: [{ on: back, at: P3(0, BOX + 9, -k.depth), dir: D3(0, 0, 1), mate: mid }] as FitOpts[],
    camBolts: [
      ...[0, 1].flatMap((i) => [55, 165].map((y): FitOpts => ({ on: front, at: P3(sg(i) * (ib + 9), BOX + y, 0), dir: D3(0, 0, 1), mate: sides[i], mateHole: 4 }))),
      { on: front, at: P3(0, BOX + 9, 0), dir: D3(0, 0, 1), mate: mid, mateHole: 4 },
    ] as FitOpts[],
    cams: [
      ...[0, 1].flatMap((i) => [55, 165].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * ib, BOX + y, -25), dir: D3(sg(i), 0, 0) }))),
      { on: mid, at: P3(0, BOX + 18, -25), dir: [0, -1, 0] },
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
  const beam = b.place(b.part("Middle beam", [60, 30, 1875], { label: "22", material: "wood" }), [0, LEDGE - 15, BEAM_Z]);

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
    { title: "Fit the castors to the two battens (9) and dowel all three", detail: "Two castors on each 9, two short 16 mm screws each; four dowels in each batten's ends, the middle one (23) too.", tools: ["hammer", "screwdriver"], scene: "drawer", kind: "screws" },
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
    { title: "Bolt the sides and the battens to the back", detail: "The battens go under the back's bottom edge, the sides on its ends: four long allen screws through the sides, one through the back into the middle batten. Stop when they're flush.", tools: ["allen"], scene: "drawer", kind: "bolts" },
    () => {
      b.fits(M, foot.fits.sideBolts, 0.12);
      b.then(0.1);
      b.fits(M, foot.fits.backBolt, 0.12);
    },
  );
  b.step({ title: "Screw five cam bolts into the foot drawer's front (13)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], scene: "drawer", kind: "cams", warnings: ["face"] }, () => {
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
  lstep({ title: "Fit a castor and four dowels to the middle batten (11)", detail: "One castor in the middle, on two 16 mm screws, and two dowels in each end.", tools: ["hammer", "screwdriver"], kind: "screws" }, () => {
    show([d0.battens[1]], d0.c, [0, 120, 0]);
    b.fits(N, d0.fits.castors(1), 0.15);
    b.fits(Q, d0.fits.castorScrews(1), 0.05);
    b.then(0.1);
    b.fits(A, d0.fits.battenDowels(1), 0.05);
  });
  lstep({ title: "Fit two castors and six dowels to each outer batten (10)", detail: "Two castors near the ends, two dowels in each end and two in the long edge that goes against the side.", tools: ["hammer", "screwdriver"], kind: "screws" }, () => {
    show([d0.battens[0], d0.battens[2]], d0.c, [0, 120, 0]);
    for (const j of [0, 2]) {
      b.fits(N, d0.fits.castors(j), 0.15);
      b.fits(Q, d0.fits.castorScrews(j), 0.05);
      b.then(0.1);
      b.fits(A, d0.fits.battenDowels(j), 0.05);
    }
  });
  lstep({ title: "Bolt the battens to the back", detail: "One long allen screw through the back into the middle batten.", tools: ["allen"], kind: "bolts" }, () => b.fits(M, d0.fits.backBolt, 0.12));
  lstep({ title: "Bolt the sides on", detail: "Two long allen screws through each side into the back, until they're flush.", tools: ["allen"], kind: "bolts" }, () => b.fits(M, d0.fits.sideBolts, 0.12));
  lstep({ title: "Screw five cam bolts into each side drawer's front (12)", detail: "Lay it face down on something soft.", tools: ["screwdriver"], kind: "cams" }, () => {
    show([d0.front], d0.c, [160, 0, 0]);
    b.fits(D, d0.fits.camBolts, 0.1);
  });
  lstep({ title: "Slide the bottom in, put the front on and lock it", detail: "The bottom (21) runs in the grooves; then the front, and five cam locks.", tools: ["flathead"], kind: "cams" }, () => {
    show([d0.bottom], d0.c, [300, 0, 0]);
    b.fits(C, d0.fits.cams, 0.12);
  });

  /* ---------- the foot board ---------- */

  const fc: Vec3 = [0, 0, ZT];
  const sideY = [GL + 55, GL + 175, GL + 325]; // the foot board's cam bolts into the side frames
  b.step({ title: "Tap four dowels into the foot rail (3)", detail: "Two in each end.", tools: ["hammer"], scene: "foot", kind: "dowels" }, () => {
    show([rail], fc, [0, 120, 0]);
    b.fits(A, [0, 1].flatMap((i) => [BAND + 20, BAND + 150].map((y): FitOpts => ({ on: rail, at: [sg(i) * 448, y, ZT + 9], dir: [-sg(i), 0, 0], mate: corners[i] }))), 0.08);
  });
  for (const [i, label] of [[1, "6"], [0, "7"]] as const) {
    const k = corners[i], g = sg(i);
    b.step(
      { title: `Fit three cam bolts and two glides to the corner piece (${label})`, detail: "The long 52 mm cam bolts in its inside face; the glides tapped into its bottom edge.", tools: ["screwdriver", "hammer"], scene: "foot", kind: "cams" },
      () => {
        show([k], fc, [0, 120, 0]);
        b.fits(H, sideY.map((y): FitOpts => ({ on: k, at: [g * SX, y, ZT], dir: [0, 0, 1], mate: sides[i], mateHole: 4 })), 0.1);
        b.then(0.1);
        b.fits(R, [-80, 80].map((dx): FitOpts => ({ on: k, at: [g * 573 + dx, GL, ZT + 9], dir: [0, 1, 0], hole: false })), 0.12);
      },
    );
  }
  const eY = [BAND + 60, BAND + 110];
  b.step(
    { title: "Join the corner pieces to the foot rail", detail: "Push the rail onto the corner pieces' dowels with two double cam bolts at each joint, then turn the eight cam locks.", tools: ["flathead"], scene: "foot", kind: "cams" },
    () => {
      b.fits(E, [0, 1].flatMap((i) => eY.map((y): FitOpts => ({ on: rail, at: [sg(i) * 472, y, ZT + 9], dir: [sg(i), 0, 0], hole: false }))), 0.1);
      b.then(0.1);
      b.fits(C, [0, 1].flatMap((i) => eY.flatMap((y): FitOpts[] => [{ on: rail, at: [sg(i) * 416, y, ZT], dir: [0, 0, 1] }, { on: corners[i], at: [sg(i) * 480, y, ZT], dir: [0, 0, 1] }])), 0.08);
    },
  );
  b.step(
    {
      title: "Screw the slat ledge (8) behind the foot board",
      detail: "Four dowels in its top edge for the slats. Lay it along the top of the rail's inside face, six 32 mm screws; then the angle bracket in the middle, on four short screws.",
      tools: ["hammer", "screwdriver"],
      scene: "foot",
      kind: "screws",
    },
    () => {
      show([ledge], fc, [0, 0, -160]);
      b.fits(A, [-450, -150, 150, 450].map((x): FitOpts => ({ on: ledge, at: [x, LEDGE, ZT - 9], dir: [0, -1, 0] })), 0.08);
      b.then(0.1);
      b.fits(P, spread(-600, 600, 6).map((x): FitOpts => ({ on: ledge, at: [x, BAND + 15, ZT - 18], dir: [0, 0, 1] })), 0.08);
      b.then(0.1);
      b.fit(S, { on: ledge, at: [0, LEDGE - 56.5, ZT - 18], dir: [0, 0, 1], twist: Math.PI, hole: false });
      b.fits(U, [-12, 12].flatMap((x) => [LEDGE - 70, LEDGE - 45].map((y): FitOpts => ({ on: ledge, at: [x, y, ZT - 20], dir: [0, 0, 1] }))), 0.06);
    },
  );

  /* ---------- the headboard and the side frames ---------- */

  const hc: Vec3 = [0, 0, ZH];
  const jx = [-530, -190, 190, 530];
  b.step(
    { title: "Join the two headboard panels (1 and 2)", detail: "Four long 50 mm dowels and four double cam bolts along the joint, then the eight cam locks on the inside face.", tools: ["hammer", "flathead"], scene: "head", kind: "cams", people: 2 },
    () => {
      show(hb, hc, [0, 120, 0]);
      b.fits(B, [-470, -130, 130, 470].map((x): FitOpts => ({ on: hb[1], at: [x, HB_JOINT, ZH - 9], dir: [0, -1, 0], mate: hb[0] })), 0.08);
      b.then(0.1);
      b.fits(E, jx.map((x): FitOpts => ({ on: hb[0], at: [x, HB_JOINT + 24, ZH - 9], dir: [0, 1, 0], hole: false })), 0.08);
      b.then(0.1);
      b.fits(C, jx.flatMap((x): FitOpts[] => [{ on: hb[0], at: [x, HB_JOINT + 32, ZH], dir: [0, 0, -1] }, { on: hb[1], at: [x, HB_JOINT - 32, ZH], dir: [0, 0, -1] }]), 0.06);
    },
  );
  b.step(
    { title: "Screw the angle bracket on and tap in three glides", detail: "The bracket in the middle of the inside face, on four short screws, for the middle beam; the glides in the bottom edge.", tools: ["screwdriver", "hammer"], scene: "head", kind: "screws" },
    () => {
      b.fit(S, { on: hb[0], at: [0, LEDGE - 56.5, ZH], dir: [0, 0, -1], hole: false });
      b.fits(U, [-12, 12].flatMap((x) => [LEDGE - 70, LEDGE - 42].map((y): FitOpts => ({ on: hbAt(y), at: [x, y, ZH + 2], dir: [0, 0, -1] }))), 0.06);
      b.then(0.1);
      b.fits(R, [-500, 0, 500].map((x): FitOpts => ({ on: hb[1], at: [x, GL, ZH - 9], dir: [0, 1, 0], hole: false })), 0.1);
    },
  );
  const dowelY = [GL + 105, GL + 195, GL + 395];
  for (const [i, label] of [[0, "4"], [1, "5"]] as const) {
    const g = sg(i);
    b.step(
      { title: `Tap dowels and glides into the side frame (${label})`, detail: "Three dowels in each end; two glides under each leg.", tools: ["hammer"], scene: "sides", kind: "dowels" },
      () => {
        show([sides[i]], [g * 400, 0, 0], [0, 120, 0]);
        b.fits(A, [
          ...dowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZH], dir: [0, 0, 1], mate: hbAt(y) })),
          ...dowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZT], dir: [0, 0, -1], mate: corners[i] })),
        ], 0.08);
        b.then(0.1);
        b.fits(R, [ZH + 60, ZH + HEAD_LEG - 60, ZT - FOOT_LEG + 60, ZT - 60].map((z): FitOpts => ({ on: sides[i], at: [g * SX, GL, z], dir: [0, 1, 0], hole: false })), 0.1);
      },
    );
  }
  const boltY = [...sideY, GL + 425];
  b.step(
    {
      title: "Bolt the side frames to the headboard",
      detail: "Drop a barrel nut into each hole on the sides' inside faces, slot towards the bolt, then the eight long bolts through the headboard with the allen key.",
      tools: ["allen", "flathead"],
      people: 2,
      kind: "bolts",
    },
    () => {
      b.stagger(0.2);
      for (const k of hb) b.add(k, [0, 0, -300]);
      for (const i of [0, 1]) b.add(sides[i], [sg(i) * 300, 0, 0]);
      b.then(0.15);
      b.fits(G, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 14), y, ZH + 45], dir: [sg(i), 0, 0], hole: false }))), 0.06);
      b.then(0.1);
      b.fits(F, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: hbAt(y), at: [sg(i) * SX, y, ZH - 18], dir: [0, 0, 1], mate: sides[i] }))), 0.1);
    },
  );
  b.step(
    {
      title: "Hook the foot board onto the side frames",
      detail: "Push it onto the sides' dowels so its cam bolts go into the cam housings, turn each housing to lock, then a grub screw in each with the allen key.",
      tools: ["flathead", "allen"],
      people: 2,
      kind: "cams",
    },
    () => {
      b.stagger(0.1);
      for (const k of [rail, ...corners, ledge]) b.add(k, [0, 0, 300]);
      b.then(0.15);
      b.fits(J, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * SI, y, ZT - 22], dir: [sg(i), 0, 0] }))), 0.1);
      b.then(0.1);
      b.fits(K, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 6), y, ZT - 22], dir: [sg(i), 0, 0], hole: false }))), 0.06);
    },
  );

  /* ---------- the middle beam ---------- */

  const legZ = [BEAM_Z - 450, BEAM_Z + 450];
  b.step(
    {
      title: "Fit the two legs under the middle beam (22)",
      detail: "Screw each cup on with four short screws, 13 mm in from the edges, then push a leg into it.",
      tools: ["screwdriver"],
      scene: "beam",
      kind: "legs",
    },
    () => {
      show([beam], [0, 0, BEAM_Z], [0, 120, 0]);
      b.fits(W, legZ.map((z): FitOpts => ({ on: beam, at: [0, LEDGE - 30, z], dir: [0, 1, 0], hole: false })), 0.15);
      b.then(0.05);
      b.fits(Q, legZ.flatMap((z) => [-1, 1].flatMap((dx) => [-1, 1].map((dz): FitOpts => ({ on: beam, at: [dx * 18, LEDGE - 30, z + dz * 18], dir: [0, 1, 0] })))), 0.04);
      b.then(0.1);
      b.fits(V, legZ.map((z): FitOpts => ({ on: beam, at: [0, LEDGE - 78, z], dir: [0, 1, 0], hole: false })), 0.15);
    },
  );
  b.step(
    { title: "Lay the beam on the two angle brackets and screw it on", detail: "Two screws up through each bracket.", tools: ["screwdriver"], kind: "screws" },
    () => {
      b.add(beam, [0, 300, 0]);
      b.then(0.15);
      b.fits(U, [ZH + 22, ZT - 18 - 22].flatMap((z) => [-12, 12].map((x): FitOpts => ({ on: beam, at: [x, LEDGE - 30, z], dir: [0, 1, 0] }))), 0.08);
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

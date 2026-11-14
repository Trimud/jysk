import type { ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { add, mul, sg, sub } from "../math";
import type { Family } from "./family";

/*
 * LIMFJORDEN bed frames with drawers (JYSK; their manuals Rev.2, 26.03.2025): the Double, Euro Double, King and Super
 * King with 3 drawers (31 pages each, 3670459/3670469, 3670461/3670471, 3670463/3670473, and the Super King's), the
 * Single and Euro Single with 2 (28 pages each).
 * The drawers come first: the foot drawer (back 14 between sides 16 and 17, battens underneath on castors, front 13 on
 * cam bolts) and the side drawers the same way, bigger (back 15, sides 18 and 19, battens 10, 11, 10, front 12): two
 * of them on the 3-drawer beds, one on the singles. Then the foot board (rail 3 between the corner pieces 7 and 6 on
 * double cam bolts, with the slat ledge 8 screwed on behind), the headboard (1 on 2, dowels and double cam bolts), the
 * two side frames 4 and 5, bolted into the headboard and hooked onto the foot board's cam bolts.
 * - 3 drawers: angle brackets on the ledge and the headboard carry the middle beam 22 on two adjustable legs; then the
 *   drawers and the manual's either/or (p. 28), both here (Plan.layouts): A (p. 29, the first) four pins in the beam
 *   and two slatted bases on, B (p. 30) no pins, a mattress straight on the frame.
 * - 2 drawers: no beam. The manual's either/or (p. 21) is which way round: A (p. 22, the first) panel 22 closes side
 *   frame 4's drawer opening, so the drawer goes under 5, B (p. 25) the other way.
 * Panel numbers are the manual's; sizes in mm are from its parts pages. Slats and mattress aren't included.
 * Hole positions are measured off the parts pages (the Double's pp. 10-12, the Single's pp. 9-10), which draw each
 * panel roughly to scale with its face holes; edge holes they don't show come from the step drawings (noted where
 * they're used). The Euro Double's parts pages are the Double's drawings relabelled (the same outlines), and the long
 * panels (15, 12, 21, 22) of the King and Super King are the Euro Double's: those holes are measured on the Double's
 * drawing, the same distance from the panel's nearer end (or its middle, for the ones nearer the middle).
 */

// fittings, as the manual lists them on pages 7-8 (its letters)
const A: HwDef = HW.dowel; // 8 x 30
const B: HwDef = { kind: "dowel", len: 50, dia: 8 };
const C: HwDef = HW.cam; // 15 mm
const D: HwDef = { kind: "camScrew", len: 45, dia: 7.5 };
const E: HwDef = { kind: "stud", len: 68, dia: 7, name: "Double cam bolt", form: "double" };
const F: HwDef = { kind: "bolt", len: 70, dia: 6, flush: true };
const G: HwDef = { kind: "nut", len: 14, dia: 10, name: "Barrel nut", form: "cross" };
const H: HwDef = { kind: "camScrew", len: 52, dia: 7 };
// J is a round barrel housing the foot board's cam bolt hooks into, locked by K: not a turning cam lock (pp. 7, 25)
const J: HwDef = { kind: "nut", len: 13.5, dia: 15, name: "Cam housing", form: "housing" }; // sunk in its hole
const K: HwDef = { kind: "nut", len: 6, dia: 8, name: "Grub screw", form: "grub" };
const M: HwDef = { kind: "bolt", len: 50, dia: 7, flush: true };
const N: HwDef = { kind: "castor", len: 27, dia: 25, form: "plate" }; // 42x27, screwed on, no pin
const P: HwDef = { kind: "screw", len: 32, dia: 4.2 };
const Q: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const R: HwDef = { kind: "glide", len: 5, dia: 15, name: "Nail-in glide" };
const S: HwDef = { kind: "angle", len: 55, dia: 45 };
const S2: HwDef = { kind: "plate", len: 2, dia: 46, name: "Joining plate", form: "square" }; // the singles' S: 46 x 46 x 2
const T: HwDef = { kind: "dowel", len: 40, dia: 10 };
const U: HwDef = { kind: "screw", len: 13, dia: 6.3, form: "euro" };
const V: HwDef = { kind: "foot", len: 238, dia: 50, name: "Adjustable leg", form: "disc" };
const W: HwDef = { kind: "spacer", len: 48, dia: 59, name: "Leg cup", form: "flange" };

/** A bed size: the measures its parts pages change (x across from the middle, the positive half where it's mirrored). */
interface Size {
  hw: number; // half the headboard's width: the side frames' outer faces
  len: number; // the side frames' length, between the headboard and the foot board
  beam: boolean; // 3 drawers: a middle beam on legs, two side drawers
  longBottom: number; // the side drawer's bottom (21) width
  ledgeDowels: number[]; // ledge 8 into the rail
  ledgeScrews: number[]; // ledge 8 into the rail, the outer pair into the corner pieces
  joint: number[]; // the headboard's double cam bolts (0: one in the middle), each with its two cam locks
  jointDowels: number[]; // the 50 mm dowels along the joint
}
const SIZES: Record<string, Size> = {
  // pp. 10-12
  "135x190": { hw: 698, len: 1905, beam: true, longBottom: 1109, ledgeDowels: [92, 366], ledgeScrews: [154, 308, 585], joint: [232, 633], jointDowels: [170, 572] },
  // measured on the Double's drawing (pp. 10-12 relabelled), the same distance from the ends: the holes nearer an end
  // than the middle keep their distance from the end, the others from the middle (a longer panel grows in the middle)
  "140x200": { hw: 723, len: 2005, beam: true, longBottom: 1209, ledgeDowels: [92, 391], ledgeScrews: [154, 308, 610], joint: [232, 658], jointDowels: [170, 597] },
  // redrawn (p. 12): the ledge's dowels 89-98 and 441 off its middle, the rail's 102-134 and 441; the joint's cam locks
  // 244-297 and 707 (drawn off centre, taken symmetric)
  "150x200": { hw: 773, len: 2005, beam: true, longBottom: 1209, ledgeDowels: [95, 441], ledgeScrews: [155, 379, 659], joint: [270, 707], jointDowels: [208, 646] },
  // redrawn (p. 12): five double cam bolts, one in the middle under the angle bracket (p. 22: B x4, C x10, E x5)
  "180x200": { hw: 923, len: 2005, beam: true, longBottom: 1209, ledgeDowels: [100, 572], ledgeScrews: [167, 505, 806], joint: [0, 416, 853], jointDowels: [355, 792] },
  // pp. 9-10; the four 50 mm dowels: one by each outer double cam bolt, two either side of the middle one (p. 20)
  "90x190": { hw: 473, len: 1905, beam: false, longBottom: 1110, ledgeDowels: [144], ledgeScrews: [80, 368], joint: [0, 416], jointDowels: [61, 355] },
  "90x200": { hw: 473, len: 2005, beam: false, longBottom: 1210, ledgeDowels: [144], ledgeScrews: [80, 368], joint: [0, 416], jointDowels: [61, 355] },
};
/** a list of positive x's mirrored, in order from -x to +x (a 0 kept once) */
const sym = (xs: number[]) => [...xs.filter((x) => x).map((x) => -x), ...xs].sort((a, b) => a - b);
const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const words = (n: number) => WORDS[n] ?? String(n);

// x across the bed, y up from the floor, z from the head (-) to the foot (+)
const GL = 5; // the nail-in glides lift everything: 5 + 450 = 455 at the sides, 5 + 900 = 905 at the headboard
const LEDGE = 316; // top of the slat ledges and the middle beam: 139 under the top of the sides
const BAND = GL + 280; // underside of the sides' top band and the foot rail: a finger gap over the drawer fronts
// the side frames' legs at each end, either side of the drawer opening: the opening is 1155 (side length - 750), the
// side drawer's front 12 (1149) 3 mm in from each leg as the foot drawer's 890 is in its 896 rail, and the singles'
// panel 22 (1155) butting both legs in their p. 22 zoom. The parts page (p. 11) draws them 476 and 241, but that drawing
// is reused across sizes and schematic on this measure.
const HEAD_LEG = 493.5, FOOT_LEG = 256.5;
const BOX = 27; // underside of a drawer box: the castors' height
const HB_JOINT = GL + 250; // where the headboard's two panels meet
// an angle bracket's four screws into the headboard, 16 and 17 either side of the joint (p. 12); the ledge's the same
const BRACKET_X = [-15.5, 15.5], BRACKET_Y = [HB_JOINT - 17, HB_JOINT + 16];
// p. 28: A (p. 29) four pins in the middle beam and a slatted base on top, B (p. 30) no pins, a mattress straight on
const LAYOUTS = [
  { id: "A", label: "On a slatted base, pins in the beam" },
  { id: "B", label: "Mattress straight on, no slats", leaves: "the four 10 mm pins (T)" },
];
// the singles' p. 21: A (p. 22) panel 22 on side frame 4, the drawer under 5; B (p. 25) the other way round
const WAYS = [
  { id: "A", label: "Side drawer on the left, seen from the foot" },
  { id: "B", label: "Side drawer on the right, seen from the foot" },
];
const SLAT_H = 50; // the slatted bases (not included, drawn as two halves, p. 29): a frame of two rails, slats on top


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
/** The foot drawer: its front 3 mm in from each end of the foot rail; the outer battens against the sides. */
const footKind = (z: Size): DrawerKind => {
  const back = 2 * z.hw - 556, u = back / 2 - 50;
  return {
    front: ["13", 2 * z.hw - 506],
    sides: ["17", "16"],
    back: ["14", back],
    bottom: ["20", 2 * z.hw - 546, 240],
    depth: 250,
    battens: [
      { label: "9", u: -u, castors: [-195, -36], dowels: OUTER(-1), edge: false }, // castors 35 in from each end
      ...(z.beam ? [{ label: "23", u: 0, castors: [], dowels: [-30, 30], edge: false }] : []), // the singles have two (p. 12)
      { label: "9", u, castors: [-195, -36], dowels: OUTER(1), edge: false },
    ],
  };
};
/** A side drawer: its front 3 mm in from each leg's end (the singles' panel 22 fills the opening, 6 longer). */
const longKind = (z: Size): DrawerKind => {
  const back = z.len - 806, u = back / 2 - 50;
  return {
    front: ["12", z.len - 756],
    sides: ["19", "18"],
    back: ["15", back],
    bottom: ["21", z.longBottom, 630],
    depth: 640,
    battens: [
      { label: "10", u: -u, castors: [-539, -83], dowels: OUTER(-1), edge: true }, // castors 82 in from each end
      { label: "11", u: 0, castors: [-310], dowels: [-30, 30], edge: false },
      { label: "10", u, castors: [-539, -83], dowels: OUTER(1), edge: true },
    ],
  };
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
  const m = k.battens.findIndex((t) => t.u === 0); // the middle batten, when there is one
  const mid = m < 0 ? undefined : battens[m];
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
    // a castor's plate along the batten (its local z, turned when the batten runs across the bed)
    castors: (j: number): FitOpts[] => k.battens[j].castors.map((w) => ({ on: battens[j], at: P3(k.battens[j].u, BOX, w), dir: [0, 1, 0], hole: false, twist: out[0] ? Math.PI / 2 : 0 })),
    // a castor's two screws are 32 apart along the batten (p. 10), their heads on its 2 mm plate
    castorScrews: (j: number): FitOpts[] => k.battens[j].castors.flatMap((w) => [-16, 16].map((dw): FitOpts => ({ on: battens[j], at: P3(k.battens[j].u, BOX - 2, w + dw), dir: [0, 1, 0] }))),
    sideBolts: [0, 1].flatMap((i) => [52, 148].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 18), BOX + y, wb), dir: D3(-sg(i), 0, 0), mate: back }))),
    backBolt: (mid ? [{ on: back, at: P3(0, BOX + 9, -k.depth), dir: D3(0, 0, 1), mate: mid }] : []) as FitOpts[],
    camBolts: [
      ...[0, 1].flatMap((i) => [53, 152].map((y): FitOpts => ({ on: front, at: P3(sg(i) * (ib + 9), BOX + y, 0), dir: D3(0, 0, 1), mate: sides[i], mateHole: 4 }))),
      ...(mid ? [{ on: front, at: P3(0, BOX + 9, 0), dir: D3(0, 0, 1), mate: mid, mateHole: 4 }] : []),
    ] as FitOpts[],
    cams: [
      // the sides' cam locks go in from their outside faces, the middle batten's from underneath (step 6), 34 behind
      // its front end (p. 10, the face with the castor screws); the sides' at the same distance, for the same cam bolts
      ...[0, 1].flatMap((i) => [53, 152].map((y): FitOpts => ({ on: sides[i], at: P3(sg(i) * (ib + 18), BOX + y, -35), dir: D3(-sg(i), 0, 0) }))),
      ...(mid ? [{ on: mid, at: P3(0, BOX, -35), dir: [0, 1, 0] }] : []),
    ] as FitOpts[],
  };
  return { c, out, across, depth: bl, front, sides, back, bottom, battens, mid, fits, parts: [front, ...sides, back, bottom, ...battens] };
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
  const z = s.bed && SIZES[`${s.bed.mattressW}x${s.bed.mattressL}`];
  if (s.archetype !== "bed" || !z || !/\bbed frame\b/i.test(s.name + " " + s.variant) || !/drawer/i.test(s.variant)) return false;
  const types = new Map<string, string>();
  const ZH = -z.len / 2, ZT = z.len / 2; // inner faces of the headboard and the foot board: the side frames between
  const SX = z.hw - 9, SI = z.hw - 18; // centre and inner face of a side frame's outer board (50 deep with its ledge)
  const DZ = (ZH + HEAD_LEG + ZT - FOOT_LEG) / 2; // the side drawers' centre along the bed
  const BEAM_L = z.len - 30;
  const BEAM_Z = (ZH + ZT - 18) / 2; // the middle beam, between the headboard and the foot ledge (8)
  const RL = z.hw - 250; // half the foot rail, between the corner pieces
  const FOOT = footKind(z), LONG = longKind(z);
  const mW = (s.bed!.mattressW ?? 0) * 10, mL = (s.bed!.mattressL ?? 0) * 10; // matched in SIZES: both set
  // the singles' way round: their side drawer's side (A: under 5, on the left seen from the foot)
  const way = z.beam ? 1 : b.pick(WAYS) === "A" ? -1 : 1;

  /* ---------- the drawers' panels, then the frame's ---------- */

  const foot = placeDrawer(b, FOOT, types, [0, 0, ZT], [0, 0, 1], [1, 0, 0]);
  const longs = (z.beam ? [1, -1] : [way]).map((g) =>
    // across turned so a viewer facing the front has u < 0 on the left, as on the foot drawer: 19 left, 18 right (p. 18)
    placeDrawer(b, LONG, types, [g * SI, 0, DZ], [g, 0, 0], [0, 0, -g]),
  );
  const hb = [
    b.place(b.part("Headboard, top", [2 * z.hw, 650, 18], { label: "1" }), [0, HB_JOINT + 325, ZH - 9]),
    b.place(b.part("Headboard, bottom", [2 * z.hw, 250, 18], { label: "2" }), [0, GL + 125, ZH - 9]),
  ];
  const hbAt = (y: number) => (y > HB_JOINT ? hb[0] : hb[1]);
  // a side frame: its outer board (a top band over two legs) and the slat ledge along its inside
  const sideFrame = (label: string, g: number) => {
    const { type, mid } = b.compound("Side frame", [
      { shape: "box", size: [18, 170, z.len], pos: [g * SX, BAND + 85, 0] },
      { shape: "box", size: [18, 280, HEAD_LEG], pos: [g * SX, GL + 140, ZH + HEAD_LEG / 2] },
      { shape: "box", size: [18, 280, FOOT_LEG], pos: [g * SX, GL + 140, ZT - FOOT_LEG / 2] },
      { shape: "box", size: [32, 70, z.len], pos: [g * (SI - 16), LEDGE - 35, 0] },
    ], { label });
    return b.place(type, mid);
  };
  // p. 9: 5 and 6 on the left seen from the foot, 4 and 7 on the right
  const sides = [sideFrame("5", -1), sideFrame("4", 1)];
  const corners = [
    b.place(b.part("Foot corner, left", [250, 450, 18], { label: "6" }), [-(z.hw - 125), GL + 225, ZT + 9]),
    b.place(b.part("Foot corner, right", [250, 450, 18], { label: "7" }), [z.hw - 125, GL + 225, ZT + 9]),
  ];
  const rail = b.place(b.part("Foot rail", [2 * RL, 170, 18], { label: "3" }), [0, BAND + 85, ZT + 9]);
  const ledge = b.place(b.part("Foot ledge", [2 * (z.hw - 63), 85, 18], { label: "8" }), [0, LEDGE - 42.5, ZT - 9]);
  const beam = z.beam ? b.place(b.part("Middle beam", [60, 30, BEAM_L], { label: "22", material: "wood" }), [0, LEDGE - 15, BEAM_Z]) : "";
  // the singles' panel 22 in the drawer opening of the side without the drawer, where a front would be (p. 22)
  const pg = -way, ps = pg < 0 ? 0 : 1; // its side frame (sides[ps])
  const panel = z.beam ? "" : b.place(b.part("Side panel", [18, 253, z.len - 750], { label: "22" }), [pg * SX, BOX - 15 + 126.5, DZ]);
  // not in the box, drawn so the finished bed looks as it's used: placed here so the parts' keys match in either layout
  const slatted = !z.beam || b.pick(LAYOUTS) === "A";
  const mattress = b.place(b.part("Your mattress", [mW, 180, mL], { material: "soft", extra: true }), [0, LEDGE + (slatted ? SLAT_H : 0) + 90, 0]);
  // p. 29: two slatted bases side by side on the ledges and the beam, the pins standing between them (its zoom), each
  // from 8 off the middle (clear of the 10 mm pins) to 8 in from the sides' inner faces; a single's one across
  const bw = z.beam ? SI - 16 : 2 * SI - 16, bx = z.beam ? SI / 2 : 0;
  const base = slatted
    ? b.compound("Your slatted base", [
        ...[bx - bw / 2 + 20, bx + bw / 2 - 20].map((x) => ({ shape: "box" as const, size: [40, 40, mL] as Vec3, pos: [x, LEDGE + 20, 0] as Vec3 })),
        ...Array.from({ length: 15 }, (_, k) => ({ shape: "box" as const, size: [bw, 10, 60] as Vec3, pos: [bx, LEDGE + SLAT_H - 5, -(mL / 2 - 30) + (k * (mL - 60)) / 14] as Vec3 })),
      ], { material: "wood", extra: true })
    : null;
  const bases = base ? (z.beam ? [-1, 1].map((g) => b.place(base.type, [g * base.mid[0], base.mid[1], base.mid[2]])) : [b.place(base.type, base.mid)]) : [];

  /* ---------- the foot drawer ---------- */

  // parts shown in their own scene, one after another
  const show = (keys: string[], centre: Vec3, from: Vec3) => {
    b.stagger(0.15);
    b.stageAround(keys, centre, from);
    b.then(0.15);
  };
  // a drawer side laid flat, outer face up (its cam lock and long screw holes), beside its pair (pp. 13, 16)
  const laySides = (d: Drawer) => {
    b.stagger(0.15);
    for (const i of [0, 1]) b.stage(d.sides[i], add([0, 9, 0], mul(d.across, sg(i) * 120)), [(-sg(i) * d.across[2] * Math.PI) / 2, 0, (sg(i) * d.across[0] * Math.PI) / 2], [0, 120, 0]);
    b.then(0.15);
  };
  const nCam = foot.fits.camBolts.length;
  // the back lies flat, inner face up (p. 13); the other parts are made in their own scenes until step 4 joins them
  b.step({ title: "Tap four dowels into the foot drawer's back (14)", detail: "Two in each end.", tools: ["hammer"], scene: "drawer", pose: "+z", kind: "dowels", warnings: ["floor"] }, () => {
    show([foot.back], foot.c, [0, 120, 0]);
    b.fits(A, foot.fits.backDowels, 0.08);
  });
  b.step({ title: "Tap two dowels into each of its sides (16 and 17)", detail: "In the end that goes against the front.", tools: ["hammer"], scene: "drawer-sides", kind: "dowels" }, () => {
    laySides(foot);
    b.fits(A, foot.fits.sideDowels, 0.08);
  });
  b.step(
    foot.mid
      ? { title: "Fit the castors to the two battens (9) and dowel all three", detail: "Two castors on each 9, two short 16 mm screws each; four dowels in each batten's ends, the middle one (23) too.", tools: ["hammer", "screwdriver"], scene: "drawer-battens", pose: "-y", kind: "screws" }
      : { title: "Fit the castors to the two battens (9) and dowel them", detail: "Two castors on each, two short 16 mm screws each; four dowels in each batten's ends.", tools: ["hammer", "screwdriver"], scene: "drawer-battens", pose: "-y", kind: "screws" },
    () => {
      show(foot.battens, foot.c, [0, 120, 0]);
      for (const j of FOOT.battens.flatMap((t, j) => (t.castors.length ? [j] : []))) {
        b.fits(N, foot.fits.castors(j), 0.15);
        b.fits(Q, foot.fits.castorScrews(j), 0.05);
      }
      b.then(0.1);
      for (const j of foot.battens.keys()) b.fits(A, foot.fits.battenDowels(j), 0.05);
    },
  );
  b.step(
    // p. 14: the back stands, seen from its inside; the sides pushed onto its ends, the battens onto its lower face
    { title: "Bolt the sides and the battens to the back", detail: `The battens' dowels go into the holes along the bottom of the back's inside face, the sides onto its ends: four long allen screws through the sides${foot.mid ? ", one through the back into the middle batten" : ""}. Stop when they're flush.`, tools: ["allen"], scene: "drawer", kind: "bolts" }, // p. 14: from the front, 16's outer face in view
    () => {
      b.stagger(0.15);
      for (const i of [0, 1]) b.stageAround([foot.sides[i]], foot.c, mul(foot.across, sg(i) * 250));
      b.stageAround(foot.battens, foot.c, mul(foot.out, 250));
      b.then(0.15);
      b.fits(M, foot.fits.sideBolts, 0.12);
      if (foot.mid) {
        b.then(0.1);
        b.fits(M, foot.fits.backBolt, 0.12);
      }
    },
  );
  b.step({ title: `Screw ${words(nCam)} cam bolts into the foot drawer's front (13)`, detail: "Lay it face down on something soft.", tools: ["screwdriver"], scene: "drawer-front", pose: "-z", kind: "cams", warnings: ["face"] }, () => {
    show([foot.front], foot.c, [0, 0, 160]);
    b.fits(D, foot.fits.camBolts, 0.1);
  });
  b.step(
    // p. 15: the box stands on its back, underside to you; the front goes on from above
    { title: "Slide the bottom in, put the front on and lock it", detail: `Stand the box on its back. The bottom (20) slides down the grooves; then the front onto the dowels and cam bolts, and ${words(nCam)} cam locks: two in each side${foot.mid ? ", one in the middle batten from underneath" : ""}.`, tools: ["flathead"], scene: "drawer", pose: "+z", kind: "cams" },
    () => {
      show([foot.bottom], foot.c, mul(foot.out, 300));
      show([foot.front], foot.c, mul(foot.out, 300));
      b.fits(C, foot.fits.cams, 0.12);
    },
  );

  /* ---------- the side drawers: one shown, the other the same ---------- */

  const d0 = longs[0];
  const two = longs.length > 1;
  // a drawer under the left side (the singles' A) is the right one turned round: every view turned with it
  // (a pose lays the drawer's front or back face up, then the turn brings the view round with it)
  const flip = d0.out[0] > 0 ? 0 : Math.PI;
  const px = flip ? "-x" : "+x", nx = flip ? "+x" : "-x";
  const each = two ? "each side drawer's" : "the side drawer's";
  const lstep = (d: StepDef, body: () => void) => b.step({ scene: "long", ...(two ? { repeat: 2 } : {}), ...d, ...(flip ? { turn: (d.turn ?? 0) + flip } : {}) }, body);
  lstep({ title: `Tap four dowels into ${each} back (15)`, detail: "Two in each end.", tools: ["hammer"], pose: px, kind: "dowels" }, () => {
    show([d0.back], d0.c, [0, 120, 0]);
    b.fits(A, d0.fits.backDowels, 0.08);
  });
  lstep({ title: "Tap two dowels into each of its sides (18 and 19)", detail: "In the end that goes against the front.", tools: ["hammer"], scene: "long-sides", kind: "dowels" }, () => {
    laySides(d0);
    b.fits(A, d0.fits.sideDowels, 0.08);
  });
  lstep({ title: "Fit a castor and four dowels to the middle batten (11)", detail: "One castor in the middle, on two 16 mm screws, and two dowels in each end.", tools: ["hammer", "screwdriver"], scene: "long-mid", pose: "-y", kind: "screws" }, () => {
    show([d0.battens[1]], d0.c, [0, 120, 0]);
    b.fits(N, d0.fits.castors(1), 0.15);
    b.fits(Q, d0.fits.castorScrews(1), 0.05);
    b.then(0.1);
    b.fits(A, d0.fits.battenDowels(1), 0.05);
  });
  lstep({ title: "Fit two castors and six dowels to each outer batten (10)", detail: "Two castors near the ends, two dowels in each end and two in the long edge that goes against the side.", tools: ["hammer", "screwdriver"], scene: "long-outer", pose: "-y", kind: "screws" }, () => {
    show([d0.battens[0], d0.battens[2]], d0.c, [0, 120, 0]);
    for (const j of [0, 2]) {
      b.fits(N, d0.fits.castors(j), 0.15);
      b.fits(Q, d0.fits.castorScrews(j), 0.05);
      b.then(0.1);
      b.fits(A, d0.fits.battenDowels(j), 0.05);
    }
  });
  // p. 18: the battens pushed onto the back first, the sides after
  lstep({ title: "Bolt the battens to the back", detail: "Push the battens' dowels into the bottom of the back's inside face, then one long allen screw through the back into the middle batten.", tools: ["allen"], turn: Math.PI, kind: "bolts" }, () => {
    show(d0.battens, d0.c, mul(d0.out, 250));
    b.fits(M, d0.fits.backBolt, 0.12);
  });
  lstep({ title: "Bolt the sides on", detail: "Push them onto the back's and the battens' dowels, then two long allen screws through each side into the back, until they're flush.", tools: ["allen"], kind: "bolts" }, () => {
    b.stagger(0.15);
    for (const i of [0, 1]) b.stageAround([d0.sides[i]], d0.c, mul(d0.across, sg(i) * 250));
    b.then(0.15);
    b.fits(M, d0.fits.sideBolts, 0.12);
  });
  lstep({ title: `Screw five cam bolts into ${each} front (12)`, detail: "Lay it face down on something soft.", tools: ["screwdriver"], scene: "long-front", pose: nx, kind: "cams" }, () => {
    show([d0.front], d0.c, mul(d0.out, 160));
    b.fits(D, d0.fits.camBolts, 0.1);
  });
  // p. 19: on its back, underside to you, the front on from above
  lstep({ title: "Slide the bottom in, put the front on and lock it", detail: "Stand the box on its back. The bottom (21) slides down the grooves; then the front, and five cam locks: two in each side, one in the middle batten from underneath.", tools: ["flathead"], pose: px, turn: 1.55, kind: "cams" }, () => {
    show([d0.bottom], d0.c, mul(d0.out, 300));
    show([d0.front], d0.c, mul(d0.out, 300));
    b.fits(C, d0.fits.cams, 0.12);
  });

  /* ---------- the foot board ---------- */

  const fc: Vec3 = [0, 0, ZT];
  // the foot board's cam bolts into the side frames: the corner pieces' holes and the sides' cam housings (pp. 11-12)
  const sideY = [GL + 45, GL + 205, GL + 429];
  // p. 20: the rail and each corner piece lie flat, inside face up, each on its own until step 18
  b.step({ title: "Tap four dowels into the foot rail (3)", detail: "Two in each end.", tools: ["hammer"], scene: "foot", pose: "-z", kind: "dowels" }, () => {
    show([rail], fc, [0, 120, 0]);
    b.fits(A, [0, 1].flatMap((i) => [BAND + 20, BAND + 150].map((y): FitOpts => ({ on: rail, at: [sg(i) * RL, y, ZT + 9], dir: [-sg(i), 0, 0], mate: corners[i] }))), 0.08);
  });
  for (const [i, label] of [[0, "6"], [1, "7"]] as const) {
    const k = corners[i], g = sg(i);
    b.step(
      { title: `Fit three cam bolts and two glides to the corner piece (${label})`, detail: "The long 52 mm cam bolts in its inside face; the glides tapped into its bottom edge.", tools: ["screwdriver", "hammer"], scene: `foot-${label}`, pose: "-z", kind: "cams" },
      () => {
        show([k], fc, [0, 120, 0]);
        b.fits(H, sideY.map((y): FitOpts => ({ on: k, at: [g * SX, y, ZT], dir: [0, 0, 1], mate: sides[i], mateHole: 4 })), 0.1);
        b.then(0.1);
        b.fits(R, [-80, 80].map((dx): FitOpts => ({ on: k, at: [g * (z.hw - 125) + dx, GL, ZT + 9], dir: [0, 1, 0], hole: false })), 0.12);
      },
    );
  }
  // p. 12: the rail's and corner pieces' cam locks, 53 and 117 under the top, 33 and 34 either side of the joint
  const eY = [BAND + 53, BAND + 117];
  b.step(
    { title: "Join the corner pieces to the foot rail", detail: "Two double cam bolts in each end of the rail, push the corner pieces onto its dowels, then turn the eight cam locks.", tools: ["flathead"], scene: "foot", pose: "-z", turn: Math.PI, kind: "cams" }, // p. 21: 7 left, the corners towards you
    () => {
      // pushed into the rail's end: its short end to the rail's cam (33 in), the long one out to the corner's (34 in)
      b.fits(E, [0, 1].flatMap((i) => eY.map((y): FitOpts => ({ on: rail, at: [sg(i) * (RL - 24), y, ZT + 9], dir: [-sg(i), 0, 0], hole: false, sunk: true }))), 0.1);
      b.then(0.1);
      b.stagger(0.15);
      for (const i of [0, 1]) b.stageAround([corners[i]], fc, [sg(i) * 300, 0, 0]);
      b.then(0.15);
      b.fits(C, [0, 1].flatMap((i) => eY.flatMap((y): FitOpts[] => [{ on: rail, at: [sg(i) * (RL - 33), y, ZT], dir: [0, 0, 1] }, { on: corners[i], at: [sg(i) * (RL + 34), y, ZT], dir: [0, 0, 1] }])), 0.08);
    },
  );
  const lDowels = sym(z.ledgeDowels), lScrews = sym(z.ledgeScrews);
  b.step(
    {
      title: "Screw the slat ledge (8) behind the foot board",
      detail: `${words(lDowels.length)[0].toUpperCase() + words(lDowels.length).slice(1)} dowels in the face that goes against the rail. Its top 31 mm overlaps the bottom of the rail's inside face, the dowels in the rail's holes; ${words(lScrews.length)} 32 mm screws${z.beam ? ", then the angle bracket in the middle, on four short screws" : ""}.`,
      tools: ["hammer", "screwdriver"],
      scene: "foot",
      pose: "-z",
      turn: Math.PI, // p. 22: seen from the corners' side, as step 18
      kind: "screws",
    },
    () => {
      // p. 22: the dowels go into the ledge while it lies apart, dowel face up, then it turns over onto the rail
      const f = sub(b.partItem(ledge).final.pos, fc);
      b.stage(ledge, add(f, [0, 0, -220]), [Math.PI, 0, 0]);
      // p. 12: every hole is 15 under the ledge's top, by the rail's dowel holes 16 over its bottom (p. 10); the outer
      // two screws go into the corner pieces
      b.fits(A, lDowels.map((x): FitOpts => ({ on: ledge, at: [x, LEDGE - 15, ZT], dir: [0, 0, -1], mate: rail })), 0.08);
      b.then(0.15);
      b.stageAround([ledge], fc);
      b.then(0.1);
      b.fits(P, lScrews.map((x): FitOpts => ({ on: ledge, at: [x, LEDGE - 15, ZT - 18], dir: [0, 0, 1] })), 0.08);
      if (z.beam) {
        b.then(0.1);
        b.fit(S, { on: ledge, at: [0, LEDGE - 56.5, ZT - 18], dir: [0, 0, 1], twist: Math.PI, hole: false });
        b.fits(U, BRACKET_X.flatMap((x) => BRACKET_Y.map((y): FitOpts => ({ on: ledge, at: [x, y, ZT - 20], dir: [0, 0, 1] }))), 0.06);
      }
    },
  );

  /* ---------- the headboard and the side frames ---------- */

  const hc: Vec3 = [0, 0, ZH];
  // p. 12: the cam locks 34 either side of the joint; the 50 mm dowels by the double cam bolts (step 20: the parts pages
  // don't draw edge holes)
  const jx = sym(z.joint), jd = sym(z.jointDowels);
  const hbGlides = [-(z.hw - 198), 0, z.hw - 198];
  b.step(
    {
      title: "Join the two headboard panels (1 and 2)",
      detail: `${words(jd.length)[0].toUpperCase() + words(jd.length).slice(1)} long 50 mm dowels and ${words(jx.length)} double cam bolts along the joint, then the ${words(2 * jx.length)} cam locks on the inside face${z.beam ? "" : ", and three glides in the bottom edge"}.`,
      tools: ["hammer", "flathead"],
      scene: "head",
      pose: "+z",
      kind: "cams",
      people: 2,
    }, // p. 22: flat, inside face up
    () => {
      // p. 22: B and E into panel 2's edge, then panel 1 pushed onto them along the joint
      show([hb[1]], hc, [0, 120, 0]);
      b.fits(B, jd.map((x): FitOpts => ({ on: hb[1], at: [x, HB_JOINT, ZH - 9], dir: [0, -1, 0], mate: hb[0] })), 0.08);
      b.then(0.1);
      // pushed into panel 2's edge: its short end to 2's cam (34 under the joint), the long one out to 1's (34 over)
      b.fits(E, jx.map((x): FitOpts => ({ on: hb[1], at: [x, HB_JOINT - 24, ZH - 9], dir: [0, -1, 0], hole: false, sunk: true })), 0.08);
      b.then(0.1);
      show([hb[0]], hc, [0, 250, 0]);
      b.fits(C, jx.flatMap((x): FitOpts[] => [{ on: hb[0], at: [x, HB_JOINT + 34, ZH], dir: [0, 0, -1] }, { on: hb[1], at: [x, HB_JOINT - 34, ZH], dir: [0, 0, -1] }]), 0.06);
      if (!z.beam) {
        // the singles' step 20: the glides in the same step, no bracket
        b.then(0.1);
        b.fits(R, hbGlides.map((x): FitOpts => ({ on: hb[1], at: [x, GL, ZH - 9], dir: [0, 1, 0], hole: false })), 0.1);
      }
    },
  );
  if (z.beam)
    b.step(
      { title: "Screw the angle bracket on and tap in three glides", detail: "The bracket in the middle of the inside face, on four short screws, for the middle beam; the glides in the bottom edge.", tools: ["screwdriver", "hammer"], scene: "head", pose: "+z", kind: "screws" },
      () => {
        b.fit(S, { on: hb[0], at: [0, LEDGE - 56.5, ZH], dir: [0, 0, -1], hole: false });
        b.fits(U, BRACKET_X.flatMap((x) => BRACKET_Y.map((y): FitOpts => ({ on: hbAt(y), at: [x, y, ZH + 2], dir: [0, 0, -1] }))), 0.06);
        b.then(0.1);
        b.fits(R, hbGlides.map((x): FitOpts => ({ on: hb[1], at: [x, GL, ZH - 9], dir: [0, 1, 0], hole: false })), 0.1);
      },
    );
  else {
    // p. 21: the side drawer and panel 22 shown where this way round puts them
    b.layouts(WAYS);
    b.step(
      { title: "Choose which side the drawer goes", detail: "The manual builds the bed either way round: pick one. A: the side drawer on the left seen from the foot end, panel 22 closing the right. B: the other way round, the drawer on the right.", kind: "general" },
      () => {
        // the whole bed faded for where it goes, in one slot (the pieces made so far come in whole later)
        b.stagger(0);
        b.ghost([...hb, ...sides, panel, ...corners, rail, ledge, ...foot.parts, ...d0.parts]);
      },
    );
  }
  // p. 12: the headboard's dowel holes by its bolt holes, the corner pieces' by their cam bolts; the side frames' ends
  // match (four dowels at the head, two at the foot)
  const headDowelY = [GL + 77, GL + 173, GL + 302, GL + 397], footDowelY = [GL + 109, GL + 365];
  // the singles' panel 22 fixed across each joint with two plates on its inside face, 59 and 219 under its top and
  // four screws each, 14 from the joint and 16 either side (p. 9; the step 21 zoom)
  const pTop = BOX - 15 + 253, pIn = pg * SI;
  const joints = [ZH + HEAD_LEG, ZT - FOOT_LEG];
  const plates = joints.flatMap((jz) => [pTop - 59, pTop - 219].map((y): FitOpts => ({ on: panel, at: [pIn, y, jz], dir: [pg, 0, 0], hole: false, twist: Math.PI / 2 })));
  const plateScrews = joints.flatMap((jz, e) => [pTop - 59, pTop - 219].flatMap((y) => [-14, 14].flatMap((dz) => [-16, 16].map((dy): FitOpts => {
    const inPanel = (e === 0) === dz > 0; // the head joint's panel is towards the foot, the foot joint's towards the head
    return { on: inPanel ? panel : sides[ps], at: [pIn - pg * 2, y + dy, jz + dz], dir: [pg, 0, 0] };
  }))));
  const sideOrder = z.beam || ps === 1 ? ([[1, "4"], [0, "5"]] as const) : ([[0, "5"], [1, "4"]] as const);
  for (const [i, label] of sideOrder) {
    const g = sg(i);
    const withPanel = !z.beam && i === ps;
    b.step(
      withPanel
        ? { title: `Fit the panel (22) to the side frame (${label}), then its dowels and glides`, detail: "Lay the side frame flat with panel 22 in its drawer opening: two joining plates across each joint, four 16 mm screws each. Then four dowels in the head end, two in the foot end, and two glides under each leg.", tools: ["screwdriver", "hammer"], scene: `side-${label}`, pose: g < 0 ? "+x" : "-x", turn: g > 0 ? Math.PI : 0, kind: "screws" }
        : { title: `Tap dowels and glides into the side frame (${label})`, detail: "Four dowels in the head end, two in the foot end; two glides under each leg.", tools: ["hammer"], scene: `side-${label}`, pose: g < 0 ? "+x" : "-x", turn: g > 0 ? Math.PI : 0, kind: "dowels" }, // p. 23: flat, the ledge up, legs towards you
      () => {
        show(withPanel ? [sides[i], panel] : [sides[i]], [g * 400, 0, 0], [0, 120, 0]);
        if (withPanel) {
          b.fits(S2, plates, 0.1);
          b.fits(Q, plateScrews, 0.04);
          b.then(0.1);
        }
        b.fits(A, [
          ...headDowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZH], dir: [0, 0, 1], mate: hbAt(y) })),
          ...footDowelY.map((y): FitOpts => ({ on: sides[i], at: [g * SX, y, ZT], dir: [0, 0, -1], mate: corners[i] })),
        ], 0.08);
        b.then(0.1);
        b.fits(R, [ZH + 60, ZH + HEAD_LEG - 60, ZT - FOOT_LEG + 60, ZT - 60].map((zz): FitOpts => ({ on: sides[i], at: [g * SX, GL, zz], dir: [0, 1, 0], hole: false })), 0.1);
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
      // p. 24: the headboard stands still, each side frame pushed along its length onto its dowels
      for (const k of hb) b.add(k);
      for (const i of [0, 1]) {
        b.add(sides[i], [0, 0, 300]);
        if (!z.beam && i === ps) b.add(panel, [0, 0, 300]); // on its side frame, one piece
      }
      b.then(0.15);
      b.fits(G, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 14), y, ZH + 46], dir: [sg(i), 0, 0], hole: false, sunk: true, spin: 0, twist: Math.PI / 2 }))), 0.06); // in its hole, level with the face, slot along the bolt (p. 24)
      b.then(0.1);
      b.fits(F, [0, 1].flatMap((i) => boltY.map((y): FitOpts => ({ on: hbAt(y), at: [sg(i) * SX, y, ZH - 18], dir: [0, 0, 1], mate: sides[i] }))), 0.1);
    },
  );
  b.step(
    {
      title: "Hook the foot board onto the side frames",
      detail: "A cam housing in each hole near the sides' foot ends, its side hole turned to the foot end, towards the cam bolt. Then push the foot board onto the sides' dowels so its cam bolts go into the housings, and tighten a grub screw into each housing with the allen key to lock it.",
      tools: ["allen"],
      people: 2,
      kind: "cams",
    },
    () => {
      // p. 11: the cam housings' holes are 33 from the sides' foot ends
      b.fits(J, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * SI, y, ZT - 33], dir: [sg(i), 0, 0], spin: 0 }))), 0.1);
      b.then(0.1);
      b.stagger(0.1);
      for (const k of [rail, ...corners, ledge]) b.add(k, [0, 0, 300]);
      b.then(0.15);
      b.fits(K, [0, 1].flatMap((i) => sideY.map((y): FitOpts => ({ on: sides[i], at: [sg(i) * (SI + 5.3), y, ZT - 33], dir: [sg(i), 0, 0], hole: false, sunk: true }))), 0.06); // down in the cam housing, its hex socket just over the housing's top
    },
  );

  /* ---------- the middle beam ---------- */

  // p. 11: the beam's two leg holes are 304 either side of its middle, the brackets' screw holes 39 in from its ends (the
  // 1975 beam is the same drawing: the same distances)
  const legZ = [BEAM_Z - 304, BEAM_Z + 304];
  if (z.beam) {
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
        b.fits(W, legZ.map((zz): FitOpts => ({ on: beam, at: [0, LEDGE - 30, zz], dir: [0, 1, 0], hole: false })), 0.15);
        b.then(0.05);
        // through its 2 mm plate, outside the socket
        b.fits(Q, legZ.flatMap((zz) => [-1, 1].flatMap((dx) => [-1, 1].map((dz): FitOpts => ({ on: beam, at: [dx * 17, LEDGE - 32, zz + dz * 17], dir: [0, 1, 0] })))), 0.04);
        b.then(0.1);
        b.fits(V, legZ.map((zz): FitOpts => ({ on: beam, at: [0, LEDGE - 78, zz], dir: [0, 1, 0], hole: false, spin: 0 })), 0.15); // pushed straight in (p. 25)
      },
    );
    b.step(
      { title: "Lay the beam on the two angle brackets and screw it on", detail: "Two screws up through each bracket.", tools: ["screwdriver"], kind: "screws" },
      () => {
        b.add(beam, [0, 300, 0]);
        b.then(0.15);
        b.fits(U, [BEAM_Z - BEAM_L / 2 + 39, BEAM_Z + BEAM_L / 2 - 39].flatMap((zz) => BRACKET_X.map((x): FitOpts => ({ on: beam, at: [x, LEDGE - 30, zz], dir: [0, 1, 0] }))), 0.08);
      },
    );
    // ponytail: the engine can't move a fitting placed in an earlier step, so the legs (V, step 26) stand at full length
    // already and nothing turns here; the manual's leg zoom with its turn arrow needs that (a later "adjust" of a fitting)
    b.step(
      { title: "Turn the legs down to the floor", detail: "Until each leg is 1-2 mm off the floor: the beam shouldn't lift.", kind: "general" },
      () => {},
    );
  }

  /* ---------- the drawers in ---------- */

  b.step(
    two
      ? { title: "Slide in the three drawers", detail: "The two big ones under the sides, the small one under the foot. They run on their own castors.", kind: "drawer" }
      : { title: "Slide in the two drawers", detail: "The big one under the open side, the small one under the foot. They run on their own castors.", kind: "drawer" },
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

  const load = "Each drawer holds 5 kg at most.";
  if (!z.beam) {
    // the singles' manual stops at the drawers and their load (p. 28): slats and mattress are your own
    b.step(
      { title: "Lay the slatted base and the mattress on", detail: `The slatted base and the ${s.bed!.mattressW} x ${s.bed!.mattressL} cm mattress aren't included: follow the slatted base's own instructions. ${load}`, kind: "general", weight: 0.8 }, // not in the box: no assembly time of ours
      () => {
        for (const k of bases) b.add(k, [0, 420, 0]);
        b.then(0.15);
        b.add(mattress, [0, 420, 0]);
      },
    );
    return true;
  }

  /* ---------- p. 28: on slats (A) or a mattress straight on (B) ---------- */

  b.layouts(LAYOUTS);
  // the pick's slatted bases and mattress shown faded where they will go, so a pick shows at once
  b.step(
    { title: "Choose what goes on the frame", detail: "The manual gives two ways: pick one. A: two slatted bases on the frame, held apart by four pins in the middle beam, the mattress on them. B: no slats and no pins, a mattress made to lie without slats straight on the frame.", kind: "general" },
    () => b.ghost([...bases, mattress]),
  );
  // p. 2 top view, at the beam's scale: the pins 182 either side of its middle and 361.5 in from its ends (576 off the
  // middle of the 1875 beam)
  const pins = [-(BEAM_L / 2 - 361.5), -182, 182, BEAM_L / 2 - 361.5].map((dz) => BEAM_Z + dz);
  if (slatted) {
    b.step(
      { title: "Tap the four pins into the middle beam", detail: "They stand up between the two slatted bases and keep them in place.", tools: ["hammer"], kind: "dowels" },
      () => b.fits(T, pins.map((zz): FitOpts => ({ on: beam, at: [0, LEDGE, zz], dir: [0, -1, 0] })), 0.1),
    );
    b.step(
      { title: "Lay the two slatted bases on", detail: "Side by side on the ledges and the beam, the pins between them. The slatted bases aren't included: follow their own instructions.", kind: "general", weight: 0.8 }, // not in the box: no assembly time of ours
      () => {
        b.stagger(0.15);
        for (const k of bases) b.add(k, [0, 420, 0]);
        b.then(0.15);
      },
    );
    b.step({ title: "Lay the mattress on", detail: `The ${s.bed!.mattressW} x ${s.bed!.mattressL} cm mattress isn't included. ${load}`, kind: "general", weight: 0.8 }, () => b.add(mattress, [0, 420, 0]));
  } else {
    // the beam comes drilled for the pins either way (p. 30 draws it with its holes)
    for (const zz of pins) b.hole(beam, [0, LEDGE, zz], [0, 1, 0], 4);
    b.step(
      { title: "Put the four pins aside and lay the mattress straight on", detail: `Without slats the four 10 mm pins (T) aren't needed. The ${s.bed!.mattressW} x ${s.bed!.mattressL} cm mattress isn't included: it lies on the ledges and the beam, so pick one made to go without slats. ${load}`, kind: "general", weight: 0.8 },
      () => b.add(mattress, [0, 420, 0]),
    );
  }
  return true;
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

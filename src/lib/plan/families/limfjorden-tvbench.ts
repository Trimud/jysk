import type { ProductSpec, Vec3 } from "../../types";
import { HW, runner, runnerScrews, SIDE_DOWN, holeR, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import type { Family } from "./family";
import { wallStep } from "./_wall";
import { BRACKET, RUNNER } from "@/engine/sizes";

/*
 * JYSK LIMFJORDEN TV bench, 2 drawers 1 door (3630136/37), read from its 37-page manual. Three compartments across:
 * a drawer, a door with a loose shelf behind it, a drawer. The two dividers (9L, 8R) take their cabinet runners on
 * spacers, the three front rails (5, 10, 5) are joined through them by long dowels and double cam bolts, the bottom (7)
 * goes on with connector screws, the two plinths (4) under it on cam locks, then the sides (1L, 2R) with their runners,
 * the top (3) with two wall brackets, and the hardboard back (14) is nailed on. It is fixed to the wall, the shelf pins
 * go in, the two drawers are built on their fronts and slid in, and the door is hung on two clip-on hinges. The manual
 * also shows the bench without its door (layout A); this guide follows layout B, as the product is sold.
 * Sizes are the manual's parts pages (11 to 13); x across, y up from the floor, z to the front. Every hole below is
 * measured off pages 12 and 13, which draw each panel to scale.
 */

// the manual's fittings, by its letters (page 9; U, the 4 mm allen key, is a tool here)
const A: HwDef = { kind: "dowel", len: 35, dia: 8 };
const B: HwDef = { kind: "dowel", len: 24, dia: 6 };
const C: HwDef = { kind: "dowel", len: 60, dia: 8 };
const D: HwDef = HW.hinge;
const E: HwDef = { kind: "screw", len: 13, dia: 5 };
const F: HwDef = { kind: "screw", len: 20, dia: 5 };
const G: HwDef = { kind: "bolt", len: 50, dia: 7, name: "Connector screw", flush: true };
const H: HwDef = { kind: "cam", len: 10, dia: 12 };
const J: HwDef = { kind: "cam", len: 12, dia: 15 };
const K: HwDef = { kind: "camScrew", len: 34, dia: 6 };
const L: HwDef = { kind: "stud", len: 82, dia: 7, name: "Double cam bolt" };
const M: HwDef = { kind: "nail", len: 25, dia: 1.4 };
const N: HwDef = { kind: "glide", len: 4, dia: 15, name: "Nail-in glide" };
const P: HwDef = { kind: "pin", len: 17, dia: 5 };
const Q: HwDef = { kind: "spacer", len: 11, dia: 20, name: "Runner spacer" };
const R: HwDef = { kind: "clip", len: 19, dia: 33, name: "Back panel clip" };
const S: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const T: HwDef = { kind: "bracket", len: 78, dia: 32, name: "Wall bracket" };
const run = (name: string, roller?: "back") => runner(400, name, roller);
const CL = run("Cabinet runner, left"), CR = run("Cabinet runner, right"), DL = run("Drawer runner, left", "back"), DR = run("Drawer runner, right", "back");

// carcass
const GL = 5; // the glides lift it: 5 + 393 + 22 = 420
const SX = 896.5, XI = 888.5; // side centres and inner faces: the bottom's 1777 between them
const ZF = 214, ZB = -214; // the sides' front and back edges (428 deep)
const YB = GL + 88, YT = GL + 393; // the bottom's underside (on the plinths) and the top's underside
const DX = 300.5; // divider centres: 580 to each side, 585 between them
// the bottom and the dividers, 423 deep, flush with the sides' front edges: their holes line up with the sides' measured
// from the front. That leaves them 5 short of the back, where the sides and the top are rebated (the line drawn 4 mm
// in from their back edges) and the back sits in the rebates against them.
const DZ = ZF - 423 / 2;
const BACK_IN = ZB + 5; // the back panel's inner face
const BZ = BACK_IN - 1.5; // and its centre
const RY = YT - 16, RZ = ZF - 30; // the front rails, 32 tall, 60 deep, flush with the front edge
// a front rail's joints, 24 mm under its top face: a dowel 15 mm in from the front, the cam bolt (or the double cam
// bolt through a divider) 47 mm in, and the cam lock up through "This side down" 34 mm from the rail's end
const JY = YT - 24, JDZ = ZF - 15, JBZ = ZF - 47, CAM = 34;
// the top: dowels 37 mm in from the front and 39 from the back, cam bolts 101 and 71 in, over each side and divider;
// their cam locks 34 mm down the sides and dividers
const topDowelZ = [ZF - 37, ZB + 39], topCamZ = [ZF - 101, ZB + 71];
// the bottom and a side: dowels 30 and 382 mm in from the front, cam bolts 62 and 350, the cam locks 34 in from its ends
const botDowelZ = [ZF - 30, ZF - 382], botCamZ = [ZF - 62, ZF - 350];
const botScrewZ = [ZF - 69, ZF - 356]; // its connector screws into the dividers
// the plinths stand on edge under the bottom, their middles 30 mm in from the front and 381 from it (22 and 39 mm in)
const plinthZ = [ZF - 30, ZF - 381];
const PBY = GL + 64, PDY = GL + 32; // a plinth's cam bolt and dowel into the side, 24 and 56 mm under its top
const plinthKX = [-735.5, -288.5, 288.5, 735.5]; // the bottom's cam bolts into the plinths, and their cam locks
const plinthDX = [-767.5, -255.5, 255.5, 767.5]; // the plinths' dowels into the bottom
const SHY = GL + 260; // the middle shelf's centre
// drawers: a 543 wide box, 12.5 mm runners on the side, 11 mm spacers under the runners on the divider
const CXD = XI - 12.5 - 543 / 2; // ±604.5
// the cabinet runners' screws, 240 mm down the sides and dividers, 37, 165 and 357 mm in from the front, and one at the
// front end 15 mm in and 11 mm higher
const runY = GL + 153;
const runScrewZ = [ZF - 37, ZF - 165, ZF - 357];
const YD = runY + 3; // the drawer boxes' underside, a little over their runners' screws (the fronts' groove, page 12)
const FY = GL + 101 + 145, FZ = ZF + 11; // the fronts (290 high, 22 thick), their tops 2 under the top
const runZ = ZF - 5 - 200;

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!/tv bench/i.test(s.variant) || Math.round(s.size.w) !== 182) return false;
  const part = (name: string, label: string, size: Vec3, o: { material?: "fiber"; mark?: typeof SIDE_DOWN } = {}) => b.part(name, size, { label, ...o });
  const side1 = b.place(part("Left side", "1L", [16, 393, 428]), [-SX, GL + 196.5, 0]);
  const side2 = b.place(part("Right side", "2R", [16, 393, 428]), [SX, GL + 196.5, 0]);
  const top = b.place(part("Top", "3", [1811, 22, 450]), [0, YT + 11, ZB + 225]);
  const plT = part("Plinth", "4", [1777, 88, 16]);
  const plinths = plinthZ.map((z) => b.place(plT, [0, GL + 44, z]));
  const railT = part("Rail", "5", [580, 32, 60], { mark: SIDE_DOWN });
  const rail5L = b.place(railT, [-(XI + DX + 8) / 2, RY, RZ]);
  const rail5R = b.place(railT, [(XI + DX + 8) / 2, RY, RZ]);
  const rail10 = b.place(part("Middle rail", "10", [585, 32, 60], { mark: SIDE_DOWN }), [0, RY, RZ]);
  const shelf = b.place(part("Shelf", "6", [583, 16, 400]), [0, SHY, BACK_IN + 200]);
  const bottom = b.place(part("Bottom", "7", [1777, 16, 423]), [0, YB + 8, DZ]);
  const divT = (name: string, label: string) => part(name, label, [16, 289, 423]);
  const div9 = b.place(divT("Divider", "9L"), [-DX, YB + 16 + 144.5, DZ]);
  const div8 = b.place(divT("Divider", "8R"), [DX, YB + 16 + 144.5, DZ]);
  const door = b.place(part("Door", "11", [600, 290, 22]), [0, FY, FZ]);
  // in the rebates: 11 mm into each side, its top edge 11 mm up into the top's (ponytail: the rebates' depth isn't drawn)
  const back = b.place(part("Back panel", "14", [1799, 320, 3], { material: "fiber" }), [0, YT + 11 - 160, BZ]);
  const frT = part("Drawer front", "12", [600, 290, 22]);
  const dsT = [part("Drawer side", "16", [12, 180, 400]), part("Drawer side", "17", [12, 180, 400])];
  const dbT = part("Drawer back", "15", [519, 180, 12]);
  const btT = part("Drawer bottom", "13", [530, 3, 400], { material: "fiber" });
  const drawers = [-1, 1].map((g) => {
    const cx = g * CXD;
    return b.drawer(
      {
        cx,
        front: b.place(frT, [g * 601.5, FY, FZ]),
        sides: [-1, 1].map((k, i) => b.place(dsT[i], [cx + k * (543 / 2 - 6), YD + 90, ZF - 200])),
        back: b.place(dbT, [cx, YD + 90, ZF - 400 + 6]),
        bottom: b.place(btT, [cx, YD + 8.5, ZF - 196]),
      },
      400,
    );
  });

  /* ---------- helpers ---------- */
  const step = b.step.bind(b);
  const fit = (def: HwDef, on: string | undefined, pts: Vec3[], dir: Vec3, o: Partial<FitOpts> = {}) => {
    b.fits(def, pts.map((at) => ({ on, at, dir, ...o })), 0.06);
    b.then(0.1);
  };
  const show = (k: string, from: Vec3 = [0, 0, -150]) => {
    b.stageAround([k], [0, 0, 0], from);
    b.then(0.12);
  };
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  const sideOf = (x: number) => Math.sign(x) || 1;

  /* ---------- the left divider, the rails, the right divider ---------- */
  step({ title: "Tap 4 dowels (A) into the divider (9L)", detail: "Two into its top edge and two into its bottom edge. 8 mm dowels, not the thin 6 mm or long 60 mm ones.", tools: ["hammer"], scene: "s1", kind: "dowels" }, () => {
    show(div9);
    fit(A, div9, topDowelZ.map((z): Vec3 => [-DX, YT, z]), [0, -1, 0], { mate: top });
    fit(A, div9, topDowelZ.map((z): Vec3 => [-DX, YB + 16, z]), [0, 1, 0], { mate: bottom });
  });
  // a cabinet runner's four screws: three in a line and one at the front end, a little higher
  const runScrews = (x: number) => runnerScrews(x, runY, runScrewZ, ZF - 15);
  const midRunner = (div: string, x: number, def: HwDef) => {
    const g = sideOf(x); // the face toward the drawer: 9L's left, 8R's right
    const face = x + g * 8;
    fit(Q, div, runScrews(face), [-g, 0, 0], { hole: holeR(F) }); // the screws' pilot holes, under the spacers
    fit(def, div, [[face + g * Q.len, runY, runZ]], [-g, 0, 0], { hole: false });
    fit(F, div, runScrews(face + g * (Q.len + RUNNER.body)), [-g, 0, 0], { hole: false });
  };
  step({ title: "Screw a cabinet runner (CR) onto the divider (9L), on spacers", detail: "On the face drilled with the small screw holes and two big cam lock holes, roller end at the front. A spacer (Q) under each of the four holes, then the longer 20 mm screws (F), not the 13 mm ones.", tools: ["screwdriver"], scene: "s1", kind: "runners" }, () => midRunner(div9, -DX, CR));
  const railEnd = (rail: string, x: number) => fit(A, rail, [[x, JY, JDZ]], [sideOf(x) * -1, 0, 0], { mate: sideOf(x) < 0 ? side1 : side2 });
  step({ title: "Tap a dowel (A) into one end of a rail (5)", detail: "Into the end that goes against the left side, not into the middle rail (10).", tools: ["hammer"], scene: "s2", kind: "dowels" }, () => {
    show(rail5L);
    railEnd(rail5L, -XI);
  });
  // through a divider: a long 60 mm dowel (C) and a double cam bolt (L), locked by a cam (J) in the rail each side
  const through = (div: string, x: number) => {
    fit(C, div, [[x, JY, JDZ]], [1, 0, 0], { hole: false });
    fit(L, div, [[x, JY, JBZ]], [1, 0, 0], { hole: false });
  };
  const camIn = (rail: string, x: number) => fit(J, rail, [[x, RY - 16, JBZ]], [0, 1, 0]);
  step({ title: "Join the rail (5) to the divider (9L)", detail: "Push the long dowel (C) and the double cam bolt (L) into the divider, \"This side down\" downwards, and push the rail onto them. Turn the big cam lock (J) in the rail clockwise, not the small 12 mm ones.", tools: ["hammer", "flathead"], kind: "cams" }, () => {
    put([div9], [0, 200, 0]);
    put([rail5L], [-250, 0, 0]);
    through(div9, -DX);
    camIn(rail5L, -DX - 8 - CAM);
  });
  step({ title: "Join the middle rail (10) to the other side of the divider", detail: "\"This side down\" downwards, over the dowel and bolt sticking out of the divider. Lock it with a cam (J) from underneath, in the hole near the divider.", tools: ["flathead"], kind: "cams" }, () => {
    put([rail10], [250, 0, 0]);
    camIn(rail10, -DX + 8 + CAM);
  });
  step({ title: "Tap 4 dowels (A) into the divider (8R)", detail: "Two into its top edge and two into its bottom edge.", tools: ["hammer"], scene: "s3", kind: "dowels" }, () => {
    show(div8);
    fit(A, div8, topDowelZ.map((z): Vec3 => [DX, YT, z]), [0, -1, 0], { mate: top });
    fit(A, div8, topDowelZ.map((z): Vec3 => [DX, YB + 16, z]), [0, 1, 0], { mate: bottom });
  });
  step({ title: "Screw a cabinet runner (CL) onto the divider (8R), on spacers", detail: "A spacer (Q) under each of the four holes, 20 mm screws (F), roller end at the front.", tools: ["screwdriver"], scene: "s3", kind: "runners" }, () => midRunner(div8, DX, CL));
  step({ title: "Fit the divider (8R) onto the middle rail", detail: "A long dowel (C) and a double cam bolt (L) through it into the rail, then turn the cam (J) in the middle rail.", tools: ["hammer", "flathead"], kind: "cams" }, () => {
    put([div8], [0, 200, 0]);
    through(div8, DX);
    camIn(rail10, DX - 8 - CAM);
  });
  step({ title: "Tap a dowel (A) into one end of the other rail (5)", detail: "Into the end that goes against the right side.", tools: ["hammer"], scene: "s4", kind: "dowels" }, () => {
    show(rail5R);
    railEnd(rail5R, XI);
  });
  step({ title: "Join the rail (5) to the divider (8R)", detail: "\"This side down\" downwards, over the dowel and bolt. Lock it with a cam (J).", tools: ["flathead"], kind: "cams" }, () => {
    put([rail5R], [250, 0, 0]);
    camIn(rail5R, DX + 8 + CAM);
  });

  /* ---------- the bottom and the plinths ---------- */
  // both plinths' cam lock holes face the back (step 15 shows them all from one side)
  const plinthCam = (i: number, x: number, y: number): FitOpts => ({ on: plinths[i], at: [x, y, plinthZ[i] - 8], dir: [0, 0, 1] });
  step({ title: "Fit dowels (A) and cam bolts (K) to the bottom (7)", detail: "Two dowels into each end, and eight cam bolts screwed straight into the underside for the plinths.", tools: ["hammer", "screwdriver"], scene: "s5", pose: "-y", kind: "dowels" }, () => {
    show(bottom);
    for (const g of [-1, 1]) fit(A, bottom, botDowelZ.map((z): Vec3 => [g * XI, YB + 8, z]), [g, 0, 0], { mate: g < 0 ? side1 : side2 });
    for (const [i, z] of plinthZ.entries()) fit(K, bottom, plinthKX.map((x): Vec3 => [x, YB, z]), [0, 1, 0], { mate: plinths[i] });
  });
  step({ title: "Fit the bottom (7) onto the dividers", detail: "Over the dividers' dowels, then four connector screws (G) through the bottom into the dividers with the allen key (U), two into each.", tools: ["allen"], kind: "bolts" }, () => {
    put([bottom], [0, -200, 0]);
    for (const [x, k] of [[-DX, div9], [DX, div8]] as const) fit(G, bottom, botScrewZ.map((z): Vec3 => [x, YB, z]), [0, 1, 0], { mate: k });
  });
  step({ title: "Tap two glides (N) into each plinth (4)", detail: "Into the bottom edge, about 586 mm in from each end.", tools: ["tape", "hammer"], scene: "s6", kind: "general" }, () => {
    for (const k of plinths) show(k);
    fit(N, undefined, plinthZ.flatMap((z) => [-302.5, 302.5].map((x): Vec3 => [x, GL, z])), [0, 1, 0], { hole: false });
  });
  step({ title: "Tap 12 dowels (A) into the plinths", detail: "On each plinth: one into each end and four into the top edge.", tools: ["hammer"], scene: "s6", kind: "dowels" }, () => {
    for (const [i, k] of plinths.entries()) {
      const z = plinthZ[i];
      for (const g of [-1, 1]) fit(A, k, [[g * XI, PDY, z]], [g, 0, 0], { mate: g < 0 ? side1 : side2 });
      fit(A, k, plinthDX.map((x): Vec3 => [x, YB, z]), [0, -1, 0], { mate: bottom });
    }
  });
  step({ title: "Fit the plinths under the bottom and lock them", detail: "One near the front, one near the back, over the cam bolts, both with their cam lock holes towards the back. Eight cam locks (J), four in each plinth.", tools: ["flathead"], kind: "cams" }, () => {
    put(plinths, [0, -200, 0]);
    b.fits(J, plinths.flatMap((_, i) => plinthKX.map((x) => plinthCam(i, x, YB - CAM))), 0.06);
    b.then(0.1);
  });

  /* ---------- the sides ---------- */
  const sideJoints = (x: number): Vec3[] => [
    [x, JY, JBZ], // the rail
    ...botCamZ.map((z): Vec3 => [x, YB + 8, z]), // the bottom
    ...plinthZ.map((z): Vec3 => [x, PBY, z]), // the plinths
  ];
  const prepSide = (sd: string, x: number) => {
    const g = sideOf(x);
    show(sd);
    fit(A, sd, topDowelZ.map((z): Vec3 => [x, YT, z]), [0, -1, 0], { mate: top });
    fit(K, sd, sideJoints(g * XI), [g, 0, 0]);
    fit(N, sd, [ZB + 20, ZF - 20].map((z): Vec3 => [x, GL, z]), [0, 1, 0], { hole: false });
  };
  const sideRunner = (sd: string, x: number, def: HwDef) => {
    const g = sideOf(x);
    fit(def, sd, [[g * XI, runY, runZ]], [g, 0, 0], { hole: false });
    fit(E, sd, runScrews(g * (XI - RUNNER.body)), [g, 0, 0]);
  };
  // the cam for each side joint, in the part the side's cam bolt goes into, 34 mm in from the side
  const lockSide = (sd: string, x: number) => {
    const g = sideOf(x), cx = g * (XI - CAM);
    put([sd], [g * 250, 0, 0]);
    fit(J, g < 0 ? rail5L : rail5R, [[cx, RY - 16, JBZ]], [0, 1, 0]);
    fit(J, bottom, botCamZ.map((z): Vec3 => [cx, YB, z]), [0, 1, 0]);
    b.fits(J, plinths.map((_, i) => plinthCam(i, cx, PBY)), 0.06);
    b.then(0.1);
  };
  step({ title: "Fit dowels, cam bolts and glides to the left side (1L)", detail: "Two dowels (A) into its top edge, five cam bolts (K) screwed straight in, and two glides (N) into its bottom edge, about 20 mm from the front and back.", tools: ["tape", "hammer", "screwdriver"], scene: "s7", kind: "cams" }, () => prepSide(side1, -SX));
  step({ title: "Screw the cabinet runner (CL) onto the left side", detail: "Four short 13 mm screws (E), roller end at the front.", tools: ["screwdriver"], scene: "s7", kind: "runners" }, () => sideRunner(side1, -SX, CL));
  step({ title: "Fit the left side and lock it", detail: "Onto the rail, the bottom and both plinths. Five cam locks (J).", tools: ["flathead"], kind: "cams" }, () => lockSide(side1, -SX));
  step({ title: "Fit dowels, cam bolts and glides to the right side (2R)", detail: "Two dowels (A), five cam bolts (K) and two glides (N), as on the left side.", tools: ["tape", "hammer", "screwdriver"], scene: "s8", kind: "cams" }, () => prepSide(side2, SX));
  step({ title: "Screw the cabinet runner (CR) onto the right side", detail: "Four 13 mm screws (E), roller end at the front.", tools: ["screwdriver"], scene: "s8", kind: "runners" }, () => sideRunner(side2, SX, CR));
  step({ title: "Fit the right side and lock it", detail: "Five cam locks (J).", tools: ["flathead"], kind: "cams" }, () => lockSide(side2, SX));

  /* ---------- the top and the back ---------- */
  const topK: Vec3[] = [-SX, -DX, DX, SX].flatMap((x) => topCamZ.map((z): Vec3 => [x, YT, z]));
  const brX = [-600, 600];
  step({ title: "Fit 8 cam bolts (K) and the two wall brackets (T) to the top (3)", detail: "Lay it face down. Cam bolts straight in; each bracket on with two screws (S), only 80% tight for now.", tools: ["screwdriver"], scene: "s9", pose: "-y", kind: "cams", warnings: ["floor"] }, () => {
    show(top);
    fit(K, top, topK, [0, 1, 0]);
    fit(T, top, brX.map((x): Vec3 => [x, YT, ZB + BRACKET.bend]), [0, 1, 0], { hole: false }); // its leg through the back, against the wall (p. 28)
    fit(S, top, brX.flatMap((x) => [ZB + 29, ZB + 44].map((z): Vec3 => [x, YT, z])), [0, 1, 0]);
  });
  step({ title: "Lay the top on and lock it", detail: "Stand the bench on its glides. The top goes over the dowels of both sides and both dividers. Eight cam locks (J), two in each.", tools: ["flathead"], kind: "cams", people: 2 }, () => {
    put([top], [0, 250, 0]);
    // in the inner face of each side, and the runner face of each divider
    for (const [face, g, k] of [[-XI, -1, side1], [-DX - 8, 1, div9], [DX + 8, -1, div8], [XI, 1, side2]] as const) fit(J, k, topCamZ.map((z): Vec3 => [face, YT - CAM, z]), [g, 0, 0]);
  });
  step({ title: "Lay the back (14) on", detail: "Cable holes at the top. It drops into the rebates along the back of the sides and the top. Turn the bench onto its front on a rug first if that's easier.", kind: "general" }, () => put([back], [0, 0, -250]));
  const nail = (x: number, y: number): FitOpts => ({ on: back, at: [x, y, BZ - 1.5], dir: [0, 0, 1] });
  step({ title: "Square it up and nail the back on", detail: "Measure both diagonals and push the bench until they match. Then 40 nails (M) round the edges and along the bottom and the dividers, and one through the clip (R) in the middle.", tools: ["tape", "hammer"], kind: "nails", check: "square" }, () => {
    fit(R, back, [[0, YB + 16, BACK_IN]], [0, 0, 1], { hole: false });
    const list: FitOpts[] = [];
    for (const x of [-SX, SX]) for (const y of [YB + 40, YB + 140, YB + 240, YT - 10]) list.push(nail(x, y)); // 8
    for (const x of [-DX, DX]) for (const y of [YB + 60, YB + 160, YB + 260]) list.push(nail(x, y)); // 6
    for (const x of [-800, -650, -500, -350, -200, -60, 60, 200, 350, 500, 650, 800]) list.push(nail(x, YB + 8), nail(x, YT + 8)); // 24
    list.push(nail(-20, YB + 8), nail(20, YB + 8)); // 2
    b.fits(M, list, 0.03);
  });
  wallStep(b, brX, YT, ZB, {
    title: "Fix it to the wall",
    detail: "Push it against the wall, mark through the two brackets, drill and plug the holes, screw the brackets to the wall, then tighten the bracket screws (S) fully. Wall screws and plugs aren't included: pick ones made for your wall.",
    pose: undefined,
  }, ZB + BRACKET.t); // the wall screws' heads on the legs' inside faces (p. 28, IV)
  const pinZ = [BACK_IN + 40, BACK_IN + 360]; // 40 mm in from the shelf's ends
  step({ title: "Push the four shelf pins (P) into the dividers", detail: "In the middle compartment, the same height on all four. Tap them in gently with the hammer.", tools: ["hammer"], kind: "shelves" }, () =>
    b.fits(P, [[div9, -DX + 8, -1], [div8, DX - 8, 1]].flatMap(([k, x, g]) => pinZ.map((z): FitOpts => ({ on: k as string, at: [x as number, SHY - 8 - 3, z], dir: [g as number, 0, 0] }))), 0.08),
  );

  /* ---------- the drawers ---------- */
  const d0 = drawers[0];
  type Drawer = (typeof drawers)[number];
  const fitsOf = (d: Drawer): [HwDef, FitOpts[]][] => {
    const per = (fn: (g: number, sd: string) => FitOpts[]) => [-1, 1].flatMap((g, i) => fn(g, d.sides[i]));
    const sx = (g: number) => d.cx + g * (543 / 2 - 6);
    // page 12: the front's cam bolts 83 and 179 mm down it, its dowels 115 and 211; the back's dowels 26 mm in from the
    // sides' top and bottom edges, its connector screw half way
    const camY = [YD + 56, YD + 152];
    return [
      [K, per((g, sd) => camY.map((y): FitOpts => ({ on: d.front, at: [sx(g), y, ZF], dir: [0, 0, 1], mate: sd, mateHole: 4 })))],
      [A, per((g, sd) => [YD + 24, YD + 120].map((y): FitOpts => ({ on: sd, at: [sx(g), y, ZF], dir: [0, 0, -1], mate: d.front })))],
      [H, per((g, sd) => camY.map((y): FitOpts => ({ on: sd, at: [d.cx + g * (543 / 2 - 12), y, ZF - 25], dir: [g, 0, 0] })))],
      [B, per((g, sd) => [YD + 26, YD + 154].map((y): FitOpts => ({ on: d.back, at: [d.cx + g * (543 / 2 - 12), y, ZF - 394], dir: [-g, 0, 0], mate: sd, hole: 3, mateHole: 3 })))],
      [G, per((g, sd) => [{ on: sd, at: [d.cx + g * (543 / 2), YD + 90, ZF - 394], dir: [-g, 0, 0], mate: d.back }])],
      [DL, [{ on: d.sides[0], at: [sx(-1), YD, runZ], dir: [0, 1, 0], hole: false }]],
      [DR, [{ on: d.sides[1], at: [sx(1), YD, runZ], dir: [0, 1, 0], hole: false }]],
      [S, per((g, sd) => [ZF - 30, ZF - 200, ZF - 370].map((z): FitOpts => ({ on: sd, at: [sx(g), YD - 2, z], dir: [0, 1, 0] })))],
    ];
  };
  const f0 = new Map(fitsOf(d0));
  const c0: Vec3 = [d0.cx, YD + 90, ZF - 200];
  const dstep = (title: string, detail: string, body: () => void, o: Pick<StepDef, "tools" | "kind" | "pose">) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", repeat: 2, kind: o.kind }, body);
  dstep("Screw four cam bolts (K) into each drawer front (12)", "Lay the front face down on a rug.", () => {
    b.stageAround([d0.front], c0, [0, 0, -160]);
    b.then(0.15);
    b.fits(K, f0.get(K)!, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Tap two dowels (A) into the front end of each drawer side", "The sides are a left (16) and a right (17) one.", () => {
    b.stagger(0.25);
    b.stageAround(d0.sides, c0, [0, 0, -300]);
    b.then(0.15);
    b.fits(A, f0.get(A)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Stand the sides on the front and lock them", "Grooves inwards. Turn the small 12 mm cam locks (H), not the big ones.", () => b.fits(H, f0.get(H)!, 0.12), { tools: ["flathead"], kind: "cams" });
  dstep("Slide the bottom (13) into the grooves", "Smooth side up, all the way to the front.", () => {
    b.stageAround([d0.bottom], c0, [0, 0, -300]);
  }, { kind: "general" });
  dstep("Tap four thin dowels (B) into the drawer back (15)", "6 mm dowels, two into each end.", () => {
    b.stageAround([d0.back], c0, [0, 0, -200]);
    b.then(0.15);
    b.fits(B, f0.get(B)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Fit the back and screw it in", "Tip each side out about 5 degrees to get the back's dowels in, then a connector screw (G) through each side into the back with the allen key (U).", () => b.fits(G, f0.get(G)!, 0.12), { tools: ["allen"], kind: "bolts" });
  dstep("Turn it upside down and screw on the drawer runners", "DL on the left, DR on the right, three screws (S) each.", () => {
    b.fits(DL, f0.get(DL)!, 0.2);
    b.fits(DR, f0.get(DR)!, 0.2);
    b.then(0.1);
    b.fits(S, f0.get(S)!, 0.06);
  }, { tools: ["screwdriver"], kind: "runners", pose: "-y" });
  b.step(
    { title: "Slide in both drawers and lay in the shelf (6)", detail: "Tip each drawer so its wheels drop behind the cabinet runners' wheels, then lower it and push it home. The shelf rests on the four pins.", kind: "drawer" },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (i > 0) for (const [def, list] of fitsOf(d)) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
      b.then(0.1);
      b.add(shelf, [0, 0, 400]);
    },
  );

  /* ---------- the door ---------- */
  const hx = -300 + 22, hys = [FY - 78, FY + 78]; // the cups 22 mm in from the edge, 67 from the top and bottom (page 12)
  step({ title: "Screw the two hinges (D) onto the door (11)", detail: "Lay the door face down. Each hinge's cup into its round hole, two 13 mm screws (E) each.", tools: ["screwdriver"], scene: "door", pose: "-z", kind: "hinges", warnings: ["floor"] }, () => {
    show(door, [0, 0, -150]);
    fit(D, door, hys.map((y): Vec3 => [hx, y, ZF]), [0, 0, 1]);
    fit(E, door, hys.flatMap((y) => [-22.5, 22.5].map((dy): Vec3 => [hx + 10, y + dy, ZF - 3])), [0, 0, 1], { hole: false });
  });
  step({ title: "Hang the door", detail: "Clip each hinge onto its plate on the left divider. Use the hinges' screws to line the door up with the drawer fronts: in and out, up and down, side to side.", tools: ["screwdriver"], kind: "doors" }, () => put([door], [0, 0, 300]));
  b.openDoor(door, -1, 80); // at 100 it would swing into the open left drawer beside its hinge
  step({ title: "Mind the load limits", detail: "40 kg on the top and a TV up to 1720 mm wide. 5 kg in each drawer, 5 kg on the shelf and 10 kg on the bottom behind the door.", kind: "general", warnings: ["tip"] });
  return true;
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

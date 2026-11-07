import type { ProductSpec, Vec3 } from "../../types";
import { PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { range, sg, spread } from "../math";
import type { Family } from "./family";
import { wallStep } from "./_wall";

/*
 * LIMFJORDEN 4 drawer chest (JYSK 3670661 and its colours), read from JYSK's 30-page manual (Rev.1, 03.02.2026).
 * The right side (2) lies on the floor with its cam bolts, glides and cabinet runners; the five rails (5a, four along
 * the front and one across the back at the bottom) and the front plinth (4) stand in it on dowels and cam locks, and
 * the left side (1) goes on top. Standing, the top (3) goes on with its cam bolts and wall bracket, and with the chest
 * on its front the folding back (11) is nailed on.
 * It is fixed to the wall before the drawers: each is built on its front (cam bolts, dowelled sides, bottom slid in,
 * dowelled back on two long allen screws, a support bar inside), gets its runners and slides in.
 * Panel numbers are the manual's; sizes in mm are from its parts pages, so the drawing ignores the rounded catalog size.
 * Where the side's holes are comes from the drilling drawn to scale on its parts page (page 11), checked on a real panel.
 */

// fittings, as the manual lists them on page 9
const A: HwDef = { kind: "dowel", len: 35, dia: 8 };
const B: HwDef = { kind: "dowel", len: 24, dia: 6 };
const C: HwDef = { kind: "screw", len: 13, dia: 5 };
const D: HwDef = { kind: "bolt", len: 50, dia: 7, flush: true };
const E: HwDef = { kind: "cam", len: 10, dia: 12 };
const F: HwDef = { kind: "cam", len: 12, dia: 15 };
const G: HwDef = { kind: "camScrew", len: 34, dia: 6 };
const H: HwDef = { kind: "glide", len: 7, dia: 15, name: "Nail-in glide" };
const J: HwDef = { kind: "clip", len: 20, dia: 30, name: "Back panel clip" };
const L: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const M: HwDef = { kind: "nail", len: 25, dia: 1.4 };
const N: HwDef = { kind: "screw", len: 13, dia: 3.5 };
const Q: HwDef = { kind: "bracket", len: 78, dia: 32 };
const CL: HwDef = { kind: "runner", len: 450, dia: 20, name: "Cabinet runner, left" };
const CR: HwDef = { kind: "runner", len: 450, dia: 20, name: "Cabinet runner, right" };
const DL: HwDef = { kind: "runner", len: 450, dia: 20, name: "Drawer runner, left" };
const DR: HwDef = { kind: "runner", len: 450, dia: 20, name: "Drawer runner, right" };
const WS: HwDef = { kind: "clamp", len: 437, dia: 12, name: "Drawer support bar" };

// carcass (x across, y up from the floor, z to the front)
const GL = 7; // the glides lift the sides: 7 + 977 + 22 = 1006
const TY = GL + 977; // underside of the top
const SX = 392, XI = 384; // side centres and inner faces: 768 between, 800 over the sides, the top 802
const ZF = 218, ZB = -240; // front and back edges of the sides (458 deep); fronts 22 in front, flush with the top
// Both chests' sides are drilled alike (the drawings to scale on their parts pages: page 11 of the 4 drawer chest's
// manual, page 12 of the 3 + 3's). The rails (768 or 778 x 60 x 32) lie with their 60 face down ("This side down"):
// 60 deep, 32 tall, so a cabinet runner fits between a rail and the drawer above it
const RFZ = ZF - 31; // the front rails, flush with the front edge: dowel holes 15 mm in, cam bolts 47 mm in
const RBZ = ZB + 35, RBY = GL + 74; // the 4 drawer chest's back rail: cam bolt 19 mm in from the back edge, 66 mm up the side
const PZ = ZF - 30; // the plinth stands on edge 22 mm in from the front edge: its dowel and cam bolt 30 mm in, one above the other
const n = 4;
const fb = (i: number) => 92 + 223 * i; // bottom of drawer front i (205 high, 18 mm finger-grip gap above)
// underside of drawer box i: the front's cam bolt holes sit about 68 mm up it (the manual's parts page), so the box
// starts about 30 mm up the front, and the bottom runners clear the plinth
const yb = (i: number) => fb(i) + 30;
// front rail centres: one under each drawer above (below its runners, above the drawer under it) and one under the top
const railY = [...range(n - 1).map((i) => yb(i + 1) - 44), TY - 16];
const XS = 365; // drawer side centres: 718 back + 2 x 12 sides, 13 mm each side for the runners
const DZB = ZF - 450; // back ends of the drawer sides
const DBZ = DZB + 6; // drawer back centre

const topDowelZ = [60, ZB + 110]; // dowels between the top and what it sits on
const runZ = ZF - 5 - 225; // cabinet runner centres
// a cabinet runner's three screws: 37, 261 and 389 mm in from the front edge, in line 3 mm under its drawer's box
const runScrewZ = [ZF - 37, ZF - 261, ZF - 389];
const runY = (i: number) => yb(i) - 3;
// the cam locks for the top: 34 mm down the side, 101 mm in from the front and 70 mm from the back
const topCamZ = [ZF - 101, ZB + 70], TOP_CAM = 34;

/** A rail (at [y, z]) and a side: the dowel 16 mm in front of the rail's middle, the cam bolt 16 mm behind it and 8 mm
 *  below (24 mm under its top face), and the cam lock coming up from underneath to meet the bolt (xi: the side's inner face). */
const railJoint = (k: string, y: number, z: number, xi: number): Joint => ({
  key: k,
  bolt: [y - 8, z - 16],
  dowel: [y - 8, z + 16],
  cam: (g) => ({ on: k, at: [g * (xi - 25), y - 16, z - 16], dir: [0, 1, 0] }),
});
/** The plinth (on edge, its middle at PZ) and a side: dowel and cam bolt one above the other, the cam lock from behind. */
const plinthJoint = (k: string, xi: number): Joint => ({ key: k, bolt: [GL + 60, PZ], dowel: [GL + 28, PZ], cam: (g) => ({ on: k, at: [g * (xi - 25), GL + 60, PZ - 8], dir: [0, 0, 1] }) });

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "drawers" || !/chest/i.test(s.variant)) return false;
  const rows = s.drawers?.rows, cols = s.drawers?.cols ?? 1;
  if (rows === 3 && cols === 2) return build33(b);
  return (rows ?? n) === n && cols === 1 && build4(b);
}

/** A joint between a side and what stands in it: cam bolt in the side, dowel and cam lock in the other part ([y, z]). */
interface Joint {
  key: string;
  bolt: number[];
  dowel: number[];
  cam: (g: number) => FitOpts;
}
const COUNT = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];

/**
 * What both chests do to their two sides (centres at ±sx, inner faces at ±xi, under a top at ty): cam bolts for the
 * joints, dowels into the top, glides, `rows` cabinet runners, and the two steps that prepare a side lying flat.
 * `screws` is said of the runner screws ("short 13 mm " where the manual has longer ones too).
 */
function sideKit(b: PlanBuilder, k: { sides: string[]; top: string; sx: number; xi: number; ty: number; rows: number; joints: (si: number) => Joint[]; screws: string }) {
  const { sides } = k;
  const bolts = (si: number): FitOpts[] => k.joints(si).map((j) => ({ on: sides[si], at: [sg(si) * k.xi, j.bolt[0], j.bolt[1]], dir: [sg(si), 0, 0], mate: j.key, mateHole: 4 }));
  // the builder sinks a dowel whose far end would come out of the thinner part it goes into
  const dowels = (js: Joint[], sis = [0, 1]): FitOpts[] => js.flatMap((j) => sis.map((si): FitOpts => ({ on: j.key, at: [sg(si) * k.xi, j.dowel[0], j.dowel[1]], dir: [-sg(si), 0, 0], mate: sides[si] })));
  const cams = (si: number, js: Joint[]) => js.map((j) => j.cam(sg(si)));
  const topDowels = (si: number): FitOpts[] => topDowelZ.map((z) => ({ on: sides[si], at: [sg(si) * k.sx, k.ty, z], dir: [0, -1, 0], mate: k.top }));
  const glides = (si: number): FitOpts[] => [ZF - 50, ZB + 50].map((z) => ({ on: sides[si], at: [sg(si) * k.sx, GL, z], dir: [0, 1, 0], hole: false }));
  const runners = (si: number): FitOpts[] => range(k.rows).map((i) => ({ on: sides[si], at: [sg(si) * k.xi, runY(i), runZ], dir: [sg(si), 0, 0], hole: false }));
  const screws = (si: number): FitOpts[] => range(k.rows).flatMap((i) => runScrewZ.map((z): FitOpts => ({ on: sides[si], at: [sg(si) * (k.xi - 2), runY(i), z], dir: [sg(si), 0, 0] })));
  const prepSide = (si: number, label: string, runner: HwDef) => {
    const lr = si ? "right" : "left";
    b.step(
      {
        title: `Fit dowels, cam bolts and glides to the ${lr} side (${label})`,
        // the sides are mirror images: the rail joints run down the front edge, the top's two cam locks sit near the top
        detail: `To pick the ${lr} side, hold a side drilled face towards you with its two big holes at the top: on the ${lr} side the column of paired holes (a pair for each front rail) runs down the ${lr} edge. Lay it drilled face up on something soft. Two 8 mm dowels in the top edge (not the thin 6 mm ones), ${COUNT[bolts(si).length]} cam bolts screwed in straight, and two glides tapped into the bottom edge.`,
        tools: ["hammer", "screwdriver"],
        scene: "prep",
        kind: "cams",
        warnings: ["floor"],
      },
      () => {
        b.stage(sides[si], [0, 8, 0], [0, 0, sg(si) * -Math.PI / 2], [0, 160, 0]);
        b.then(0.15);
        b.fits(A, topDowels(si), 0.1);
        b.then(0.1);
        b.fits(G, bolts(si), 0.06);
        b.then(0.1);
        b.fits(H, glides(si), 0.12);
      },
    );
    b.step(
      {
        title: `Screw the ${COUNT[k.rows]} ${lr} cabinet runners on`,
        detail: `They're marked ${si ? "CR" : "CL"}. Three ${k.screws}screws each, through the holes the arrows point to, roller end at the front.`,
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
      },
      () => {
        b.fits(runner, runners(si), 0.12);
        b.then(0.1);
        b.fits(C, screws(si), 0.04);
      },
    );
  };
  return { dowels, cams, prepSide };
}

/** The 4 drawer chest (manual for 3670661). */
function build4(b: PlanBuilder) {
  const sideT = (name: string, label: string) => b.part(name, [16, 977, 458], { label });
  const sides = [b.place(sideT("Left side", "1"), [-SX, GL + 977 / 2, (ZF + ZB) / 2]), b.place(sideT("Right side", "2"), [SX, GL + 977 / 2, (ZF + ZB) / 2])];
  const top = b.place(b.part("Top", [802, 22, 480], { label: "3" }), [0, TY + 11, 0]);
  const plinth = b.place(b.part("Plinth", [768, 88, 16], { label: "4" }), [0, GL + 44, PZ]);
  const railT = b.part("Rail", [768, 32, 60], { label: "5a" });
  const railAt = [...railY.map((y) => [y, RFZ]), [RBY, RBZ]]; // the four front rails, then the back one
  const rails = railAt.map(([y, z]) => b.place(railT, [0, y, z]));
  // ponytail: the back folds in two along its middle; drawn as one board, in rebates in the sides and top, nailed to the back rail
  const back = b.place(b.part("Back panel", [790, 935, 2.5], { material: "fiber", label: "11" }), [0, TY + 11 - 935 / 2, ZB + 1.25]);

  // a side's joints: cam bolt in the side, dowel in the rail or plinth end, cam lock in the rail or plinth face
  const railJ = rails.map((k, j) => railJoint(k, railAt[j][0], railAt[j][1], XI));
  const plinthJ = [plinthJoint(plinth, XI)];
  const joints = [...railJ, ...plinthJ];
  const { dowels, cams, prepSide } = sideKit(b, { sides, top, sx: SX, xi: XI, ty: TY, rows: n, joints: () => joints, screws: "" });

  /* ---------- the right side, on the floor, and what stands in it ---------- */

  prepSide(1, "2", CR);

  b.step(
    { title: "Tap a dowel into each end of the five rails", detail: "8 mm dowels, one in each end.", tools: ["hammer"], scene: "rails", kind: "dowels" },
    () => {
      b.stagger(0.12);
      rails.forEach((k, i) => b.stage(k, [0, 16, (i - 2) * 120], [0, 0, 0], [0, 120, 0]));
      b.then(0.15);
      b.fits(A, dowels(railJ), 0.05);
    },
  );
  b.step(
    {
      title: "Stand the rails in the right side and lock them",
      detail: "Four go along the front edge, flush with it, and one across the back at the bottom, each with \"This side down\" towards the side's bottom end. Push each rail onto its dowel and cam bolt, then turn the cam lock (the big 15 mm one) clockwise with a flat screwdriver.",
      tools: ["flathead"],
      pose: "-x",
      kind: "cams",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[1], [-260, 0, 0]);
      b.then(0.15);
      b.stagger(0.2);
      for (const k of rails) b.add(k, [-300, 0, 0]);
      b.then(0.15);
      b.fits(F, cams(1, railJ), 0.12);
    },
  );
  b.step(
    { title: "Tap a dowel into each end of the plinth", detail: "8 mm dowels again.", tools: ["hammer"], scene: "rails", kind: "dowels" },
    () => {
      b.stage(plinth, [0, 8, 0], [Math.PI / 2, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(A, dowels(plinthJ), 0.1);
    },
  );
  b.step(
    { title: "Stand the plinth in at the front and lock it", detail: "It goes across the bottom of the front edge, on its long edge and set about 22 mm back from it. One cam lock.", tools: ["flathead"], pose: "-x", kind: "cams" },
    () => {
      b.add(plinth, [-300, 0, 0]);
      b.then(0.15);
      b.fits(F, cams(1, plinthJ), 0.12);
    },
  );

  /* ---------- the left side on top ---------- */

  prepSide(0, "1", CL);
  b.step(
    {
      title: "Lower the left side on and lock the cam locks",
      detail: "Its cam bolts go into the holes in the ends of the rails and the plinth. Press it down evenly, then turn the six cam locks.",
      tools: ["flathead"],
      people: 2,
      pose: "-x",
      kind: "cams",
    },
    () => {
      b.add(sides[0], [-420, 0, 0]);
      b.then(0.2);
      b.fits(F, cams(0, joints), 0.12);
    },
  );

  /* ---------- the top ---------- */

  const topBolts: FitOpts[] = [0, 1].flatMap((si) => topCamZ.map((z): FitOpts => ({ on: top, at: [sg(si) * SX, TY, z], dir: [0, 1, 0], mate: sides[si], mateHole: 4 })));
  const qz = ZB + 16; // the bracket stays under the top; its upright leg drops through the hole in the back
  b.step(
    {
      title: "Fit the cam bolts and the wall bracket under the top",
      detail: "Lay the top upside down. Four cam bolts, and the bracket in the middle of the back edge on two 16 mm screws, turned only about 80% of the way in for now.",
      tools: ["screwdriver"],
      scene: "top",
      kind: "cams",
      warnings: ["face"],
    },
    () => {
      b.stage(top, [0, 11, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(G, topBolts, 0.1);
      b.then(0.1);
      b.fit(Q, { on: top, at: [0, TY, qz], dir: [0, 1, 0], hole: false, wall: true });
      b.then(0.05);
      b.fits(L, [qz + 4, qz + 12].map((z) => ({ on: top, at: [0, TY - 2, z], dir: [0, 1, 0] as Vec3, wall: true })), 0.12);
    },
  );
  b.step(
    {
      title: "Stand it up, put the top on and lock it",
      detail: "Lower the top onto the dowels and cam bolts, then turn the four cam locks just under it.",
      tools: ["flathead"],
      people: 2,
      pose: "+y",
      kind: "cams",
    },
    () => {
      b.add(top, [0, 300, 0]);
      b.then(0.2);
      b.fits(F, [0, 1].flatMap((si) => topCamZ.map((z): FitOpts => ({ on: sides[si], at: [sg(si) * XI, TY - TOP_CAM, z], dir: [sg(si), 0, 0] }))), 0.12);
    },
  );

  /* ---------- the back ---------- */

  const nail = (k: string, x: number, y: number): FitOpts => ({ on: k, at: [x, y, ZB], dir: [0, 0, 1], hole: false });
  b.step(
    {
      title: "Lay it on its front and put the back panel in",
      detail: "Unfold the back and drop it into the rebates, with its hole round the wall bracket.",
      pose: "-z",
      kind: "flip",
      warnings: ["floor"],
    },
    () => b.add(back, [0, 0, -340]),
  );
  b.step(
    {
      title: "Clip the back's middle and nail it all round",
      detail: "Check the diagonals match so the chest is square. Nail the clip over the fold at the bottom, then 29 nails along the sides, the top and the back rail.",
      tools: ["hammer", "tape"],
      pose: "-z",
      kind: "nails",
      check: "square",
    },
    () => {
      const backRail = rails[rails.length - 1];
      b.fit(J, { on: backRail, at: [0, RBY, ZB], dir: [0, 0, 1], hole: false });
      b.then(0.1);
      const list: FitOpts[] = [nail(backRail, 0, RBY)];
      for (const si of [0, 1]) for (const y of spread(120, TY - 60, 8)) list.push(nail(sides[si], sg(si) * SX, y));
      for (const x of spread(-360, 360, 7)) list.push(nail(top, x, TY + 6));
      for (const x of spread(-360, 360, 7).filter((_, i) => i !== 3)) list.push(nail(backRail, x, RBY));
      b.fits(M, list, 0.04);
    },
  );
  wallStep(b, [0], TY, ZB);

  drawerSteps(b, range(n).map((i) => ({ i, cx: 0, fx: 0 })));
  return true;
}

/*
 * The 3+3 drawer chest (3670662 and its colours; its own 39-page manual, Rev.1, 03.02.2026), built standing: the left
 * side (1) takes its cam bolts, glides and runners, its three rails (5) and the front plinth (12) go in, the middle
 * panel (2, with runners on spacers on both faces) stands on the plinth, joined to the rails through it by double cam
 * bolts and long dowels, then the right rails, the flat back rail (14) bolted up into the middle panel, the right side
 * (3), the middle foot (13) under the back rail, and the top with two wall brackets. On its front the two folding
 * backs (11) are nailed on and plated together; it is fixed to the wall, and the six drawers are the 4 drawer chest's.
 * Its manual letters differ from the 4 drawer chest's (its J is our G, its I our F...); the fittings are the same.
 */
const C60: HwDef = { kind: "dowel", len: 60, dia: 8 };
const K: HwDef = { kind: "stud", len: 82, dia: 7, name: "Double cam bolt" };
const F20: HwDef = { kind: "screw", len: 20, dia: 5 };
const SP: HwDef = { kind: "spacer", len: 11, dia: 16, name: "Runner spacer" };
const O: HwDef = { kind: "connector", len: 25, dia: 12, name: "Back joining plate" };
const SX3 = 794, XI3 = 786, TY3 = GL + 754, MX = 8; // sides, top (1606 x 480) and the middle panel's faces
const CX3 = 402.5, FX3 = 400.5; // drawer box and front centres of a column: runners on 11 mm spacers on the middle panel
const BRZ = ZB + 2.5 + 44, BRY = GL + 80; // the flat back rail (14): 88 deep, its top at the middle panel's foot
const BBZ = ZB + 37; // its cam bolts, 37 mm in from the back edge (its dowels 32 mm further in)
const FZ = BRZ + 30; // the middle foot (13), under the back rail

function build33(b: PlanBuilder) {
  const sideT = (name: string, label: string) => b.part(name, [16, 754, 458], { label });
  const sides = [b.place(sideT("Left side", "1"), [-SX3, GL + 377, (ZF + ZB) / 2]), b.place(sideT("Right side", "3"), [SX3, GL + 377, (ZF + ZB) / 2])];
  const mid = b.place(b.part("Middle panel", [16, 666, 454], { label: "2" }), [0, TY3 - 333, ZF - 227]);
  const top = b.place(b.part("Top", [1606, 22, 480], { label: "4" }), [0, TY3 + 11, 0]);
  // rails like the 4 drawer chest's: 60 face down, under each upper drawer's runners and under the top
  const railT = b.part("Rail", [778, 32, 60], { label: "5" });
  const ry = [yb(1) - 44, yb(2) - 44, TY3 - 16];
  const rails = [0, 1].map((si) => ry.map((y) => b.place(railT, [sg(si) * (MX + 389), y, RFZ])));
  const plinth = b.place(b.part("Plinth", [1572, 88, 16], { label: "12" }), [0, GL + 44, PZ]);
  const foot = b.place(b.part("Middle foot", [370, 72, 16], { label: "13" }), [0, GL + 36, FZ]);
  const backRail = b.place(b.part("Back rail", [1572, 16, 88], { label: "14" }), [0, BRY, BRZ]);
  // ponytail: each back folds in two along its middle; drawn as one board, in rebates in the sides and the top
  const backT = b.part("Back panel", [796, 698, 2.5], { material: "fiber", label: "11" });
  const backs = [-1, 1].map((g) => b.place(backT, [g * 399, TY3 + 11 - 349, ZB + 1.25])); // 11 mm up into the top, like the 4 drawer chest's

  // a side's joints: cam bolt in the side, dowel and cam lock in the rail, plinth or back rail
  const joint = (key: string, bolt: number[], dowel: number[], cam: (g: number) => FitOpts): Joint => ({ key, bolt, dowel, cam });
  const railJ = (si: number) => rails[si].map((k, j) => railJoint(k, ry[j], RFZ, XI3));
  const plinthJ = plinthJoint(plinth, XI3);
  const backJ = joint(backRail, [BRY, BBZ], [BRY, BBZ + 32], (g) => ({ on: backRail, at: [g * (XI3 - 25), BRY + 8, BBZ], dir: [0, -1, 0] }));
  const joints = (si: number) => [...railJ(si), plinthJ, backJ];
  // its manual has 20 mm runner screws too, for the middle panel
  const { dowels, cams, prepSide } = sideKit(b, { sides, top, sx: SX3, xi: XI3, ty: TY3, rows: 3, joints, screws: "short 13 mm " });

  // runners: straight onto the sides, on spacers onto the middle panel (its left face takes right runners, and back)
  const midRunners = (g: number): [FitOpts[], FitOpts[], FitOpts[]] => [
    range(3).flatMap((i) => runScrewZ.map((z): FitOpts => ({ on: mid, at: [g * MX, runY(i), z], dir: [-g, 0, 0], hole: false }))),
    range(3).map((i) => ({ on: mid, at: [g * (MX + 11), runY(i), runZ], dir: [-g, 0, 0], hole: false })),
    range(3).flatMap((i) => runScrewZ.map((z): FitOpts => ({ on: mid, at: [g * (MX + 13), runY(i), z], dir: [-g, 0, 0] }))),
  ];
  const lr = (si: number) => (si ? "right" : "left");
  const railDowels = (si: number) =>
    b.step(
      { title: `Tap a dowel into one end of the three ${lr(si)} rails`, detail: "8 mm dowels, in the end that goes against the side.", tools: ["hammer"], scene: "rails", kind: "dowels" },
      () => {
        b.stagger(0.12);
        rails[si].forEach((k, i) => b.stage(k, [0, 16, (i - 1) * 120], [0, 0, 0], [0, 120, 0]));
        b.then(0.15);
        b.fits(A, dowels(railJ(si), [si]), 0.05);
      },
    );

  /* ---------- the left side and its rails ---------- */

  prepSide(0, "1", CL);
  railDowels(0);
  b.step(
    {
      title: "Stand the left side up and fit the left rails",
      detail: "\"This side down\" downwards, flush with the front edge. Push each rail onto its dowel and cam bolt and turn the big 15 mm cam lock clockwise.",
      tools: ["flathead"],
      kind: "cams",
    },
    () => {
      b.add(sides[0], [0, 200, 0]);
      b.then(0.15);
      b.stagger(0.2);
      for (const k of rails[0]) b.add(k, [300, 0, 0]);
      b.then(0.15);
      b.fits(F, cams(0, railJ(0)), 0.12);
    },
  );
  b.step(
    { title: "Tap the dowels and a glide into the plinth", detail: "A dowel in each end, and a glide in the middle of the bottom edge, 786 mm from each end.", tools: ["hammer", "tape"], scene: "rails", kind: "dowels" },
    () => {
      b.stage(plinth, [0, 8, 0], [Math.PI / 2, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(A, dowels([plinthJ]), 0.1);
      b.then(0.1);
      b.fit(H, { on: plinth, at: [0, GL, PZ], dir: [0, 1, 0], hole: false });
    },
  );
  b.step({ title: "Fit the plinth along the bottom front and lock it", detail: "One cam lock at the left side.", tools: ["flathead"], kind: "cams" }, () => {
    b.add(plinth, [0, 0, 300]);
    b.then(0.15);
    b.fits(F, cams(0, [plinthJ]), 0.12);
  });

  /* ---------- the middle panel and the right rails ---------- */

  const midTop: FitOpts[] = topDowelZ.map((z) => ({ on: mid, at: [0, TY3, z], dir: [0, -1, 0], mate: top }));
  b.step(
    { title: "Tap three dowels into the middle panel (2)", detail: "Two in the top edge and one in the bottom edge, at the front.", tools: ["hammer"], scene: "prep", kind: "dowels", warnings: ["floor"] },
    () => {
      b.stage(mid, [0, 8, 0], [0, 0, -Math.PI / 2], [0, 160, 0]);
      b.then(0.15);
      b.fits(A, [...midTop, { on: mid, at: [0, GL + 88, PZ], dir: [0, 1, 0], mate: plinth }], 0.1);
    },
  );
  for (const [g, def, mark] of [[-1, CR, "CR"], [1, CL, "CL"]] as const) {
    const [sp, run, sc] = midRunners(g);
    b.step(
      {
        title: `Screw three cabinet runners onto the middle panel's ${g < 0 ? "left" : "right"} face`,
        detail: `They're marked ${mark}. Each sits on three 11 mm spacers, with the longer 20 mm screws through them.`,
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
      },
      () => {
        if (g > 0) b.stage(mid, [0, 8, 0], [0, 0, Math.PI / 2], [0, 160, 0]);
        b.then(0.1);
        b.fits(SP, sp, 0.04);
        b.then(0.1);
        b.fits(def, run, 0.12);
        b.then(0.1);
        b.fits(F20, sc, 0.04);
      },
    );
  }
  b.step({ title: "Stand the middle panel on the plinth", detail: "Its bottom dowel goes into the plinth, its CR runners face the left rails.", kind: "join", people: 2 }, () =>
    b.add(mid, [0, 300, 0]),
  );
  b.step(
    {
      title: "Join the left rails through the middle panel",
      detail: "At each rail: a long 60 mm dowel and a double cam bolt pushed through the middle panel into the rail, then turn the cam lock in the rail.",
      tools: ["hammer", "flathead"],
      kind: "cams",
    },
    () => {
      // through the middle panel's holes, where a side's dowel and cam bolt would be (railJoint)
      b.fits(C60, ry.map((y) => ({ on: mid, at: [18, y - 8, RFZ + 16], dir: [1, 0, 0] as Vec3, hole: false })), 0.1);
      b.then(0.1);
      b.fits(K, ry.map((y) => ({ on: mid, at: [-31, y - 8, RFZ - 16], dir: [-1, 0, 0] as Vec3, hole: false })), 0.1);
      b.then(0.1);
      b.fits(F, ry.map((y, j) => ({ on: rails[0][j], at: [-MX - 33, y - 16, RFZ - 16], dir: [0, 1, 0] as Vec3 })), 0.12);
    },
  );
  railDowels(1);
  b.step(
    { title: "Fit the right rails onto the middle panel and lock them", detail: "\"This side down\" downwards, flush with the front, over the dowels and cam bolts sticking out of the panel.", tools: ["flathead"], kind: "cams" },
    () => {
      b.stagger(0.2);
      for (const k of rails[1]) b.add(k, [300, 0, 0]);
      b.then(0.15);
      b.fits(F, ry.map((y, j) => ({ on: rails[1][j], at: [MX + 33, y - 16, RFZ - 16], dir: [0, 1, 0] as Vec3 })), 0.12);
    },
  );

  /* ---------- the back rail and the right side ---------- */

  b.step({ title: "Tap a dowel into each end of the back rail (14)", detail: "8 mm dowels.", tools: ["hammer"], scene: "rails", kind: "dowels" }, () => {
    b.stage(backRail, [0, 8, 0], [0, 0, 0], [0, 120, 0]);
    b.then(0.15);
    b.fits(A, dowels([backJ]), 0.1);
  });
  b.step(
    { title: "Fit the back rail along the bottom of the back and lock it", detail: "It lies flat under the middle panel. Hold it up in the middle while you turn the cam lock at the left side.", tools: ["flathead"], kind: "cams" },
    () => {
      b.add(backRail, [0, 0, -300]);
      b.then(0.15);
      b.fits(F, cams(0, [backJ]), 0.12);
    },
  );
  b.step(
    { title: "Screw the back rail up into the middle panel", detail: "One long allen screw, with the allen key, until its head is flush.", tools: ["allen"], kind: "screws" },
    () => b.fit(D, { on: backRail, at: [0, BRY - 8, BRZ - 22], dir: [0, 1, 0], mate: mid }),
  );
  prepSide(1, "3", CR);
  b.step(
    { title: "Fit the right side and lock it", detail: "Its cam bolts go into the rails, the plinth and the back rail. Then turn the five cam locks.", tools: ["flathead"], people: 2, kind: "cams" },
    () => {
      b.add(sides[1], [300, 0, 0]);
      b.then(0.2);
      b.fits(F, cams(1, joints(1)), 0.12);
    },
  );
  b.step(
    { title: "Tap two dowels and two glides into the middle foot (13)", detail: "Dowels in one long edge, glides in the other, 30 mm from each end.", tools: ["hammer", "tape"], scene: "rails", kind: "dowels" },
    () => {
      b.stage(foot, [0, 36, 0], [0, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(A, [-1, 1].map((g) => ({ on: foot, at: [g * 105, GL + 72, FZ], dir: [0, -1, 0] as Vec3, mate: backRail })), 0.1);
      b.then(0.1);
      b.fits(H, [-1, 1].map((g) => ({ on: foot, at: [g * 155, GL, FZ], dir: [0, 1, 0] as Vec3, hole: false })), 0.12);
    },
  );
  b.step(
    { title: "Fit the foot under the back rail", detail: "Push it under the middle of the back rail onto its dowels, then two long allen screws down through the rail into it.", tools: ["allen"], kind: "screws" },
    () => {
      b.add(foot, [0, 0, 300]);
      b.then(0.15);
      b.fits(D, [-1, 1].map((g) => ({ on: backRail, at: [g * 135, BRY + 8, FZ], dir: [0, -1, 0] as Vec3, mate: foot })), 0.15);
    },
  );

  /* ---------- the top ---------- */

  const under = [sides[0], mid, sides[1]];
  const topX = [-SX3, 0, SX3];
  const ux = [-399, 399]; // a wall bracket over the middle of each back
  b.step(
    {
      title: "Fit the cam bolts and the wall brackets under the top",
      detail: "Lay the top upside down. Six cam bolts, and the two brackets at the back edge, each on two 16 mm screws turned only about 80% of the way in.",
      tools: ["screwdriver"],
      scene: "top",
      kind: "cams",
      warnings: ["face"],
    },
    () => {
      b.stage(top, [0, 11, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(G, under.flatMap((k, i) => topCamZ.map((z): FitOpts => ({ on: top, at: [topX[i], TY3, z], dir: [0, 1, 0], mate: k, mateHole: 4 }))), 0.1);
      b.then(0.1);
      b.fits(Q, ux.map((x) => ({ on: top, at: [x, TY3, ZB + 16], dir: [0, 1, 0] as Vec3, hole: false, wall: true })), 0.2);
      b.then(0.05);
      b.fits(L, ux.flatMap((x) => [ZB + 20, ZB + 28].map((z) => ({ on: top, at: [x, TY3 - 2, z], dir: [0, 1, 0] as Vec3, wall: true }))), 0.12);
    },
  );
  b.step(
    { title: "Put the top on and lock it", detail: "Lower it onto the dowels and cam bolts, then turn the six cam locks: two in each side and two in the middle panel.", tools: ["flathead"], people: 2, kind: "cams" },
    () => {
      b.add(top, [0, 300, 0]);
      b.then(0.2);
      b.fits(
        F,
        [
          ...[0, 1].flatMap((si) => topCamZ.map((z): FitOpts => ({ on: sides[si], at: [sg(si) * XI3, TY3 - TOP_CAM, z], dir: [sg(si), 0, 0] }))),
          ...topCamZ.map((z): FitOpts => ({ on: mid, at: [-MX, TY3 - TOP_CAM, z], dir: [1, 0, 0] })),
        ],
        0.12,
      );
    },
  );

  /* ---------- the backs ---------- */

  b.step(
    { title: "Lay it on its front and put the two back panels in", detail: "Unfold them and drop them into the rebates, holes round the wall brackets. They meet over the middle panel, about 3 mm apart.", pose: "-z", kind: "flip", warnings: ["floor"] },
    () => {
      b.stagger(0.3);
      for (const k of backs) b.add(k, [0, 0, -340]);
    },
  );
  const nail = (k: string, x: number, y: number): FitOpts => ({ on: k, at: [x, y, ZB], dir: [0, 0, 1], hole: false });
  b.step(
    {
      title: "Plate the backs together and nail them all round",
      detail: "Check the diagonals match so it's square. Five plates over the join, each on one 16 mm screw, the clip over the right back's fold at the bottom, then 37 nails along the sides, the top and the back rail.",
      tools: ["hammer", "screwdriver", "tape"],
      pose: "-z",
      kind: "nails",
      check: "square",
    },
    () => {
      const py = spread(150, TY3 - 80, 5);
      b.fits(O, py.map((y) => ({ on: mid, at: [0, y, ZB], dir: [0, 0, 1] as Vec3, hole: false })), 0.1);
      b.then(0.05);
      b.fits(L, py.map((y) => ({ on: mid, at: [0, y, ZB - 2], dir: [0, 0, 1] as Vec3 })), 0.1);
      b.then(0.1);
      b.fit(J, { on: backRail, at: [399, BRY, ZB], dir: [0, 0, 1], hole: false });
      b.then(0.1);
      const list: FitOpts[] = [nail(backRail, 399, BRY)];
      for (const si of [0, 1]) for (const y of spread(120, TY3 - 60, 5)) list.push(nail(sides[si], sg(si) * SX3, y));
      for (const g of [-1, 1]) for (const x of spread(40, 760, 7)) list.push(nail(top, g * x, TY3 + 6));
      for (const x of spread(-760, 760, 14).filter((_, i) => i !== 10)) list.push(nail(backRail, x, BRY));
      b.fits(M, list, 0.04);
    },
  );
  wallStep(b, ux, TY3, ZB);
  drawerSteps(b, range(3).flatMap((i) => [-1, 1].map((g) => ({ i, cx: g * CX3, fx: g * FX3 }))));
  return true;
}

/** The drawers (the same in both chests): one built step by step on its front, the others the same, then all slid in; the load limits last. */
function drawerSteps(b: PlanBuilder, slots: { i: number; cx: number; fx: number }[]) {
  const frT = b.part("Drawer front", [799, 205, 22], { label: "9" });
  const dsT = [b.part("Drawer side, left", [12, 160, 450], { label: "6" }), b.part("Drawer side, right", [12, 160, 450], { label: "7" })];
  const dbT = b.part("Drawer back", [718, 160, 12], { label: "8" });
  const dbtT = b.part("Drawer bottom", [729, 2.5, 450], { material: "fiber", label: "10" });
  const drawers = slots.map(({ i, cx, fx }) => ({
    y: yb(i),
    cx,
    front: b.place(frT, [fx, fb(i) + 102.5, ZF + 11]),
    sides: [0, 1].map((k) => b.place(dsT[k], [cx + sg(k) * XS, yb(i) + 80, ZF - 225])),
    bottom: b.place(dbtT, [cx, yb(i) + 10, ZF - 225]),
    back: b.place(dbT, [cx, yb(i) + 80, DBZ]),
  }));
  type Drawer = (typeof drawers)[number];
  const per = (d: Drawer, fn: (g: number, side: string) => FitOpts[]) => [0, 1].flatMap((k) => fn(sg(k), d.sides[k]));
  const fitsOf = (d: Drawer): [HwDef, FitOpts[]][] => [
    [G, per(d, (g, sd) => [d.y + 30, d.y + 130].map((y): FitOpts => ({ on: d.front, at: [d.cx + g * XS, y, ZF], dir: [0, 0, 1], mate: sd, mateHole: 4 })))],
    [A, per(d, (g, sd) => [d.y + 60, d.y + 100].map((y): FitOpts => ({ on: sd, at: [d.cx + g * XS, y, ZF], dir: [0, 0, -1], mate: d.front })))],
    [E, per(d, (g, sd) => [d.y + 30, d.y + 130].map((y): FitOpts => ({ on: sd, at: [d.cx + g * (XS - 6.5), y, ZF - 25], dir: [g, 0, 0] })))],
    [B, per(d, (g, sd) => [d.y + 35, d.y + 125].map((y): FitOpts => ({ on: d.back, at: [d.cx + g * (XS - 6), y, DBZ], dir: [-g, 0, 0], mate: sd, hole: 3, mateHole: 3 })))],
    [D, per(d, (g, sd) => [{ on: sd, at: [d.cx + g * (XS + 6), d.y + 80, DBZ], dir: [-g, 0, 0], mate: d.back }])],
    [WS, [{ on: d.bottom, at: [d.cx, d.y + 11.25, (ZF + DBZ + 6) / 2], dir: [0, -1, 0], twist: Math.PI / 2, hole: false }]],
    [N, [{ on: d.front, at: [d.cx, d.y + 16, ZF], dir: [0, 0, 1] }, { on: d.back, at: [d.cx, d.y + 16, DBZ + 6], dir: [0, 0, -1] }]],
    [DL, [{ on: d.sides[0], at: [d.cx - XS, d.y, ZF - 5 - 225], dir: [0, 1, 0], hole: false }]],
    [DR, [{ on: d.sides[1], at: [d.cx + XS, d.y, ZF - 5 - 225], dir: [0, 1, 0], hole: false }]],
    [L, per(d, (g, sd) => [ZF - 30, ZF - 230, ZF - 420].map((z): FitOpts => ({ on: sd, at: [d.cx + g * XS, d.y - 2, z], dir: [0, 1, 0] })))],
  ];
  const d0 = drawers[0];
  const f0 = new Map(fitsOf(d0).map(([def, list]) => [def, list]));
  const c0: Vec3 = [d0.cx, d0.y + 80, ZF - 225];
  const dstep = (title: string, detail: string, body: () => void, o: Pick<StepDef, "tools" | "kind" | "pose">) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", repeat: drawers.length, kind: o.kind }, body);

  dstep("Screw four cam bolts into each drawer front", "Lay the front face down on something soft.", () => {
    b.stageAround([d0.front], c0, [0, 0, -160]);
    b.then(0.15);
    b.fits(G, f0.get(G)!, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Tap two dowels into the front end of each drawer side", "8 mm dowels. The sides are a left (6) and a right (7) one.", () => {
    b.stagger(0.25);
    b.stageAround(d0.sides, c0, [0, 0, -300]);
    b.then(0.15);
    b.fits(A, f0.get(A)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Stand the sides on the front and lock them", "Grooves inwards. Turn the small 12 mm cam locks, not the big ones.", () => b.fits(E, f0.get(E)!, 0.12), { tools: ["flathead"], kind: "cams" });
  dstep("Slide the bottom in", "Down the grooves until it reaches the front.", () => b.stageAround([d0.bottom], c0, [0, 0, -420]), { kind: "drawer" });
  dstep("Tap two thin dowels into each end of the drawer back", "The 6 mm dowels this time.", () => {
    b.stageAround([d0.back], c0, [0, 0, -260]);
    b.then(0.15);
    b.fits(B, f0.get(B)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Put the back on with two long allen screws", "Spread the sides about 5° to drop the back onto its dowels over the bottom, then screw a long screw through each side with the allen key. Keep it straight and stop when it's flush.", () => b.fits(D, f0.get(D)!, 0.15), { tools: ["allen"], kind: "screws" });
  dstep("Screw the support bar in down the middle", "Stand the drawer up. The bar lies on the bottom from front to back: one short 13 mm screw through each bent end.", () => {
    b.fits(WS, f0.get(WS)!, 0.2);
    b.then(0.1);
    b.fits(N, f0.get(N)!, 0.15);
  }, { tools: ["screwdriver"], kind: "screws" });
  dstep("Turn it upside down and screw on the drawer runners", "DL on the left, DR on the right, three 16 mm screws each.", () => {
    b.fits(DL, f0.get(DL)!, 0.2);
    b.fits(DR, f0.get(DR)!, 0.2);
    b.then(0.1);
    b.fits(L, f0.get(L)!, 0.06);
  }, { tools: ["screwdriver"], kind: "runners", pose: "-y" });

  b.step(
    { title: `Slide in all ${drawers.length} drawers`, detail: "Tip each one so its wheels drop behind the cabinet runners' wheels, then lower it and push it home.", kind: "drawer", warnings: ["tip"] },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (i > 0) for (const [def, list] of fitsOf(d)) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  // on the finished chest each drawer slides about two thirds of its 450 mm box out of the front
  for (const d of drawers) b.openDrawer([d.front, ...d.sides, d.back, d.bottom], 450);
  b.step({ title: "Mind the load limits", detail: "25 kg at most on the top and 5 kg in each drawer. Only open one drawer at a time.", kind: "general", warnings: ["tip"] }, () => {});
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

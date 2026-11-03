import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import { rotate, sub } from "../math";
import type { Family } from "./family";

/*
 * ABBETVED desk 48x120 (JYSK 3600446, 3600473, 3600497), read from JYSK's 23-page manual (Rev 7, 27.11.2025).
 * A low box on two black metal A-frames. The box is built upside down on its top (1): the end panels (3, 4) and the
 * two dividers (5, 6) stand on cam bolts and are locked, the hardboard back (7) slides into the grooves, the drawer
 * goes in upside down and the bottom (2) is screwed on over it all. Still upside down, the two leg frames (13, 14),
 * joined by a rail (15), are bolted on, the wall brackets screwed on, and the two crossed rods (16) bolted between
 * the back legs. Stood up, the cam locks get their caps and it is fixed to the wall. No knobs: a finger cut-out.
 * Panel numbers are the manual's; sizes in mm are from its parts page.
 */

// fittings, as the manual lists them on page 9 (O, the 4 mm allen key, and J, the 7 mm spanner, are tools here)
const A: HwDef = { kind: "camScrew", len: 40, dia: 6 };
const B: HwDef = { kind: "bolt", len: 30, dia: 6, name: "Connector bolt", flush: true };
const C: HwDef = { kind: "bolt", len: 25, dia: 6, name: "Connector bolt", flush: true };
const D: HwDef = { kind: "bolt", len: 20, dia: 6, name: "Connector bolt" };
const E: HwDef = { kind: "screw", len: 25, dia: 4, name: "Machine screw" };
const F: HwDef = { kind: "bolt", len: 12, dia: 6, name: "Barrel nut", flush: true };
const G: HwDef = HW.dowel; // 8 x 30
const H: HwDef = { kind: "screw", len: 40, dia: 5 };
const I: HwDef = { kind: "nut", len: 7, dia: 4, name: "Cap nut" };
const K: HwDef = { kind: "cam", len: 10, dia: 15 };
const L: HwDef = { kind: "screw", len: 25, dia: 4 };
const M: HwDef = { kind: "screw", len: 14, dia: 4 };
const N: HwDef = { kind: "bracket", len: 75, dia: 25 };
const P: HwDef = { kind: "cap", len: 2, dia: 22 };

// the box (x across, y up from the floor, z to the front): the top 480 deep, its front at z = 240
const TILT = (8 * Math.PI) / 180; // the leg frames lean out 8°: 640 mm along the leg is 633 mm high, as the manual draws it
const YB = Math.round((640 * Math.cos(TILT) + 25 * Math.sin(TILT)) * 10) / 10; // underside of the bottom (2): the frames stand on a corner
const Y2 = YB + 15; // top face of the bottom
const YT = Y2 + 100; // underside of the top: 100 mm openings
const ZF = 240;
const XE = 592.5, XD = 275.5; // end panels (inner faces 585) and dividers (536 mm between them, for the drawer)
const g2 = [-1, 1];
const endZ = [190, 0, -190], divZ = [190, -170]; // cam bolts under the top
const DY = Y2 + 1; // the drawer stands on the bottom
const DD = 350; // the drawer sides' length: the front 15 + 350 deep
const LX = 412.5; // leg frame tops: the rail (15) is 800 between them
const RZ = 217.5; // the rail runs under the front edge, the crossed rods between the back legs
const TOP_Y = YB - 12.5 * Math.sin(TILT); // centre of a frame's top edge
/** x of a leg's centre line at height y (it leans out as it goes down) */
const legX = (g: number, y: number) => g * (LX + (TOP_Y - y) * Math.tan(TILT));

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "table" || s.size.w !== 120 || s.size.d !== 48 || (s.table?.drawers ?? 1) !== 1) return false;

  /* ---------- parts ---------- */

  const top = b.place(b.part("Top", [1200, 30, 480], { label: "1" }), [0, YT + 15, 0]);
  const bottom = b.place(b.part("Bottom", [1200, 15, 480], { label: "2" }), [0, YB + 7.5, 0]);
  const ends = g2.map((g, i) => b.place(b.part("End panel", [15, 100, 479], { label: ["3", "4"][i] }), [g * XE, Y2 + 50, ZF - 239.5]));
  const divs = g2.map((g, i) => b.place(b.part("Divider", [15, 100, 463], { label: ["5", "6"][i] }), [g * XD, Y2 + 50, ZF - 231.5]));
  // the back runs in grooves in the top, the bottom and the end panels
  const back = b.place(b.part("Back panel", [1175, 110, 4.3], { material: "fiber", label: "7" }), [0, Y2 + 50, -230]);

  // the drawer: front with its finger cut-out, sides, back, bottom. The front is a board stood up (its outline's z is
  // down the front), the cut-out an arc 100 wide and 25 deep in its top edge (radius 62.5, centred 37.5 above it)
  const t0 = Math.asin(0.6);
  const notch = Array.from({ length: 9 }, (_, i): [number, number] => {
    const t = Math.PI - t0 - (i * (Math.PI - 2 * t0)) / 8;
    return [62.5 * Math.cos(t), -85 + 62.5 * Math.sin(t)];
  });
  const outline: [number, number][] = [[-265, -47.5], ...notch, [265, -47.5], [265, 47.5], [-265, 47.5]];
  const front = b.place(b.compound("Drawer front", [{ shape: "slab", size: [530, 15, 95], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], outline }], { label: "8", tone: 1 }).type, [0, DY + 47.5, ZF - 7.5]);
  const dsides = g2.map((g, i) => b.place(b.part("Drawer side", [15, 80, DD], { label: ["9", "10"][i] }), [g * 256, DY + 40, ZF - 15 - DD / 2]));
  const dback = b.place(b.part("Drawer back", [497, 94, 15], { label: "11" }), [0, DY + 47, ZF - 7.5 - DD]);
  const dbottom = b.place(b.part("Drawer bottom", [507, 4.3, 342], { material: "fiber", label: "12" }), [0, DY + 8, ZF - 181]);
  const drawer = b.drawer({ front, sides: dsides, back: dback, bottom: dbottom }, DD);

  // the legs: two welded frames (13, 14) leaning out, the flat rail (15) and the crossed rods (16), all metal
  // each frame (640 x 460 of 25 mm tube): two legs, a bar across the top and one 160 mm off the floor
  const framePieces: PartPiece[] = [
    ...g2.map((k): PartPiece => ({ shape: "box", size: [25, 640, 25], pos: [0, 0, k * 217.5] })),
    { shape: "box", size: [25, 25, 410], pos: [0, 307.5, 0] },
    { shape: "box", size: [25, 25, 410], pos: [0, -160, 0] },
  ];
  const frames = g2.map((g, i) => {
    const rot: Vec3 = [0, 0, g * TILT];
    return b.place(b.compound("Leg frame", framePieces, { material: "metal", label: ["13", "14"][i] }).type, sub([g * LX, TOP_Y, 0], rotate([0, 320, 0], rot)), rot);
  });
  const rail = b.place(b.part("Rail", [800, 15, 20], { material: "metal", label: "15" }), [0, YB - 7.5, RZ]);
  // the rods' holes: high on one back leg, low on the other (the manual's front view), crossing in the middle
  const hi = YB - 40, lo = YB - 284;
  const ends16 = g2.map((g): [Vec3, Vec3] => [[legX(g, hi), hi, 0], [legX(-g, lo), lo, 0]]);
  const RODZ = [-200, -190]; // against the back legs' front faces, the second over the first where they cross
  const rodT = b.part("Cross brace", [9.8, 932, 9.8], { shape: "cyl", material: "metal", label: "16" });
  const rods = ends16.map(([p, q], i) => {
    const dx = q[0] - p[0], dy = q[1] - p[1];
    // ponytail: the real rods' flattened ends are cranked onto the legs; drawn straight, the second rod's ends stand 5 mm off
    return b.place(rodT, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, RODZ[i]], [0, 0, Math.atan2(-dx, dy)]);
  });
  const [[x0, y0], [x1, y1]] = ends16[0];
  const crossY = y0 + ((y1 - y0) * -x0) / (x1 - x0);

  /* ---------- fittings, where they end up ---------- */

  const camBolts: FitOpts[] = [
    ...g2.flatMap((g, i) => endZ.map((z): FitOpts => ({ on: top, at: [g * XE, YT, z], dir: [0, 1, 0], mate: ends[i], mateHole: 4 }))),
    ...g2.flatMap((g, i) => divZ.map((z): FitOpts => ({ on: top, at: [g * XD, YT, z], dir: [0, 1, 0], mate: divs[i], mateHole: 4 }))),
  ];
  // the carcass cam locks all face the open side compartments: the end panels' inner faces, the dividers' outer ones
  const endCams = g2.flatMap((g, i) => endZ.map((z): FitOpts => ({ on: ends[i], at: [g * 585, YT - 20, z], dir: [g, 0, 0] })));
  const divCams = g2.flatMap((g, i) => divZ.map((z): FitOpts => ({ on: divs[i], at: [g * 283, YT - 20, z], dir: [-g, 0, 0] })));
  const dowels = g2.flatMap((g, i) =>
    [205, -204].flatMap((z): FitOpts[] => [
      { on: ends[i], at: [g * XE, YT, z], dir: [0, -1, 0], mate: top },
      { on: ends[i], at: [g * XE, Y2, z], dir: [0, 1, 0], mate: bottom },
    ]),
  );
  const bottomScrews: FitOpts[] = [
    ...g2.flatMap((g) => [130, 0, -130].map((z): FitOpts => ({ on: bottom, at: [g * XE, YB, z], dir: [0, 1, 0] }))),
    ...g2.flatMap((g) => [150, -150].map((z): FitOpts => ({ on: bottom, at: [g * XD, YB, z], dir: [0, 1, 0] }))),
  ];
  const dz = [DY + 20, DY + 60];
  const drawerBolts = g2.flatMap((g, i) => dz.map((y): FitOpts => ({ on: front, at: [g * 256, y, ZF - 15], dir: [0, 0, 1], mate: dsides[i], mateHole: 4 })));
  const drawerCams = g2.flatMap((g, i) => dz.map((y): FitOpts => ({ on: dsides[i], at: [g * 248.5, y, ZF - 35], dir: [g, 0, 0] })));
  const drawerScrews = g2.flatMap((g, i) => [DY + 25, DY + 65].map((y): FitOpts => ({ on: dsides[i], at: [g * 263.5, y, ZF - 7.5 - DD], dir: [-g, 0, 0], mate: dback })));

  /* ---------- the box, upside down on its top ---------- */

  b.step(
    {
      title: "Screw ten cam bolts into the top (1)",
      detail: "Lay the top upside down on something soft. Screw the bolts in by hand, straight, until the collar sits on the board: not deeper, not proud.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "cams",
      warnings: ["floor"],
    },
    () => {
      b.add(top, [0, -200, 0]);
      b.then(0.15);
      b.fits(A, camBolts, 0.08);
    },
  );
  b.step(
    { title: "Tap four dowels into each end panel (3 and 4)", detail: "8 mm dowels, two in each long edge.", tools: ["hammer"], scene: "prep", kind: "dowels" },
    () => {
      b.stagger(0.25);
      g2.forEach((g, i) => b.stage(ends[i], [g * 130, 7.5, 0], [0, 0, Math.PI / 2], [0, 140, 0]));
      b.then(0.15);
      b.fits(G, dowels, 0.08);
    },
  );
  b.step(
    {
      title: "Stand the end panels on the top and lock them",
      detail: "Push each onto its cam bolts and dowels, groove to the back, then turn its three cam locks clockwise with a flat screwdriver.",
      tools: ["flathead"],
      pose: "-y",
      kind: "cams",
    },
    () => {
      b.stagger(0.3);
      for (const k of ends) b.add(k, [0, -220, 0]);
      b.then(0.15);
      b.fits(K, endCams, 0.1);
    },
  );
  b.step(
    {
      title: "Stand the dividers (5 and 6) on the top and lock them",
      detail: "Holes facing out, towards the end panels, and the clean edge at the front. Two cam locks each.",
      tools: ["flathead"],
      pose: "-y",
      kind: "cams",
    },
    () => {
      b.stagger(0.3);
      for (const k of divs) b.add(k, [0, -220, 0]);
      b.then(0.15);
      b.fits(K, divCams, 0.1);
    },
  );
  b.step({ title: "Slide the back panel (7) into its grooves", detail: "Down the grooves in the end panels until it sits in the groove of the top.", pose: "-y", kind: "join" }, () =>
    b.add(back, [0, -260, 0]),
  );

  /* ---------- the drawer ---------- */

  const c0: Vec3 = [0, DY + 47, ZF - 182];
  b.step(
    {
      title: "Build the drawer: cam bolts in the front (8), then the sides",
      detail: "Four cam bolts in the back of the front. Push the sides (9 and 10) on, grooves inwards, and turn their four cam locks.",
      tools: ["screwdriver", "flathead"],
      scene: "drawer",
      kind: "cams",
    },
    () => {
      b.stageAround([front], c0, [0, 0, 160]);
      b.then(0.15);
      b.fits(A, drawerBolts, 0.1);
      b.then(0.1);
      b.stagger(0.25);
      b.stageAround(dsides, c0, [0, 0, -260]);
      b.then(0.15);
      b.fits(K, drawerCams, 0.12);
    },
  );
  b.step({ title: "Slide the drawer bottom (12) in", detail: "From the back, along the grooves in the sides, into the groove in the front.", scene: "drawer", kind: "drawer" }, () =>
    b.stageAround([dbottom], c0, [0, 0, -400]),
  );
  b.step(
    { title: "Screw the drawer back (11) on", detail: "Its groove over the bottom. Two long screws through each side into its ends.", tools: ["screwdriver"], scene: "drawer", kind: "screws" },
    () => {
      b.stageAround([dback], c0, [0, 0, -220]);
      b.then(0.15);
      b.fits(H, drawerScrews, 0.12);
    },
  );
  b.step(
    {
      title: "Put the drawer in, upside down",
      detail: "Lower it into the middle opening with its back behind the two small stops on the top, so it can't be pulled all the way out.",
      pose: "-y",
      kind: "drawer",
    },
    () => {
      b.stagger(0);
      for (const k of [drawer.front, ...drawer.sides, drawer.back, drawer.bottom]) b.add(k, [0, -260, 0]);
    },
  );
  b.step(
    {
      title: "Screw the bottom (2) on",
      detail: "Groove over the back panel, holes over the panels' edges and the dowels. Ten long screws: three into each end panel, two into each divider.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.add(bottom, [0, -260, 0]);
      b.then(0.2);
      b.fits(H, bottomScrews, 0.08);
    },
  );

  /* ---------- the legs, still upside down ---------- */

  const ry = YB - 7.5;
  const railBolts = g2.map((g, i): FitOpts => ({ on: frames[i], at: [legX(g, ry) + g * 12.7, ry, RZ], dir: [-g, 0, 0], mate: rail, mateHole: 3 }));
  b.step(
    {
      title: "Join the leg frames (13 and 14) with the rail (15)",
      detail: "Lay the frames upside down. One 30 mm bolt through each frame into the end of the rail, with the allen key. Mind the bolts: B is the 30 mm one.",
      tools: ["allen"],
      scene: "legs",
      pose: "-y",
      kind: "legs",
    },
    () => {
      b.stagger(0.25);
      b.stageAround([...frames, rail], [0, YB - 330, 0], [0, -160, 0]);
      b.then(0.15);
      b.fits(B, railBolts, 0.15);
    },
  );
  b.step(
    {
      title: "Bolt the legs to the bottom",
      detail: "Two 25 mm bolts through each frame's top bar into the bottom (2). Turn them about 80% of the way in for now.",
      tools: ["allen"],
      people: 2,
      pose: "-y",
      kind: "legs",
    },
    () => {
      b.stagger(0);
      for (const k of [...frames, rail]) b.add(k, [0, -300, 0]);
      b.then(0.2);
      b.fits(C, g2.flatMap((g, i) => [150, -150].map((z): FitOpts => ({ on: frames[i], at: [legX(g, YB - 12), YB - 12, z], dir: [0, 1, 0], mate: bottom }))), 0.12);
    },
  );
  b.step({ title: "Screw the rail to the bottom", detail: "Two 25 mm screws up through the rail (not the short 14 mm ones).", tools: ["screwdriver"], pose: "-y", kind: "screws" }, () =>
    b.fits(L, [-224, 224].map((x): FitOpts => ({ on: rail, at: [x, YB - 15, RZ], dir: [0, 1, 0] })), 0.15),
  );
  const bx = [-250, 250];
  b.step(
    {
      title: "Screw the two wall brackets (N) on",
      detail: "Under the back edge, upright leg at the back. Two short 14 mm screws each, about 80% of the way in so they can still slide.",
      tools: ["screwdriver"],
      pose: "-y",
      kind: "screws",
    },
    () => {
      b.fits(N, bx.map((x): FitOpts => ({ on: bottom, at: [x, YB, -224], dir: [0, 1, 0], hole: false, wall: true })), 0.2);
      b.then(0.1);
      b.fits(M, bx.flatMap((x) => [-220, -210].map((z): FitOpts => ({ on: bottom, at: [x, YB - 2, z], dir: [0, 1, 0], wall: true }))), 0.1);
    },
  );
  b.step(
    {
      title: "Join the two rods (16) where they cross",
      detail: "The arrows on their flat ends point the same way. One screw through both middles and the cap nut on, held with the spanner, about 80% tight.",
      tools: ["screwdriver", "wrench"],
      scene: "rods",
      pose: "-y",
      kind: "bolts",
    },
    () => {
      b.stagger(0.25);
      b.stageAround(rods, [0, crossY, -195], [0, -120, 0]);
      b.then(0.15);
      b.fit(E, { on: rods[1], at: [0, crossY, -184.9], dir: [0, 0, -1], hole: false });
      b.then(0.1);
      b.fit(I, { on: rods[0], at: [0, crossY, -204.9], dir: [0, 0, 1], hole: false });
    },
  );
  // ponytail: one bolt depth for both rods: on the second rod its head sits in the rod, the shank bridges the 5 mm to the leg
  const rodEnds = ends16.flatMap(([p, q], i) => [p, q].map((e) => ({ rod: rods[i], x: e[0], y: e[1], frame: frames[e[0] < 0 ? 0 : 1] })));
  b.step(
    {
      title: "Bolt the rods between the back legs",
      detail: "At each flat end, a 20 mm bolt through the rod into the leg and a barrel nut into the back of the leg, an allen key on each. About 80% tight.",
      tools: ["allen"],
      pose: "-y",
      kind: "bolts",
    },
    () => {
      b.stagger(0.2);
      for (const k of rods) b.add(k, [0, -200, 0]);
      b.then(0.15);
      b.fits(D, rodEnds.map((e): FitOpts => ({ on: e.rod, at: [e.x, e.y, -195], dir: [0, 0, -1], hole: false })), 0.12);
      b.then(0.1);
      b.fits(F, rodEnds.map((e): FitOpts => ({ on: e.frame, at: [e.x, e.y, -230], dir: [0, 0, 1] })), 0.12);
    },
  );
  b.step({ title: "Tighten every bolt fully", detail: "The legs, the rail and the rods: now turn them all the way, with both allen keys on the rod ends.", tools: ["allen"], pose: "-y", kind: "bolts" }, () => {});

  /* ---------- standing ---------- */

  b.step(
    { title: "Turn it upright and cap the cam locks", detail: "Ten caps over the cam locks inside the side openings. The drawer's own four stay uncapped.", people: 2, pose: "+y", kind: "standup" },
    () => b.fits(P, [...endCams, ...divCams].map((o): FitOpts => ({ ...o, hole: false })), 0.08),
  );
  b.step(
    {
      title: "Fix it to the wall",
      detail: "Push it against the wall, slide the brackets out to touch it, mark, drill and plug, then screw them to the wall and tighten their 14 mm screws fully. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      pose: "+y",
      kind: "anchor",
      wall: true,
      warnings: ["tip", "wall"],
    },
    () => {
      b.fits(HW.plug, bx.map((x): FitOpts => ({ at: [x, YB - 25, -240], dir: [0, 0, -1] })), 0.2);
      b.then(0.1);
      b.fits(HW.wallScrew, bx.map((x): FitOpts => ({ at: [x, YB - 25, -238], dir: [0, 0, -1] })), 0.2);
    },
  );
  b.step({ title: "Mind the load limits", detail: "40 kg at most on the top and 5 kg in the drawer.", kind: "general", warnings: ["tip"] }, () => {});
  return true;
}

const family: Family = { names: ["ABBETVED"], build };
export default family;

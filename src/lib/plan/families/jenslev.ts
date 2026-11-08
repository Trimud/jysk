import type { ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { HW, runner, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import type { Family } from "./family";

/**
 * JYSK JENSLEV sideboard, 2 doors 4 drawers, 118x89x36 (3601026, 70663001), read from its 31-page manual.
 * Two dividers (6, 7) carrying the cabinet runners make three columns: a door on each side (16 left, 17 right, inset
 * between the sides, hinged on them, a shelf on pins behind each) and four drawers in the middle. Every front has a
 * pull handle at its top edge. The carcass is built standing: the dividers and the plinth onto the bottom, the sides,
 * the three hardboard backs slid down their grooves, the top; it is laid on its front to fix the backs and tap in the
 * glides, stood up and fixed to the wall. Then the drawers, the shelves and the doors.
 */

const T = 16;
// the manual's fittings, by its letters
const A: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const B: HwDef = { kind: "cam", len: 12, dia: 15 };
const C: HwDef = { kind: "dowel", len: 30, dia: 8 };
const D: HwDef = { kind: "angle", len: 15, dia: 15, name: "Back panel block" };
const E: HwDef = { kind: "screw", len: 16, dia: 3 };
const F: HwDef = { kind: "screw", len: 22, dia: 4, name: "Handle bolt" };
const G: HwDef = { kind: "bracket", len: 75, dia: 32, name: "Anti-tip bracket" };
const H: HwDef = { kind: "screw", len: 13, dia: 6.3, name: "Euro screw" };
const J: HwDef = { kind: "handle", len: 128, dia: 12 };
const L: HwDef = { kind: "bolt", len: 50, dia: 6.3, name: "Connector screw", flush: true };
const M: HwDef = { kind: "cap", len: 2, dia: 20, name: "Cover cap" };
const N: HwDef = { kind: "glide", len: 4, dia: 15, name: "Nail-in glide" };
const P: HwDef = { kind: "pin", len: 16, dia: 5 };
const Q: HwDef = { kind: "plate", len: 2, dia: 20, name: "Joining plate" };
const R: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const S: HwDef = HW.hinge;
const run = (name: string, roller?: "back") => runner(300, name, roller);
const CR = run("Cabinet runner, right"), CL = run("Cabinet runner, left"), DR = run("Drawer runner, right", "back"), DL = run("Drawer runner, left", "back");

// mm: x left to right, y up, z back to front. Sides at ±581, dividers at ±198, the bottom's top at 76, the top at 867.
const XS = 581, XD = 198, YB = 76, YT = 867;
const FY = [79, 276, 473, 670]; // the drawer fronts' bottom edges, top drawer last
const ZF = 158; // the back face of the doors and drawer fronts (their front is flush with the sides at 174)

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "cabinet" || Math.round(s.size.w) !== 118 || Math.round(s.size.h) !== 89 || Math.round(s.size.d) !== 36) return false;

  /* ---------- parts, the manual's numbers as labels ---------- */
  const part = (name: string, label: string, size: Vec3, o: { material?: "fiber" } = {}) => b.part(name, size, { label, ...o });
  const side1 = b.place(part("Left side", "1", [T, 867, 350]), [-XS, 433.5, -1]);
  const side2 = b.place(part("Right side", "2", [T, 867, 350]), [XS, 433.5, -1]);
  const top = b.place(part("Top", "3", [1178, T, 352]), [0, 875, 0]);
  const bottom = b.place(part("Bottom", "4", [1144, T, 348]), [0, 68, 0]);
  const plinth = b.place(part("Plinth", "5", [1144, 60, T]), [0, 30, 158]);
  const div6 = b.place(part("Divider", "6", [T, 791, 315]), [-XD, 471.5, -9.5]);
  const div7 = b.place(part("Divider", "7", [T, 791, 315]), [XD, 471.5, -9.5]);
  const b8 = part("Back panel", "8", [382, 805, 2.5], { material: "fiber" });
  const backs = [b.place(b8, [-388, 468.5, -168.75]), b.place(part("Back panel", "9", [394, 805, 2.5], { material: "fiber" }), [0, 468.5, -168.75]), b.place(b8, [388, 468.5, -168.75])];
  const shT = part("Shelf", "10", [366, T, 300]);
  const shelves = [-389.5, 389.5].map((x) => b.place(shT, [x, 482, -17]));
  const types = { l: part("Drawer side", "11", [T, 120, 300]), r: part("Drawer side", "12", [T, 120, 300]), back: part("Drawer back", "13", [322, 120, T]), bottom: part("Drawer bottom", "14", [337, 2.5, 300], { material: "fiber" }), front: part("Drawer front", "15", [390, 194, T]) };
  const drawers = FY.map((fy) =>
    b.drawer(
      {
        fy,
        front: b.place(types.front, [0, fy + 97, 166]),
        sides: [b.place(types.l, [-169, fy + 82, 8]), b.place(types.r, [169, fy + 82, 8])],
        back: b.place(types.back, [0, fy + 82, -134]),
        bottom: b.place(types.bottom, [0, fy + 30, 16]), // in grooves 8 mm into the back and the front
      },
      300,
    ),
  );
  const door16 = b.place(part("Door", "16", [370, 785, T]), [-388, 471.5, 166]);
  const door17 = b.place(part("Door", "17", [370, 785, T]), [388, 471.5, 166]);

  /* ---------- helpers ---------- */
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "+y", ...d }, body);
  const fit = (def: HwDef, on: string | undefined, pts: Vec3[], dir: Vec3, o: Partial<FitOpts> = {}) => {
    b.fits(def, pts.map((at) => ({ on, at, dir, ...o })), 0.06);
    b.then(0.1);
  };
  const show = (k: string, from?: Vec3, off: Vec3 = [0, 0, 0]) => {
    b.stageAround([k], [-off[0], -off[1], -off[2]], from);
    b.then(0.12);
  };
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  const runY = (fy: number) => fy + 20; // the runners, at the foot of each drawer

  /* ---------- the carcass, standing ---------- */
  step({ title: "Tap 4 dowels into the bottom", detail: "Two into each end, into the holes in the edge, not the face.", kind: "dowels", tools: ["hammer"], scene: "s1", warnings: ["floor"] }, () => {
    show(bottom, [0, 150, 0]);
    for (const sx of [-1, 1]) fit(C, bottom, [-100, 100].map((z): Vec3 => [sx * 572, YB - 8, z]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
  });
  const prepDivider = (div: string, sx: number, runner: HwDef) => {
    const face = sx * (XD - 8); // the face towards the drawers
    show(div, [0, 150, 0]);
    fit(C, div, [-80, 80].map((z): Vec3 => [sx * XD, YT, z]), [0, -1, 0], { mate: top });
    fit(C, div, [-80, 80].map((z): Vec3 => [sx * XD, YB, z]), [0, 1, 0], { mate: bottom });
    fit(runner, div, FY.map((fy): Vec3 => [face, runY(fy), 8]), [sx, 0, 0], { hole: false });
    fit(H, div, FY.flatMap((fy) => [-110, 120].map((dz): Vec3 => [face - sx * 12, runY(fy), 8 + dz])), [sx, 0, 0], { hole: false });
  };
  step({ title: "Fit the runners and dowels to divider 7", detail: "Four right-hand cabinet runners (CR), two euro screws each, and two dowels into each end.", kind: "runners", tools: ["screwdriver", "hammer"], scene: "s2", pose: "-x" }, () => prepDivider(div7, 1, CR));
  step({ title: "The same for divider 6", detail: "Four left-hand cabinet runners (CL), two euro screws each, and four dowels.", kind: "runners", tools: ["screwdriver", "hammer"], scene: "s3", pose: "+x" }, () => prepDivider(div6, -1, CL));
  step({ title: "Screw the dividers to the bottom", detail: "Runners facing each other. Two connector screws up through the bottom into each, with the Allen key, heads flush.", kind: "bolts", tools: ["allen"] }, () => {
    put([bottom], [0, -200, 0]);
    put([div6, div7], [0, 300, 0]);
    for (const [div, sx] of [[div6, -1], [div7, 1]] as const) fit(L, bottom, [-60, 60].map((z): Vec3 => [sx * XD, 60, z]), [0, 1, 0], { mate: div });
  });
  step({ title: "Tap 6 dowels into the plinth", detail: "Two into each end, two into the top edge.", kind: "dowels", tools: ["hammer"], scene: "s5" }, () => {
    show(plinth, [0, 150, 0]);
    for (const sx of [-1, 1]) fit(C, plinth, [20, 42].map((y): Vec3 => [sx * 572, y, 158]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
    fit(C, plinth, [-300, 300].map((x): Vec3 => [x, 60, 158]), [0, -1, 0], { mate: bottom });
  });
  step({ title: "Fit the plinth under the bottom", detail: "Onto the dowels, along the front edge.", kind: "join" }, () => put([plinth], [0, -150, 150]));
  const prepSide = (side: string, sx: number) => {
    show(side, [0, 150, 0]);
    fit(C, side, [-100, 100].map((z): Vec3 => [sx * XS, YT, z]), [0, -1, 0], { mate: top });
    fit(A, side, [[sx * (XS - 8), YB - 8, 0]], [sx, 0, 0], { mate: bottom });
    fit(A, side, [[sx * (XS - 8), 30, 158]], [sx, 0, 0], { mate: plinth });
  };
  const lockSide = (side: string, sx: number) => {
    put([side], [sx * 300, 0, 0]);
    fit(B, bottom, [[sx * 545, YB, 0]], [0, -1, 0]);
    fit(B, plinth, [[sx * 545, 30, 150]], [0, 0, 1]);
  };
  step({ title: "Prepare the left side", detail: "Two dowels into the top edge and two cam bolts into the inside face, low down.", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s7", pose: "+x" }, () => prepSide(side1, -1));
  step({ title: "Fit the left side and lock it", detail: "Onto the dowels of the bottom and the plinth. Two cam locks, arrow towards the bolt, turned with the flat screwdriver.", kind: "cams", tools: ["flathead"] }, () => lockSide(side1, -1));
  step({ title: "Prepare the right side", detail: "The same: two dowels and two cam bolts.", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s9", pose: "-x" }, () => prepSide(side2, 1));
  step({ title: "Fit the right side and lock it", detail: "Two cam locks.", kind: "cams", tools: ["flathead"] }, () => lockSide(side2, 1));
  step({ title: "Slide the three back panels in", detail: "Down the grooves from the top: the two with a notch (8) at the sides, notch up, the wide one (9) in the middle.", kind: "join" }, () => put(backs, [0, 400, 0]));
  const uprights: [string, number][] = [[side1, -XS], [div6, -XD], [div7, XD], [side2, XS]];
  step({ title: "Prepare the top", detail: "Eight cam bolts into its underside, two over each side and divider. Screw the two anti-tip brackets on at the back, two screws each, to about 80%.", kind: "cams", tools: ["screwdriver"], scene: "s12", pose: "-y" }, () => {
    show(top, [0, -150, 0]);
    b.fits(A, uprights.map(([mate, x]) => [mate, x, Math.abs(x) > 400 ? 40 : 20] as const).flatMap(([mate, x, z]) => [-z, z].map((zz): FitOpts => ({ on: top, at: [x, YT, zz], dir: [0, 1, 0], mate }))), 0.06);
    b.then(0.1);
    fit(G, top, [-400, 400].map((x): Vec3 => [x, YT, -168]), [0, 1, 0], { travel: 60, wall: true });
    fit(R, top, [-400, 400].flatMap((x) => [-11, 11].map((dx): Vec3 => [x + dx, YT - 2.5, -158])), [0, 1, 0], { hole: false, wall: true });
  });
  step({ title: "Fit the top and lock it", detail: "Onto the dowels of both sides and dividers. Eight cam locks: in the sides' inside faces and in the dividers' outer faces.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([top], [0, 300, 0]);
    for (const [k, x] of uprights) {
      const sx = Math.sign(x), z = Math.abs(x) > 400 ? 40 : 20;
      // sides: their inside faces; dividers: their faces towards the door columns
      const face = Math.abs(x) > 400 ? x - sx * 8 : x + sx * 8;
      fit(B, k, [-z, z].map((zz): Vec3 => [face, YT - 22, zz]), [Math.abs(x) > 400 ? sx : -sx, 0, 0]);
    }
  });
  step({ title: "Fix the back panels and tap in the glides", detail: "Lay it on its front on a rug and check the diagonals match. Sixteen blocks round the edges of the backs, ten joining plates and screws over the two seams, and six glides into the bottom edges of the sides and plinth.", kind: "nails", tools: ["tape", "hammer", "screwdriver"], pose: "-z", check: "square" }, () => {
    const z = -172;
    const blocks: Vec3[] = [
      ...[-560, -400, -200, 0, 200, 400, 560].flatMap((x): Vec3[] => [[x, 860, z]]),
      ...[-500, -250, 0, 250, 500].map((x): Vec3 => [x, 80, z]),
      ...[-1, 1].flatMap((sx) => [300, 650].map((y): Vec3 => [sx * 570, y, z])),
    ];
    b.fits(D, blocks.map((at): FitOpts => ({ on: backs[at[0] < -197 ? 0 : at[0] > 197 ? 2 : 1], at, dir: [0, 0, 1], hole: false })), 0.04);
    b.then(0.1);
    const seams = [-197, 197].flatMap((x) => [100, 300, 470, 640, 840].map((y): Vec3 => [x, y, -170])).slice(0, 10);
    fit(Q, backs[1], seams, [0, 0, 1], { hole: false });
    b.fits(E, seams.map((at): FitOpts => ({ on: backs[1], at: [at[0], at[1], -172], dir: [0, 0, 1], mate: at[0] < 0 ? div6 : div7 })), 0.04);
    b.then(0.1);
    fit(N, side1, [-146, 144].map((z2): Vec3 => [-XS, 0, z2]), [0, 1, 0]);
    fit(N, side2, [-146, 144].map((z2): Vec3 => [XS, 0, z2]), [0, 1, 0]);
    fit(N, plinth, [-400, 400].map((x): Vec3 => [x, 0, 158]), [0, 1, 0]);
  });
  step({ title: "Stand it up and fix it to the wall", detail: "Two of you stand it up. Push it against the wall, mark through both brackets, drill, plug and screw them to the wall, then tighten the screws in the top fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer"], people: 2, wall: true, warnings: ["wall", "tip"] }, () => {
    fit(HW.plug, undefined, [-400, 400].map((x): Vec3 => [x, 840, -176]), [0, 0, -1]);
    fit(HW.wallScrew, undefined, [-400, 400].map((x): Vec3 => [x, 840, -174]), [0, 0, -1]);
  });

  /* ---------- the drawers: one is shown, the manual has you make all four the same way ---------- */
  type Group = [HwDef, FitOpts[]];
  const dFits = (d: (typeof drawers)[number]): Record<"frontBolts" | "sideCams" | "caps" | "backScrews" | "handle" | "runners", Group[]> => {
    const y = d.fy + 82;
    const sides: [number, string, number][] = [
      [-169, d.sides[0], -1],
      [169, d.sides[1], 1],
    ];
    const cams = sides.flatMap(([x, side, sx]) => [-40, 40].map((dy): FitOpts => ({ on: side, at: [x + sx * 8, y + dy, 133], dir: [-sx, 0, 0] })));
    const hy = d.fy + 169;
    return {
      frontBolts: [[A, sides.flatMap(([x, side]) => [-40, 40].map((dy): FitOpts => ({ on: d.front, at: [x, y + dy, ZF], dir: [0, 0, 1], mate: side })))]],
      sideCams: [[B, cams]],
      caps: [[M, cams.map((o) => ({ ...o, hole: false as const }))]],
      backScrews: [[L, sides.flatMap(([x, side, sx]) => [-35, 35].map((dy): FitOpts => ({ on: side, at: [x + sx * 8, y + dy, -134], dir: [-sx, 0, 0], mate: d.back })))]],
      handle: [
        [J, [{ on: d.front, at: [0, hy, 174], dir: [0, 0, -1], hole: false }]],
        [F, [-64, 64].map((x): FitOpts => ({ on: d.front, at: [x, hy, ZF], dir: [0, 0, 1] }))],
      ],
      runners: [
        [DL, [{ on: d.sides[0], at: [-169, d.fy + 22, 8], dir: [0, 1, 0], hole: false }]],
        [DR, [{ on: d.sides[1], at: [169, d.fy + 22, 8], dir: [0, 1, 0], hole: false }]],
        [E, sides.flatMap(([x, side]) => [-100, 110].map((dz): FitOpts => ({ on: side, at: [x, d.fy + 20, 8 + dz], dir: [0, 1, 0], hole: false })))],
      ],
    };
  };
  const d0 = drawers[0];
  const g0 = dFits(d0);
  const emit = (k: keyof typeof g0) => {
    for (const [def, list] of g0[k]) {
      b.fits(def, list, 0.06);
      b.then(0.1);
    }
  };
  const dStep = (title: string, detail: string, kind: StepKind, tools: ToolId[], body: () => void) => step({ title, detail, kind, tools, scene: "drawer", repeat: 4 }, body);
  dStep("Screw 4 cam bolts into each drawer front", "Into the back face, two near each end.", "cams", ["screwdriver"], () => {
    show(d0.front, [0, 0, 150]);
    emit("frontBolts");
  });
  dStep("Fit the sides to the front and lock them", "Left side 11, right side 12, then two cam locks in each side's outer face.", "cams", ["flathead"], () => {
    for (const k of d0.sides) show(k, [0, 150, 0]);
    emit("sideCams");
  });
  dStep("Slide the bottom in and cap the cam locks", "Along the grooves from the back. Then press a cover cap over each cam lock.", "drawer", [], () => {
    show(d0.bottom, [0, 0, -400]);
    emit("caps");
  });
  dStep("Screw on the back", "Between the sides, two connector screws through each side with the Allen key.", "bolts", ["allen"], () => {
    show(d0.back, [0, 0, -250]);
    emit("backScrews");
  });
  dStep("Screw the handle on", "Two bolts from inside the front.", "screws", ["screwdriver"], () => emit("handle"));
  dStep("Screw the runners to the drawer", "DL under the left side, DR under the right, two screws each.", "runners", ["screwdriver"], () => emit("runners"));
  step({ title: "Slide in the four drawers", detail: "Set each drawer's runner wheels in the cabinet runners and push it in until it closes.", kind: "drawer" }, () => {
    for (const [i, d] of drawers.entries()) {
      b.stagger(0);
      for (const k of [d.front, ...d.sides, d.back, d.bottom]) b.add(k, [0, 0, 400]);
      if (i > 0) for (const [def, list] of Object.values(dFits(d)).flat()) for (const o of list) b.preset(def, o);
      b.wait(0.22);
    }
  });

  /* ---------- shelves and doors ---------- */
  step({ title: "Push in the shelf pins and cap the cam locks", detail: "Four pins for each shelf, at the height you want. Press the four cover caps over the cam locks high in the sides.", kind: "shelves", tools: ["hammer"] }, () => {
    const pins: [string, number, number][] = [[side1, -(XS - 8), -1], [div6, -(XD + 8), 1], [div7, XD + 8, -1], [side2, XS - 8, 1]];
    b.fits(P, pins.flatMap(([k, x, d]) => [-110, 90].map((z): FitOpts => ({ on: k, at: [x, 471, z], dir: [d, 0, 0], hole: false }))), 0.05);
    b.then(0.1);
    b.fits(M, [[side1, -1], [side2, 1]].flatMap(([k, sx]) => [-40, 40].map((z): FitOpts => ({ on: k as string, at: [(sx as number) * (XS - 8), YT - 22, z], dir: [sx as number, 0, 0], hole: false }))), 0.05);
  });
  step({ title: "Lay the two shelves on", detail: "One shelf (10) on the pins in each door column.", kind: "shelves" }, () => put(shelves, [0, 0, 300]));
  const hinge = (door: string, sgn: number) => {
    const x = sgn * 551; // 22 mm in from its hinged edge
    show(door, [0, 0, -150]);
    const ys = [179, 764];
    fit(S, door, ys.map((y): Vec3 => [x, y, ZF]), [0, 0, 1], { twist: sgn > 0 ? Math.PI : 0 });
    fit(R, door, ys.flatMap((y) => [-24, 24].map((dy): Vec3 => [x + sgn * 4, y + dy, ZF - 3])), [0, 0, 1], { hole: false });
    b.openDoor(door, sgn);
  };
  step({ title: "Screw 2 hinges to the right door (17)", detail: "Lay it face down on a rug. Each hinge cup in its round hole, two screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z", warnings: ["floor"] }, () => hinge(door17, 1));
  step({ title: "The same for the left door (16)", detail: "Two hinges, four screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z" }, () => hinge(door16, -1));
  step({ title: "Hang the doors and screw on their handles", detail: "Left door on the left side, right door on the right: clip each hinge onto its plate. Then a handle at the top of each door, two bolts from inside.", kind: "doors", tools: ["screwdriver"] }, () => {
    put([door16, door17], [0, 0, 300]);
    for (const [door, x] of [[door16, -388], [door17, 388]] as const) {
      fit(J, door, [[x, 834, 174]], [0, 0, -1], { hole: false });
      fit(F, door, [-64, 64].map((dx): Vec3 => [x + dx, 834, ZF]), [0, 0, 1]);
    }
  });
  step({ title: "Line up the doors", detail: "The hinge screws move each door up and down, sideways, and in and out until the gaps are even.", kind: "doors", tools: ["screwdriver"] });
  step({ title: "Keep to the weight limits", detail: "Top 20 kg. Each shelf 5 kg. The bottom of each door column 10 kg. Each drawer 3 kg.", kind: "general" });
  return true;
}

const family: Family = { names: ["JENSLEV"], build };
export default family;

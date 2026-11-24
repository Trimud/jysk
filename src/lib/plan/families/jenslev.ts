import type { ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { HW, runner, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import type { Family } from "./family";

/**
 * JYSK JENSLEV sideboard, 2 doors 4 drawers, 118x89x36 (3601026, 70663001), read from its 31-page manual.
 * Two dividers (6, 7) carrying the cabinet runners make three columns: a door on each side (16 left, 17 right, inset
 * between the sides, hinged on them, a shelf on pins behind each) and four drawers in the middle. Every front has a
 * pull handle at its top edge. The carcass is built lying on its front, seen from its bottom end: the dividers and the
 * plinth onto the bottom, the sides, the three hardboard backs slid along their grooves; stood up for the top, laid on
 * its front again to fix the backs and tap in the glides, stood up and fixed to the wall. Then the drawers (each made
 * lying on its front), the shelves and the doors.
 */

const T = 16;
// the manual's fittings, by its letters
const A: HwDef = { kind: "camScrew", len: 44, dia: 7 };
const B: HwDef = { kind: "cam", len: 12, dia: 15 };
const C: HwDef = { kind: "dowel", len: 30, dia: 8 };
const D: HwDef = { kind: "wedge", len: 15, dia: 11, name: "Back panel block" };
const E: HwDef = { kind: "screw", len: 16, dia: 3 };
const F: HwDef = { kind: "screw", len: 22, dia: 4, name: "Handle bolt" };
const G: HwDef = { kind: "bracket", len: 75, dia: 32, name: "Anti-tip bracket" };
const H: HwDef = { kind: "screw", len: 13, dia: 6.3, name: "Euro screw", form: "euro" };
const J: HwDef = { kind: "handle", len: 128, dia: 12, form: "pull" }; // 128 between its holes, 152 long
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
// p12, p13 to scale: at every joint of the top and the bottom with the sides and dividers, cam bolt holes near the front
// and back edges (58 and 68 mm in) and dowel holes between them (122 and 218 mm from the front). Where the dividers
// stand on the bottom it is the other way round: the dowels in the outer pair, the connector screws in the inner (p12, p14)
const CZ = [115, -108], DZ = [51, -44];
const PIN_SZ = [116, -108], PIN_DZ = [111, -113]; // the shelf pins' holes in the sides and in the dividers
const YC = YT - 34; // the cam locks high in the sides and dividers, 35 mm below the top edge (p13)
const FROM_END = Math.PI - 1.24; // turned round to the carcass's bottom end when it lies on its front, as p15 to p21 draw it

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "cabinet" || Math.round(s.size.w) !== 118 || Math.round(s.size.h) !== 89 || Math.round(s.size.d) !== 36) return false;

  /* ---------- parts, the manual's numbers as labels ---------- */
  const part = (name: string, label: string, size: Vec3, o: { material?: "fiber" } = {}) => b.part(name, size, { label, ...o });
  const side1 = b.place(part("Left side", "1", [T, 867, 350]), [-XS, 433.5, -1]);
  const side2 = b.place(part("Right side", "2", [T, 867, 350]), [XS, 433.5, -1]);
  const top = b.place(part("Top", "3", [1178, T, 352]), [0, 875, 0]);
  const bottom = b.place(part("Bottom", "4", [1144, T, 348]), [0, 68, 0]);
  // p13: the plinth's dowel holes in the sides 26 mm from their front edge, so its face stands 18 mm back
  const ZP = 148;
  const plinth = b.place(part("Plinth", "5", [1144, 60, T]), [0, 30, ZP]);
  const div6 = b.place(part("Divider", "6", [T, 791, 315]), [-XD, 471.5, -9.5]);
  const div7 = b.place(part("Divider", "7", [T, 791, 315]), [XD, 471.5, -9.5]);
  // p13: back 8 has a half-round notch 50 mm across in the middle of its top edge (under the anti-tip brackets)
  const notch = Array.from({ length: 13 }, (_, i): [number, number] => [25 * Math.cos(Math.PI - (i * Math.PI) / 12), -402.5 + 25 * Math.sin((i * Math.PI) / 12)]);
  const b8 = b.compound("Back panel", [{ shape: "slab", size: [382, 2.5, 805], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], outline: [[-191, -402.5], ...notch, [191, -402.5], [191, 402.5], [-191, 402.5]] }], { material: "fiber", label: "8" }).type;
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
  // p12: the runner screw rows 33 mm above each drawer front's bottom edge, the holes 37 and 261 mm from the dividers'
  // front edge (z 148); the runner's front end just behind that edge
  const runY = (fy: number) => fy + 33;
  // the backs' groove, full length along the back edge of the bottom's top face, the sides' inside faces and the top's
  // underside (p14, p17, p18, p20), drawn as its two edges at the backs' faces
  const groove = (k: string, a: Vec3, c: Vec3) => {
    for (const z of [-167.5, -170]) b.pencil(k, [a[0], a[1], z], [c[0], c[1], z]);
  };

  /* ---------- the carcass, lying on its front (p14 to p19) ---------- */
  // p14: the bottom underside up, the four big cam lock holes near its corners
  step({ title: "Tap 4 dowels into the bottom", detail: "Underside up. Two into each end, into the holes in the edge, not the face.", kind: "dowels", tools: ["hammer"], scene: "s1", pose: "-y", warnings: ["floor"] }, () => {
    show(bottom, [0, -150, 0]);
    groove(bottom, [-572, YB, 0], [572, YB, 0]);
    // the inset: the groove's notch in each end edge, 8 deep, so you can tell which way round the board goes
    for (const sx of [-1, 1]) {
      const n: Vec3[] = [[sx * 572, YB, -167.5], [sx * 572, YB - 8, -167.5], [sx * 572, YB - 8, -170], [sx * 572, YB, -170]];
      for (let i = 0; i < 3; i++) b.pencil(bottom, n[i], n[i + 1]);
    }
    b.look(bottom, [572, YB - 4, -168.75], { dir: [-1, 0, 0], size: 15 });
    for (const sx of [-1, 1]) fit(C, bottom, DZ.map((z): Vec3 => [sx * 572, YB - 8, z]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
  });
  const prepDivider = (div: string, sx: number, runner: HwDef) => {
    const face = sx * (XD - 8); // the face towards the drawers
    show(div, [0, 150, 0]);
    fit(C, div, DZ.map((z): Vec3 => [sx * XD, YT, z]), [0, -1, 0], { mate: top }); // between the cam lock holes (p12, p14)
    fit(C, div, CZ.map((z): Vec3 => [sx * XD, YB, z]), [0, 1, 0], { mate: bottom });
    fit(runner, div, FY.map((fy): Vec3 => [face, runY(fy), -3]), [sx, 0, 0], { hole: false });
    // the runners' euro screws go into holes drilled for them (p12)
    for (const fy of FY) for (const z of [111, -113]) b.hole(div, [face, runY(fy), z], [-sx, 0, 0], 2.5);
    fit(H, div, FY.flatMap((fy) => [111, -113].map((z): Vec3 => [face - sx * 12, runY(fy), z])), [sx, 0, 0], { hole: false });
  };
  // p14: the bottom end (outer-pair dowels) nearest, the runners' rollers on the far edge
  step({ title: "Fit the runners and dowels to divider 7", detail: "Four right-hand cabinet runners (CR), two euro screws each, and two dowels into each end.", kind: "runners", tools: ["screwdriver", "hammer"], scene: "s2", pose: "-x", turn: Math.PI }, () => prepDivider(div7, 1, CR));
  step({ title: "The same for divider 6", detail: "Four left-hand cabinet runners (CL), two euro screws each, and four dowels.", kind: "runners", tools: ["screwdriver", "hammer"], scene: "s3", pose: "+x" }, () => prepDivider(div6, -1, CL));
  const onFront = { pose: "-z", turn: FROM_END } as const;
  step({ title: "Screw the dividers to the bottom", detail: "Lay the dividers on their front edges, runners facing each other. Two connector screws through the underside of the bottom into each, with the Allen key, heads flush.", kind: "bolts", tools: ["allen"], ...onFront }, () => {
    put([bottom], [0, -200, 0]);
    put([div6, div7], [0, 300, 0]);
    for (const [div, sx] of [[div6, -1], [div7, 1]] as const) fit(L, bottom, DZ.map((z): Vec3 => [sx * XD, 60, z]), [0, 1, 0], { mate: div });
  });
  step({ title: "Tap 6 dowels into the plinth", detail: "Two into each end, two into the top edge.", kind: "dowels", tools: ["hammer"], scene: "s5" }, () => {
    show(plinth, [0, 150, 0]);
    for (const sx of [-1, 1]) fit(C, plinth, [14, 46].map((y): Vec3 => [sx * 572, y, ZP]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
    fit(C, plinth, [-300, 300].map((x): Vec3 => [x, 60, ZP]), [0, -1, 0], { mate: bottom });
  });
  step({ title: "Fit the plinth under the bottom", detail: "Onto the dowels in the underside of the bottom, along its front edge.", kind: "join", ...onFront }, () => put([plinth], [0, -150, 0]));
  const prepSide = (side: string, sx: number) => {
    show(side, [0, 150, 0]);
    groove(side, [sx * (XS - 8), 0, 0], [sx * (XS - 8), 867, 0]);
    fit(C, side, DZ.map((z): Vec3 => [sx * XS, YT, z]), [0, -1, 0], { mate: top });
    // p13, p17: both cam bolts at the bottom panel's height, near the front and back edges
    fit(A, side, CZ.map((z): Vec3 => [sx * (XS - 8), YB - 8, z]), [sx, 0, 0], { mate: bottom });
  };
  const lockSide = (side: string, sx: number) => {
    put([side], [sx * 300, 0, 0]);
    fit(B, bottom, CZ.map((z): Vec3 => [sx * 545, YB - 16, z]), [0, 1, 0]); // in the bottom's underside (p17)
  };
  step({ title: "Prepare the left side", detail: "Two dowels into the top edge and two cam bolts into the inside face, at the height of the bottom.", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s7", pose: "+x" }, () => prepSide(side1, -1));
  step({ title: "Fit the left side and lock it", detail: "Onto the dowels of the bottom and the plinth. Two cam locks in the underside of the bottom, arrow towards the bolt, turned with the flat screwdriver.", kind: "cams", tools: ["flathead"], ...onFront }, () => lockSide(side1, -1));
  step({ title: "Prepare the right side", detail: "The same: two dowels and two cam bolts.", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s9", pose: "-x" }, () => prepSide(side2, 1));
  step({ title: "Fit the right side and lock it", detail: "Two cam locks in the underside of the bottom.", kind: "cams", tools: ["flathead"], ...onFront }, () => lockSide(side2, 1));
  step({ title: "Slide the three back panels in", detail: "Along the grooves from the top end: the two with a notch (8) at the sides, notch at the top end, the wide one (9) in the middle.", kind: "join", ...onFront }, () => put(backs, [0, 400, 0]));
  const uprights: [string, number][] = [[side1, -XS], [div6, -XD], [div7, XD], [side2, XS]];
  step({ title: "Prepare the top", detail: "Eight cam bolts into its underside, two over each side and divider. Screw the two anti-tip brackets on at the back, two screws each, to about 80%.", kind: "cams", tools: ["screwdriver"], scene: "s12", pose: "-y" }, () => {
    show(top, [0, -150, 0]);
    groove(top, [-589, YT, 0], [589, YT, 0]);
    b.fits(A, uprights.flatMap(([mate, x]) => CZ.map((z): FitOpts => ({ on: top, at: [x, YT, z], dir: [0, 1, 0], mate }))), 0.06);
    b.then(0.1);
    b.brackets(G, R, [-400, 400].map((x): FitOpts => ({ on: top, at: [x, YT, -168], dir: [0, 1, 0], travel: 60, wall: true })));
  });
  step({ title: "Fit the top and lock it", detail: "Stand it up. Onto the dowels of both sides and dividers. Eight cam locks: in the sides' inside faces and in the dividers' faces towards the drawers.", kind: "cams", tools: ["flathead"] }, () => {
    put([top], [0, 300, 0]);
    // every cam lock in the face towards the middle: the sides' inside faces, the dividers' runner faces (p14, p15)
    for (const [k, x] of uprights) {
      const sx = Math.sign(x);
      fit(B, k, CZ.map((z): Vec3 => [x - sx * 8, YC, z]), [sx, 0, 0]);
    }
  });
  step({ title: "Fix the back panels and tap in the glides", detail: "Lay it on its front on a rug and check the diagonals match. Sixteen blocks round the edges of the backs, ten joining plates and screws over the two seams, and six glides into the bottom edges of the sides and plinth.", kind: "nails", tools: ["tape", "hammer", "screwdriver"], ...onFront, check: "square" }, () => {
    const z = -170;
    // p21: five along the top edge, five along the bottom, three up each side; each block on the back, its upright face
    // (7.5 mm from its middle) against the top, the bottom or a side, turned to face it
    const xs = [-490, -270, 10, 295, 515];
    const blocks: [Vec3, number][] = [
      ...xs.map((x): [Vec3, number] => [[x, YT - 7.5, z], 0]),
      ...xs.map((x): [Vec3, number] => [[x, YB + 7.5, z], Math.PI]),
      ...[-1, 1].flatMap((sx) => [170, 440, 710].map((y): [Vec3, number] => [[sx * (XS - 8 - 7.5), y, z], (-sx * Math.PI) / 2])),
    ];
    b.fits(D, blocks.map(([at, twist]): FitOpts => ({ on: backs[at[0] < -197 ? 0 : at[0] > 197 ? 2 : 1], at, dir: [0, 0, 1], twist, hole: false })), 0.04);
    b.then(0.1);
    const seams = [-197, 197].flatMap((x) => [100, 300, 470, 640, 840].map((y): Vec3 => [x, y, -170])).slice(0, 10);
    fit(Q, backs[1], seams, [0, 0, 1], { hole: false });
    b.fits(E, seams.map((at): FitOpts => ({ on: backs[1], at: [at[0], at[1], -172], dir: [0, 0, 1], mate: at[0] < 0 ? div6 : div7 })), 0.04);
    b.then(0.1);
    // the right side's first: their circle points there, clear of the other fittings on a phone
    fit(N, side2, [-146, 144].map((z2): Vec3 => [XS, 0, z2]), [0, 1, 0]);
    fit(N, side1, [-146, 144].map((z2): Vec3 => [-XS, 0, z2]), [0, 1, 0]);
    fit(N, plinth, [-200, 200].map((x): Vec3 => [x, 0, ZP]), [0, 1, 0]); // p21: about a third in from each end
  });
  step({ title: "Stand it up and fix it to the wall", detail: "Stand it up, push it against the wall and mark through both brackets. Move it away, drill and plug the holes, then push it back, screw the brackets to the wall and tighten the screws in the top fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer"], wall: true, warnings: ["wall", "tip"] }, () => {
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
    const hy = d.fy + 184; // the handle holes 10 mm below the front's top edge (p13)
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
  const dStep = (title: string, detail: string, kind: StepKind, tools: ToolId[], body: () => void, o: Partial<StepDef> = {}) => step({ title, detail, kind, tools, scene: "drawer", repeat: 4, ...o }, body);
  // p23, p24: the front lies on its face and the drawer is built up from it; upright for the handle (p25)
  const flat = { pose: "-z" } as const;
  dStep("Screw 4 cam bolts into each drawer front", "Lay it on its face. Into the inside face, two near each end.", "cams", ["screwdriver"], () => {
    // p23, p24: the bottom's groove along the front's inside face near its bottom edge, end to end, its notch in each end
    for (const d of drawers) {
      const ys = [d.fy + 28.75, d.fy + 31.25];
      for (const y of ys) b.pencil(d.front, [-195, y, ZF], [195, y, ZF]);
      for (const sx of [-1, 1]) {
        const n: Vec3[] = [[sx * 195, ys[0], ZF], [sx * 195, ys[0], ZF + 8], [sx * 195, ys[1], ZF + 8], [sx * 195, ys[1], ZF]];
        for (let i = 0; i < 3; i++) b.pencil(d.front, n[i], n[i + 1]);
      }
    }
    show(d0.front, [0, 0, -150]);
    emit("frontBolts");
  }, flat);
  dStep("Fit the sides to the front and lock them", "Left side 11, right side 12, down onto the cam bolts, then two cam locks in each side's outer face.", "cams", ["flathead"], () => {
    for (const k of d0.sides) show(k, [0, 0, -150]);
    emit("sideCams");
  }, flat);
  dStep("Slide the bottom in and cap the cam locks", "Down the grooves. Then press a cover cap over each cam lock.", "drawer", [], () => {
    show(d0.bottom, [0, 0, -400]);
    emit("caps");
  }, flat);
  dStep("Screw on the back", "Down between the sides, two connector screws through each side with the Allen key.", "bolts", ["allen"], () => {
    show(d0.back, [0, 0, -250]);
    emit("backScrews");
  }, flat);
  dStep("Screw the handle on", "Two bolts from inside the front.", "screws", ["screwdriver"], () => emit("handle"));
  // p25: upside down, front towards you
  dStep("Screw the runners to the drawer", "Turn it upside down. DL on the left side, DR on the right, two screws each.", "runners", ["screwdriver"], () => emit("runners"), { pose: "-y", turn: FROM_END });
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
    // one pair of 5 mm holes in each, 471.5 up, measured off pp. 12 and 13: 58 mm from the front and 66 from the back
    // edge in the sides, 37 and 35 in the dividers
    const pins: [string, number, number, number[]][] = [[side1, -(XS - 8), -1, PIN_SZ], [div6, -(XD + 8), 1, PIN_DZ], [div7, XD + 8, -1, PIN_DZ], [side2, XS - 8, 1, PIN_SZ]];
    for (const [k, x, d, zs] of pins) for (const z of zs) b.hole(k, [x, 471.5, z], [-d, 0, 0], 2.5);
    b.fits(P, pins.flatMap(([k, x, d, zs]) => zs.map((z): FitOpts => ({ on: k, at: [x, 471.5, z], dir: [d, 0, 0], hole: false }))), 0.05);
    b.then(0.1);
    b.fits(M, [[side1, -1], [side2, 1]].flatMap(([k, sx]) => CZ.map((z): FitOpts => ({ on: k as string, at: [(sx as number) * (XS - 8), YC, z], dir: [sx as number, 0, 0], hole: false }))), 0.05);
  });
  step({ title: "Lay the two shelves on", detail: "One shelf (10) on the pins in each door column.", kind: "shelves" }, () => put(shelves, [0, 0, 300]));
  const hinge = (door: string, sgn: number) => {
    // p13 to scale: each cup 22 mm in from the hinged edge and 88 mm from the door's end, its two screws 9 mm further
    // in, 45 mm apart along the edge
    const x = sgn * 551;
    show(door, [0, 0, -150]);
    const ys = [167, 776];
    // each cup in its 35 mm bore (p28 inset), its edge drawn round the cup
    fit(S, door, ys.map((y): Vec3 => [x, y, ZF]), [0, 0, 1], { twist: sgn > 0 ? Math.PI : 0, hole: 17.5 });
    fit(R, door, ys.flatMap((y) => [-22.5, 22.5].map((dy): Vec3 => [x - sgn * 9, y + dy, ZF - 3])), [0, 0, 1], { hole: false });
    b.openDoor(door, sgn);
  };
  step({ title: "Screw 2 hinges to the right door (17)", detail: "Lay it face down on a rug. Each hinge cup in its round hole, two screws.", kind: "hinges", tools: ["screwdriver"], scene: "door17", pose: "-z", warnings: ["floor"] }, () => hinge(door17, 1));
  step({ title: "The same for the left door (16)", detail: "Two hinges, four screws.", kind: "hinges", tools: ["screwdriver"], scene: "door16", pose: "-z" }, () => hinge(door16, -1)); // p28: door 16 on its own
  /** Hangs a door open at 90° on its hinges (`sgn` -1 hinged on its left), arriving from the front, as the wardrobe's. */
  const hang = (door: string, sgn: number) => {
    const it = b.partItem(door);
    const [w, , t] = b.parts.find((p) => p.id === it.ref)!.size;
    const [x, y, z] = it.final.pos;
    // turned a quarter round the hinge line at its front face's hinge edge, as openDoor swings it
    b.stage(door, [x + (sgn * (w - t)) / 2, y, z + (t + w) / 2], [0, (sgn * Math.PI) / 2, 0], [0, 0, 400]);
  };
  // p29: both hung open at about 90°, the inset a hinge clipped onto its plate on the side, its screw turned
  step({ title: "Hang the doors and screw on their handles", detail: "Left door on the left side, right door on the right. Hold each door open at about 90°, clip each hinge onto its plate on the side and tighten the hinge screw. Then a handle at the top of each door, two bolts from inside.", kind: "doors", tools: ["screwdriver"] }, () => {
    b.stagger(0.25);
    hang(door16, -1);
    hang(door17, 1);
    b.then(0.12);
    // the top hinge of door 16 where its arm meets the plate, out past the hinged edge (the loose drawing's plate)
    b.look(door16, [-595, 776, ZF - 1], { size: 35 });
    for (const [door, x] of [[door16, -388], [door17, 388]] as const) {
      // the handle holes 10 mm below the door's top edge (p13)
      fit(J, door, [[x, 854, 174]], [0, 0, -1], { hole: false });
      fit(F, door, [-64, 64].map((dx): Vec3 => [x + dx, 854, ZF]), [0, 0, 1]);
    }
  });
  // p30's three rows: up and down, in and out, sideways
  step({ title: "Line up the doors", detail: "Hold the door while you adjust it, and loosen a screw only a little, never right out. Up and down, and in and out: loosen the screw at the far end of each hinge arm, move the door by hand, then tighten it. Sideways: loosen that screw too, turn the adjusting screw beside it until the gaps are even, then tighten the end screw again.", kind: "doors", tools: ["screwdriver"] }, () => {
    // shut both doors (p30)
    b.stagger(0.1);
    for (const k of [door16, door17]) b.add(k);
    b.then(0.12);
  });
  step({ title: "Keep to the weight limits", detail: "Top 20 kg. Each shelf 5 kg. The bottom of each door column 10 kg. Each drawer 3 kg.", kind: "general" });
  return true;
}

const family: Family = { names: ["JENSLEV"], build };
export default family;

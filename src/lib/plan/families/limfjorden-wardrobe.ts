import type { ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { HW, runner, runnerScrews, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import { add, mul, neg, sub } from "../math";
import type { Family } from "./family";
import { CLIP_BOSS, RUNNER } from "@/engine/sizes";
import { STEP_CAM } from "../sight";

/**
 * JYSK LIMFJORDEN wardrobe 120x200, 2 doors 3 drawers (3670614/15/16/64), read from its 41-page manual.
 * A divider (3R, faced with the stile 11R) splits it into two 573 mm columns: on the left three drawers under a
 * fixed shelf (8), a short door (13) above; on the right a full-height door (14). No handles. The carcass is built
 * lying on its back: the fixed shelf onto the divider, the runner panel (4), the front rail and stile, the bottom
 * with its plinth, the drawer rails, then the sides and the top, all on cam locks. It is stood up, the two
 * hardboard backs nailed on and it is fixed to the wall. The manual offers two layouts for the rail and the four
 * loose shelves (p. 30), both here (Plan.layouts): A (p. 31, the first) the rail over the drawers and four shelves on
 * the right; B (p. 32) three shelves over the drawers and the rail and one shelf on the right. The drawers are put
 * together, slid in, and the doors hung on clip-on hinges.
 */

const T = 16;
// the manual's fittings, by its letters
const A: HwDef = { kind: "dowel", len: 35, dia: 8 };
const B: HwDef = HW.hinge;
const C: HwDef = { kind: "screw", len: 13, dia: 5, form: "euro" };
const D: HwDef = { kind: "screw", len: 16, dia: 5, form: "euro" };
const E: HwDef = { kind: "bolt", len: 50, dia: 7, name: "Connector screw", flush: true };
const F: HwDef = { kind: "cam", len: 12, dia: 15 };
const G: HwDef = { kind: "camScrew", len: 34, dia: 6 };
const H: HwDef = { kind: "nail", len: 25, dia: 1.4 };
const J: HwDef = { kind: "glide", len: 4, dia: 15, name: "Nail-in glide" };
const K: HwDef = { kind: "pin", len: 10, dia: 5, form: "support" }; // an L support on its pin
const L: HwDef = { kind: "washer", len: 4, dia: 20, name: "Runner spacer" };
const M: HwDef = { kind: "clip", len: 19, dia: 33, form: "channel" }; // a boss nailed through, its U channel out past the side
const N: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const M4: HwDef = { kind: "screw", len: 30, dia: 4 }; // the 180's hinge strip screws
const Q: HwDef = { kind: "hook", len: 11, dia: 33, name: "Rail holder", form: "cup" }; // 33x19x11, its U open at the top
const R: HwDef = { kind: "plate", len: 3, dia: 22, name: "Joining plate" };
const S: HwDef = { kind: "bracket", len: 78, dia: 32, name: "Anti-tip bracket" };
const run = (name: string, roller?: "back") => runner(500, name, roller);
// the drawer runners go under the sides' bottom edges (p. 36)
const CL = run("Cabinet runner, left"), CR = run("Cabinet runner, right"), DL: HwDef = { ...run("Drawer runner, left", "back"), form: "under" }, DR: HwDef = { ...run("Drawer runner, right"), form: "under" }; // turned round under its side, so its front end is the back

/** n points evenly along a line, ends included when n > 1 */
const line = (a: Vec3, b: Vec3, n: number): Vec3[] => Array.from({ length: n }, (_, i) => add(a, mul(sub(b, a), n === 1 ? 0.5 : i / (n - 1))));

/** Step, fitting and staging helpers both builds share. */
function kit(b: PlanBuilder) {
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "+z", ...d }, body);
  // dowels and cam bolts given a `mate` are sunk by the builder so their ends stay inside the board they go into
  const fit = (def: HwDef, on: string | undefined, pts: Vec3[], dir: Vec3, o: Partial<FitOpts> = {}) => {
    b.fits(def, pts.map((at) => ({ on, at, dir, ...o })), 0.06);
    b.then(0.1);
  };
  /** Shows a loose part in a side scene: where it ends up, moved by `off`, arriving from `from`. */
  const show = (k: string, from?: Vec3, off: Vec3 = [0, 0, 0]) => {
    b.stageAround([k], neg(off), from);
    b.then(0.12);
  };
  /** Adds parts to the build, arriving from `from`. */
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  /** Hinges on a door lying face down: cups `x` along its hinge edge, `sgn` -1 hinged on its left, 1 on its right.
   *  That side is also the way the door swings open on the finished piece. */
  const hinge = (door: string, ys: number[], sgn: number, x: number) => {
    show(door, [0, 0, -150]);
    // each cup in its 35 mm bore (pp. 38, 42), its edge drawn round the cup
    fit(B, door, ys.map((y): Vec3 => [x, y, 278]), [0, 0, 1], { twist: sgn > 0 ? Math.PI : 0, hole: 17.5 });
    // its two screws 10 mm further in from the edge than the cup, 44 apart, in holes drilled for them (32 mm in, p. 14)
    const screws = ys.flatMap((y) => [-22, 22].map((dy): Vec3 => [x - sgn * 10, y + dy, 275]));
    pilots(b, door, screws.map(([sx, sy]): Vec3 => [sx, sy, 278]), [0, 0, -1], 1.5);
    fit(N, door, screws, [0, 0, 1], { hole: false });
    b.openDoor(door, sgn);
  };
  /** Hangs a door open at 90° on its hinges (`sgn` as for `hinge`), arriving from the front; `close` shuts them later. */
  const hang = (door: string, sgn: number) => {
    const it = b.partItem(door);
    const [w, , t] = b.parts.find((p) => p.id === it.ref)!.size;
    const [x, y, z] = it.final.pos;
    // turned a quarter round the hinge line at its front face's hinge edge, as openDoor swings it
    b.stage(door, [x + (sgn * (w - t)) / 2, y, z + (t + w) / 2], [0, (sgn * Math.PI) / 2, 0], [0, 0, 400]);
  };
  const close = (doors: string[]) => {
    b.stagger(0.1);
    for (const k of doors) b.add(k);
    b.then(0.12);
  };
  return { step, fit, show, put, hinge, hang, close };
}

const runY = (fy: number) => fy + 35; // runners sit at the foot of each drawer's slot
// a drawer side's front end has 4 holes 32 apart, here from its middle (p. 33): dowels in the 1st and 3rd from the groove, the front's cam bolts in the 2nd and 4th
const DOWEL_DY = [-50, 14], BOLT_DY = [-18, 46];

/** The three drawers (15-19), the same in both sizes: the box centred on x = xc, the fronts on x = fx. */
function drawerParts(b: PlanBuilder, xc: number, fx: number) {
  const frT = b.part("Drawer front", [582, 205, T], { label: "15" });
  const slT = b.part("Drawer side", [T, 156, 500], { label: "16L" });
  const srT = b.part("Drawer side", [T, 156, 500], { label: "17R" });
  const dbT = b.part("Drawer back", [489, 154, T], { label: "18" });
  const btT = b.part("Drawer bottom", [498, 3, 498], { label: "19", material: "fiber" });
  return [93, 317, 541].map((fy) => ({
    fy,
    xc,
    front: b.place(frT, [fx, fy + 102.5, 285]), // its back face meets the sides' ends at 277
    l: b.place(slT, [xc - 252.5, fy + 103, 27]),
    r: b.place(srT, [xc + 252.5, fy + 103, 27]),
    back: b.place(dbT, [xc, fy + 103, -215]),
    bottom: b.place(btT, [xc, fy + 31.5, 34]), // in grooves 8 mm into the back and 5 into the front
  }));
}
type Drawer = ReturnType<typeof drawerParts>[number];

/** Drawer assembly, both manuals alike: one drawer is shown, the manual has you make all three the same way. */
function drawerSteps(b: PlanBuilder, drawers: Drawer[]) {
  const { step, show } = kit(b);
  type Group = [HwDef, FitOpts[]];
  const dFits = (d: Drawer): Record<"frontBolts" | "sideDowels" | "sideCams" | "backDowels" | "backScrews" | "runners", Group[]> => {
    const y = d.fy + 103;
    const xs: [number, string, number][] = [
      [d.xc - 252.5, d.l, -1],
      [d.xc + 252.5, d.r, 1],
    ];
    return {
      frontBolts: [[G, xs.flatMap(([x, side]) => BOLT_DY.map((dy) => ({ on: d.front, at: [x, y + dy, 277] as Vec3, dir: [0, 0, 1] as Vec3, mate: side })))]],
      sideDowels: [[A, xs.flatMap(([x, side]) => DOWEL_DY.map((dy) => ({ on: side, at: [x, y + dy, 277] as Vec3, dir: [0, 0, -1] as Vec3, mate: d.front })))]],
      // in the sides' outer faces (p. 34)
      sideCams: [[F, xs.flatMap(([x, side, sx]) => BOLT_DY.map((dy) => ({ on: side, at: [x + sx * 8, y + dy, 243] as Vec3, dir: [-sx, 0, 0] as Vec3 })))]],
      backDowels: [[A, xs.flatMap(([x, side, sx]) => [-45, 45].map((dy) => ({ on: d.back, at: [x - sx * 8, y + dy, -215] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: side })))]],
      backScrews: [[E, xs.map(([x, side, sx]) => ({ on: side, at: [x + sx * 8, y, -215] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: d.back }))]],
      runners: [
        // under each side's bottom edge (fy + 25), the ledge outwards (DR turned round), three screws up through it
        [DL, [{ on: d.l, at: [d.xc - 252.5, d.fy + 25, 27], dir: [0, 1, 0], hole: false }]],
        [DR, [{ on: d.r, at: [d.xc + 252.5, d.fy + 25, 27], dir: [0, 1, 0], twist: Math.PI, hole: false }]],
        [N, xs.flatMap(([x, side]) => [-200, 0, 200].map((dz) => ({ on: side, at: [x, d.fy + 23, 27 + dz] as Vec3, dir: [0, 1, 0] as Vec3, hole: false as const })))],
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
  // the manuals build each drawer standing on its front, face down (pose "-z", its back up), from the bolts to the back
  const dStep = (title: string, detail: string, kind: StepKind, tools: ToolId[], body: () => void, o: Partial<StepDef> = {}) =>
    step({ title, detail, kind, tools, scene: "drawer", pose: "-z", repeat: 3, ...o }, body);
  dStep("Screw 4 cam bolts into each drawer front", "Lay it face down. Into the back face, two near each end, in the 2nd and 4th holes from the groove.", "cams", ["screwdriver"], () => {
    // the bottom's groove in the front, the sides and the back (pp. 33, 35), drawn as its two edges
    for (const d of drawers) {
      for (const y of [d.fy + 28.5, d.fy + 34.5]) {
        b.pencil(d.front, [d.xc - 252, y, 277], [d.xc + 252, y, 277]);
        b.pencil(d.back, [d.xc - 244.5, y, -207], [d.xc + 244.5, y, -207]);
        for (const sx of [-1, 1]) b.pencil(sx < 0 ? d.l : d.r, [d.xc + sx * 244.5, y, -223], [d.xc + sx * 244.5, y, 277]);
      }
    }
    show(d0.front, [0, 0, -150]);
    emit("frontBolts");
  });
  dStep("Tap 2 dowels into the front end of each drawer side", "Into the 1st and 3rd holes from the groove. Twelve in all for the six sides (16L and 17R).", "dowels", ["hammer"], () => {
    // lying flat, inner face up, in a scene of their own so the front is out of the picture (p. 33)
    for (const [k, rz] of [[d0.l, Math.PI / 2], [d0.r, -Math.PI / 2]] as const) b.stage(k, add(b.partItem(k).final.pos, [0, -60, -350]), [0, 0, rz], [0, 150, 0]);
    b.then(0.12);
    emit("sideDowels");
  }, { pose: "+y", scene: "drawer-sides" });
  // seen from the left, so 16L's outer face and its cam locks show, as on p. 34 of the 120's manual
  dStep("Fit the sides to the front and lock them", "Stand each side on the front, then two cam locks in each side's outer face.", "cams", ["flathead"], () => {
    show(d0.l, [-200, 0, 0]);
    show(d0.r, [200, 0, 0]);
    emit("sideCams");
    // 17R's are in its outer face, turned away: a circle on one from that side (p. 34 draws them beside it)
    b.look(d0.r, [d0.xc + 260.5, d0.fy + 103 + BOLT_DY[1], 243], { dir: [-1, 0, 0], size: 30 });
  }, { turn: -2 * STEP_CAM.az });
  dStep("Slide in the drawer bottom", "Along the grooves in the sides, from the back. The inside is 498 mm wide.", "drawer", ["tape"], () => show(d0.bottom, [0, 0, -450]));
  // on its own, lying with its groove up (p. 35)
  dStep("Tap 4 dowels into the drawer back", "Two in each end.", "dowels", ["hammer"], () => {
    show(d0.back, [0, 0, 150]);
    emit("backDowels");
  }, { scene: "drawer-back", pose: "+z" });
  dStep("Fit the back and screw it on", "Ease the sides out about 5° to get it in over the dowels, then one connector screw through each side.", "bolts", ["allen"], () => {
    show(d0.back, [0, 0, -250]);
    emit("backScrews");
    // 16L's goes in from its outer face, turned away: a circle on it from that side (p. 35)
    b.look(d0.l, [d0.xc - 260.5, d0.fy + 103, -215], { dir: [1, 0, 0], size: 30 });
  });
  // upside down, as p. 36 draws it
  dStep("Screw the runners to the drawer", "Turn it upside down. DL under the left side's edge, DR under the right's, three screws each.", "runners", ["screwdriver"], () => emit("runners"), { pose: "-y" });
  step({ title: "Slide in the three drawers", detail: "Rest each drawer's runner wheels on the cabinet runners, tilt it down and push it in until it runs smoothly.", kind: "drawer", pose: "+y" }, () => {
    for (const [i, d] of drawers.entries()) {
      b.stagger(0);
      for (const k of [d.front, d.l, d.r, d.back, d.bottom]) b.add(k, [0, 0, 520]);
      if (i > 0) for (const [def, list] of Object.values(dFits(d)).flat()) for (const o of list) b.preset(def, o);
      b.wait(0.22);
    }
  });
  // they open about 300 mm, the runners' travel
  for (const d of drawers) b.openDrawer([d.front, d.l, d.r, d.back, d.bottom], 455);
}

/*
 * The drilling both builds share, measured off the parts pages, drawn to scale (pages 12, 13 and 15 of the 120's
 * manual, 12 to 16 of the 180's; the panels they share are drilled alike). Depths are z, the back edges of the sides,
 * dividers, runner panels and fixed shelf at -287, their front edges at 277 (sides) or 257.
 */
// The drawer rails (10) lie 70 face down, flush with the front rail and the stiles (front at 272): in each end a dowel
// 57 mm and a cam bolt 25 mm in from the front, 8 mm above the rail's underside, and a cam lock coming up from
// underneath 34 mm in from each end. So the bolts sit 304 and 528 up, as the runner panels' drilling has them.
const RAIL_Y = [312, 536]; // rail centres
const RAIL_JY = RAIL_Y.map((y) => y - 8); // their joints' bolts
// the shelf-pin holes (5 mm), the 32 mm system's: two rows every 64 mm from 1743 down, on every upright (the 120's left
// side only above its fixed shelf), both faces of a divider; read off the parts pages' drawings. The rows' depths differ
// a little between the panels: the 120's sides, and the 180's sides and every divider. Each shelf has four 5 mm holes
// underneath, 10 mm in from its ends, over the rows, for the supports' clips
/** The 180's three layouts (pp. 33 to 36). */
const LAYOUTS_180 = [
  { id: "A", label: "Rails on the left and over the drawers, four shelves on the right" },
  { id: "B", label: "Four shelves on the left, rails over the drawers and on the right" },
  { id: "C", label: "Rails on both sides, shelves over the drawers and low each side" },
];
/** The 180's two ways for the short door (p. 44): L hinged on the left divider (pp. 45, 46), R on the right (pp. 47, 48). */
const DOOR_180 = [
  { id: "L", label: "Short door hinged on the left, opening to the left" },
  { id: "R", label: "Short door hinged on the right, opening to the right" },
];
/** The 120's two layouts (pp. 30 to 32). */
const LAYOUTS_120 = [
  { id: "A", label: "Rail over the drawers, four shelves on the right" },
  { id: "B", label: "Three shelves over the drawers, rail on the right" },
];
// a rail holder's peg (8 mm) and screw (3 mm) holes, 16 apart, high in each upright's faces (pp. 13, 15): the holder's
// origin 6 mm under the peg, its screw 10 under that, the rail's middle 13 under it in its cup
const RAIL_HY = 1897;
const PIN_Y = (n = 24) => Array.from({ length: n }, (_, k) => 1743 - 64 * k);
const PIN_Z = [-209, 175], PIN_Z2 = [-212, 172];
const pinRows = (b: PlanBuilder, key: string, x: number, n: Vec3, zs: number[], count?: number) => {
  for (const y of PIN_Y(count)) for (const z of zs) b.hole(key, [x, y, z], n, 2.5);
};
const shelfHoles = (b: PlanBuilder, shelf: string, w: number) => {
  const [x, y] = b.partItem(shelf).final.pos;
  for (const g of [-1, 1]) for (const z of PIN_Z2) b.hole(shelf, [x + g * (w / 2 - 10), y - T / 2, z], [0, -1, 0], 2.5);
};
/** A rail holder's two holes in an upright's face at x, facing n (both layouts' places are drilled): its peg's, its screw's. */
const railHoles = (b: PlanBuilder, key: string, x: number, n: Vec3) => {
  b.hole(key, [x, RAIL_HY + 6, -15], n, 4);
  b.hole(key, [x, RAIL_HY - 10, -15], n, 1.5);
};
/** Pilot holes (pp. 13 and 15): the runners' and the hinges' screws go into holes drilled for them. */
const pilots = (b: PlanBuilder, key: string, pts: Vec3[], n: Vec3, r: number) => pts.forEach((at) => b.hole(key, at, n, r));
const RAIL_DZ = 215, RAIL_BZ = 247;
const TOP_BZ = [-201, 182], TOP_DZ = [-232, 215]; // the top's cam bolts and, outside them, its dowels over each upright
const BOT_BZ = [-203, 181], BOT_DZ = [-233, -9, 214]; // the bottom: the sides' cam bolts (and the dividers' screws), its end dowels
const FIX_BZ = [-218, 166], FIX_DZ = [-249, -25, 198]; // the fixed shelf: the 120's left side's cam bolts (and the dividers' screws), its end dowels
const P4_DZ = [-236, 212]; // a runner panel's end dowels, into the fixed shelf and the bottom
const P4_FY = [194, 705]; // and the two in its front edge, into the stile's back 8 mm in from its edge
const RUN_Z = 2, RUN_SZ = [-130, 94, 222]; // cabinet runner centres and three screws; a fourth 244 in, 11 mm higher
const STILE_BY = [535, 1047, 1559], STILE_DY = [247, 1079, 1879]; // a stile's cam bolts and the divider's front edge dowels
// the tall doors' hinges, level with the middles of the pairs of plate holes in the sides
const TALL_HINGE_Y = [192, 767, 1311, 1887];
// the wall screw goes through the middle of the bracket's upright slot, 0.53 to 0.83 of its height above the top (drawable.ts)
const WALL_Y = 2001 + S.dia * 0.68;
/** A cabinet runner's four screws: three in line, the one at its front end 11 mm higher. */
const runScrews = (x: number, y: number) => runnerScrews(x, y, RUN_SZ, 244);

/** 120x200, 2 doors (3670614/15/16/64), its 41-page manual. */
function build120(b: PlanBuilder) {
  /* ---------- parts, in mm: x left to right, y up, z back to front; the manual's numbers as labels ---------- */
  const side1 = b.place(b.part("Left side", [T, 1980, 564], { label: "1L" }), [-590, 995, -5]);
  const side2 = b.place(b.part("Right side", [T, 1980, 564], { label: "2R" }), [590, 995, -5]);
  const div = b.place(b.part("Divider", [T, 1876, 544], { label: "3R" }), [0, 1047, -15]);
  const p4 = b.place(b.part("Runner panel", [T, 681, 544], { label: "4" }), [-24, 449.5, -15]);
  const top = b.place(b.part("Top", [1196, T, 581], { label: "5" }), [0, 1993, 3.5]);
  const bot = b.place(b.part("Bottom", [1162, T, 561], { label: "6" }), [0, 101, -6.5]);
  const shT = b.part("Shelf", [573, T, 498], { label: "7" });
  // on shelf pins in the 32 mm system's holes (pin centre 11 mm under the shelf's middle): layout A's four on the right
  // in holes 3, 8, 14 and 19 of the rows (p. 31); B's three over the drawers and one low on the right (p. 32)
  const lay = b.pick(LAYOUTS_120);
  const shelfAt: [number, number][] = lay === "A" ? [3, 8, 14, 19].map((k) => [294.5, PIN_Y()[k] + 11]) : [[-294.5, 1114], [-294.5, 1434], [-294.5, 1689], [294.5, 794]];
  const shelves = shelfAt.map(([x, y]) => b.place(shT, [x, y, -38]));
  const fixed = b.place(b.part("Fixed shelf", [573, T, 544], { label: "8" }), [-294.5, 798, -15]);
  const lip = b.place(b.part("Front rail", [550, 70, T], { label: "9" }), [-307, 771, 264]);
  const railT = b.part("Drawer rail", [550, 32, 70], { label: "10" });
  const rails = RAIL_Y.map((y) => b.place(railT, [-307, y, 237]));
  // its left edge flush with the runner panel (x = -32), like the 180's stiles, so the rails meet it there
  const SC = -32 + 35;
  const stile = b.place(b.part("Front stile", [70, 1876, T], { label: "11R" }), [SC, 1047, 265]);
  const plinth = b.place(b.part("Plinth", [1162, 88, T], { label: "12" }), [0, 49, 246]);
  const door13 = b.place(b.part("Short door", [582, 1218, T], { label: "13" }), [-293, 1374, 286]);
  const door14 = b.place(b.part("Tall door", [582, 1890, T], { label: "14" }), [293, 1038, 286]);
  // the box 2 mm right of the opening's middle: the left runners stand on 4 mm spacers, panel 4's don't (pp. 14, 19)
  const drawers = drawerParts(b, -305, -293);
  const bkT = b.part("Back panel", [590, 1900, 3], { label: "20", material: "fiber" });
  const backs = [-295, 295].map((x) => b.place(bkT, [x, 1043, -288.5]));
  // in its holders' cups: over the drawers in layout A, on the right in B
  const rail = b.place(b.part("Clothes rail", [22, 567, 15], { label: "21", shape: "cyl", material: "metal" }), [lay === "A" ? -294.5 : 294.5, RAIL_HY - 13, -15], [0, 0, Math.PI / 2]);
  pinRows(b, side1, -582, [1, 0, 0], PIN_Z, 15);
  pinRows(b, side2, 582, [-1, 0, 0], PIN_Z);
  for (const g of [-1, 1]) pinRows(b, div, g * 8, [g, 0, 0], PIN_Z2);
  for (const k of shelves) shelfHoles(b, k, 573);
  for (const [k, x, d] of [[side1, -582, 1], [div, -8, -1], [div, 8, 1], [side2, 582, -1]] as const) railHoles(b, k, x, [d, 0, 0]);


  const { step, fit, show, put, hinge, hang, close } = kit(b);

  /* ---------- the carcass, lying on its back ---------- */
  step({ title: "Tap 5 dowels into the fixed shelf", detail: "Three into the end that meets the left side, two into the front edge. Use the hammer gently.", kind: "dowels", tools: ["hammer"], scene: "s1", pose: "-y", turn: Math.PI, warnings: ["floor"] }, () => {
    // underside up, its cam lock holes showing, the dowelled end on the right (p. 16)
    show(fixed, [0, -150, 0]);
    fit(A, fixed, FIX_DZ.map((z): Vec3 => [-581, 798, z]), [1, 0, 0], { mate: side1 });
    // into the front rail's back, 51 mm in from its ends
    fit(A, fixed, [-530, -83].map((x): Vec3 => [x, 798, 257]), [0, 0, -1], { mate: lip });
  });
  step({ title: "Tap 7 dowels into the divider", detail: "Three into its front edge for the stile, two into each end.", kind: "dowels", tools: ["hammer"], scene: "s2", pose: "+x" }, () => {
    show(div, [0, 150, 0]);
    fit(A, div, STILE_DY.map((y): Vec3 => [0, y, 257]), [0, 0, -1], { mate: stile });
    fit(A, div, TOP_DZ.map((z): Vec3 => [0, 1985, z]), [0, -1, 0], { mate: top });
    fit(A, div, TOP_DZ.map((z): Vec3 => [0, 109, z]), [0, 1, 0], { mate: bot });
  });
  step({ title: "Screw the fixed shelf to the divider", detail: "Lay the divider on its back edge. Hold the shelf's plain end against it, its dowelled end away, and drive two connector screws through the divider into it with the Allen key, heads flush.", kind: "bolts", tools: ["allen", "screwdriver"] }, () => {
    put([div], [0, 0, 300]);
    put([fixed], [-300, 0, 0]);
    fit(E, div, FIX_BZ.map((z): Vec3 => [8, 798, z]), [-1, 0, 0], { mate: fixed });
  });
  step({ title: "Fit the runners, dowels and cam bolts to panel 4", detail: "Three right-hand cabinet runners (CR), four short 13 mm screws each, not the 16 mm ones. Two dowels in each end and two in the front edge. Two cam bolts into the runner face near the front edge, one between each pair of runners, for the drawer rails.", kind: "runners", tools: ["hammer", "screwdriver"], scene: "s4", pose: "-x" }, () => {
    show(p4, [0, 150, 0]);
    fit(A, p4, P4_DZ.map((z): Vec3 => [-24, 790, z]), [0, -1, 0], { mate: fixed });
    fit(A, p4, P4_DZ.map((z): Vec3 => [-24, 109, z]), [0, 1, 0], { mate: bot });
    fit(A, p4, P4_FY.map((y): Vec3 => [-24, y, 257]), [0, 0, -1], { mate: stile });
    fit(CR, p4, drawers.map((d): Vec3 => [-32, runY(d.fy), RUN_Z]), [1, 0, 0], { hole: false });
    pilots(b, p4, drawers.flatMap((d) => runScrews(-32, runY(d.fy))), [-1, 0, 0], 1.75);
    fit(C, p4, drawers.flatMap((d) => runScrews(-32 - RUNNER.body, runY(d.fy))), [1, 0, 0], { hole: false });
    b.fits(G, RAIL_Y.map((y, i) => ({ on: p4, at: [-32, y - 8, RAIL_BZ] as Vec3, dir: [1, 0, 0] as Vec3, mate: rails[i] })), 0.06);
  });
  step({ title: "Fit panel 4 under the fixed shelf", detail: "Runners facing the left side, about 8 mm clear of the divider. Push its dowels up into the shelf.", kind: "join", turn: -2 * STEP_CAM.az }, () => put([p4], [0, -300, 0]));
  step({ title: "Prepare the front stile and the front rail", detail: "Two dowels in each end of the long stile (11R) and three cam bolts in its back. Two cam bolts in the back of the short rail (9).", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s6", pose: "-z" }, () => {
    show(stile, [0, 0, -150]);
    // p. 18: the rail lies apart from the stile, beside it and the same way along
    b.stage(lip, [300, 1047, 264], [0, 0, Math.PI / 2], [0, 0, -150]);
    b.then(0.12);
    fit(A, stile, [SC - 17, SC + 17].map((x): Vec3 => [x, 109, 265]), [0, 1, 0], { mate: bot });
    fit(A, stile, [SC - 17, SC + 17].map((x): Vec3 => [x, 1985, 265]), [0, -1, 0], { mate: top });
    fit(G, stile, STILE_BY.map((y): Vec3 => [0, y, 257]), [0, 0, 1], { mate: div });
    // 115 mm in from each end, level with the shelf's middle
    fit(G, lip, [-467, -147].map((x): Vec3 => [x, 798, 256]), [0, 0, 1], { mate: fixed });
  });
  step({ title: "Fit the front rail and lock it", detail: "Lay it on the front edge of the fixed shelf, flush with the top. Two cam locks in the shelf's underside, arrow towards the bolt, turned clockwise with the flat screwdriver.", kind: "cams", tools: ["flathead"], turn: -2 * STEP_CAM.az }, () => {
    put([lip], [0, 0, 250]);
    fit(F, fixed, [-467, -147].map((x): Vec3 => [x, 790, 223]), [0, 1, 0]);
  });
  step({ title: "Fit the front stile and lock it", detail: "Lay it on the divider's front edge, onto its three dowels and the two in panel 4's front edge, its bottom end flush with panel 4. Three cam locks in the divider.", kind: "cams", tools: ["flathead"] }, () => {
    put([stile], [0, 0, 300]);
    fit(F, div, STILE_BY.map((y): Vec3 => [8, y, 222]), [-1, 0, 0]);
  });
  step({ title: "Tap dowels into the bottom and the plinth", detail: "Three in each end of the bottom (6). Two in each end of the plinth (12) and two in its top edge. Knock a glide into the middle of the plinth's bottom edge, 581 mm from the end.", kind: "dowels", tools: ["hammer", "tape"], scene: "s9", pose: "-y" }, () => {
    // p. 20: the bottom underside up, its cam lock holes showing; the plinth flat in front of it, top edge away
    show(bot, [0, -150, 0]);
    b.stage(plinth, [0, 101, -450], [Math.PI / 2, 0, 0], [0, -150, 0]);
    b.then(0.12);
    for (const sx of [-1, 1]) {
      fit(A, bot, BOT_DZ.map((z): Vec3 => [sx * 581, 101, z]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
      fit(A, plinth, [38, 69].map((y): Vec3 => [sx * 581, y, 246]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
    }
    fit(A, plinth, [-447, 447].map((x): Vec3 => [x, 93, 246]), [0, -1, 0], { mate: bot });
    fit(J, plinth, [[0, 5, 246]], [0, 1, 0]);
    // the top edge is away from you: a circle on each of its two dowels
    for (const x of [-447, 447]) b.look(plinth, [x, 93, 246], { dir: [0, -1, 0], size: 30 });
  });
  step({ title: "Screw the plinth to the bottom", detail: "Under the front edge of the bottom, onto its dowels. One connector screw down through the bottom into the plinth.", kind: "bolts", tools: ["allen", "flathead"], scene: "s9", pose: "+y" }, () => {
    show(plinth);
    fit(E, bot, [[0, 109, 246]], [0, -1, 0], { mate: plinth });
  });
  step({ title: "Fit the bottom to the divider", detail: "Push it onto the dowels of the divider, the stile and panel 4. Two connector screws through the bottom into the divider.", kind: "bolts", tools: ["allen"] }, () => {
    put([bot, plinth], [0, -300, 0]);
    fit(E, bot, BOT_BZ.map((z): Vec3 => [0, 93, z]), [0, 1, 0], { mate: div });
  });
  step({ title: "Tap a dowel into each end of the drawer rails", detail: "Four dowels for the two thick rails (10).", kind: "dowels", tools: ["hammer"], scene: "s12", pose: "-y" }, () => {
    // underside up, a cam lock hole near each end (p. 21)
    for (const k of rails) show(k, [0, -150, 0]);
    for (const [i, k] of rails.entries()) {
      fit(A, k, [[-582, RAIL_JY[i], RAIL_DZ]], [1, 0, 0], { mate: side1 });
      fit(A, k, [[-32, RAIL_JY[i], RAIL_DZ]], [-1, 0, 0], { mate: p4 });
    }
  });
  step({ title: "Fit the drawer rails to panel 4 and lock them", detail: "The rails go between the drawer runners, flush with the front, onto panel 4's cam bolts with their dowels in its holes. One cam lock from underneath into each rail's end there.", kind: "cams", tools: ["flathead"] }, () => {
    put(rails, [-300, 0, 0]); // endwise, from the open left side (p. 22)
    for (const [i, k] of rails.entries()) fit(F, k, [[-66, RAIL_Y[i] - 16, 245]], [0, 1, 0]);
  });
  step({ title: "Screw the drawer runners to the left side", detail: "Three left-hand cabinet runners (CL), each on four 4 mm spacer washers, one under each screw hole, with the longer 16 mm screws.", kind: "runners", tools: ["screwdriver"], scene: "s14", pose: "+x" }, () => {
    show(side1, [0, 150, 0]);
    // p. 19: a 4 mm spacer (F) on the side under each screw hole, the runner on them, a 16 mm screw (L) through each
    const pts = drawers.flatMap((d) => runScrews(-582, runY(d.fy)));
    pilots(b, side1, pts, [1, 0, 0], 1.75);
    fit(L, side1, pts, [-1, 0, 0], { hole: false });
    fit(CL, side1, drawers.map((d): Vec3 => [-582 + L.len, runY(d.fy), RUN_Z]), [-1, 0, 0], { hole: false });
    fit(D, side1, pts.map((p): Vec3 => [-582 + L.len + RUNNER.body, p[1], p[2]]), [-1, 0, 0], { hole: false });
  });
  step({ title: "Tap 2 dowels into the top of the left side", detail: "Into the top edge, near the front and back edges.", kind: "dowels", tools: ["hammer"], scene: "s14", pose: "+x" }, () => {
    fit(A, side1, TOP_DZ.map((z): Vec3 => [-590, 1985, z]), [0, -1, 0], { mate: top });
    // the top end is away from you: a circle on the second dowel too
    b.look(side1, [-590, 1985, TOP_DZ[1]], { dir: [0, -1, 0], size: 30 });
  });
  step({ title: "Add 6 cam bolts and 2 glides to the left side", detail: "Cam bolts into the inside face: two for the bottom, one for each rail and two for the fixed shelf. Glides into the bottom edge, 50 mm from each end, centred on the edge.", kind: "cams", tools: ["screwdriver", "hammer", "tape"], scene: "s14", pose: "+x" }, () => {
    const at: [Vec3, string][] = [
      ...BOT_BZ.map((z): [Vec3, string] => [[-582, 101, z], bot]),
      ...rails.map((k, i): [Vec3, string] => [[-582, RAIL_JY[i], RAIL_BZ], k]),
      ...FIX_BZ.map((z): [Vec3, string] => [[-582, 798, z], fixed]),
    ];
    b.fits(G, at.map(([p, mate]) => ({ on: side1, at: p, dir: [-1, 0, 0] as Vec3, mate })), 0.06);
    b.then(0.1);
    fit(J, side1, [-237, 227].map((z): Vec3 => [-590, 5, z]), [0, 1, 0]);
  });
  step({ title: "Fit the left side and lock it", detail: "Push it onto the dowels of the bottom, plinth, rails and fixed shelf. Six cam locks, all from underneath: two in the bottom, one in each rail, two in the fixed shelf.", kind: "cams", tools: ["flathead"] }, () => {
    put([side1], [-400, 0, 0]);
    // 35 mm in from the bottom's end, 34 from the rails' and the fixed shelf's
    fit(F, bot, BOT_BZ.map((z): Vec3 => [-546, 93, z]), [0, 1, 0]);
    for (const [i, k] of rails.entries()) fit(F, k, [[-548, RAIL_Y[i] - 16, 245]], [0, 1, 0]);
    fit(F, fixed, FIX_BZ.map((z): Vec3 => [-547, 790, z]), [0, 1, 0]);
  });
  step({ title: "Prepare the right side", detail: "Two dowels into the top edge, two cam bolts into the inside face for the bottom, and two glides into the bottom edge, 50 mm from each end.", kind: "dowels", tools: ["hammer", "screwdriver", "tape"], scene: "s18", pose: "-x", turn: Math.PI }, () => {
    // p. 24: the top end and its dowels away from you, the bottom end (cam bolts, glides) near
    show(side2, [0, 150, 0]);
    fit(A, side2, TOP_DZ.map((z): Vec3 => [590, 1985, z]), [0, -1, 0], { mate: top });
    fit(G, side2, BOT_BZ.map((z): Vec3 => [582, 101, z]), [1, 0, 0], { mate: bot });
    fit(J, side2, [-237, 227].map((z): Vec3 => [590, 5, z]), [0, 1, 0]);
  });
  // seen from the left of the bottom end, so the bottom's underside and both cam locks face you (p. 25)
  step({ title: "Fit the right side and lock it", detail: "Onto the dowels of the bottom and plinth. Two cam locks in the bottom's underside.", kind: "cams", tools: ["flathead"], turn: -2 * STEP_CAM.az }, () => {
    put([side2], [400, 0, 0]);
    fit(F, bot, BOT_BZ.map((z): Vec3 => [546, 93, z]), [0, 1, 0]);
  });
  step({ title: "Screw 6 cam bolts into the top", detail: "Into the underside: two for each side and two for the divider.", kind: "cams", tools: ["screwdriver"], scene: "s20", pose: "-y" }, () => {
    show(top, [0, -150, 0]);
    b.fits(G, [[-590, side1], [0, div], [590, side2]].flatMap(([x, mate]) => TOP_BZ.map((z) => ({ on: top, at: [x as number, 1985, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: mate as string }))), 0.06);
  });
  step({ title: "Screw the anti-tip brackets to the top", detail: "Two brackets on the top face along the back edge, two 16 mm screws each. Stop at about 80%: they are tightened fully once it is against the wall.", kind: "screws", tools: ["screwdriver"], scene: "s20", pose: "+y" }, () => {
    b.brackets(S, N, [-300, 300].map((x): FitOpts => ({ on: top, at: [x, 2001, -274], dir: [0, -1, 0], travel: 60, wall: true })));
  });
  step({ title: "Fit the top and lock it", detail: "Onto the dowels of both sides, the divider and the stile. Six cam locks: two in each side and two in the divider.", kind: "cams", tools: ["flathead"] }, () => {
    put([top], [0, 400, 0]);
    // 35 mm down from the top edge
    fit(F, side1, TOP_BZ.map((z): Vec3 => [-582, 1950, z]), [-1, 0, 0]);
    fit(F, div, TOP_BZ.map((z): Vec3 => [8, 1950, z]), [-1, 0, 0]);
    fit(F, side2, TOP_BZ.map((z): Vec3 => [582, 1950, z]), [1, 0, 0]);
    // 2R's are in its inner face, turned away: a circle on one, seen from inside (p. 26)
    b.look(side2, [582, 1950, TOP_BZ[1]], { dir: [1, 0, 0], size: 30 });
  });

  /* ---------- standing: the back, the wall ---------- */
  step({ title: "Stand it up and mark the shelf line", detail: "Two of you: it is over 2 m tall, so check the room is higher than 215 cm before tipping it up. Lay the back panel for the tall door's column on, pushed up to the top and out to the side, and mark the fixed shelf's height on the left side's back edge and on that panel's edge by the seam.", kind: "standup", tools: ["pencil"], pose: "+y", turn: Math.PI, people: 2, warnings: ["two"] }, () => {
    // p. 27: one panel only, the drawer column left open; two short marks level with the fixed shelf
    put([backs[1]], [0, 0, -300]);
    b.pencil(side1, [-597, 798, -287.2], [-583, 798, -287.2]);
    b.pencil(backs[1], [2, 798, -290.2], [40, 798, -290.2]);
    // each mark in a circle of its own, as the manual's insets have them
    b.look(side1, [-590, 798, -287], { dir: [0, 0, 1], size: 35 });
    b.look(backs[1], [21, 798, -290], { dir: [0, 0, 1], size: 35 });
  });
  step({ title: "Nail on the back", detail: "Lay the second panel on and draw the fixed shelf's line across it between your marks with a level. Measure both diagonals: when they match it is square. Nail round the edges, along your lines into the fixed shelf and the divider, the six joining plates over the seam and the clip on the left side's back edge, about 1.5 m up. 44 nails in all. Drive each one straight in, square to the back, so it goes into the middle of the edge behind and doesn't come out the side.", kind: "nails", tools: ["hammer", "tape", "level", "pencil"], pose: "+y", turn: Math.PI, check: "square" }, () => {
    put([backs[0]], [0, 0, -300]);
    b.pencil(backs[0], [-575, 798, -290.2], [-15, 798, -290.2]); // the fixed shelf's line, drawn with the level (p. 28)
    const z = -290;
    const on = (p: Vec3) => (p[0] < 0 ? backs[0] : backs[1]);
    const nails = (pts: Vec3[]) => {
      b.fits(H, pts.map((at) => ({ on: on(at), at, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.03);
      b.then(0.1);
    };
    const plates: Vec3[] = line([0, 200, z], [0, 1850, z], 6);
    const clip: Vec3 = [-590, 1490, z]; // well above the shelf line, measured on p. 28
    nails([
      ...line([-590, 150, z], [-590, 1940, z], 8),
      ...line([590, 150, z], [590, 1940, z], 8),
      ...line([-540, 1989, z], [540, 1989, z], 5),
      ...line([-540, 101, z], [540, 101, z], 5),
      ...[365, 695, 1025, 1355, 1685, 1950].map((y): Vec3 => [0, y, z]),
      ...line([-560, 798, z], [-30, 798, z], 5),
    ]);
    fit(R, undefined, plates, [0, 0, 1], { hole: false });
    // its channel out past the left side (twist turns it from up to -x), the nail through the boss's top
    fit(M, backs[0], [clip], [0, 0, 1], { hole: false, twist: Math.PI / 2 });
    nails([...plates, add(clip, [0, 0, -CLIP_BOSS])]);
  });
  step({ title: "Fix it to the wall", detail: "Push it against the wall, mark through both brackets, drill, plug and screw them to the wall, then tighten the screws in the top fully. Use a step ladder to reach the brackets. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    fit(HW.plug, undefined, [-300, 300].map((x): Vec3 => [x, WALL_Y, -290]), [0, 0, -1]);
    fit(HW.wallScrew, undefined, [-300, 300].map((x): Vec3 => [x, WALL_Y, -288]), [0, 0, -1]);
  });

  /* ---------- inside: layout B ---------- */
  b.layouts(LAYOUTS_120);
  // the picked layout's rail and shelves shown faded where they will go, so a pick shows at once
  step({ title: "Choose where the rail goes", detail: "The manual gives two layouts: pick one. A: the rail over the drawers, four shelves on the right. B: three shelves over the drawers, the rail and one shelf on the right.", kind: "general", pose: "+y", el: 0.1 }, () => b.ghost([rail, ...shelves]));
  const railLeft = lay === "A";
  step({ title: "Fit the rail and the four shelves", detail: railLeft ? "Screw a rail holder to the left side and to the divider at the top, one screw each, and drop the rail in. Then four shelf pins under each shelf, at any height: all four shelves on the right." : "Screw a rail holder to the divider and to the right side at the top, one screw each, and drop the rail in. Then four shelf pins under each shelf, at any height: three shelves on the left, one on the right.", kind: "shelves", tools: ["screwdriver"], pose: "+y", el: 0.1 }, () => {
    // each holder upright (twist), its screw through the bottom of its U, behind the rail's end: the faces either side of
    // the rail's column, each as [part, face x, the way into it]
    const holders: [string, number, number][] = railLeft ? [[side1, -582, -1], [div, -8, 1]] : [[div, 8, -1], [side2, 582, 1]];
    for (const [k, x, d] of holders) fit(Q, k, [[x, RAIL_HY, -15]], [d, 0, 0], { twist: d < 0 ? Math.PI : 0 });
    for (const [k, x, d] of holders) fit(N, k, [[x - d * 2, RAIL_HY - 10, -15]], [d, 0, 0], { hole: false });
    put([rail], [0, -150, 250]);
    const pins: FitOpts[] = [];
    for (const k of shelves) {
      const y = b.partItem(k).final.pos[1] - T / 2 - 3; // the support's ledge (twist turns it up) under the shelf
      const [xa, xb, ka, kb] = b.partItem(k).final.pos[0] < 0 ? [-582, -8, side1, div] : [8, 582, div, side2];
      const zs = (k: string) => (k === div ? PIN_Z2 : PIN_Z);
      for (const j of [0, 1]) pins.push({ on: ka, at: [xa, y, zs(ka)[j]], dir: [-1, 0, 0], twist: Math.PI, hole: false }, { on: kb, at: [xb, y, zs(kb)[j]], dir: [1, 0, 0], hole: false });
    }
    b.fits(K, pins, 0.04);
    b.then(0.15);
    put(shelves, [0, 0, 400]);
  });


  drawerSteps(b, drawers);

  /* ---------- the doors: clip-on hinges, no handles ---------- */
  step({ title: "Screw 3 hinges to the short door", detail: "Lay it face down on a rug. Each hinge cup in its round hole, two screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z", warnings: ["floor"] }, () => hinge(door13, [865, 1374, 1883], -1, -562));
  // door 14 on its own (p. 38)
  step({ title: "Screw 4 hinges to the tall door", detail: "The same way.", kind: "hinges", tools: ["screwdriver"], scene: "door14", pose: "-z" }, () => hinge(door14, TALL_HINGE_Y, 1, 562));
  // p. 39: both hung open at about 90°, 13 swinging out to the left, 14 to the right
  step({ title: "Hang the doors and line them up", detail: "Short door on the left side, tall door on the right. Hold each door open at about 90° and clip each hinge onto its plate, then turn the hinge screws to move each door up and down, in and out, and sideways until the gaps are even.", kind: "doors", tools: ["screwdriver"], pose: "+y" }, () => {
    b.stagger(0.25);
    hang(door13, -1);
    hang(door14, 1);
    b.then(0.12);
  });
  step({ title: "Keep to the weight limits", detail: "Shut the doors. Top 40 kg. Rail 11 kg. Each loose shelf 10 kg. Fixed shelf and bottom 20 kg each. Each drawer 5 kg.", kind: "general", pose: "+y" }, () => close([door13, door14]));
}

/**
 * 180x200, 3 doors (3670617/18/19/65), its own 50-page manual. Two dividers (21L, 3R, each faced with a stile)
 * make three 578 mm columns: tall doors (14) on the outer two, the drawers in the middle under the fixed shelf (8),
 * between two runner panels (4) that carry both sets of cabinet runners, the short door (13) above them. Its fittings
 * have their own letters (D connector screws, E cam locks, F cam bolts, L the small screws), named here by what they
 * are. The manual offers three inside layouts (pp. 33 to 36) and two ways for the short door (p. 44), all here
 * (Plan.layouts), each built as the manual's first by default: layout A, and door L (hinged on the left divider, its
 * strip 23 screwed there); R hangs it on the right divider, the strip there instead.
 */
function build180(b: PlanBuilder) {
  /* ---------- parts, in mm, the manual's numbers as labels ---------- */
  const side1 = b.place(b.part("Left side", [T, 1980, 564], { label: "1L" }), [-892, 995, -5]);
  const side2 = b.place(b.part("Right side", [T, 1980, 564], { label: "2R" }), [892, 995, -5]);
  const divR = b.place(b.part("Divider", [T, 1876, 544], { label: "3R" }), [297, 1047, -15]);
  const divL = b.place(b.part("Divider", [T, 1876, 544], { label: "21L" }), [-297, 1047, -15]);
  const p4T = b.part("Runner panel", [T, 681, 544], { label: "4" });
  const p4 = [-281, 281].map((x) => b.place(p4T, [x, 449.5, -15])); // left (CL), right (CR)
  const top = b.place(b.part("Top", [1800, T, 581], { label: "5" }), [0, 1993, 3.5]);
  const bot = b.place(b.part("Bottom", [1766, T, 561], { label: "6" }), [0, 101, -6.5]);
  const shT = b.part("Shelf", [578, T, 498], { label: "7" });
  // on pins in the 32 mm system's holes, as the picked layout has them
  // A (p. 34, the first): four shelves on the right, B (p. 35) on the left, in holes 2, 8, 14 and 20 of the rows; C
  // (p. 36): two over the drawers and one low in each side column
  const lay = b.pick(LAYOUTS_180);
  const side = (x: number): [number, number][] => [2, 8, 14, 20].map((k) => [x, PIN_Y()[k] + 11]);
  const shelfAt: [number, number][] = lay === "A" ? side(594.5) : lay === "B" ? side(-594.5) : [[0, 1178], [0, 1626], [-594.5, 602], [594.5, 602]];
  const shelves = shelfAt.map(([x, y]) => b.place(shT, [x, y, -38]));
  const fixed = b.place(b.part("Fixed shelf", [578, T, 544], { label: "8" }), [0, 798, -15]);
  const lip = b.place(b.part("Front rail", [546, 70, T], { label: "9" }), [0, 771, 265]);
  const railT = b.part("Drawer rail", [546, 32, 70], { label: "10" });
  const rails = RAIL_Y.map((y) => b.place(railT, [0, y, 237]));
  // the stiles' inner edges are flush with the runner panels and the hinge strip (x = ±273), not centred on the dividers
  const stileR = b.place(b.part("Front stile", [70, 1876, T], { label: "11R" }), [308, 1047, 265]);
  const stileL = b.place(b.part("Front stile", [70, 1876, T], { label: "22L" }), [-308, 1047, 265]);
  const plinth = b.place(b.part("Plinth", [1766, 88, T], { label: "12" }), [0, 49, 246]);
  const door13 = b.place(b.part("Short door", [582, 1218, T], { label: "13" }), [0, 1374, 286]);
  const tallT = b.part("Tall door", [582, 1890, T], { label: "14" });
  const doors14 = [-586, 586].map((x) => b.place(tallT, [x, 1038, 286]));
  const drawers = drawerParts(b, 0, 0);
  const bkT = b.part("Back panel", [594, 1900, 3], { label: "20", material: "fiber" });
  const backs = [-594, 0, 594].map((x) => b.place(bkT, [x, 1043, -288.5]));
  // the short door's hinge side (p. 44): -1 L, on the left divider; 1 R, on the right. Door 13 is drilled on one long
  // edge only (p. 15), its cups level about its middle, so for R it is the same panel turned round
  const dsg = b.pick(DOOR_180) === "R" ? 1 : -1;
  const strip = b.place(b.part("Hinge strip", [T, 1178, 44], { label: "23" }), [dsg * 281, 1395, 235]);
  const rodT = b.part("Clothes rail", [22, 572, 15], { label: "24", shape: "cyl", material: "metal" });
  // the two rails, in the columns without shelves (C: the side columns)
  const rodX = lay === "A" ? [-594.5, 0] : lay === "B" ? [0, 594.5] : [-594.5, 594.5];
  const rods = rodX.map((x) => b.place(rodT, [x, RAIL_HY - 13, -15], [0, 0, Math.PI / 2]));
  // pp. 14 and 16: full rows on both sides' inside faces and both faces of each divider, all at the dividers' depths
  for (const [k, x, d] of [[side1, -884, 1], [divL, -305, -1], [divL, -289, 1], [divR, 289, -1], [divR, 305, 1], [side2, 884, -1]] as const) railHoles(b, k, x, [d, 0, 0]);
  pinRows(b, side1, -884, [1, 0, 0], PIN_Z2);
  pinRows(b, side2, 884, [-1, 0, 0], PIN_Z2);
  for (const [k, x] of [[divL, -297], [divR, 297]] as const) for (const g of [-1, 1]) pinRows(b, k, x + g * 8, [g, 0, 0], PIN_Z2);
  for (const k of shelves) shelfHoles(b, k, 578);

  const { step, fit, show, put, hinge, hang, close } = kit(b);
  const divs: [string, number][] = [
    [divL, -297],
    [divR, 297],
  ];

  /* ---------- the middle: fixed shelf, dividers, drawer unit, lying on its back ---------- */
  step({ title: "Tap 8 dowels into the fixed shelf", detail: "Three into each end, two into the front edge. Use the hammer gently. In the front edge, use the two holes that don't open into the big round holes in the face: those are for the front rail's cam bolts.", kind: "dowels", tools: ["hammer"], scene: "s1", pose: "-y", turn: Math.PI, warnings: ["floor"] }, () => {
    // p. 17: underside up, its two cam lock holes behind the front edge showing
    show(fixed, [0, -150, 0]);
    // the dividers' faces aren't drawn where these go: spaced as the 120's shelf's dowels into its side
    for (const [div, x] of divs) fit(A, fixed, FIX_DZ.map((z): Vec3 => [Math.sign(x) * 289, 798, z]), [-Math.sign(x), 0, 0], { mate: div });
    // into the front rail's back, 49 mm in from its ends
    fit(A, fixed, [-224, 224].map((x): Vec3 => [x, 798, 257]), [0, 0, -1], { mate: lip });
  });
  const divDowels = (div: string, x: number, stile: string) => {
    fit(A, div, STILE_DY.map((y): Vec3 => [x, y, 257]), [0, 0, -1], { mate: stile });
    fit(A, div, TOP_DZ.map((z): Vec3 => [x, 1985, z]), [0, -1, 0], { mate: top });
    fit(A, div, TOP_DZ.map((z): Vec3 => [x, 109, z]), [0, 1, 0], { mate: bot });
  };
  step({ title: "Tap 7 dowels into the right divider (3R)", detail: "Three into its front edge for the stile, two into each end.", kind: "dowels", tools: ["hammer"], scene: "s2", pose: "-x" }, () => {
    show(divR, [0, 150, 0]);
    divDowels(divR, 297, stileR);
  });
  step({ title: "Screw the fixed shelf to the right divider", detail: "Lay the divider on its back edge. Push the shelf onto its dowels and drive two connector screws through the divider with the Allen key, heads flush.", kind: "bolts", tools: ["allen"] }, () => {
    put([divR], [0, 0, 300]);
    put([fixed], [-300, 0, 0]);
    fit(E, divR, FIX_BZ.map((z): Vec3 => [305, 798, z]), [-1, 0, 0], { mate: fixed });
  });
  step({ title: "Tap 7 dowels into the left divider (21L)", detail: "The same: three into its front edge, two into each end.", kind: "dowels", tools: ["hammer"], scene: "s4", pose: "-x" }, () => {
    show(divL, [0, 150, 0]);
    divDowels(divL, -297, stileL);
  });
  step({ title: "Screw the left divider to the fixed shelf", detail: "Onto the shelf's other end, two connector screws.", kind: "bolts", tools: ["allen"], turn: Math.PI }, () => {
    put([divL], [-300, 0, 0]);
    fit(E, divL, FIX_BZ.map((z): Vec3 => [-305, 798, z]), [1, 0, 0], { mate: fixed });
  });
  const prepPanel = (i: number) => {
    const sx = i ? 1 : -1; // -1 the left panel, its runners on its right face
    const face = sx * 273;
    show(p4[i], [0, 150, 0]);
    fit(A, p4[i], P4_DZ.map((z): Vec3 => [sx * 281, 790, z]), [0, -1, 0], { mate: fixed });
    fit(A, p4[i], P4_DZ.map((z): Vec3 => [sx * 281, 109, z]), [0, 1, 0], { mate: bot });
    fit(A, p4[i], P4_FY.map((y): Vec3 => [sx * 281, y, 257]), [0, 0, -1], { mate: i ? stileR : stileL });
    fit(i ? CR : CL, p4[i], drawers.map((d): Vec3 => [face, runY(d.fy), RUN_Z]), [sx, 0, 0], { hole: false });
    pilots(b, p4[i], drawers.flatMap((d) => runScrews(face, runY(d.fy))), [-sx, 0, 0], 1.75);
    fit(C, p4[i], drawers.flatMap((d) => runScrews(face - sx * RUNNER.body, runY(d.fy))), [sx, 0, 0], { hole: false });
    for (const [r, y] of RAIL_Y.entries()) fit(G, p4[i], [[face, y - 8, RAIL_BZ]], [sx, 0, 0], { mate: rails[r] });
  };
  step({ title: "Fit the runners, dowels and cam bolts to the left panel 4", detail: "Three left-hand cabinet runners (CL), four 13 mm screws each. Two dowels in each end and two in the front edge, and two cam bolts for the drawer rails near the front edge, screwed in straight.", kind: "runners", tools: ["hammer", "screwdriver"], scene: "s6", pose: "+x" }, () => prepPanel(0));
  step({ title: "The same for the right panel 4", detail: "Three right-hand cabinet runners (CR), four 13 mm screws each, six dowels and two cam bolts.", kind: "runners", tools: ["hammer", "screwdriver"], scene: "s7", pose: "-x" }, () => prepPanel(1));
  step({ title: "Tap a dowel into each end of the drawer rails", detail: "Four dowels for the two thick rails (10).", kind: "dowels", tools: ["hammer"], scene: "s8", pose: "-y" }, () => {
    // underside up, a cam lock hole near each end (p. 20)
    for (const k of rails) show(k, [0, -150, 0]);
    for (const [i, k] of rails.entries()) {
      fit(A, k, [[-273, RAIL_JY[i], RAIL_DZ]], [1, 0, 0], { mate: p4[0] });
      fit(A, k, [[273, RAIL_JY[i], RAIL_DZ]], [-1, 0, 0], { mate: p4[1] });
    }
  });
  // lying on its back, as the manual draws it, so the rails' undersides and their cam locks face you
  step({ title: "Lock the drawer rails between the two panels", detail: "Push the panels onto the rails' dowels and cam bolts, the rails flush with the panels' front edges. Then one cam lock from underneath into each end of each rail.", kind: "cams", tools: ["flathead"], scene: "s9", pose: "+z" }, () => {
    for (const k of rails) show(k);
    show(p4[0], [-200, 0, 0]);
    show(p4[1], [200, 0, 0]);
    // 35 mm in from each end, 27 from the front
    for (const [i, k] of rails.entries()) fit(F, k, [-238, 238].map((x): Vec3 => [x, RAIL_Y[i] - 16, 245]), [0, 1, 0]);
  });
  step({ title: "Push the drawer unit in under the fixed shelf", detail: "Between the two dividers, the panels' dowels into the shelf. Check the runners' wheel ends are at the front, by the panels' front edges.", kind: "join" }, () => put([...p4, ...rails], [0, -300, 0]));
  step({ title: "Screw 2 cam bolts into the front rail (9)", detail: "Into its back face.", kind: "cams", tools: ["screwdriver"], scene: "s11", pose: "-z" }, () => {
    show(lip, [0, 0, -150]);
    // 113 mm in from each end
    fit(G, lip, [-160, 160].map((x): Vec3 => [x, 798, 257]), [0, 0, 1], { mate: fixed });
  });
  step({ title: "Fit the front rail and lock it", detail: "Lay it on the front edge of the fixed shelf, flush with the top. Two cam locks in the shelf's underside.", kind: "cams", tools: ["flathead"], turn: -2 * STEP_CAM.az }, () => {
    put([lip], [0, 0, 250]);
    fit(F, fixed, [-160, 160].map((x): Vec3 => [x, 790, 223]), [0, 1, 0]);
    // the second one is under the rail's overhang: a circle of its own (p. 22 draws both)
    b.look(fixed, [160, 790, 223], { dir: [0, 1, 0], size: 30 });
  });
  step({ title: "Prepare the two front stiles", detail: "Two dowels in each end of both stiles (22L and 11R) and three cam bolts in the back of each.", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s13", pose: "-z" }, () => {
    for (const [stile, x, div] of [[stileL, -297, divL], [stileR, 297, divR]] as const) {
      show(stile, [0, 0, -150]);
      const sc = x + Math.sign(x) * 11; // the stile's centre
      fit(A, stile, [sc - 17, sc + 17].map((xx): Vec3 => [xx, 109, 265]), [0, 1, 0], { mate: bot });
      fit(A, stile, [sc - 17, sc + 17].map((xx): Vec3 => [xx, 1985, 265]), [0, -1, 0], { mate: top });
      fit(G, stile, STILE_BY.map((y): Vec3 => [x, y, 257]), [0, 0, 1], { mate: div });
    }
  });
  step({ title: "Fit the stiles and lock them", detail: "On the dividers' front edges and the dowels in the panels' front edges, flush with the drawer unit. Three cam locks in each divider, in its face towards the side column.", kind: "cams", tools: ["flathead"] }, () => {
    put([stileL, stileR], [0, 0, 300]);
    // the dividers' cam locks are in their outer faces (both drawn on pages 14), 35 mm in from the front
    for (const [div, x] of divs) fit(F, div, STILE_BY.map((y): Vec3 => [x + Math.sign(x) * 8, y, 222]), [-Math.sign(x), 0, 0]);
  });
  step({ title: "Tap dowels into the bottom and the plinth", detail: "Three in each end of the bottom (6), two in each end of the plinth (12). Knock two glides into the plinth's bottom edge, 590 mm from each end, centred.", kind: "dowels", tools: ["hammer", "tape"], scene: "s15", pose: "-y" }, () => {
    // p. 24: the bottom underside up, its cam lock holes showing; the plinth flat beyond it, its bottom edge (the glides') towards you
    show(bot, [0, -150, 0]);
    b.stage(plinth, [0, 101, 450], [Math.PI / 2, 0, 0], [0, -150, 0]);
    b.then(0.12);
    for (const sx of [-1, 1]) {
      fit(A, bot, BOT_DZ.map((z): Vec3 => [sx * 883, 101, z]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
      fit(A, plinth, [37, 69].map((y): Vec3 => [sx * 883, y, 246]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
    }
    fit(J, plinth, [-293, 293].map((x): Vec3 => [x, 5, 246]), [0, 1, 0]);
  });
  step({ title: "Screw the plinth to the bottom", detail: "Under the front edge of the bottom, onto its dowels. Two connector screws down through the bottom.", kind: "bolts", tools: ["allen"], scene: "s15", pose: "+y" }, () => {
    show(plinth);
    fit(E, bot, [-249, 249].map((x): Vec3 => [x, 109, 246]), [0, -1, 0], { mate: plinth });
  });
  step({ title: "Fit the bottom to both dividers", detail: "Onto the dowels of the dividers, the stiles and both panels 4. Four connector screws, two into each divider.", kind: "bolts", tools: ["allen"] }, () => {
    put([bot, plinth], [0, -300, 0]);
    for (const [div, x] of divs) fit(E, bot, BOT_BZ.map((z): Vec3 => [x, 93, z]), [0, 1, 0], { mate: div });
  });

  /* ---------- the sides and the top ---------- */
  step({ title: "Screw 2 cam bolts into the left side", detail: "Into the inside face, low down, for the bottom.", kind: "cams", tools: ["screwdriver"], scene: "s18", pose: "+x" }, () => {
    show(side1, [0, 150, 0]);
    fit(G, side1, BOT_BZ.map((z): Vec3 => [-884, 101, z]), [-1, 0, 0], { mate: bot });
  });
  step({ title: "Add 2 dowels and 2 glides to the left side", detail: "Dowels into the top edge, near the front and back edges. Glides into the bottom edge, 50 mm from each end, centred on the edge.", kind: "dowels", tools: ["hammer", "tape"], scene: "s18", pose: "+x" }, () => {
    fit(A, side1, TOP_DZ.map((z): Vec3 => [-892, 1985, z]), [0, -1, 0], { mate: top });
    fit(J, side1, [-237, 227].map((z): Vec3 => [-892, 5, z]), [0, 1, 0]);
  });
  step({ title: "Fit the left side and lock it", detail: "Onto the dowels of the bottom and plinth. Two cam locks in the bottom's underside.", kind: "cams", tools: ["screwdriver"], people: 2 }, () => {
    put([side1], [-400, 0, 0]);
    fit(F, bot, BOT_BZ.map((z): Vec3 => [-849, 93, z]), [0, 1, 0]);
  });
  step({ title: "Prepare the right side", detail: "Two dowels into the top edge, two cam bolts into the inside face for the bottom, and two glides into the bottom edge, 50 mm from each end.", kind: "dowels", tools: ["hammer", "screwdriver", "tape"], scene: "s21", pose: "-x", turn: Math.PI }, () => {
    show(side2, [0, 150, 0]);
    fit(A, side2, TOP_DZ.map((z): Vec3 => [892, 1985, z]), [0, -1, 0], { mate: top });
    fit(G, side2, BOT_BZ.map((z): Vec3 => [884, 101, z]), [1, 0, 0], { mate: bot });
    fit(J, side2, [-237, 227].map((z): Vec3 => [892, 5, z]), [0, 1, 0]);
  });
  step({ title: "Fit the right side and lock it", detail: "Onto the dowels of the bottom and plinth. Two cam locks in the bottom's underside.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([side2], [400, 0, 0]);
    fit(F, bot, BOT_BZ.map((z): Vec3 => [849, 93, z]), [0, 1, 0]);
  });
  const uprights: [string, number][] = [[side1, -892], [divL, -297], [divR, 297], [side2, 892]];
  step({ title: "Screw 8 cam bolts into the top", detail: "Into the underside: two over each side and each divider.", kind: "cams", tools: ["screwdriver"], scene: "s23", pose: "-y" }, () => {
    show(top, [0, -150, 0]);
    b.fits(G, uprights.flatMap(([mate, x]) => TOP_BZ.map((z) => ({ on: top, at: [x, 1985, z] as Vec3, dir: [0, 1, 0] as Vec3, mate }))), 0.06);
  });
  step({ title: "Screw the anti-tip brackets to the top", detail: "Two brackets on the top face along the back edge, two 16 mm screws each (not the 30 mm ones). Stop at about 80%: they are tightened fully once it is against the wall.", kind: "screws", tools: ["screwdriver"], scene: "s23", pose: "+y" }, () => {
    // about 250 mm in from each end, as pp. 28, 30 and 31 draw them (the top isn't drilled for them)
    b.brackets(S, N, [-645, 645].map((x): FitOpts => ({ on: top, at: [x, 2001, -274], dir: [0, -1, 0], travel: 60, wall: true })));
  });
  step({ title: "Fit the top and lock it", detail: "Onto the dowels of both sides, both dividers and both stiles. Eight cam locks: two in each side's inside face and in each divider's face towards the side column.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([top], [0, 400, 0]);
    // 35 mm down: in the sides' inside faces, and in the dividers' outer faces, as their drilling (page 14) has them
    for (const [k, x] of uprights) {
      const out = Math.abs(x) < 500 ? 1 : -1;
      fit(F, k, TOP_BZ.map((z): Vec3 => [x + out * Math.sign(x) * 8, 1950, z]), [-out * Math.sign(x), 0, 0]);
    }
  });

  /* ---------- standing: the back, the wall ---------- */
  step({ title: "Stand it up and mark the lines", detail: "Two of you: it is over 2 m tall, so check the room is higher than 215 cm before tipping it up. Lay the two outer back panels on, pushed up to the top and out to the sides, and mark the fixed shelf's height on each one's inner edge.", kind: "standup", tools: ["pencil"], pose: "+y", turn: Math.PI, people: 2, warnings: ["two"] }, () => {
    // p. 30: the middle column stays open; a short mark on each outer panel by its divider, level with the fixed shelf
    put([backs[0], backs[2]], [0, 0, -300]);
    b.pencil(backs[0], [-335, 798, -290.2], [-299, 798, -290.2]);
    b.pencil(backs[2], [299, 798, -290.2], [335, 798, -290.2]);
  });
  step({ title: "Nail on the back", detail: "Lay the middle panel on and draw the fixed shelf's line across it between your marks with a level. Measure both diagonals: when they match it is square. Nail round the edges, along your lines into the dividers and the fixed shelf, the twelve joining plates over the two seams and the clip on the left edge. 55 nails in all. Drive each one straight in, square to the back, so it goes into the middle of the edge behind and doesn't come out the side.", kind: "nails", tools: ["hammer", "tape", "level", "pencil"], pose: "+y", turn: Math.PI, check: "square" }, () => {
    put([backs[1]], [0, 0, -300]);
    b.pencil(backs[1], [-285, 798, -290.2], [285, 798, -290.2]); // the fixed shelf's line, drawn with the level (p. 31)
    const z = -290;
    const on = (p: Vec3) => backs[p[0] < -297 ? 0 : p[0] > 297 ? 2 : 1];
    const nails = (pts: Vec3[]) => {
      b.fits(H, pts.map((at) => ({ on: on(at), at, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.03);
      b.then(0.1);
    };
    const plates = [-297, 297].flatMap((x) => line([x, 200, z], [x, 1850, z], 6));
    const clip: Vec3 = [-892, 1000, z];
    nails([
      ...line([-892, 150, z], [-892, 1940, z], 8),
      ...line([892, 150, z], [892, 1940, z], 8),
      ...line([-850, 1989, z], [850, 1989, z], 6),
      ...line([-850, 101, z], [850, 101, z], 6),
      ...[-297, 297].flatMap((x) => [365, 695, 1025, 1355].map((y): Vec3 => [x, y, z])),
      ...line([-270, 798, z], [270, 798, z], 6),
    ]);
    fit(R, undefined, plates, [0, 0, 1], { hole: false });
    // its channel out past the left side (twist turns it from up to -x), the nail through the boss's top
    fit(M, backs[0], [clip], [0, 0, 1], { hole: false, twist: Math.PI / 2 });
    nails([...plates, add(clip, [0, 0, -CLIP_BOSS])]);
  });
  step({ title: "Fix it to the wall", detail: "Push it against the wall, mark through both brackets, drill, plug and screw them to the wall, then tighten the screws in the top fully. Use a step ladder to reach the brackets. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    fit(HW.plug, undefined, [-645, 645].map((x): Vec3 => [x, WALL_Y, -290]), [0, 0, -1]);
    fit(HW.wallScrew, undefined, [-645, 645].map((x): Vec3 => [x, WALL_Y, -288]), [0, 0, -1]);
  });

  /* ---------- inside: the picked layout ---------- */
  b.layouts(LAYOUTS_180);
  step({ title: "Choose the layout", detail: "The manual gives three: pick one. A: rails on the left and over the drawers, four shelves on the right. B: four shelves on the left, rails over the drawers and on the right. C: rails on both sides, two shelves over the drawers and one low shelf in each side column.", kind: "general", pose: "+y", el: 0.1 }, () => b.ghost([...rods, ...shelves]));
  const railText: Record<string, string> = { A: "in the left column and over the drawers", B: "over the drawers and in the right column", C: "in both side columns" };
  const shelfText: Record<string, string> = { A: "all four on the right", B: "all four on the left", C: "two over the drawers and one low on each side" };
  step({ title: "Fit the two rails and the four shelves", detail: `Screw the four rail holders in at the top, ${railText[lay]}, one screw each, and drop the rails in. Then four shelf pins under each shelf, at any height: ${shelfText[lay]}.`, kind: "shelves", tools: ["screwdriver"], pose: "+y", el: 0.1 }, () => { // low, so both rails show under the top (p. 36)
    // each column, by its middle: the faces either side of it, as [part, face x, the way into it]
    const column = (x: number): [[string, number, number], [string, number, number]] =>
      x < -100 ? [[side1, -884, -1], [divL, -305, 1]] : x > 100 ? [[divR, 305, -1], [side2, 884, 1]] : [[divL, -289, -1], [divR, 289, 1]];
    // each rail between the two faces of its column; each holder upright (twist), its screw through the bottom of its U
    const holders = rodX.flatMap(column);
    for (const [k, x, d] of holders) fit(Q, k, [[x, RAIL_HY, -15]], [d, 0, 0], { twist: d < 0 ? Math.PI : 0 });
    for (const [k, x, d] of holders) fit(N, k, [[x - d * 2, RAIL_HY - 10, -15]], [d, 0, 0], { hole: false });
    put(rods, [0, -150, 250]);
    const pins: FitOpts[] = [];
    // C: the low side shelves' pins first: the pins' circle then points at the right column, clear of the others on a phone
    for (const i of lay === "C" ? [3, 2, 0, 1] : [0, 1, 2, 3]) {
      const y = b.partItem(shelves[i]).final.pos[1] - T / 2 - 3; // the support's ledge (twist turns it up) under the shelf
      const [[ka, xa], [kb, xb]] = column(b.partItem(shelves[i]).final.pos[0]);
      for (const z of PIN_Z2) pins.push({ on: ka, at: [xa, y, z], dir: [-1, 0, 0], twist: Math.PI, hole: false }, { on: kb, at: [xb, y, z], dir: [1, 0, 0], hole: false });
    }
    b.fits(K, pins, 0.04);
    b.then(0.15);
    put(shelves, [0, 0, 400]);
  });

  drawerSteps(b, drawers);

  /* ---------- the doors: clip-on hinges, no handles; the short door hinged on either divider (p. 44) ---------- */
  step({ title: "Screw 3 hinges to the short door", detail: "Lay it face down on a rug. Each hinge cup in its round hole, two screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z", warnings: ["floor"] }, () => hinge(door13, [865, 1374, 1883], dsg, dsg * 269));
  step({ title: "Screw 4 hinges to each tall door", detail: "The same way: eight hinges for the two doors (14).", kind: "hinges", tools: ["screwdriver"], scene: "doors14", pose: "-z" }, () => {
    hinge(doors14[0], TALL_HINGE_Y, -1, -855);
    hinge(doors14[1], TALL_HINGE_Y, 1, 855);
  });
  step({ title: "Hang the two tall doors", detail: "One on the left side, one on the right. Hold each door open at about 90° and clip each hinge onto its plate, then turn the hinge screws until the gaps are even.", kind: "doors", tools: ["screwdriver"], pose: "+y", people: 2, warnings: ["two"] }, () => {
    // p. 43: hung open, swinging out to each side
    b.stagger(0.25);
    hang(doors14[0], -1);
    hang(doors14[1], 1);
    b.then(0.12);
  });
  const dside = dsg < 0 ? "left" : "right";
  // R: the short door's steps seen from the left instead, the strip's face and the door's hinges towards you as for L
  const dturn = dsg > 0 ? -2 * STEP_CAM.az : 0;
  b.layouts(DOOR_180);
  step({ title: "Choose which way the short door opens", detail: "The manual gives two: pick one. L: hinged on the left divider, opening to the left. R: hinged on the right divider, opening to the right. The hinge strip goes on that divider.", kind: "general", pose: "+y", el: 0.1, turn: dturn }, () => b.ghost([strip]));
  step({ title: `Screw the hinge strip to the ${dside} divider`, detail: "Inside the middle column, above the fixed shelf, against the stile. Five 30 mm screws through the strip (not the 16 mm ones). The strip has a top: the end with the single screw hole goes down, just above the bottom hinge plate; at the top and middle plates a screw goes either side.", kind: "screws", tools: ["screwdriver"], pose: "+y", turn: dturn }, () => {
    put([strip], [-dsg * 150, 0, 0]);
    // pp. 45 and 47 draw the strip alike: a screw either side of the top and middle hinge plates (48 mm off), one just above the bottom one
    fit(M4, strip, [1931, 1835, 1422, 1326, 913].map((y): Vec3 => [dsg * 273, y, 235]), [dsg, 0, 0]);
  });
  step({ title: "Hang the short door and line it up", detail: `Hold it open at about 90° to the ${dside} and clip its hinges onto the plates on the strip, then turn the hinge screws until the gaps are even.`, kind: "doors", tools: ["screwdriver"], pose: "+y", turn: dturn }, () => hang(door13, dsg));
  step({ title: "Keep to the weight limits", detail: "Shut the doors. Top 40 kg. Each rail 11 kg. Each loose shelf 10 kg. Fixed shelf and the bottom of each side column 20 kg. Each drawer 5 kg.", kind: "general", pose: "+y" }, () => close([...doors14, door13]));
}

const family: Family = {
  names: ["LIMFJORDEN"],
  build(b, s: ProductSpec) {
    // the chest shares the name (and is a "drawers" kind); other sizes would need their own manual
    if (s.archetype !== "cabinet" || s.cabinet?.drawers !== 3 || Math.round(s.size.h) !== 200) return false;
    const sized = ({ 120: build120, 180: build180 } as Record<number, (b: PlanBuilder) => void>)[Math.round(s.size.w)];
    sized?.(b);
    return !!sized;
  },
};
export default family;

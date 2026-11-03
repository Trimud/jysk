import type { ProductSpec, StepKind, ToolId, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import { add, mul, sub } from "../math";
import type { Family } from "./family";

/**
 * JYSK LIMFJORDEN wardrobe 120x200, 2 doors 3 drawers (3670614/15/16/64), read from its 41-page manual.
 * A divider (3R, faced with the stile 11R) splits it into two 573 mm columns: on the left three drawers under a
 * fixed shelf (8), a short door (13) above; on the right a full-height door (14). No handles. The carcass is built
 * lying on its back: the fixed shelf onto the divider, the runner panel (4), the front rail and stile, the bottom
 * with its plinth, the drawer rails, then the sides and the top, all on cam locks. It is stood up, the two
 * hardboard backs nailed on and it is fixed to the wall. The manual offers two layouts for the rail and the four
 * loose shelves; this guide follows layout B, as JYSK's photos show it: three shelves above the drawers, the rail
 * and one shelf on the right. The drawers are put together, slid in, and the doors hung on clip-on hinges.
 */

const T = 16;
// the manual's fittings, by its letters
const A: HwDef = { kind: "dowel", len: 35, dia: 8 };
const B: HwDef = HW.hinge;
const C: HwDef = { kind: "screw", len: 13, dia: 5 };
const D: HwDef = { kind: "screw", len: 16, dia: 5 };
const E: HwDef = { kind: "bolt", len: 50, dia: 7, name: "Connector screw", flush: true };
const F: HwDef = { kind: "cam", len: 12, dia: 15 };
const G: HwDef = { kind: "camScrew", len: 34, dia: 6 };
const H: HwDef = { kind: "nail", len: 25, dia: 1.4 };
const J: HwDef = { kind: "glide", len: 4, dia: 15, name: "Nail-in glide" };
const K: HwDef = { kind: "pin", len: 10, dia: 5 };
const L: HwDef = { kind: "washer", len: 4, dia: 20, name: "Runner spacer" };
const M: HwDef = { kind: "clip", len: 19, dia: 33 };
const N: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const Q: HwDef = { kind: "hook", len: 19, dia: 33, name: "Rail holder" };
const R: HwDef = { kind: "plate", len: 3, dia: 22, name: "Joining plate" };
const S: HwDef = { kind: "bracket", len: 78, dia: 32, name: "Anti-tip bracket" };
const run = (name: string): HwDef => ({ kind: "runner", len: 500, dia: 20, name });
const CL = run("Cabinet runner, left"), CR = run("Cabinet runner, right"), DL = run("Drawer runner, left"), DR = run("Drawer runner, right");

/** n points evenly along a line, ends included when n > 1 */
const line = (a: Vec3, b: Vec3, n: number): Vec3[] => Array.from({ length: n }, (_, i) => add(a, mul(sub(b, a), n === 1 ? 0.5 : i / (n - 1))));

function build(b: PlanBuilder, s: ProductSpec): boolean {
  // the chest shares the name (and is a "drawers" kind); other sizes would need their own manual
  if (s.archetype !== "cabinet" || s.cabinet?.drawers !== 3 || Math.round(s.size.w) !== 120 || Math.round(s.size.h) !== 200) return false;

  /* ---------- parts, in mm: x left to right, y up, z back to front; the manual's numbers as labels ---------- */
  const side1 = b.place(b.part("Left side", [T, 1980, 564], { label: "1L" }), [-590, 995, -5]);
  const side2 = b.place(b.part("Right side", [T, 1980, 564], { label: "2R" }), [590, 995, -5]);
  const div = b.place(b.part("Divider", [T, 1876, 544], { label: "3R" }), [0, 1047, -15]);
  const p4 = b.place(b.part("Runner panel", [T, 681, 544], { label: "4" }), [-24, 449.5, -15]);
  const top = b.place(b.part("Top", [1196, T, 581], { label: "5" }), [0, 1993, 3.5]);
  const bot = b.place(b.part("Bottom", [1162, T, 561], { label: "6" }), [0, 101, -6.5]);
  const shT = b.part("Shelf", [573, T, 498], { label: "7" });
  const shelves = [
    ...[1109, 1404, 1699].map((y) => b.place(shT, [-294.5, y, -38])),
    b.place(shT, [294.5, 798, -38]),
  ];
  const fixed = b.place(b.part("Fixed shelf", [573, T, 544], { label: "8" }), [-294.5, 798, -15]);
  const lip = b.place(b.part("Front rail", [550, 70, T], { label: "9" }), [-307, 771, 264]);
  const railT = b.part("Drawer rail", [550, 32, 70], { label: "10" });
  const railY = [307.5, 531.5]; // the two drawer rails (10), 32 mm tall
  const rails = railY.map((y) => b.place(railT, [-307, y, 237]));
  const stile = b.place(b.part("Front stile", [70, 1876, T], { label: "11R" }), [0, 1047, 265]);
  const plinth = b.place(b.part("Plinth", [1162, 88, T], { label: "12" }), [0, 49, 246]);
  const door13 = b.place(b.part("Short door", [582, 1218, T], { label: "13" }), [-293, 1374, 286]);
  const door14 = b.place(b.part("Tall door", [582, 1890, T], { label: "14" }), [293, 1038, 286]);
  const frT = b.part("Drawer front", [582, 205, T], { label: "15" });
  const slT = b.part("Drawer side", [T, 156, 500], { label: "16L" });
  const srT = b.part("Drawer side", [T, 156, 500], { label: "17R" });
  const dbT = b.part("Drawer back", [489, 154, T], { label: "18" });
  const btT = b.part("Drawer bottom", [498, 3, 498], { label: "19", material: "fiber" });
  const drawers = [93, 317, 541].map((fy) => ({
    fy,
    front: b.place(frT, [-293, fy + 102.5, 286]),
    l: b.place(slT, [-559.5, fy + 103, 27]),
    r: b.place(srT, [-54.5, fy + 103, 27]),
    back: b.place(dbT, [-307, fy + 103, -215]),
    bottom: b.place(btT, [-307, fy + 31.5, 28]),
  }));
  const bkT = b.part("Back panel", [590, 1900, 3], { label: "20", material: "fiber" });
  const backs = [-295, 295].map((x) => b.place(bkT, [x, 1043, -288.5]));
  const rail = b.place(b.part("Clothes rail", [22, 567, 22], { label: "21", shape: "cyl", material: "metal" }), [294.5, 1925, -15], [0, 0, Math.PI / 2]);

  /* ---------- helpers ---------- */
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "+z", ...d }, body);
  // dowels and cam bolts given a `mate` are sunk by the builder so their ends stay inside the board they go into
  const fit = (def: HwDef, on: string | undefined, pts: Vec3[], dir: Vec3, o: Partial<FitOpts> = {}) => {
    b.fits(def, pts.map((at) => ({ on, at, dir, ...o })), 0.06);
    b.then(0.1);
  };
  /** Shows a loose part in a side scene: where it ends up, moved by `off`, arriving from `from`. */
  const show = (k: string, from?: Vec3, off: Vec3 = [0, 0, 0]) => {
    const f = b.partItem(k).final;
    b.stage(k, add(f.pos, off), f.rot, from);
    b.then(0.12);
  };
  /** Adds parts to the build, arriving from `from`. */
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  const runY = (fy: number) => fy + 35; // runners sit at the foot of each drawer's slot

  /* ---------- the carcass, lying on its back ---------- */
  step({ title: "Tap 5 dowels into the fixed shelf", detail: "Three into the end that meets the left side, two into the front edge. Use the hammer gently.", kind: "dowels", tools: ["hammer"], scene: "s1", pose: "+y", warnings: ["floor"] }, () => {
    show(fixed, [0, 150, 0]);
    fit(A, fixed, [-220, -15, 190].map((z): Vec3 => [-581, 798, z]), [1, 0, 0], { mate: side1 });
    fit(A, fixed, [-480, -130].map((x): Vec3 => [x, 798, 257]), [0, 0, -1], { mate: lip });
  });
  step({ title: "Tap 7 dowels into the divider", detail: "Three into its left face for the fixed shelf, two into each end.", kind: "dowels", tools: ["hammer"], scene: "s2", pose: "-x" }, () => {
    show(div, [0, 150, 0]);
    fit(A, div, [-220, -15, 190].map((z): Vec3 => [-8, 798, z]), [1, 0, 0], { mate: fixed });
    fit(A, div, [-200, 170].map((z): Vec3 => [0, 1985, z]), [0, -1, 0], { mate: top });
    fit(A, div, [-200, 170].map((z): Vec3 => [0, 109, z]), [0, 1, 0], { mate: bot });
  });
  step({ title: "Screw the fixed shelf to the divider", detail: "Lay the divider on its back edge. Push the shelf onto its dowels and drive two connector screws through the divider with the Allen key, heads flush.", kind: "bolts", tools: ["allen"] }, () => {
    put([div], [0, 0, 300]);
    put([fixed], [-300, 0, 0]);
    fit(E, div, [-120, 100].map((z): Vec3 => [8, 798, z]), [-1, 0, 0], { mate: fixed });
  });
  step({ title: "Fit the runners, dowels and cam bolts to panel 4", detail: "Three right-hand cabinet runners (CR), four short 13 mm screws each, not the 16 mm ones. Three dowels in each end and two cam bolts in the bottom end.", kind: "runners", tools: ["hammer", "screwdriver"], scene: "s4", pose: "-x" }, () => {
    show(p4, [0, 150, 0]);
    fit(A, p4, [-200, -15, 170].map((z): Vec3 => [-24, 790, z]), [0, -1, 0], { mate: fixed });
    fit(A, p4, [-200, -15, 170].map((z): Vec3 => [-24, 109, z]), [0, 1, 0], { mate: bot });
    fit(CR, p4, drawers.map((d): Vec3 => [-32, runY(d.fy), 20]), [1, 0, 0], { hole: false });
    fit(C, p4, drawers.flatMap((d) => [-210, -70, 70, 210].map((dz): Vec3 => [-44, runY(d.fy), 20 + dz])), [1, 0, 0], { hole: false });
    fit(G, p4, [-110, 80].map((z): Vec3 => [-24, 109, z]), [0, 1, 0], { mate: bot });
  });
  step({ title: "Fit panel 4 under the fixed shelf", detail: "Runners facing the left side. Push it onto the dowels, against the divider.", kind: "join" }, () => put([p4], [0, -300, 0]));
  step({ title: "Prepare the front stile and the front rail", detail: "Two dowels in each end of the long stile (11R) and three cam bolts in its back. Two cam bolts in the back of the short rail (9).", kind: "dowels", tools: ["hammer", "screwdriver"], scene: "s6", pose: "-z" }, () => {
    show(stile, [0, 0, -150]);
    show(lip, [0, 0, -150]);
    fit(A, stile, [-17, 17].map((x): Vec3 => [x, 109, 265]), [0, 1, 0], { mate: bot });
    fit(A, stile, [-17, 17].map((x): Vec3 => [x, 1985, 265]), [0, -1, 0], { mate: top });
    fit(G, stile, [400, 1050, 1700].map((y): Vec3 => [0, y, 257]), [0, 0, 1], { mate: div });
    fit(G, lip, [-507, -107].map((x): Vec3 => [x, 798, 256]), [0, 0, 1], { mate: fixed });
  });
  step({ title: "Fit the front rail and lock it", detail: "Lay it on the front edge of the fixed shelf, flush with the top. Two cam locks in the shelf, arrow towards the bolt, turned clockwise with the flat screwdriver.", kind: "cams", tools: ["flathead"] }, () => {
    put([lip], [0, 0, 250]);
    fit(F, fixed, [-507, -107].map((x): Vec3 => [x, 806, 226]), [0, -1, 0]);
  });
  step({ title: "Fit the front stile and lock it", detail: "Lay it on the divider's front edge, its bottom end flush with panel 4. Three cam locks in the divider.", kind: "cams", tools: ["flathead"] }, () => {
    put([stile], [0, 0, 300]);
    fit(F, div, [400, 1050, 1700].map((y): Vec3 => [8, y, 227]), [-1, 0, 0]);
  });
  step({ title: "Tap dowels into the bottom and the plinth", detail: "Three in each end of the bottom (6). Two in each end of the plinth (12) and two in its top edge. Knock a glide into the middle of the plinth's bottom edge, 581 mm from the end.", kind: "dowels", tools: ["hammer", "tape"], scene: "s9", pose: "+y" }, () => {
    show(bot, [0, 150, 0]);
    show(plinth, [0, 150, 0], [0, -150, 0]);
    for (const sx of [-1, 1]) {
      fit(A, bot, [-230, -6, 220].map((z): Vec3 => [sx * 581, 101, z]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
      fit(A, plinth, [25, 70].map((y): Vec3 => [sx * 581, y, 246]), [-sx, 0, 0], { mate: sx < 0 ? side1 : side2 });
    }
    fit(A, plinth, [-300, 300].map((x): Vec3 => [x, 93, 246]), [0, -1, 0], { mate: bot });
    fit(J, plinth, [[0, 5, 246]], [0, 1, 0]);
  });
  step({ title: "Screw the plinth to the bottom", detail: "Under the front edge of the bottom, onto its dowels. One connector screw down through the bottom into the plinth.", kind: "bolts", tools: ["allen"], scene: "s9", pose: "+y" }, () => {
    show(plinth);
    fit(E, bot, [[0, 109, 246]], [0, -1, 0], { mate: plinth });
  });
  step({ title: "Fit the bottom to the divider", detail: "Push it onto the dowels of the divider, the stile and panel 4. Two connector screws through the bottom into the divider.", kind: "bolts", tools: ["allen"] }, () => {
    put([bot, plinth], [0, -300, 0]);
    fit(E, bot, [-100, 80].map((z): Vec3 => [0, 93, z]), [0, 1, 0], { mate: div });
  });
  step({ title: "Tap a dowel into each end of the drawer rails", detail: "Four dowels for the two thick rails (10).", kind: "dowels", tools: ["hammer"], scene: "s12", pose: "+y" }, () => {
    for (const k of rails) show(k, [0, 150, 0]);
    for (const [i, k] of rails.entries()) {
      fit(A, k, [[-582, railY[i], 237]], [1, 0, 0], { mate: side1 });
      fit(A, k, [[-32, railY[i], 237]], [-1, 0, 0], { mate: p4 });
    }
  });
  step({ title: "Fit the drawer rails and lock panel 4", detail: "The rails go between the drawer runners, dowels into panel 4. Then two cam locks in the bottom lock panel 4's bolts.", kind: "cams", tools: ["flathead"] }, () => {
    put(rails, [0, 0, 300]);
    fit(F, bot, [-110, 80].map((z): Vec3 => [-55, 109, z]), [0, -1, 0]);
  });
  step({ title: "Screw the drawer runners to the left side", detail: "Three left-hand cabinet runners (CL), the longer 16 mm screws, each through a spacer washer: four per runner.", kind: "runners", tools: ["screwdriver"], scene: "s14", pose: "+x" }, () => {
    show(side1, [0, 150, 0]);
    fit(CL, side1, drawers.map((d): Vec3 => [-582, runY(d.fy), 20]), [-1, 0, 0], { hole: false });
    const pts = drawers.flatMap((d) => [-210, -70, 70, 210].map((dz): Vec3 => [-578, runY(d.fy), 20 + dz]));
    fit(L, side1, pts, [-1, 0, 0], { hole: false });
    fit(D, side1, pts.map((p): Vec3 => [-570, p[1], p[2]]), [-1, 0, 0], { hole: false });
  });
  step({ title: "Tap 2 dowels into the top of the left side", detail: "Into the top edge.", kind: "dowels", tools: ["hammer"], scene: "s14", pose: "+x" }, () => {
    fit(A, side1, [-200, 170].map((z): Vec3 => [-590, 1985, z]), [0, -1, 0], { mate: top });
  });
  step({ title: "Add 6 cam bolts and 2 glides to the left side", detail: "Cam bolts into the inside face for the bottom, the rails and the fixed shelf. Glides into the bottom edge, 50 mm from each end, centred on the edge.", kind: "cams", tools: ["screwdriver", "hammer", "tape"], scene: "s14", pose: "+x" }, () => {
    const at: [Vec3, string][] = [
      [[-582, 101, -120], bot],
      [[-582, 101, 120], bot],
      ...rails.map((k, i): [Vec3, string] => [[-582, railY[i], 237], k]),
      [[-582, 771, 264], lip],
      [[-582, 798, 90], fixed],
    ];
    b.fits(G, at.map(([p, mate]) => ({ on: side1, at: p, dir: [-1, 0, 0] as Vec3, mate })), 0.06);
    b.then(0.1);
    fit(J, side1, [-237, 227].map((z): Vec3 => [-590, 5, z]), [0, 1, 0]);
  });
  step({ title: "Fit the left side and lock it", detail: "Push it onto the dowels of the bottom, plinth, rails and fixed shelf. Six cam locks: two in the bottom, one in each rail, one in the fixed shelf.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([side1], [-400, 0, 0]);
    fit(F, bot, [-120, 120].map((z): Vec3 => [-551, 109, z]), [0, -1, 0]);
    for (const [i, k] of rails.entries()) fit(F, k, [[-552, railY[i] + 16, 237]], [0, -1, 0]);
    fit(F, lip, [[-552, 771, 256]], [0, 0, 1]);
    fit(F, fixed, [[-551, 806, 90]], [0, -1, 0]);
  });
  step({ title: "Prepare the right side", detail: "Two dowels into the top edge, two cam bolts into the inside face for the bottom, and two glides into the bottom edge, 50 mm from each end.", kind: "dowels", tools: ["hammer", "screwdriver", "tape"], scene: "s18", pose: "-x" }, () => {
    show(side2, [0, 150, 0]);
    fit(A, side2, [-200, 170].map((z): Vec3 => [590, 1985, z]), [0, -1, 0], { mate: top });
    fit(G, side2, [-120, 120].map((z): Vec3 => [582, 101, z]), [1, 0, 0], { mate: bot });
    fit(J, side2, [-237, 227].map((z): Vec3 => [590, 5, z]), [0, 1, 0]);
  });
  step({ title: "Fit the right side and lock it", detail: "Onto the dowels of the bottom and plinth. Two cam locks in the bottom.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([side2], [400, 0, 0]);
    fit(F, bot, [-120, 120].map((z): Vec3 => [551, 109, z]), [0, -1, 0]);
  });
  step({ title: "Screw 6 cam bolts into the top", detail: "Into the underside: two for each side and two for the divider.", kind: "cams", tools: ["screwdriver"], scene: "s20", pose: "-y" }, () => {
    show(top, [0, -150, 0]);
    b.fits(G, [[-590, side1], [0, div], [590, side2]].flatMap(([x, mate]) => [-100, 100].map((z) => ({ on: top, at: [x as number, 1985, z] as Vec3, dir: [0, 1, 0] as Vec3, mate: mate as string }))), 0.06);
  });
  step({ title: "Screw the anti-tip brackets to the top", detail: "Two brackets on the top face along the back edge, two 16 mm screws each. Stop at about 80%: they are tightened fully once it is against the wall.", kind: "screws", tools: ["screwdriver"], scene: "s20", pose: "+y" }, () => {
    fit(S, top, [-300, 300].map((x): Vec3 => [x, 2001, -274]), [0, -1, 0], { travel: 60, wall: true });
    fit(N, top, [-300, 300].flatMap((x) => [-11, 11].map((dx): Vec3 => [x + dx, 2003, -262])), [0, -1, 0], { hole: false, wall: true });
  });
  step({ title: "Fit the top and lock it", detail: "Onto the dowels of both sides, the divider and the stile. Six cam locks: two in each side and two in the divider.", kind: "cams", tools: ["flathead"], people: 2 }, () => {
    put([top], [0, 400, 0]);
    fit(F, side1, [-100, 100].map((z): Vec3 => [-582, 1955, z]), [-1, 0, 0]);
    fit(F, div, [-100, 100].map((z): Vec3 => [8, 1955, z]), [-1, 0, 0]);
    fit(F, side2, [-100, 100].map((z): Vec3 => [582, 1955, z]), [1, 0, 0]);
  });

  /* ---------- standing: the back, the wall ---------- */
  step({ title: "Stand it up and mark the shelf line", detail: "Two of you: it is over 2 m tall, so check the room is higher than 215 cm before tipping it up. Lay both back panels on and draw a pencil line across them where the fixed shelf and the divider are, to nail along.", kind: "standup", tools: ["pencil"], pose: "+y", people: 2, warnings: ["two"] }, () => put(backs, [0, 0, -300]));
  step({ title: "Nail on the back", detail: "Measure both diagonals: when they match it is square. Nail round the edges, along your lines into the fixed shelf and the divider, the six joining plates over the seam and the clip at the fixed shelf's back corner. 44 nails in all.", kind: "nails", tools: ["hammer", "tape", "level", "pencil"], pose: "+y", check: "square" }, () => {
    const z = -290;
    const on = (p: Vec3) => (p[0] < 0 ? backs[0] : backs[1]);
    const nails = (pts: Vec3[]) => {
      b.fits(H, pts.map((at) => ({ on: on(at), at, dir: [0, 0, 1] as Vec3, hole: false as const })), 0.03);
      b.then(0.1);
    };
    const plates: Vec3[] = line([0, 200, z], [0, 1850, z], 6);
    const clip: Vec3 = [-590, 798, z];
    nails([
      ...line([-590, 150, z], [-590, 1940, z], 8),
      ...line([590, 150, z], [590, 1940, z], 8),
      ...line([-540, 1989, z], [540, 1989, z], 5),
      ...line([-540, 101, z], [540, 101, z], 5),
      ...[365, 695, 1025, 1355, 1685, 1950].map((y): Vec3 => [0, y, z]),
      ...line([-560, 798, z], [-30, 798, z], 5),
    ]);
    fit(R, undefined, plates, [0, 0, 1], { hole: false });
    fit(M, backs[0], [clip], [0, 0, 1], { hole: false });
    nails([...plates, clip]);
  });
  step({ title: "Fix it to the wall", detail: "Push it against the wall, mark through both brackets, drill, plug and screw them to the wall, then tighten the screws in the top fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    fit(HW.plug, undefined, [-300, 300].map((x): Vec3 => [x, 2027, -290]), [0, 0, -1]);
    fit(HW.wallScrew, undefined, [-300, 300].map((x): Vec3 => [x, 2027, -288]), [0, 0, -1]);
  });

  /* ---------- inside: layout B ---------- */
  step({ title: "Choose where the rail goes", detail: "The manual gives two layouts. A: the rail over the drawers, four shelves on the right. B (this guide, as in JYSK's photos): three shelves over the drawers, the rail and one shelf on the right.", kind: "general", pose: "+y" });
  step({ title: "Fit the rail and the four shelves", detail: "Screw a rail holder to the divider and to the right side at the top, one screw each, and drop the rail in. Then four shelf pins under each shelf, at any height: three shelves on the left, one on the right.", kind: "shelves", tools: ["screwdriver"], pose: "+y" }, () => {
    fit(Q, div, [[8, 1935, -15]], [-1, 0, 0]);
    fit(Q, side2, [[582, 1935, -15]], [1, 0, 0]);
    fit(N, div, [[11, 1948, -15]], [-1, 0, 0], { hole: false });
    fit(N, side2, [[579, 1948, -15]], [1, 0, 0], { hole: false });
    put([rail], [0, -150, 250]);
    const zs = [-240, 160];
    const pins: FitOpts[] = [];
    for (const [i, k] of shelves.entries()) {
      const y = b.partItem(k).final.pos[1] - T / 2 - 3;
      const [xa, xb, ka, kb] = i < 3 ? [-582, -8, side1, div] : [8, 582, div, side2];
      for (const z of zs) pins.push({ on: ka, at: [xa, y, z], dir: [-1, 0, 0], hole: false }, { on: kb, at: [xb, y, z], dir: [1, 0, 0], hole: false });
    }
    b.fits(K, pins, 0.04);
    b.then(0.15);
    put(shelves, [0, 0, 400]);
  });

  /* ---------- the drawers: one is shown, the manual has you make all three the same way ---------- */
  type Group = [HwDef, FitOpts[]];
  const dFits = (d: (typeof drawers)[number]): Record<"frontBolts" | "sideDowels" | "sideCams" | "backDowels" | "backScrews" | "runners", Group[]> => {
    const y = d.fy + 103;
    const xs: [number, string, number][] = [
      [-559.5, d.l, -1],
      [-54.5, d.r, 1],
    ];
    return {
      frontBolts: [[G, xs.flatMap(([x, side]) => [-25, 25].map((dy) => ({ on: d.front, at: [x, y + dy, 278] as Vec3, dir: [0, 0, 1] as Vec3, mate: side })))]],
      sideDowels: [[A, xs.flatMap(([x, side]) => [-60, 60].map((dy) => ({ on: side, at: [x, y + dy, 277] as Vec3, dir: [0, 0, -1] as Vec3, mate: d.front })))]],
      sideCams: [[F, xs.flatMap(([x, side, sx]) => [-25, 25].map((dy) => ({ on: side, at: [x - sx * 8, y + dy, 243] as Vec3, dir: [sx, 0, 0] as Vec3 })))]],
      backDowels: [[A, xs.flatMap(([x, side, sx]) => [-45, 45].map((dy) => ({ on: d.back, at: [x - sx * 8, y + dy, -215] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: side })))]],
      backScrews: [[E, xs.map(([x, side, sx]) => ({ on: side, at: [x + sx * 8, y, -215] as Vec3, dir: [-sx, 0, 0] as Vec3, mate: d.back }))]],
      runners: [
        [DL, [{ on: d.l, at: [-567.5, runY(d.fy), 27], dir: [1, 0, 0], hole: false }]],
        [DR, [{ on: d.r, at: [-46.5, runY(d.fy), 27], dir: [-1, 0, 0], hole: false }]],
        [N, xs.flatMap(([x, side, sx]) => [-200, 0, 200].map((dz) => ({ on: side, at: [x + sx * 16, runY(d.fy), 27 + dz] as Vec3, dir: [-sx, 0, 0] as Vec3, hole: false as const })))],
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
  const dStep = (title: string, detail: string, kind: StepKind, tools: ToolId[], body: () => void) => step({ title, detail, kind, tools, scene: "drawer", pose: "+y", repeat: 3 }, body);
  dStep("Screw 4 cam bolts into each drawer front", "Into the back face, two near each end.", "cams", ["screwdriver"], () => {
    show(d0.front, [0, 0, 150]);
    emit("frontBolts");
  });
  dStep("Tap 2 dowels into the front end of each drawer side", "Twelve in all for the six sides (16L and 17R).", "dowels", ["hammer"], () => {
    show(d0.l, [0, 150, 0], [0, 0, -350]);
    show(d0.r, [0, 150, 0], [0, 0, -350]);
    emit("sideDowels");
  });
  dStep("Fit the sides to the front and lock them", "Press each side onto the front, then two cam locks in each side.", "cams", ["flathead"], () => {
    show(d0.l);
    show(d0.r);
    emit("sideCams");
  });
  dStep("Slide in the drawer bottom", "Along the grooves in the sides, from the back. The inside is 498 mm wide.", "drawer", ["tape"], () => show(d0.bottom, [0, 0, -450]));
  dStep("Tap 4 dowels into the drawer back", "Two in each end.", "dowels", ["hammer"], () => {
    show(d0.back, [0, 150, 0], [0, 0, -300]);
    emit("backDowels");
  });
  dStep("Fit the back and screw it on", "Ease the sides out about 5° to get it in over the dowels, then one connector screw through each side.", "bolts", ["allen"], () => {
    show(d0.back);
    emit("backScrews");
  });
  dStep("Screw the runners to the drawer", "DL on the left side, DR on the right, three screws each.", "runners", ["screwdriver"], () => emit("runners"));
  step({ title: "Slide in the three drawers", detail: "Rest each drawer's runner wheels on the cabinet runners, tilt it down and push it in until it runs smoothly.", kind: "drawer", pose: "+y" }, () => {
    for (const [i, d] of drawers.entries()) {
      b.stagger(0);
      for (const k of [d.front, d.l, d.r, d.back, d.bottom]) b.add(k, [0, 0, 520]);
      if (i > 0) for (const [def, list] of Object.values(dFits(d)).flat()) for (const o of list) b.preset(def, o);
      b.wait(0.22);
    }
  });

  /* ---------- the doors: clip-on hinges, no handles ---------- */
  const hinge = (door: string, ys: number[], sgn: number) => {
    const x = sgn * 562; // the hinge edge: the short door's left, the tall door's right
    show(door, [0, 0, -150]);
    fit(B, door, ys.map((y): Vec3 => [x, y, 278]), [0, 0, 1], { twist: sgn > 0 ? Math.PI : 0 });
    fit(N, door, ys.flatMap((y) => [-24, 24].map((dy): Vec3 => [x + sgn * 4, y + dy, 275])), [0, 0, 1], { hole: false });
  };
  step({ title: "Screw 3 hinges to the short door", detail: "Lay it face down on a rug. Each hinge cup in its round hole, two screws.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z", warnings: ["floor"] }, () => hinge(door13, [865, 1374, 1883], -1));
  step({ title: "Screw 4 hinges to the tall door", detail: "The same way.", kind: "hinges", tools: ["screwdriver"], scene: "doors", pose: "-z" }, () => hinge(door14, [193, 756, 1320, 1883], 1));
  step({ title: "Hang the doors and line them up", detail: "Short door on the left side, tall door on the right. Clip each hinge onto its plate, then turn the hinge screws to move each door up and down, in and out, and sideways until the gaps are even.", kind: "doors", tools: ["screwdriver"], pose: "+y", people: 2, warnings: ["two"] }, () => put([door13, door14], [0, 0, 400]));
  step({ title: "Keep to the weight limits", detail: "Top 40 kg. Rail 11 kg. Each loose shelf 10 kg. Fixed shelf and bottom 20 kg each. Each drawer 5 kg.", kind: "general", pose: "+y" });
  return true;
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

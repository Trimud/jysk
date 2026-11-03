import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder, type StepDef } from "../builder";
import type { Family } from "./family";

/**
 * JYSK TRAPPEDAL shelving unit, 5 shelves, 70x109x30 (3600987, 3601268), read from its 18-page manual.
 * A black square-tube frame: two side ladders (2 left, 3 right), each two 16 mm posts with a cross bar at every shelf
 * and a top bar, and a shorter middle ladder (4) between the bottom and the top. The wooden shelves (top 1, bottom 7,
 * two narrow 5 on the left, two wide 6 on the right, staggered) each sit in a pair of metal edge rails, and every
 * joint is an M6 countersunk bolt (A) through a post into a rail end. It is built lying on its left side: the small
 * shelves onto the left ladder, the middle ladder, the bottom, the top (on the middle posts, two short bolts B down
 * into them), the wide shelves, the right ladder; then the anti-tip bracket, stood up, levelled on its feet and fixed.
 */

const T = 16; // tube, rail and board thickness
const A: HwDef = { kind: "bolt", len: 35, dia: 6, flush: true }; // M6x35, countersunk into the tube
const B: HwDef = { kind: "bolt", len: 12, dia: 6, flush: true }; // M6x12, its head level with the top
const C: HwDef = { kind: "bracket", len: 75, dia: 25, name: "Anti-tip bracket" };

// heights in mm (centres of the boards), from the manual's dimensions: legs 91, then 234/334/367 left, 360/360/215 right
const Y = { bottom: 99, s5: [349, 699], s6: [475, 851], top: 1082 };
const XL = -350, XR = 350; // outer faces of the side ladders
const XM = [-80, -64]; // the middle ladder's faces: 254 mm to its left, 398 to its right
const XMC = (XM[0] + XM[1]) / 2; // and its centre
const ZP = 142; // the posts' centres, front (+) and back (-)

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "shelf" || Math.round(s.size.w) !== 70 || Math.round(s.size.h) !== 109) return false;

  /* ---------- parts, the manual's numbers as labels; frames metal, shelves wood in metal edge rails ---------- */
  /** One part type drawn from pieces (where the first one goes), placed at each height in `ys` (the first is the pieces' own). */
  const part = (name: string, label: string, pieces: PartPiece[], material: "metal" | "board", ys: number[] = [pieces[0].pos[1]]) => {
    const { type, mid } = b.compound(name, pieces, { material, label });
    return ys.map((y) => b.place(type, [mid[0], mid[1] + y - ys[0], mid[2]]));
  };
  const ladder = (name: string, label: string, x: number, y0: number, y1: number, bars: number[]) =>
    part(name, label, [
      ...[-ZP, ZP].map((z): PartPiece => ({ shape: "box", size: [T, y1 - y0, T], pos: [x, (y0 + y1) / 2, z] })),
      ...bars.map((y): PartPiece => ({ shape: "box", size: [T, T, 2 * ZP - T], pos: [x, y, 0] })),
    ], "metal")[0];
  const shelves = (name: string, label: string, x0: number, x1: number, ys: number[]) =>
    part(name, label, [
      { shape: "box", size: [x1 - x0, T, 266], pos: [(x0 + x1) / 2, ys[0], 0], material: "board" },
      ...[-141, 141].map((z): PartPiece => ({ shape: "box", size: [x1 - x0, T, T], pos: [(x0 + x1) / 2, ys[0], z], material: "metal" })),
    ], "board", ys);
  const [top] = shelves("Top", "1", XL + T, XR - T, [Y.top]);
  const left = ladder("Left frame", "2", XL + T / 2, 0, 1090, [Y.bottom, ...Y.s5, Y.top]);
  const right = ladder("Right frame", "3", XR - T / 2, 0, 1090, [Y.bottom, ...Y.s6, Y.top]);
  const middle = ladder("Middle frame", "4", XMC, 108, 1073, [...Y.s5, ...Y.s6]);
  const s5 = shelves("Small shelf", "5", XL + T, XM[0], Y.s5);
  const s6 = shelves("Wide shelf", "6", XM[1], XR - T, Y.s6);
  const [bottom] = shelves("Bottom shelf", "7", XL + T, XR - T, [Y.bottom]);
  // each small and wide shelf with its height, for the bolts into it
  const at5 = Y.s5.map((y, i): [number, string] => [y, s5[i]]);
  const at6 = Y.s6.map((y, i): [number, string] => [y, s6[i]]);

  /* ---------- helpers ---------- */
  const step = (d: StepDef, body = () => {}) => b.step({ pose: "+x", ...d }, body);
  const put = (keys: string[], from: Vec3) => {
    b.stagger(0.25);
    for (const k of keys) b.add(k, from);
    b.then(0.12);
  };
  /** Bolts A through a ladder's posts (front and back) at height y, from face x the way `dir` goes, into a shelf's rails. */
  const bolts = (on: string, x: number, dir: number, ys: [number, string][]) => {
    b.fits(A, ys.flatMap(([y, mate]) => [ZP, -ZP].map((z): FitOpts => ({ on, at: [x, y, z], dir: [dir, 0, 0], mate }))), 0.08);
    b.then(0.1);
  };

  /* ---------- lying on its left side on a rug ---------- */
  step({ title: "Bolt the two small shelves to the left frame", detail: "Lay the left frame (2) flat, feet at the bottom end. Stand the small shelves (5) on it at its cross bars and bolt each through the front and back post with the Allen key: 4 bolts. The posts' hole ends go up.", kind: "bolts", tools: ["allen"], warnings: ["floor"] }, () => {
    put([left], [-200, 0, 0]);
    put(s5, [200, 0, 0]);
    bolts(left, XL, 1, at5);
  });
  step({ title: "Bolt the middle frame on", detail: "The middle frame (4) onto the other ends of the small shelves, the hole in its posts' ends at the top: 4 bolts.", kind: "bolts", tools: ["allen"] }, () => {
    put([middle], [200, 0, 0]);
    bolts(middle, XM[1], -1, at5);
  });
  step({ title: "Bolt on the bottom shelf", detail: "The bottom shelf (7): two bolts through the left frame into its end, two up through its rails into the middle frame's posts.", kind: "bolts", tools: ["allen"] }, () => {
    put([bottom], [200, 0, 0]);
    bolts(left, XL, 1, [[Y.bottom, bottom]]);
    b.fits(A, [ZP, -ZP].map((z): FitOpts => ({ on: bottom, at: [XMC, Y.bottom - T / 2, z], dir: [0, 1, 0], mate: middle })), 0.08);
  });
  step({ title: "Slide the top onto the middle frame", detail: "Its two square sockets underneath go over the ends of the middle frame's posts.", kind: "join" }, () => put([top], [0, 250, 0]));
  step({ title: "Bolt the top on", detail: "Two bolts through the left frame into the top's end, then the two short bolts (B) down through the top into the middle frame's posts.", kind: "bolts", tools: ["allen"] }, () => {
    bolts(left, XL, 1, [[Y.top, top]]);
    b.fits(B, [ZP, -ZP].map((z): FitOpts => ({ on: top, at: [XMC, Y.top + T / 2, z], dir: [0, -1, 0] })), 0.1);
  });
  step({ title: "Bolt the two wide shelves to the middle frame", detail: "The wide shelves (6) at the middle frame's other cross bars: 4 bolts through its posts.", kind: "bolts", tools: ["allen"] }, () => {
    put(s6, [200, 0, 0]);
    bolts(middle, XM[0], 1, at6);
  });
  step({ title: "Bolt on the right frame", detail: "The right frame (3) over the ends of the bottom, both wide shelves and the top: 8 bolts.", kind: "bolts", tools: ["allen"], people: 2 }, () => {
    put([right], [200, 0, 0]);
    bolts(right, XR, -1, [[Y.bottom, bottom], ...at6, [Y.top, top]]);
  });
  step({ title: "Screw the anti-tip bracket to the top", detail: "On the back rail of the top, in the middle, with the third short bolt (B). Tighten it to about 80%: fully once it is against the wall.", kind: "screws", tools: ["allen"] }, () => {
    b.fit(C, { on: top, at: [0, Y.top, -149], dir: [0, 0, 1], travel: 60, wall: true });
    b.then(0.1);
    b.fit(B, { on: top, at: [0, Y.top, -151], dir: [0, 0, 1], wall: true });
  });

  /* ---------- standing ---------- */
  step({ title: "Stand it up and level it", detail: "Two of you: tip it up onto its feet. Lay a spirit level on the top and turn the feet under the posts until it stands level and doesn't rock.", kind: "standup", tools: ["level"], pose: "+y", people: 2, warnings: ["two"] });
  step({ title: "Fix it to the wall", detail: "Push it against the wall, mark through the bracket, drill, plug and screw it to the wall, then tighten the bracket's bolt fully. Wall plugs and screws aren't included: pick ones made for your wall.", kind: "anchor", tools: ["drill", "screwdriver", "pencil", "hammer", "allen"], pose: "+y", wall: true, warnings: ["wall", "tip"] }, () => {
    b.fit(HW.plug, { at: [0, 1100, -175], dir: [0, 0, -1] });
    b.then(0.05);
    b.fit(HW.wallScrew, { at: [0, 1100, -173], dir: [0, 0, -1] });
  });
  step({ title: "Keep to the weight limits", detail: "5 kg on each shelf and on the top.", kind: "general", pose: "+y" });
  return true;
}

const family: Family = { names: ["TRAPPEDAL"], build };
export default family;

import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type HwDef, type PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * JYSK KETTINGE wall panel, 160x90 and 200x90, read from its 12-page manual. A slatted headboard panel in two halves
 * (1, 2: 1600x465x36, or 2000 wide): horizontal slats on four upright battens. Laid face down, the battens' stepped
 * ends overlap where the halves meet and two screws (A, Ø4x25) go through each joint. It hangs on two keyholes at the
 * top of the outer battens and is screwed to the wall through a hole at the bottom of each; wall screws and plugs
 * aren't included. x across, y up, z out from the wall, the battens' backs on z = 0.
 */

const A: HwDef = { kind: "screw", len: 25, dia: 4 };

const H = 900, BT = 18, ST = 18; // battens and slats are each half the 36 mm depth, read off the drawings
const N = 22, PITCH = H / N, SH = 30; // slats counted on the drawings
const SEAM = 11 * PITCH - (PITCH - SH) / 2; // in the gap between the 11th and 12th slat
const LAP = 15; // each batten's stepped end, either side of the seam

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!/wall panel/i.test(s.variant)) return false;
  const W = s.size.w * 10;
  const bx = [-W / 2 + 150, -W / 6, W / 6, W / 2 - 150];
  const slat = (i: number): PartPiece => ({ shape: "box", size: [W, SH, ST], pos: [0, i * PITCH + SH / 2, BT + ST / 2] });
  const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
  // the bottom half's battens run up past the seam in the front half of their depth, the top half's down in the back half
  const bottomHalf = b.compound(
    "Panel half",
    [...Array.from({ length: 11 }, (_, i) => slat(i)), ...bx.flatMap((x) => [box([40, SEAM - LAP, BT], [x, (SEAM - LAP) / 2, BT / 2]), box([40, 2 * LAP, BT / 2], [x, SEAM, (3 * BT) / 4])])],
    { material: "wood", label: "2" },
  );
  const topHalf = b.compound(
    "Panel half",
    [...Array.from({ length: 11 }, (_, i) => slat(i + 11)), ...bx.flatMap((x) => [box([40, H - SEAM - LAP, BT], [x, (H + SEAM + LAP) / 2, BT / 2]), box([40, 2 * LAP, BT / 2], [x, SEAM, BT / 4])])],
    { material: "wood", label: "1" },
  );
  const lower = b.place(bottomHalf.type, bottomHalf.mid);
  const upper = b.place(topHalf.type, topHalf.mid);
  const outer = [bx[0], bx[3]];

  b.step(
    {
      title: "Screw the two halves (1, 2) together",
      detail: "Lay both face down on a rug, top half above, so the stepped ends of their battens overlap. Two screws (A) through each of the four joints.",
      tools: ["screwdriver"],
      kind: "screws",
      warnings: ["floor"],
    },
    () => {
      b.add(lower, [0, -200, 0]);
      b.then(0.1);
      b.add(upper, [0, 200, 0]);
      b.then(0.1);
      b.fits(A, bx.flatMap((x) => [-8, 8].map((dx): FitOpts => ({ on: upper, at: [x + dx, SEAM, 0], dir: [0, 0, 1], mate: lower }))), 0.06);
    },
  );
  b.step(
    {
      title: "Hang it on the wall",
      detail: "Mark where the two keyholes at the top go, level with each other. Drill and plug the holes, screw in the screws until their heads stand out a little, and hang the panel's keyholes over them. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => {
      b.fits(HW.plug, outer.map((x): FitOpts => ({ at: [x, H - 30, -3], dir: [0, 0, -1] })), 0.2);
      b.then(0.1);
      b.fits(HW.wallScrew, outer.map((x): FitOpts => ({ at: [x, H - 30, 1], dir: [0, 0, -1] })), 0.2);
    },
  );
  b.step(
    {
      title: "Screw the bottom to the wall",
      detail: "Drill through the hole near the bottom of each outer batten into the wall, plug the holes and screw the panel on.",
      tools: ["drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => {
      b.fits(HW.plug, outer.map((x): FitOpts => ({ at: [x, 30, -3], dir: [0, 0, -1] })), 0.2);
      b.then(0.1);
      b.fits(HW.wallScrew, outer.map((x): FitOpts => ({ at: [x, 30, BT], dir: [0, 0, -1] })), 0.2);
    },
  );
  return true;
}

const family: Family = { names: ["KETTINGE"], build };
export default family;

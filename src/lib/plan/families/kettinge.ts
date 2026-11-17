import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { range, sub } from "../math";
import { wallFix } from "./_wall";
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
const KEY = H - 38; // the keyhole plates' middle

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (!/wall panel/i.test(s.variant)) return false;
  const W = s.size.w * 10;
  const bx = [-W / 2 + 150, -W / 6, W / 6, W / 2 - 150];
  const slat = (i: number): PartPiece => ({ shape: "box", size: [W, SH, ST], pos: [0, i * PITCH + SH / 2, BT + ST / 2] });
  const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
  // the bottom half's (2) battens run up past the seam in the back half of their depth, on top when laid face down, with
  // the two predrilled holes (p8, p9 inset); the top half's (1) run down past it in the front half
  const bottomHalf = b.compound(
    "Panel half",
    [...range(11).map(slat), ...bx.flatMap((x) => [box([40, SEAM - LAP, BT], [x, (SEAM - LAP) / 2, BT / 2]), box([40, 2 * LAP, BT / 2], [x, SEAM, BT / 4])])],
    { material: "wood", label: "2" },
  );
  // a metal keyhole plate on the back of each outer batten's top end (p9, p10 inset V): 20x45 with round ends, the
  // screw head's round hole low and the slot above it that hangs on the screw. One outline: round the outside, then
  // in by a hairline cut at the bottom and round the keyhole (a non-rectangular slab, so qa:overlaps leaves it out).
  // Hung, the slot's top end (8 above the plate's middle) rests on the wall screw at H - 30, so the plate sits at H - 38
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number): [number, number][] =>
    range(9).map((i) => {
      const a = ((a0 + ((a1 - a0) * i) / 8) * Math.PI) / 180;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    });
  const plate: [number, number][] = [
    ...arc(0, -12.5, 10, -89, 0), ...arc(0, 12.5, 10, 0, 180), ...arc(0, -12.5, 10, 180, 269),
    ...arc(0, -8, 5, 266, 120), ...arc(0, 8, 2.5, 180, 0), ...arc(0, -8, 5, 60, -86),
  ].map(([x, v]) => [x, -v]); // turned up onto the back below: its outline's z runs down y
  const keyhole = (x: number): PartPiece => ({ shape: "slab", outline: plate, size: [20, 1.5, 45], pos: [x, KEY, 0.45], rot: [Math.PI / 2, 0, 0], material: "metal" });
  const topHalf = b.compound(
    "Panel half",
    [
      ...range(11).map((i) => slat(i + 11)),
      ...bx.flatMap((x) => [box([40, H - SEAM - LAP, BT], [x, (H + SEAM + LAP) / 2, BT / 2]), box([40, 2 * LAP, BT / 2], [x, SEAM, (3 * BT) / 4])]),
      ...[bx[0], bx[3]].map(keyhole),
    ],
    { material: "wood", label: "1" },
  );
  const lower = b.place(bottomHalf.type, bottomHalf.mid);
  const upper = b.place(topHalf.type, topHalf.mid);
  const outer = [bx[0], bx[3]];
  const flat = (k: string, from: Vec3) => b.stage(k, sub(b.partItem(k).final.pos, [0, H / 2, 0]), [0, 0, 0], from);

  // p9: both face down on the floor, battens up, half 1 at the far end; made apart, hung in step 2. Its warning box:
  // screws only into a joint lying flat (tick), not one with a step standing up (cross)
  b.step(
    {
      page: 9,
      title: "Screw the two halves (1, 2) together",
      detail:
        "Lay both face down on a rug, half 1 at the far end, the same way up so the stepped ends of their battens nest flush. Two screws (A) through each of half 2's batten ends into half 1. Only screw once each joint lies flat, one stepped end fully over the other: never with a step standing up out of the joint.",
      tools: ["screwdriver"],
      kind: "screws",
      scene: "halves",
      pose: "-z",
      turn: Math.PI,
      warnings: ["floor"],
    },
    () => {
      flat(lower, [0, -200, 0]);
      b.then(0.1);
      flat(upper, [0, 200, 0]);
      b.then(0.1);
      // the keyhole plates on the back of the outer battens' top ends, facing up as it lies
      b.look(upper, [outer[0], KEY, 0], { dir: [0, 0, 1], size: 35 });
      b.fits(A, bx.flatMap((x) => [-8, 8].map((dx): FitOpts => ({ on: lower, at: [x + dx, SEAM, 0], dir: [0, 0, 1], mate: upper }))), 0.06);
    },
  );
  b.step(
    {
      page: 10,
      title: "Hang it on the wall",
      detail: "Mark where the two keyholes at the top go, level with each other. Drill and plug the holes, screw in the screws until their heads stand out a little, and hang the panel's keyholes over them. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => {
      // p10: the screws first, heads left standing out, then the keyholes hung down over them
      wallFix(b, outer.map((x) => [x, H - 30]), 0, 5);
      b.then(0.2);
      b.stagger(0);
      b.add(lower, [0, 40, 120]);
      b.add(upper, [0, 40, 120]);
      b.then(0.1);
      // a keyhole over its screw head, seen through the panel
      b.look(upper, [outer[0], KEY, 0], { dir: [0, 0, -1], size: 35 });
    },
  );
  b.step(
    {
      page: 11,
      title: "Screw the bottom to the wall",
      detail:
        "Mark through the hole near the bottom of each outer batten, between the first two slats. Swing the bottom of the panel out from the wall on its top screws, drill and plug the holes, then swing it back and screw the panel on. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => wallFix(b, outer.map((x) => [x, SH + (PITCH - SH) / 2]), 0, BT), // p11 inset III: through the batten, in the first slat gap
  );
  return true;
}

const family: Family = { names: ["KETTINGE"], build };
export default family;

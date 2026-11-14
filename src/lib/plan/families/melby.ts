import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { RETIGHTEN, rod, washered } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK MELBY dining chair, 48 x 84 x 58 (3640275, 3640276), read from its 11-page manual (Rev 1, 24.04.2025).
 * The seat (1, 590x480x440) comes made: "Legs must be mounted". The legs are one welded black steel base (2,
 * 495x475x450): two tubes crossing in an X under the seat, a splayed leg off each arm's end (page 11). On the upturned
 * seat it takes four bolts (A) with a washer (B) under each, through tabs beside the arms; then it is stood up. Seat height 46 cm, tested for 110 kg.
 */

const A: HwDef = { kind: "bolt", len: 20, dia: 6 }; // M6x20
const B: HwDef = { kind: "washer", len: 1.5, dia: 18 }; // Ø6/Ø18; C is the 5 mm allen key

const BASE = 395; // the seat's underside: 835 high, the seat 440 of it
const TOP: [number, number] = [150, 140]; // the X's arm ends under the seat, half its width and depth
const TAB: [number, number] = [77, 113]; // the bolt tabs, 30 off each arm towards the seat's front or back edge (page 11)
const FOOT: [number, number] = [225, 215]; // the feet, half the base's 495 x 475 less the tube
/** p11's arrow sticker, `l` long, pointing to the seat's front (+z), lying flat at height y. */
const arrow = (l: number, z: number, y: number): PartPiece => {
  const w = l * 0.7, s = l * 0.12, k = l * 0.05;
  return { shape: "slab", outline: [[-s, -l / 2], [s, -l / 2], [s, k], [w / 2, k], [0, l / 2], [-w / 2, k], [-s, k]], size: [w, 1, l], pos: [0, y, z], material: "board" };
};

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "seat" || Math.round(s.size.w) !== 48 || Math.round(s.size.h) !== 84 || Math.round(s.size.d) !== 58) return false;
  // the made seat as _seat's body() draws it (480 x 580, seat 460, back 90 deep), with its arrow sticker underneath
  // near the front edge, in past the soft box's rounding
  const seatT = b.compound(
    "Seat",
    [
      { shape: "box", size: [480, 460 - BASE, 490], pos: [0, (BASE + 460) / 2, 45] },
      { shape: "box", size: [480, 835 - BASE, 90], pos: [0, (BASE + 835) / 2, -245] },
      arrow(64, 205, BASE - 0.6),
    ],
    { material: "soft", label: "1", made: true },
  );
  const seat = b.place(seatT.type, seatT.mid);

  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const pt = ([gx, gz]: [number, number], [x, z]: [number, number], y: number): Vec3 => [gx * x, y, gz * z];
  const { type, mid } = b.compound(
    "Leg base",
    [
      ...corners.map((c) => rod(pt(c, TOP, BASE - 12), pt(c, FOOT, 0), 25)),
      // the two arms of the X, corner to corner
      rod(pt([-1, -1], TOP, BASE - 12), pt([1, 1], TOP, BASE - 12), 20),
      rod(pt([1, -1], TOP, BASE - 12), pt([-1, 1], TOP, BASE - 12), 20),
      // a welded tab beside each arm, flush with the arms' top, that the bolt goes up through
      ...corners.map((c) => ({ shape: "box" as const, size: [40, 3, 40] as Vec3, pos: pt(c, TAB, BASE - 3.5) })),
      // p11: the arrow sticker under the crossing, pointing the same way as the seat's
      arrow(52, 0, BASE - 22.6),
    ],
    { material: "metal", label: "2" },
  );
  const legs = b.place(type, mid);
  const bolts = corners.map((c): FitOpts => ({ on: legs, at: pt(c, TAB, BASE - 5), dir: [0, 1, 0], mate: seat }));

  b.step(
    {
      page: 11,
      title: "Bolt the leg base (2) to the seat (1)",
      detail: "Turn the seat upside down onto a rug or its box and stand the base on it over the four holes. It only fits one way: the arrow where the base's arms cross must point the same way as the arrow under the seat. A washer (B) on each bolt (A), then all four in with the allen key and tight.",
      kind: "legs",
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    () => {
      b.add(seat, [0, 0, 300]);
      b.then(0.15);
      b.add(legs, [0, 260, 0]);
      b.then(0.15);
      washered(b, A, B, bolts);
    },
  );
  b.step({ page: 11, title: "Stand it up", detail: `Turn it onto its feet. Tested for 110 kg in the home. ${RETIGHTEN}`, kind: "standup" }, () => {});
  return true;
}

const family: Family = { names: ["MELBY"], build };
export default family;

import type { ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { body, RETIGHTEN, rod, washered } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK MELBY dining chair, 48 x 84 x 58 (3640275, 3640276), read from its 11-page manual (Rev 1, 24.04.2025).
 * The seat (1, 590x480x440) comes made: "Legs must be mounted". The legs are one welded black steel base (2,
 * 495x475x450): a square frame under the seat with a splayed leg at each corner. On the upturned seat it takes four
 * bolts (A) with a washer (B) under each; then it is stood up. Seat height 46 cm, tested for 110 kg.
 */

const A: HwDef = { kind: "bolt", len: 20, dia: 6 }; // M6x20
const B: HwDef = { kind: "washer", len: 1.5, dia: 18 }; // Ø6/Ø18; C is the 5 mm allen key

const BASE = 395; // the seat's underside: 835 high, the seat 440 of it
const TOP: [number, number] = [150, 140]; // the base's frame under the seat, half its width and depth
const FOOT: [number, number] = [225, 215]; // the feet, half the base's 495 x 475 less the tube

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "seat" || Math.round(s.size.w) !== 48 || Math.round(s.size.h) !== 84 || Math.round(s.size.d) !== 58) return false;
  const seat = body(b, { name: "Seat", label: "1", w: 480, d: 580, h: 835, base: BASE, seat: 460, back: 90 });

  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const pt = ([gx, gz]: [number, number], [x, z]: [number, number], y: number): Vec3 => [gx * x, y, gz * z];
  const { type, mid } = b.compound(
    "Leg base",
    [
      ...corners.map((c) => rod(pt(c, TOP, BASE - 12), pt(c, FOOT, 0), 25)),
      ...corners.map((c, i) => rod(pt(c, TOP, BASE - 12), pt(corners[(i + 1) % 4], TOP, BASE - 12), 20)),
    ],
    { material: "metal", label: "2" },
  );
  const legs = b.place(type, mid);
  const bolts = corners.map((c): FitOpts => ({ on: legs, at: pt(c, [TOP[0] - 30, TOP[1] - 30], BASE - 22), dir: [0, 1, 0], mate: seat }));

  b.step(
    {
      title: "Bolt the leg base (2) to the seat (1)",
      detail: "Turn the seat upside down onto a rug or its box and stand the base on it over the four holes. A washer (B) on each bolt (A), then all four in with the allen key and tight.",
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
  b.step({ title: "Stand it up", detail: `Turn it onto its feet. Tested for 110 kg in the home. ${RETIGHTEN}`, kind: "standup" }, () => {});
  return true;
}

const family: Family = { names: ["MELBY"], build };
export default family;

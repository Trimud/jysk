import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { add, rotate } from "../math";
import { body, RETIGHTEN, washered } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK VEMMETOFTE swivel dining chair with armrests, 62 x 85 x 61 (3620208, 3620209), read from its 20-page manual
 * (Rev 1, 22.01.2026). The seat (1, 610x610x475) comes made: "Legs must be mounted". Under it goes a swivel base (2,
 * 235x170x210): a cross-shaped plate on a swivel, with a hub below that has a bracket for each of the four solid oak
 * legs (3, 447 long, 50x37). The legs bolt to the hub first (A, two each), then the base to the upturned seat (B, a
 * washer C under each, the arrows on the plate's front arms to the seat's front); felt pads (E) go on the feet, it is stood up and sat
 * on, and every bolt is tightened. Seat height 50 cm, arms 66 cm.
 */

const A: HwDef = { kind: "bolt", len: 20, dia: 6 }; // M6x20, 8
const B: HwDef = { kind: "bolt", len: 25, dia: 6 }; // M6x25, 4
const C: HwDef = { kind: "washer", len: 1.5, dia: 16 }; // Ø6/Ø16; D is the 5 mm allen key
const E: HwDef = { kind: "glide", len: 3, dia: 25, name: "Felt pad", form: "square" }; // 25x25x3

const BASE = 375; // the seat's underside: 850 high, the seat 475 of it
const PLATE = 8, HUB = 205; // the swivel plate under the seat, and the bottom of the base (170 below the seat)
const TOP = 260, R0 = 45, R1 = 405; // each leg: its top end beside the hub, out to its foot on a diagonal
const HUB_R = 30, HUB_Y = 255; // the hub: a short cylinder under the plate, the brackets hanging from it
const LT = 30, BT = 4, BW = 30; // the leg's thickness; a bracket's thickness and width

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "seat" || Math.round(s.size.w) !== 62 || Math.round(s.size.h) !== 85 || Math.round(s.size.d) !== 61) return false;
  const seat = body(b, { name: "Seat", label: "1", w: 610, d: 610, h: 850, base: BASE, seat: 500, back: 110, arm: 660, armW: 90 });

  // one leg drawn out along +x, its flat side to z (the side the bolts go in from), then turned onto each diagonal.
  // p15: a flat oak board 30 thick, 50 wide at the top narrowing to 37 at the foot, the foot cut level for its pad
  const a0: Vec3 = [R0, TOP, 0], c0: Vec3 = [R1, 0, 0];
  const len = Math.hypot(R1 - R0, TOP);
  const u: Vec3 = [(R1 - R0) / len, -TOP / len, 0]; // down the leg
  const n: Vec3 = [-u[1], u[0], 0]; // across it, in its own plane
  const at = (t: number, w: number): Vec3 => [a0[0] + u[0] * t + n[0] * w, a0[1] + u[1] * t + n[1] * w, 0];
  const level = (w0: number, w1: number): [number, number] => {
    const p = at(0, w0), q = at(len, w1), k = p[1] / (p[1] - q[1]);
    return [p[0] + (q[0] - p[0]) * k, 0];
  };
  const outline: [number, number][] = [[at(0, 25)[0], at(0, 25)[1]], level(25, 18.5), level(-25, -18.5), [at(0, -25)[0], at(0, -25)[1]]];
  const xs = outline.map((q) => q[0]), ys = outline.map((q) => q[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const board: PartPiece = {
    shape: "slab",
    // the slab's own z runs down its y here, its thickness across z
    outline: outline.map(([x, y]) => [x - cx, cy - y]),
    size: [Math.max(...xs) - Math.min(...xs), LT, Math.max(...ys) - Math.min(...ys)],
    pos: [cx, cy, 0],
    rot: [Math.PI / 2, 0, 0],
  };
  const legT = b.compound("Leg", [board], { material: "wood", label: "3" });

  // p15, p16: each leg's bracket, a flat strap from the hub down along the leg's top end, against its side
  const t0 = -(R0 - HUB_R) / u[0]; // where the leg's line meets the hub
  const t1 = (TOP - HUB - (BW / 2) * n[1]) / -u[1]; // its lower corner on the base's bottom
  const strap = (phi: number): PartPiece => ({
    shape: "box",
    size: [BW, t1 - t0, BT],
    pos: rotate([...at((t0 + t1) / 2, 0).slice(0, 2), LT / 2 + BT / 2 + 0.5] as Vec3, [0, phi, 0]),
    rot: [0, phi, Math.atan2(-u[0], u[1])],
  });
  const turns = [0, 1, 2, 3].map((i) => -Math.PI / 4 + (i * Math.PI) / 2);
  const swivel = b.compound(
    "Swivel base",
    [
      // p15, p17: the plate is an X, its arms to the seat's corners over the legs
      { shape: "box", size: [235, PLATE, 40], pos: [0, BASE - PLATE / 2, 0], rot: [0, Math.PI / 4, 0] },
      { shape: "box", size: [235, PLATE, 40], pos: [0, BASE - PLATE / 2, 0], rot: [0, -Math.PI / 4, 0] },
      { shape: "cyl", size: [2 * HUB_R, BASE - PLATE - HUB_Y, 2 * HUB_R], pos: [0, (BASE - PLATE + HUB_Y) / 2, 0] },
      ...turns.map(strap),
    ],
    { material: "metal", label: "2" },
  );
  const base = b.place(swivel.type, swivel.mid);

  const legs = turns.map((phi) => {
    const rot: Vec3 = [0, phi, 0];
    const c = rotate(c0, rot);
    return { key: b.place(legT.type, rotate(legT.mid, rot), rot), x: c[0] / R1, z: c[2] / R1, c, phi };
  });
  // two through each bracket's holes into the leg's side
  const aBolts = legs.flatMap((l) =>
    [12, 55].map((t): FitOpts => ({ on: base, at: rotate([...at(t, 0).slice(0, 2), LT / 2 + BT + 0.5] as Vec3, [0, l.phi, 0]), dir: rotate([0, 0, -1], [0, l.phi, 0]), mate: l.key })),
  );
  const bBolts = [[64, 64], [-64, 64], [64, -64], [-64, -64]].map(([x, z]): FitOpts => ({ on: base, at: [x, BASE - PLATE, z], dir: [0, 1, 0], mate: seat }));
  const pads = legs.map((l): FitOpts => ({ on: l.key, at: l.c, dir: [0, 1, 0], hole: false }));

  b.step(
    {
      title: "Bolt the four legs (3) to the swivel base (2)",
      detail: "Stand the base upside down on its plate. Hold each leg flat against its bracket on the hub and put two short bolts (A) through the bracket into it with the allen key (D), about 80% tight: 8 in all. Not the longer bolts (B).",
      kind: "legs",
      tools: ["allen"],
      pose: "-y",
      warnings: ["floor"],
    },
    () => {
      b.add(base, [0, 200, 0]);
      b.then(0.15);
      for (const l of legs) {
        b.add(l.key, [l.x * 200, 120, l.z * 200]);
        b.then(0.1);
      }
      b.fits(A, aBolts, 0.06);
    },
  );
  b.step(
    {
      title: "Bolt the base to the seat (1)",
      detail: "Turn the seat upside down onto a rug and stand the base on it, the arrows on the plate's two front arms pointing to the seat's front, where the seat has its arrow mark. Four longer bolts (B), a washer (C) on each, through the plate: about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      pose: "-y",
    },
    () => {
      // the seat lies upside down and the base with its legs is set down onto it, the bolts then straight down through
      // the plate (p17). Upside down, the model's -y is up in the view. Already in this scene, the base and legs move
      // from their last state, not from an offset: so each gets one held 300 up first, then its place
      b.add(seat);
      b.then(0.1);
      b.stagger(0);
      for (const k of [base, ...legs.map((l) => l.key)]) {
        const f = b.partItem(k).final;
        b.stage(k, add(f.pos, [0, -300, 0]), f.rot);
        b.add(k);
      }
      b.then(0.15);
      washered(b, B, C, bBolts);
    },
  );
  b.step(
    { title: "Stick on the felt pads (E)", detail: "Peel the backing off each pad and press one onto the end of every leg.", kind: "general", pose: "-y" },
    () => b.fits(E, pads, 0.1),
  );
  b.step({ title: "Stand it up and sit on it", detail: "Turn it onto its feet and press the seat down (or sit on it), so the base beds in and all four feet sit flat.", kind: "standup" }, () => {});
  b.step({ title: "Tighten every bolt", detail: `All twelve, the whole way, with the allen key. ${RETIGHTEN}`, kind: "bolts", tools: ["allen"] }, () => {});
  return true;
}

const family: Family = { names: ["VEMMETOFTE"], build };
export default family;

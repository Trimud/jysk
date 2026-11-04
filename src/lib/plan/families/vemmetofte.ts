import type { ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { rotate } from "../math";
import { body, RETIGHTEN, rod, washered } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK VEMMETOFTE swivel dining chair with armrests, 62 x 85 x 61 (3620208, 3620209), read from its 20-page manual
 * (Rev 1, 22.01.2026). The seat (1, 610x610x475) comes made: "Legs must be mounted". Under it goes a swivel base (2,
 * 235x170x210): a cross-shaped plate on a swivel, with a hub below that has a bracket for each of the four solid oak
 * legs (3, 447 long, 50x37). The legs bolt to the hub first (A, two each), then the base to the upturned seat (B, a
 * washer C under each, the triangle on the plate to the front); felt pads (E) go on the feet, it is stood up and sat
 * on, and every bolt is tightened. Seat height 50 cm, arms 66 cm.
 */

const A: HwDef = { kind: "bolt", len: 20, dia: 6 }; // M6x20, 8
const B: HwDef = { kind: "bolt", len: 25, dia: 6 }; // M6x25, 4
const C: HwDef = { kind: "washer", len: 1.5, dia: 16 }; // Ø6/Ø16; D is the 5 mm allen key
const E: HwDef = { kind: "glide", len: 3, dia: 25, name: "Felt pad" }; // 25x25x3

const BASE = 375; // the seat's underside: 850 high, the seat 475 of it
const PLATE = 8, HUB = 205; // the swivel plate under the seat, and the bottom of the hub (170 below the seat)
const TOP = 260, R0 = 45, R1 = 405; // each leg: its top end beside the hub, out to its foot on a diagonal

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "seat" || Math.round(s.size.w) !== 62 || Math.round(s.size.h) !== 85 || Math.round(s.size.d) !== 61) return false;
  const seat = body(b, { name: "Seat", label: "1", w: 610, d: 610, h: 850, base: BASE, seat: 500, back: 110, arm: 660, armW: 90 });

  const swivel = b.compound(
    "Swivel base",
    [
      { shape: "box", size: [235, PLATE, 40], pos: [0, BASE - PLATE / 2, 0] },
      { shape: "box", size: [40, PLATE, 235], pos: [0, BASE - PLATE / 2, 0] },
      { shape: "cyl", size: [60, BASE - PLATE - HUB, 60], pos: [0, (BASE - PLATE + HUB) / 2, 0] },
    ],
    { material: "metal", label: "2" },
  );
  const base = b.place(swivel.type, swivel.mid);

  // one leg type, drawn on the front right diagonal and turned a quarter round for each of the others
  const k = Math.SQRT1_2;
  const a0: Vec3 = [k * R0, TOP, k * R0], c0: Vec3 = [k * R1, 0, k * R1];
  const legT = b.compound("Leg", [rod(a0, c0, 44)], { material: "wood", label: "3" });
  const legs = [0, 1, 2, 3].map((i) => {
    const rot: Vec3 = [0, (i * Math.PI) / 2, 0];
    const a = rotate(a0, rot), c = rotate(c0, rot);
    return { key: b.place(legT.type, rotate(legT.mid, rot), rot), x: c[0] / R1, z: c[2] / R1, a, c };
  });
  const aBolts = legs.flatMap((l) =>
    [0.08, 0.2].map((t): FitOpts => {
      const p: Vec3 = [l.a[0] + (l.c[0] - l.a[0]) * t, l.a[1] + (l.c[1] - l.a[1]) * t, l.a[2] + (l.c[2] - l.a[2]) * t];
      const side: Vec3 = [-l.z, 0, l.x]; // across the leg, level
      return { on: base, at: [p[0] + side[0] * 25, p[1], p[2] + side[2] * 25], dir: [-side[0], 0, -side[2]], mate: l.key };
    }),
  );
  const bBolts = [[90, 0], [-90, 0], [0, 90], [0, -90]].map(([x, z]): FitOpts => ({ on: base, at: [x, BASE - PLATE, z], dir: [0, 1, 0], mate: seat }));
  const pads = legs.map((l): FitOpts => ({ on: l.key, at: l.c, dir: [0, 1, 0], hole: false }));

  b.step(
    {
      title: "Bolt the four legs (3) to the swivel base (2)",
      detail: "Stand the base upside down on its plate. Push each leg into a bracket on the hub and put two short bolts (A) through the bracket into it with the allen key (D), about 80% tight: 8 in all. Not the longer bolts (B).",
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
      detail: "Turn the seat upside down onto a rug and stand the base on it, the triangle on the plate towards the seat's front. Four longer bolts (B), a washer (C) on each, through the plate: about 80% tight.",
      kind: "bolts",
      tools: ["allen"],
      pose: "-y",
    },
    () => {
      b.add(seat, [0, 0, 300]);
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

import type { ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { body, RETIGHTEN, rod } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK HAGESTED wing armchair, 86 x 93 x 90 (3620269, 3620273), read from its 14-page manual (Rev 0, 22.01.2026).
 * The chair (1, 860x840x785) comes made: "Legs must be mounted". Its four solid rubber wood legs and the fittings are
 * packed in a box tucked under it. Upside down, the two straight front legs (2, 190x93x87) take three bolts (A) each
 * through their plates, the two raked back legs (3, 145x128x60) four each; then a felt pad (C) goes on every foot and
 * it is stood up. Seat height 45 cm, seat depth 55 cm; the arms' and back's thickness are read off the drawings.
 */

const A: HwDef = { kind: "bolt", len: 25, dia: 6 }; // M6x25, 14; B is the 5 mm allen key
const C: HwDef = { kind: "glide", len: 3, dia: 25, name: "Felt pad" };

const BASE = 145; // the chair's underside: 930 high, the chair 785 of it
const PLATE = 6;
const LX = 320, LZ = 300; // the leg plates, in from the sides, front and back

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "sofa" || Math.round(s.size.w) !== 86 || Math.round(s.size.h) !== 93 || Math.round(s.size.d) !== 90) return false;
  const chair = body(b, { name: "Armchair", label: "1", w: 860, d: 840, h: 930, base: BASE, seat: 450, back: 200, arm: 620, armW: 150 });

  // each pair is one leg type, raked straight forward or back, placed at both sides
  const pair = (label: string, name: string, z: number, rake: number, plate: Vec3) => {
    const top: Vec3 = [-LX, BASE - PLATE, z], foot: Vec3 = [-LX, 0, z + rake];
    const { type, mid } = b.compound(name, [{ shape: "box", size: plate, pos: [-LX, BASE - PLATE / 2, z] }, rod(top, foot, 42)], { material: "wood", label });
    return [-1, 1].map((g) => {
      const x = g * LX;
      return { key: b.place(type, [mid[0] + x + LX, mid[1], mid[2]]), x, z, foot: [x, 0, z + rake] as Vec3 };
    });
  };
  const fronts = pair("2", "Front leg", LZ, 20, [87, PLATE, 93]);
  const backs = pair("3", "Back leg", -LZ, -95, [128, PLATE, 60]);
  const bolts = (l: { key: string; x: number; z: number }, offs: [number, number][]) =>
    offs.map(([u, v]): FitOpts => ({ on: l.key, at: [l.x + u, BASE - PLATE, l.z + v], dir: [0, 1, 0], mate: chair }));
  const three: [number, number][] = [[-28, -30], [28, -30], [0, 32]];
  const four: [number, number][] = [[-45, -18], [45, -18], [-45, 18], [45, 18]];
  const pads = [...fronts, ...backs].map((l): FitOpts => ({ on: l.key, at: l.foot, dir: [0, 1, 0], hole: false }));

  b.step(
    {
      title: "Turn it over and take out the legs",
      detail: "Lay the armchair upside down on a rug. The box with the legs (2, 3), the bolts (A), the felt pads (C) and the allen key (B) is tucked into the underside: take it out.",
      kind: "flip",
      pose: "-y",
      warnings: ["floor"],
    },
    () => b.add(chair, [0, 0, 300]),
  );
  b.step(
    {
      title: "Bolt on the two front legs (2)",
      detail: "The straight legs go at the front, under the seat's front edge. Three bolts (A) through each leg's plate with the allen key.",
      kind: "legs",
      tools: ["allen"],
      pose: "-y",
    },
    () => {
      for (const l of fronts) {
        b.add(l.key, [0, 220, 0]);
        b.then(0.1);
        b.fits(A, bolts(l, three), 0.06);
      }
    },
  );
  b.step(
    {
      title: "Bolt on the two back legs (3)",
      detail: "The raked legs go at the back, leaning out behind. Four bolts (A) through each leg's plate.",
      kind: "legs",
      tools: ["allen"],
      pose: "-y",
    },
    () => {
      for (const l of backs) {
        b.add(l.key, [0, 220, 0]);
        b.then(0.1);
        b.fits(A, bolts(l, four), 0.06);
      }
    },
  );
  b.step(
    { title: "Stick on the felt pads (C)", detail: "Peel the backing off each pad and press one onto the end of every leg.", kind: "general", pose: "-y" },
    () => b.fits(C, pads, 0.1),
  );
  b.step({ title: "Stand it up", detail: `Turn it onto its legs. Tested for 110 kg in the home. ${RETIGHTEN}`, kind: "standup" }, () => {});
  return true;
}

const family: Family = { names: ["HAGESTED"], build };
export default family;

import type { ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { add, mul, rotate, sub } from "../math";
import { body, RETIGHTEN, rod } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK HAGESTED wing armchair, 86 x 93 x 90 (3620269, 3620273), read from its 14-page manual (Rev 0, 22.01.2026).
 * The chair (1, 860x840x785) comes made: "Legs must be mounted". Its four solid rubber wood legs and the fittings are
 * packed in a box tucked under it. Upside down, the two straight front legs (2, 190x93x87) take three bolts (A) each
 * through their plates, the two raked back legs (3, 145x128x60) four each; then a felt pad (C) goes on every foot and
 * it is stood up. The front legs are the longer, so it leans back a little. Seat height 45 cm, seat depth 55 cm; the
 * arms' and back's thickness are read off the drawings.
 */

const A: HwDef = { kind: "bolt", len: 25, dia: 6, form: "button" }; // M6x25, 14; B is the 5 mm allen key
const C: HwDef = { kind: "glide", len: 3, dia: 25, name: "Felt pad" };

const BASE = 145; // the chair's underside, in its own frame: 930 high, the chair 785 of it
const PLATE = 6, DIA = 40;
const LX = 320, LZ = 300; // the leg plates' centres, in from the sides, front and back

/** A leg drawn plate up, its top face on y = 0: a plate and a round leg from `top` down to its foot, raked along +x,
 *  the foot's lowest edge on y = -h; `reach`: the foot's centre along x, given the rake's angle. */
function leg(plate: Vec3, at: Vec3, top: Vec3, h: number, reach: (t: number) => number) {
  let t = 0, foot: Vec3 = [0, 0, 0];
  for (let i = 0; i < 20; i++) {
    foot = [reach(t), -h + (DIA / 2) * Math.sin(t), 0];
    t = Math.atan2(foot[0] - top[0], top[1] - foot[1]);
  }
  return { pieces: [{ shape: "box" as const, size: plate, pos: at }, rod(top, foot, DIA)], top, foot, low: [foot[0] - (DIA / 2) * Math.cos(t), -h, 0] as Vec3 };
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "sofa" || Math.round(s.size.w) !== 86 || Math.round(s.size.h) !== 93 || Math.round(s.size.d) !== 90) return false;
  const chair = body(b, { name: "Armchair", label: "1", w: 860, d: 840, h: 930, base: BASE, seat: 450, back: 200, arm: 620, armW: 150 });

  // p11: front leg 2 is 190x93x87, nearly straight under its plate; back leg 3 is 145x128x60, rising from one end
  // of a long plate and raked along it, past the plate's other end
  const front = leg([93, PLATE, 87], [0, -PLATE / 2, 0], [0, -PLATE, 0], 190, () => 15);
  const back = leg([100, PLATE, 60], [50, -PLATE / 2, 0], [78, -PLATE, 0], 145, (t) => 128 - (DIA / 2) * Math.cos(t));
  // the fronts point straight forward; the backs out to the back corners (p13, p14)
  const sides = (plateMid: Vec3, z: number, phi: (g: number) => number) =>
    [-1, 1].map((g) => ({ g, phi: phi(g), at: sub([g * LX, BASE, z], rotate(plateMid, [0, phi(g), 0])) }));
  const fs = sides([0, 0, 0], LZ, () => -Math.PI / 2);
  const bs = sides([50, 0, 0], -LZ, (g) => (g > 0 ? Math.PI / 4 : (3 * Math.PI) / 4));

  // the longer front legs tilt the chair back: turned about x until both feet meet the floor
  const inChair = (l: { at: Vec3; phi: number }, q: Vec3) => add(l.at, rotate(q, [0, l.phi, 0]));
  const lf = inChair(fs[0], front.low), lb = inChair(bs[0], back.low);
  const tilt = Math.atan2(lb[1] - lf[1], lf[2] - lb[2]);
  const R: Vec3 = [-tilt, 0, 0];
  const lift = -rotate(lf, R)[1];
  const W = (q: Vec3) => add(rotate(q, R), [0, lift, 0]);
  const ci = b.partItem(chair);
  ci.final = { pos: W(ci.final.pos), rot: R };

  const pair = (label: string, name: string, f: typeof front, list: { at: Vec3; phi: number }[]) => {
    const { type, mid } = b.compound(name, f.pieces, { material: "wood", label });
    return list.map((l) => ({ ...l, key: b.place(type, W(inChair(l, mid)), [-tilt, l.phi, 0]) }));
  };
  const fronts = pair("2", "Front leg", front, fs);
  const backs = pair("3", "Back leg", back, bs);
  const up = rotate([0, 1, 0], R);
  // bolts up through the plate from its underside, offsets on the plate as drawn
  const bolts = (l: (typeof fronts)[number], offs: [number, number][]) =>
    offs.map(([u, v]): FitOpts => ({ on: l.key, at: W(inChair(l, [u, -PLATE, v])), dir: up, mate: chair }));
  const three: [number, number][] = [[-30, -28], [-30, 28], [32, 0]];
  const four: [number, number][] = [[14, -18], [14, 18], [44, -18], [44, 18]]; // the plate's free end, clear of the leg
  const pad = (l: (typeof fronts)[number], f: typeof front): FitOpts => {
    const v = sub(f.top, f.foot), n = Math.hypot(...v);
    return { on: l.key, at: W(inChair(l, f.foot)), dir: rotate(rotate(mul(v, 1 / n), [0, l.phi, 0]), R), hole: false };
  };
  const pads = [...fronts.map((l) => pad(l, front)), ...backs.map((l) => pad(l, back))];

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
      detail: "The longer, straight legs go at the front, under the seat's front edge. Three bolts (A) through each leg's plate with the allen key.",
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
      detail: "The shorter, raked legs go at the back, leaning out towards the back corners. Four bolts (A) through each leg's plate.",
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

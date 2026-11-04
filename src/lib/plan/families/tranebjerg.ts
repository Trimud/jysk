import type { ProductSpec } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { body } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK TRANEBJERG armchair, 88 x 78 x 88 (3610175, 3610176), read from its 11-page manual (Rev 1, 04.02.2026).
 * The chair (1, 890x875x730) comes made, covered all over: "Legs must be mounted". Its four round feet (A, Ø60 x 50,
 * each with a threaded stud) are in a bag zipped inside the cover underneath. Upside down, they screw in by hand;
 * then it is stood up. Seat height 43 cm, seat depth 59 cm; the arms' and back's thickness are read off the drawings.
 */

const A: HwDef = { kind: "foot", len: 50, dia: 60, name: "Foot" };

const BASE = 50; // the chair's underside, on its feet
const FX = 350, FZ = 340; // the feet, in from the corners

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "sofa" || Math.round(s.size.w) !== 88 || Math.round(s.size.h) !== 78 || Math.round(s.size.d) !== 88) return false;
  const chair = body(b, { name: "Armchair", label: "1", w: 880, d: 875, h: 780, base: BASE, seat: 430, back: 180, arm: 600, armW: 160 });
  const feet = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([gx, gz]): FitOpts => ({ on: chair, at: [gx * FX, BASE, gz * FZ], dir: [0, 1, 0], hole: false }));

  b.step(
    {
      title: "Turn it over and open the zip underneath",
      detail: "Lay the armchair upside down on a rug. Open the zip in the cover underneath and take out the bag with the four feet (A).",
      kind: "flip",
      pose: "-y",
      warnings: ["floor"],
    },
    () => b.add(chair, [0, 0, 300]),
  );
  b.step(
    {
      title: "Screw in the four feet (A)",
      detail: "One into each threaded hole near the corners, clockwise by hand until it is snug. No tools.",
      kind: "legs",
      pose: "-y",
      warnings: ["hand"],
    },
    () => b.fits(A, feet, 0.15),
  );
  b.step({ title: "Stand it up", detail: "Turn it onto its feet. Tested for 110 kg in the home.", kind: "standup" }, () => {});
  return true;
}

const family: Family = { names: ["TRANEBJERG"], build };
export default family;

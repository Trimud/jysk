import type { ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import { spread } from "../math";
import { wallFix } from "./_wall";
import type { Family } from "./family";

/*
 * JYSK MOLLERUP coat rack, 5 hooks, bamboo (3670136), read from its 9-page manual (Rev.6, 13.07.2026).
 * A bamboo board (1, 500x60x14) and five round pegs (2, Ø15x50), each held by one screw (A, Ø4x30) put in from the
 * back of the board; the pegs point up a little. Two keyholes in the back hang it on two wall screws, which aren't
 * included. x along the board, y up, z out from the wall, the board's back on z = 0.
 */

const A = HW.screwM; // Ø4x30

const L = 500, H = 60, T = 14;
const PEG = 50, TILT = (20 * Math.PI) / 180; // read off the side view: the pegs rise about 20 degrees
const xs = spread(-200, 200, 5);
const KEY = [-180, 180]; // the two keyholes, near the ends of the back

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 50 || Math.round(s.size.h) !== 6) return false;
  const board = b.place(b.part("Board", [L, H, T], { material: "wood", label: "1" }), [0, H / 2, T / 2]);
  const pegT = b.part("Peg", [15, PEG, 15], { shape: "cyl", material: "wood", label: "2" });
  // a peg's axis is its local y: turned forward until it points out of the board and up by TILT
  const out: Vec3 = [0, Math.sin(TILT), Math.cos(TILT)];
  const pegs = xs.map((x) => b.place(pegT, [x, H / 2 + (out[1] * PEG) / 2, T + (out[2] * PEG) / 2], [Math.PI / 2 - TILT, 0, 0]));

  b.step(
    {
      title: "Screw the five pegs (2) onto the board (1)",
      detail: "Lay the board face down on a rug. One screw (A) through each hole from the back into the end of a peg, until the peg sits tight against the board.",
      tools: ["screwdriver"],
      kind: "screws",
      warnings: ["floor"],
    },
    () => {
      b.add(board, [0, 0, -200]);
      b.then(0.1);
      b.stagger(0.15);
      pegs.forEach((k) => b.add(k, [0, 0, 160]));
      b.then(0.1);
      b.fits(A, xs.map((x, i): FitOpts => ({ on: board, at: [x, H / 2, 0], dir: [0, 0, 1], mate: pegs[i] })), 0.06);
    },
  );
  b.step(
    {
      title: "Hang it on the wall",
      detail: "Hold it level where you want it, mark through the two keyholes on the back, drill and plug the holes, and screw in the two screws until their heads stand out about 3 mm. Hang the board's keyholes over them. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["tape", "pencil", "level", "drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => wallFix(b, KEY.map((x) => [x, H - 15]), 0),
  );
  return true;
}

const family: Family = { names: ["MOLLERUP"], build };
export default family;

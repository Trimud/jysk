import type { ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import { add, spread } from "../math";
import { wallFix } from "./_wall";
import type { Family } from "./family";

/*
 * JYSK MOLLERUP coat rack, 5 hooks, bamboo (3670136), read from its 9-page manual (Rev.6, 13.07.2026).
 * A bamboo board (1, 500x60x14) and five round pegs (2, Ø15x50), each held by one screw (A, Ø4x30) put in from the
 * back of the board, along the peg's axis; the pegs point up. Two keyholes in the back hang it on two wall screws, which aren't
 * included. x along the board, y up, z out from the wall, the board's back on z = 0.
 */

const A = HW.screwM; // Ø4x30

const L = 500, H = 60, T = 14;
const PEG = 50, TILT = (30 * Math.PI) / 180; // p8 inset, to scale: the peg and its screw rise about 30 degrees
const xs = spread(-200, 200, 5);
// the two keyholes in the back, about 100 mm in from each end (p9 panel I, measured): the round head low, the slot
// above it that the wall screw ends up in once the board has dropped AWAY's 6 mm onto it
const KEY = [-150, 150], SLOT = H - 15, HEAD = SLOT - 6;
const AWAY: Vec3 = [0, 6, 160]; // made off the wall, then hung: out from it and a little above the screw heads

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 50 || Math.round(s.size.h) !== 6) return false;
  const board = b.place(b.part("Board", [L, H, T], { material: "wood", label: "1" }), [0, H / 2, T / 2]);
  for (const x of KEY) {
    b.hole(board, [x, HEAD, 0], [0, 0, -1], 5);
    b.hole(board, [x, SLOT, 0], [0, 0, -1], 2.5);
  }
  const pegT = b.part("Peg", [15, PEG, 15], { shape: "cyl", material: "wood", label: "2" });
  // a peg's axis is its local y: turned forward until it points out of the board and up by TILT
  const out: Vec3 = [0, Math.sin(TILT), Math.cos(TILT)];
  // out along its axis until its square-cut end's low edge meets the board (the real end is cut to the slope)
  const s0 = PEG / 2 + 7.5 * Math.tan(TILT);
  const pegs = xs.map((x) => b.place(pegT, [x, H / 2 + out[1] * s0, T + out[2] * s0], [Math.PI / 2 - TILT, 0, 0]));
  // made away from the wall (p8), brought onto the screws in step 2 (p9)
  const off = (k: string, from: Vec3) => {
    const f = b.partItem(k).final;
    b.stage(k, add(f.pos, AWAY), f.rot, from);
  };

  b.step(
    {
      page: 8,
      title: "Screw the five pegs (2) onto the board (1)",
      detail: "Hold each peg (2) against its hole and drive one screw (A) through the board from the back into the end of the peg, until the peg sits tight against the board.",
      tools: ["screwdriver"],
      kind: "screws",
    },
    () => {
      off(board, [0, 0, -200]);
      b.then(0.1);
      b.stagger(0.15);
      pegs.forEach((k) => off(k, [0, 0, 160]));
      b.then(0.1);
      // p8 inset: each screw runs along its peg's axis, in low on the back and out at the peg's centre on the front
      b.fits(A, xs.map((x, i): FitOpts => ({ on: board, at: [x, H / 2 - Math.tan(TILT) * T, 0], dir: out, mate: pegs[i] })), 0.06);
    },
  );
  b.step(
    {
      page: 9,
      title: "Hang it on the wall",
      detail: "Hold it level where you want it, mark through the two keyholes on the back, take it down, drill and plug the holes, and screw in the two screws until their heads stand out about 3 mm. Hang the board's keyholes over them. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["tape", "pencil", "level", "drill", "hammer", "screwdriver"],
      kind: "anchor",
      wall: true,
    },
    () => {
      wallFix(b, KEY.map((x) => [x, SLOT]), 0);
      b.then(0.2);
      b.stagger(0);
      for (const k of [board, ...pegs]) b.add(k);
    },
  );
  return true;
}

const family: Family = { names: ["MOLLERUP"], build };
export default family;

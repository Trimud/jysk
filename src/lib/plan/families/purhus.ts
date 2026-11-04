import type { HwDef } from "../builder";
import { crossed } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK PURHUS dining chair with armrests, 59 x 84 x 58 (3640126 to 3640129), read from its 12-page manual (Rev 9,
 * 28.10.2025). The seat with its arms (1, 590x565x445) comes made: "Legs must be mounted". Two black steel leg frames
 * (2, 3: 695x430x25) cross in an X, arrows on the rails matching, with one short bolt (A) through the crossing; the
 * cross goes on the upturned seat with four long bolts (B), a washer (D) under each. Turned over and pressed down, all
 * five bolts are tightened. Seat height 49 cm, arms 63.5 cm. The PURHUS desk chair is another product: not this one.
 */

const A: HwDef = { kind: "bolt", len: 30, dia: 6 }; // M6x30
const B: HwDef = { kind: "bolt", len: 45, dia: 6 }; // M6x45
const D: HwDef = { kind: "washer", len: 1.5, dia: 16 }; // Ø16; C is the 5 mm allen key

const build = crossed({
  w: 59, h: 84, d: 58,
  seat: { name: "Seat", label: "1", w: 590, d: 565, h: 840, base: 395, seat: 490, back: 90, arm: 635, armW: 70 },
  frame: { len: 695, top: 470 },
  A, B, D,
  crossWasher: false,
  steps: "three",
  tested: "Tested for 110 kg in the home.",
});

const family: Family = { names: ["PURHUS"], build };
export default family;

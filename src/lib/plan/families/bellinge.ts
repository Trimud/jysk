import type { HwDef } from "../builder";
import { crossed } from "./_seat";
import type { Family } from "./family";

/*
 * JYSK BELLINGE dining chair, 52 x 83 x 60 (3640130, 3640131), read from its 12-page manual (Rev 3, 09.04.2025).
 * The seat (1, 520x585x445) comes made; JYSK sells it as "Legs must be mounted". The legs are two black steel frames
 * (2, 3: 630x410x32), each two splayed legs on a rail. The rails halve into each other in an X (arrows on them to line
 * up), one short bolt (A) with a washer (D) through the crossing, then the cross stands on the upturned seat and four
 * long bolts (B) with washers go up into it. Stood up and pressed down, every bolt is tightened. Seat height 48 cm.
 */

const A: HwDef = { kind: "bolt", len: 30, dia: 6 }; // M6x30
const B: HwDef = { kind: "bolt", len: 50, dia: 6 }; // M6x50
const D: HwDef = { kind: "washer", len: 1.5, dia: 16 }; // Ø16; C is the 5 mm allen key

const build = crossed({
  w: 52, h: 83, d: 60,
  seat: { name: "Seat", label: "1", w: 520, d: 585, h: 830, base: 385, seat: 480, back: 90 },
  frame: { len: 630, top: 440 },
  A, B, D,
  crossWasher: true,
  steps: "five",
  tested: "Tested for 110 kg in the home.",
});

const family: Family = { names: ["BELLINGE"], build };
export default family;

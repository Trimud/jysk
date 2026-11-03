import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * JYSK DALSHUSE 3 seater sofa, 2185 x 795 x 840 (3620187, 3620188), read from its 13-page manual (Rev 1, 03.02.2026).
 * The body (3) comes in one piece: arms, low back and the three sewn-in seat cushions. Laid on its back, the middle
 * leg (5) screws into the centre of the base and the four corner legs (4), each a steel tube on an 80 mm plate, are
 * bolted on with four M6x20 bolts (A) each. Stood up, the three loose back cushions (1, 2, 1) are pushed down into the
 * gap behind the seat. Seat height 44 cm and seat depth 55 cm are JYSK's; the arms' and back's thickness are read off
 * the drawings, so the 660 mm cushions fill the space between the arms.
 */

const A: HwDef = { kind: "bolt", len: 20, dia: 6 }; // M6x20, 16 of them; B is the 5 mm allen key

// x across, y up from the floor, z to the front
const W = 2185, D = 840, H = 795;
const LEG = 182; // the corner legs, plate included: the body's underside
const SEAT = 440, SEAT_D = 550; // top of the seat, and its depth from the front edge
const RIM = 640; // top of the arms and the back: 458 of body over the legs (its box is 470 high)
const ARM = 100; // the arms: 1985 between them, three 660 mm back cushions
const BACK = 75; // the back of the body, behind the cushions
const BASE = 332; // top of the base under the seat cushions
const IN = W / 2 - ARM;
const ZS = D / 2 - SEAT_D; // the seat cushions' back edge

// the back cushions lean back a little, their top at the full height, their front on the seat's back edge
const TILT = 0.06, ct = Math.cos(TILT), st = Math.sin(TILT);
const CW = 660, CH = 425, CT = 190;
const CY = H - (CH / 2) * ct - (CT / 2) * st;
const CZ = ZS + ((SEAT - CY - (CT / 2) * st) / ct) * st - (CT / 2) * ct;
const CX = [-1, 0, 1].map((k) => k * (2 * IN) / 3);

const LX = W / 2 - 52, LZ = D / 2 - 50; // corner leg plates: centred under the arms, 10 mm in from the ends
const PLATE = 4;
const corners: [number, number][] = [[-LX, LZ], [LX, LZ], [LX, -LZ], [-LX, -LZ]];

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "sofa" || Math.round(s.size.w) !== 219 || Math.round(s.size.h) !== 80 || Math.round(s.size.d) !== 84) return false;

  /* ---------- parts, the manual's numbers as labels ---------- */

  const soft = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
  const third = (2 * IN) / 3;
  const body = b.compound(
    "Sofa body",
    [
      soft([2 * IN, BASE - LEG, D - BACK], [0, (LEG + BASE) / 2, BACK / 2]),
      ...[-1, 1].map((g) => soft([ARM, RIM - LEG, D], [g * (IN + ARM / 2), (LEG + RIM) / 2, 0])),
      soft([2 * IN, RIM - LEG, BACK], [0, (LEG + RIM) / 2, -D / 2 + BACK / 2]),
      ...CX.map((x) => soft([third - 4, SEAT - BASE, SEAT_D], [x, (BASE + SEAT) / 2, ZS + SEAT_D / 2])),
    ],
    { material: "soft", label: "3" },
  );
  const sofa = b.place(body.type, body.mid);

  const cushion = (label: string) => b.part("Back cushion", [CW, CH, CT], { material: "soft", label });
  const c1 = cushion("1"), c2 = cushion("2");
  // ponytail: the outer cushions' flared outer edge is drawn square, like the middle one's
  const backs = CX.map((x, i) => b.place(i === 1 ? c2 : c1, [x, CY, CZ], [-TILT, 0, 0]));

  // a corner leg (4): a steel tube under an 80 x 80 plate, 182 high in all
  const leg = b.compound(
    "Leg",
    [
      { shape: "box", size: [80, PLATE, 80], pos: [0, LEG - PLATE / 2, 0] },
      { shape: "cyl", size: [32, LEG - PLATE, 32], pos: [0, (LEG - PLATE) / 2, 0] },
    ],
    { material: "metal", label: "4" },
  );
  const legs = corners.map(([x, z]) => b.place(leg.type, [x + leg.mid[0], leg.mid[1], z + leg.mid[2]]));
  // the middle leg (5): a Ø25 tube with a threaded stud on top and a screw-in foot under it.
  // ponytail: 177 mm with its foot screwed home (the manual's size); drawn with the foot 17 mm out, down to the floor
  const mid = b.compound(
    "Middle leg",
    [
      { shape: "cyl", size: [8, 12, 8], pos: [0, LEG + 6, 0] },
      { shape: "cyl", size: [25, LEG - 17, 25], pos: [0, (LEG + 17) / 2, 0] },
      { shape: "cyl", size: [10, 7, 10], pos: [0, 13.5, 0] },
      { shape: "cyl", size: [25, 10, 25], pos: [0, 5, 0] },
    ],
    { material: "metal", label: "5" },
  );
  const middle = b.place(mid.type, mid.mid);

  // four bolts up through each plate's corners into the frame's threaded inserts
  const bolts = corners.flatMap(([x, z], i) =>
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): FitOpts => ({ on: legs[i], at: [x + u * 27, LEG - PLATE, z + v * 27], dir: [0, 1, 0], mate: sofa })),
  );

  /* ---------- on its back ---------- */

  b.step(
    {
      title: "Lay the sofa (3) on its back",
      detail: "Two of you, onto a rug or the flattened box. The legs (4, 5), the 16 bolts (A) and the allen key (B) are in the pouch on the underside.",
      pose: "+z",
      kind: "general",
      people: 2,
      warnings: ["two", "floor"],
    },
    () => b.add(sofa, [0, 0, 300]),
  );
  b.step(
    { title: "Screw the middle leg (5) into the centre", detail: "Into the threaded hole in the middle of the base, clockwise by hand until it is snug.", pose: "+z", kind: "legs", warnings: ["hand"] },
    () => b.add(middle, [0, -220, 0], { spin: 3 }),
  );
  b.step(
    {
      title: "Bolt the four legs (4) to the corners",
      detail: "Each plate over its four holes, then four bolts (A) through it with the allen key (B): 16 in all. Tighten each leg's bolts in turn.",
      tools: ["allen"],
      pose: "+z",
      kind: "legs",
    },
    () => {
      b.stagger(0.25);
      for (const k of legs) b.add(k, [0, -240, 0]);
      b.then(0.15);
      b.fits(A, bolts, 0.06);
    },
  );

  /* ---------- standing ---------- */

  b.step(
    {
      title: "Stand it up and push in the back cushions (1, 2, 1)",
      detail: "Two of you, onto its legs. The middle cushion (2) goes in the middle and the two shaped ones (1) at the ends, their curved edge out towards the arm: push each down into the gap behind the seat. Then turn the foot of the middle leg until it meets the floor.",
      pose: "+y",
      kind: "cushions",
      people: 2,
      warnings: ["two"],
    },
    () => {
      b.stagger(0.25);
      for (const k of backs) b.add(k, [0, 360, 0]);
    },
  );
  return true;
}

const family: Family = { names: ["DALSHUSE"], build };
export default family;

import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * JYSK HADSTEN wall hooks, pack of 5 (3681371, 57616001), read from its 4-page manual (Rev.7, 23.04.2024).
 * Five round wooden balls, two large (Ø83) and three small (Ø50), each on a short neck with its own wood screw in the
 * back; the large ones stand 80 mm off the wall. For each one: drill a hole, tap in a wall plug (not included), screw the knob in by hand.
 * The manual leaves where they go to you; this guide hangs them in a row, large ones second and fourth.
 * x along the wall, y up, z out from it, the wall face on z = 0.
 */

const NECK = 14; // the short collar between the wall and the ball, read off page 4's drawing
const CUT = 0.3; // the ball's back is cut flat where it meets the neck, this far behind its centre (x its dia): 80 deep for Ø83
const ROW: { x: number; big: boolean }[] = [
  { x: -300, big: false },
  { x: -150, big: true },
  { x: 0, big: false },
  { x: 150, big: true },
  { x: 300, big: false },
];

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 5 || Math.round(s.size.d) !== 8) return false;
  /** the ball, its back cut flat on the neck, CUT x its dia behind its centre: 0.8 x dia long, turned from y to z */
  const ball = (d: number): PartPiece => ({ shape: "ball", size: [d, d * (0.5 + CUT), d], pos: [0, 0, NECK + (d * (0.5 + CUT)) / 2], rot: [Math.PI / 2, 0, 0] });
  /** the wood screw standing out of the neck's back, len long: a core, a thread ring every 2.5 mm and a pointed tip */
  const screw = (len: number): PartPiece[] => {
    const turn: Vec3 = [Math.PI / 2, 0, 0], tip = 5;
    return [
      { shape: "cyl", size: [3.4, len - tip, 3.4], pos: [0, 0, -(len - tip) / 2], rot: turn, material: "metal" },
      { shape: "cyl", size: [3.4, tip, 3.4], foot: 0.4, pos: [0, 0, -len + tip / 2], rot: turn, material: "metal" },
      ...Array.from({ length: Math.floor((len - tip) / 2.5) }, (_, i): PartPiece => ({ shape: "cyl", size: [5, 0.8, 5], pos: [0, 0, -1.5 - i * 2.5], rot: turn, material: "metal" })),
    ];
  };
  const knob = (name: string, label: string, d: number, len: number) =>
    b.compound(
      name,
      [{ shape: "cyl", size: [d * 0.4, NECK + 1, d * 0.4], pos: [0, 0, (NECK + 1) / 2], rot: [Math.PI / 2, 0, 0] }, ball(d), ...screw(len)],
      { material: "wood", label },
    );
  // the screws measured off page 1 against the balls: about 20 mm on the large one, 16 on the small
  const big = knob("Large hook", "1", 83, 20), small = knob("Small hook", "2", 50, 16);
  const y = 83 / 2;
  const hooks = ROW.map((h) => {
    const t = h.big ? big : small;
    return b.place(t.type, [h.x + t.mid[0], y + t.mid[1], t.mid[2]]);
  });
  // the wall's face at the necks' backs (the stage would put it at the screw tips, the parts' deepest point)
  const WALL = 0;
  b.view({ wallZ: WALL });
  const holes = ROW.map((h): Vec3 => [h.x, y, WALL]);

  b.step({
    page: 4,
    title: "Mark and drill a hole for each hook",
    detail: "Mark the five spots on the wall, level with each other, and drill a hole at each one with a bit to suit your wall plugs.",
    tools: ["tape", "pencil", "level", "drill"],
    kind: "anchor",
    wall: true,
  });
  b.step(
    {
      page: 4,
      title: "Tap a wall plug into each hole",
      detail: "Plugs aren't included: pick ones made for your wall that take the hooks' screws.",
      tools: ["hammer"],
      kind: "anchor",
      wall: true,
    },
    // p4 panel 2: pushed right into its hole, only its lip showing level with the wall
    () => b.fits(HW.plug, holes.map((at): FitOpts => ({ at: [at[0], at[1], at[2] - 1.2], dir: [0, 0, -1] })), 0.15),
  );
  b.step(
    {
      page: 4,
      title: "Screw in the hooks",
      detail: "Two large and three small. Turn each one clockwise by hand until it sits tight against the wall.",
      kind: "screws",
      wall: true,
    },
    () => {
      b.stagger(0.2);
      hooks.forEach((k) => b.add(k, [0, 0, 160]));
    },
  );
  return true;
}

const family: Family = { names: ["HADSTEN"], build };
export default family;

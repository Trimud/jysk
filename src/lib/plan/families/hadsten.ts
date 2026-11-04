import type { ProductSpec, Vec3 } from "../../types";
import { HW, type FitOpts, type PlanBuilder } from "../builder";
import type { Family } from "./family";

/*
 * JYSK HADSTEN wall hooks, pack of 5 (3681371, 57616001), read from its 4-page manual (Rev.7, 23.04.2024).
 * Five round wooden knobs, two large (Ø83) and three small (Ø50), each 80 mm from the wall to its front with its own
 * wood screw in the back. For each one: drill a hole, tap in a wall plug (not included), screw the knob in by hand.
 * The manual leaves where they go to you; this guide hangs them in a row, large ones second and fourth.
 * x along the wall, y up, z out from it, the wall face on z = 0.
 */

const DEPTH = 80;
const NECK = 22; // the short collar between the wall and the ball, read off the drawing
const ROW: { x: number; big: boolean }[] = [
  { x: -300, big: false },
  { x: -150, big: true },
  { x: 0, big: false },
  { x: 150, big: true },
  { x: 300, big: false },
];

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (Math.round(s.size.w) !== 5 || Math.round(s.size.d) !== 8) return false;
  const knob = (name: string, label: string, d: number) =>
    b.compound(
      name,
      [
        // ponytail: the ball drawn as a short thick disc; the engine has no sphere piece
        { shape: "cyl", size: [d * 0.45, NECK, d * 0.45], pos: [0, 0, NECK / 2], rot: [Math.PI / 2, 0, 0] },
        { shape: "cyl", size: [d, DEPTH - NECK, d], pos: [0, 0, NECK + (DEPTH - NECK) / 2], rot: [Math.PI / 2, 0, 0] },
      ],
      { material: "wood", label },
    );
  const big = knob("Large hook", "1", 83), small = knob("Small hook", "2", 50);
  const y = 83 / 2;
  const hooks = ROW.map((h) => {
    const t = h.big ? big : small;
    return b.place(t.type, [h.x + t.mid[0], y + t.mid[1], t.mid[2]]);
  });
  const holes = ROW.map((h): Vec3 => [h.x, y, 0]);

  b.step(
    {
      title: "Mark and drill a hole for each hook",
      detail: "Mark the five spots on the wall, level with each other, and drill a hole at each one with a bit to suit your wall plugs.",
      tools: ["tape", "pencil", "level", "drill"],
      kind: "anchor",
      wall: true,
    },
    () => {},
  );
  b.step(
    {
      title: "Tap a wall plug into each hole",
      detail: "Plugs aren't included: pick ones made for your wall that take the hooks' screws.",
      tools: ["hammer"],
      kind: "anchor",
      wall: true,
    },
    () => b.fits(HW.plug, holes.map((at): FitOpts => ({ at: [at[0], at[1], -3], dir: [0, 0, -1] })), 0.15),
  );
  b.step(
    {
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

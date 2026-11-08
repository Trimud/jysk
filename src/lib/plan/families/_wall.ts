import type { StepDef } from "../builder";
import { HW, type PlanBuilder } from "../builder";
import type { Vec3 } from "../../types";

/** A plug into the wall behind each point ([x, y]) on its face at z = `wall`, then a wall screw, its head at `screwZ`. */
export function wallFix(b: PlanBuilder, pts: [number, number][], wall: number, screwZ = wall + 1) {
  const dir: Vec3 = [0, 0, -1];
  b.fits(HW.plug, pts.map(([x, y]) => ({ at: [x, y, wall - 3] as Vec3, dir })), 0.2);
  b.then(0.1);
  b.fits(HW.wallScrew, pts.map(([x, y]) => ({ at: [x, y, screwZ] as Vec3, dir })), 0.2);
}

/** Fixing it to the wall through its brackets, at these x under a top at `ty`, its back on z = `wall`; `screwZ`: where
 *  the wall screws' heads sit (on the brackets' upright legs), the back's face by default. */
export function wallStep(b: PlanBuilder, xs: number[], ty: number, wall: number, o: Partial<StepDef> = {}, screwZ?: number) {
  const many = xs.length > 1, s = many ? "s" : "";
  b.step(
    {
      title: "Stand it up and fix it to the wall",
      detail: `Push it against the wall, mark through the bracket${s}, drill and plug the hole${s}, screw the bracket${s} to the wall and tighten the ${many ? "bracket screws" : "two bracket screws"} fully. Wall screws and plugs aren't included: pick ones made for your wall.`,
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      pose: "+y",
      kind: "anchor",
      wall: true,
      warnings: ["tip", "wall"],
      ...o,
    },
    () => wallFix(b, xs.map((x) => [x, ty - 24]), wall, screwZ),
  );
}

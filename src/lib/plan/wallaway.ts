import type { HwItem, PartItem, Plan, Vec3 } from "../types";
import { insidePart, rotate, stateAt, toLocal } from "./math";

/**
 * A wall step done as a manual draws it: hold the piece at the wall and mark through its holes, move it away, drill and
 * plug the bare wall, put it back, then drive the screws through it into the plugs. When anything already in place in
 * step `s` (a part, or a fitting such as an anti-topple bracket's upright leg) stands in the way a plug comes in, this
 * gives the parts that stand aside (all of the step's scene already in place: the assembled piece, its fittings riding
 * with it), the way away from the wall, and the first and last plugs' delays (plan time). Null when the step has no
 * wall plug, or nothing stands in front of one (plug first, the piece or bracket comes after it).
 * ponytail: a fitting stands in the way when its origin is within its own length (or width) of a plug's path, not
 * by its drawn shape; and a step whose plugs go in different ways (two walls) doesn't move.
 */
export function wallAway(plan: Plan, s: number): { parts: string[]; dir: Vec3; from: number; last: number } | null {
  const step = plan.steps[s];
  if (!step?.wall) return null;
  const types = new Map(plan.hardware.map((h) => [h.id, h]));
  const parts = plan.items.filter((i): i is PartItem => i.kind === "part");
  const byKey = new Map(parts.map((p) => [p.key, p]));
  const hws = plan.items.filter((i): i is HwItem => i.kind === "hw" && i.step <= s);
  const plugs = hws.filter((h) => h.step === s && h.wall && types.get(h.ref)?.kind === "plug");
  if (!plugs.length) return null;
  const from = Math.min(...plugs.map((h) => h.delay));
  // a part or fitting in place before the first plug, where it sits in this step (root frame)
  const placed = (key: string) => {
    const st = stateAt(byKey.get(key)?.states ?? [], s).st;
    return st && !st.ghost && st.scene === step.scene && (st.step < s || st.delay < from) ? st : null;
  };
  const inRoot = (h: HwItem) => {
    const st = h.parent ? placed(h.parent) : null;
    if (h.parent && !st) return null;
    const at = st ? rotate(h.pos, st.rot).map((v, i) => v + st.pos[i]) as Vec3 : h.pos;
    return { at, dir: st ? rotate(h.dir, st.rot) : h.dir };
  };
  const home = parts.filter((p) => placed(p.key));
  const paths = plugs.map((h) => ({ h, ...inRoot(h)! })).filter((p) => p.at);
  if (paths.length !== plugs.length) return null;
  const dir = paths[0].dir, n = Math.hypot(...dir) || 1;
  if (paths.some((p) => (p.dir[0] * dir[0] + p.dir[1] * dir[1] + p.dir[2] * dir[2]) / ((Math.hypot(...p.dir) || 1) * n) < 0.9)) return null;
  const away: Vec3 = [-dir[0] / n, -dir[1] / n, -dir[2] / n];
  // the plug's way in: from where it starts (its travel out of the wall) to 1 mm short of the wall
  const along = (p: (typeof paths)[number], k: number): Vec3 => [p.at[0] + away[0] * k, p.at[1] + away[1] * k, p.at[2] + away[2] * k];
  const partInWay = paths.some((p) =>
    home.some((part) => {
      const st = placed(part.key)!, t = plan.parts.find((x) => x.id === part.ref)!;
      for (let k = 1; k <= p.h.travel; k += 2) if (insidePart(t, toLocal(along(p, k), st.pos, st.rot), -0.5)) return true;
      return false;
    }),
  );
  const fitInWay = () =>
    hws.some((h) => {
      const ht = types.get(h.ref);
      if (!ht || ht.kind === "plug" || (h.step === s && h.delay >= from) || (!h.parent && h.scene !== step.scene)) return false;
      const r = inRoot(h);
      if (!r) return false;
      return paths.some((p) => {
        const v = [r.at[0] - p.at[0], r.at[1] - p.at[1], r.at[2] - p.at[2]];
        const k = v[0] * away[0] + v[1] * away[1] + v[2] * away[2];
        const off = Math.hypot(v[0] - away[0] * k, v[1] - away[1] * k, v[2] - away[2] * k);
        return k > -20 && k < p.h.travel && off < Math.max(ht.len, ht.dia);
      });
    });
  if (!partInWay && !fitInWay()) return null;
  return { parts: home.map((p) => p.key), dir: away, from, last: Math.max(...plugs.map((h) => h.delay)) };
}

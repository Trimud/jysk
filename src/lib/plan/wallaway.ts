import type { HwItem, PartItem, Plan, Vec3 } from "../types";
import { insidePart, rotate, stateAt, toLocal } from "./math";

/**
 * A wall step done as a manual draws it: hold the piece at the wall and mark through its holes, move it away, drill and
 * plug the bare wall, put it back, then drive the screws through it into the plugs. When anything already in place in
 * step `s` (a part, or a fitting such as an anti-topple bracket's upright leg) stands in the way a plug comes in, this
 * gives the parts that stand aside (all of the step's scene already in place: the assembled piece, its fittings riding
 * with it), the way away from the wall, and the first and last plugs' delays (plan time). Null when the step has no
 * wall plug, or nothing stands in front of one (plug first, the piece or bracket comes after it).
 * When the piece already hangs on an earlier step's wall screws (screws into the wall through or on one of those
 * parts), it can't come off the wall: `pivot` then gives the line it swings out about instead (through those screws,
 * on the wall), turned so a positive swing takes the plugs' side off the wall, and `r`, the nearest plug's distance
 * from that line (mm), to work out how far it swings.
 * ponytail: a fitting stands in the way when its origin is within its own length (or width) of a plug's path, not
 * by its drawn shape; and a step whose plugs go in different ways (two walls) doesn't move.
 */
export function wallAway(plan: Plan, s: number): { parts: string[]; dir: Vec3; from: number; last: number; pivot?: { at: Vec3; axis: Vec3; r: number } } | null {
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
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  // onto the wall, at the plugs' depth
  const flat = (q: Vec3): Vec3 => { const k = dot(sub(q, paths[0].at), away); return [q[0] - away[0] * k, q[1] - away[1] * k, q[2] - away[2] * k]; };
  // earlier wall screws the piece hangs on: into the wall, on one of its parts or with their head in one
  const held = hws
    .filter((h) => h.step < s && h.wall && types.get(h.ref)?.kind === "screw")
    .map((h) => ({ h, r: inRoot(h) }))
    .filter(({ h, r }) => r && dot(r.dir, away) < -0.9 * (Math.hypot(...r.dir) || 1) && (!!h.parent || home.some((p) => { const st = placed(p.key)!; return insidePart(plan.parts.find((x) => x.id === p.ref)!, toLocal(r.at, st.pos, st.rot), 2); })))
    .map(({ r }) => flat(r!.at));
  const res = { parts: home.map((p) => p.key), dir: away, from, last: Math.max(...plugs.map((h) => h.delay)) };
  if (!held.length) return res;
  // the line through the two screws furthest apart; one screw: ponytail, the line through it square to the way to the
  // plugs (it swings out about that one screw as if it were a hinge)
  let [a, b] = [held[0], held[0]];
  for (const p of held) for (const q of held) if (Math.hypot(...sub(p, q)) > Math.hypot(...sub(a, b))) [a, b] = [p, q];
  const mid = flat(paths.map((p) => p.at).reduce((m, q) => [m[0] + q[0] / paths.length, m[1] + q[1] / paths.length, m[2] + q[2] / paths.length], [0, 0, 0] as Vec3));
  const cross = (u: Vec3, v: Vec3): Vec3 => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  let axis = Math.hypot(...sub(b, a)) > 1 ? sub(b, a) : cross(away, sub(mid, a));
  const len = Math.hypot(...axis);
  if (len < 1) return res;
  axis = [axis[0] / len, axis[1] / len, axis[2] / len];
  // each plug's way out from the line, in the wall: all on one side, or it can't swing (it slides off instead)
  const radial = paths.map((p) => { const v = sub(flat(p.at), a), k = dot(v, axis); return sub(v, [axis[0] * k, axis[1] * k, axis[2] * k]); });
  const side = radial.map((w) => dot(cross(axis, w), away));
  if (!side.every((x) => x > 1) && !side.every((x) => x < -1)) return res;
  if (side[0] < 0) axis = [-axis[0], -axis[1], -axis[2]];
  return { ...res, pivot: { at: a, axis, r: Math.min(...radial.map((w) => Math.hypot(...w))) } };
}

import type { PartPiece, PartState, PartType, Pose, Vec3 } from "../types";

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];

/** 0, 1, … k-1. */
export const range = (k: number) => Array.from({ length: k }, (_, i) => i);
/** k evenly spaced values from a to c (their middle when k is 1). */
export const spread = (a: number, c: number, k: number) => range(k).map((i) => (k === 1 ? (a + c) / 2 : a + ((c - a) * i) / (k - 1)));
/** Left (-1) for the first of a pair, right (1) for the second. */
export const sg = (i: number) => (i === 0 ? -1 : 1);

function rx(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}
function ry(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rz(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2]];
}

/** Rotate by an XYZ Euler (same convention as three.js): R = Rx * Ry * Rz */
export function rotate(v: Vec3, e: Vec3): Vec3 {
  return rx(ry(rz(v, e[2]), e[1]), e[0]);
}
export function unrotate(v: Vec3, e: Vec3): Vec3 {
  return rz(ry(rx(v, -e[0]), -e[1]), -e[2]);
}

export function toLocal(p: Vec3, pos: Vec3, rot: Vec3): Vec3 {
  return unrotate(sub(p, pos), rot);
}
export function toWorld(p: Vec3, pos: Vec3, rot: Vec3): Vec3 {
  return add(rotate(p, rot), pos);
}

export const POSE_EULER: Record<Pose, Vec3> = {
  "+y": [0, 0, 0],
  "-y": [Math.PI, 0, 0],
  "+z": [-Math.PI / 2, 0, 0],
  "-z": [Math.PI / 2, 0, 0],
  "+x": [0, 0, Math.PI / 2],
  "-x": [0, 0, -Math.PI / 2],
};

export const round = (n: number) => Math.round(n * 10) / 10;
export const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/**
 * Whether a point in a part's own frame is inside it, at least `margin` mm in from its surface (a negative margin
 * counts points just outside): in one of its pieces, or its own box or cylinder. Boxes, cylinders (along y) and boards
 * cut to an outline, flat or bent round an axis; the bent tubes and half round pieces never count.
 */
export function insidePart(t: Pick<PartType, "shape" | "size" | "pieces">, q: Vec3, margin = 0) {
  const pieces: PartPiece[] = t.pieces ?? [{ shape: t.shape, size: t.size, pos: [0, 0, 0] }];
  return pieces.some((pc) => {
    const [x, y, z] = pc.rot ? unrotate(sub(q, pc.pos), pc.rot) : sub(q, pc.pos);
    if (pc.shape === "bent") {
      if (!pc.outline || !pc.bend) return false;
      // back to the flat board: along its middle surface, up, and across it
      const { r, t: th } = pc.bend, { mid } = bentBox(pc.outline, pc.bend);
      const px = x + mid[0], py = y + mid[1], pz = z + mid[2], s = Math.sign(r);
      const u = r * Math.atan2(s * px, s * (r - pz)), w = r - s * Math.hypot(px, r - pz);
      return Math.abs(w) < th / 2 - margin && inPolygon(pc.outline, u, py) && edgeDist(pc.outline, u, py) > margin;
    }
    const [w, h, d] = pc.size;
    if (Math.abs(y) >= h / 2 - margin) return false;
    if (pc.shape === "box") return Math.abs(x) < w / 2 - margin && Math.abs(z) < d / 2 - margin;
    if (pc.shape === "cyl") return Math.hypot(x, z) < w / 2 - margin; // ponytail: a tapered leg as its top's width
    if (pc.shape === "slab" && pc.outline) return inPolygon(pc.outline, x, z) && edgeDist(pc.outline, x, z) > margin;
    return false;
  });
}
/** A point of a board bent round a vertical axis: u along its middle surface, y up, w across it (+ towards the bend's
 *  centre), from the middle of that surface. r: the middle surface's radius, its centre towards +z (negative: -z). */
export const bendAt = (u: number, y: number, w: number, r: number): Vec3 => [(r - w) * Math.sin(u / r), y, r - (r - w) * Math.cos(u / r)];

/** Where a vertical line at u crosses an outline of [u, y] corners: its lowest and highest y.
 *  ponytail: one span, so a bent board's outline must be one any vertical line crosses once (a D, a rectangle). */
export function spanAt(pts: [number, number][], u: number): [number, number] {
  let lo = Infinity, hi = -Infinity;
  pts.forEach(([au, ay], i) => {
    const [bu, by] = pts[(i + 1) % pts.length];
    if (u < Math.min(au, bu) || u > Math.max(au, bu)) return;
    for (const y of au === bu ? [ay, by] : [ay + ((by - ay) * (u - au)) / (bu - au)]) {
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
  });
  return [lo, hi];
}

/** A bent board's bounding box: its centre (from the outline's origin) and size. ponytail: bends under a half turn. */
export function bentBox(pts: [number, number][], bend: { r: number; t: number }): { mid: Vec3; size: Vec3 } {
  const us = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const ps = [u0, u1, ...(u0 < 0 && u1 > 0 ? [0] : [])].flatMap((u) => [-1, 1].map((k) => bendAt(u, 0, (k * bend.t) / 2, bend.r)));
  const lo: Vec3 = [Math.min(...ps.map((p) => p[0])), Math.min(...ys), Math.min(...ps.map((p) => p[2]))];
  const hi: Vec3 = [Math.max(...ps.map((p) => p[0])), Math.max(...ys), Math.max(...ps.map((p) => p[2]))];
  return { mid: mul(add(lo, hi), 0.5), size: sub(hi, lo) };
}

/** A board cut to `outline` ([u, y]: along it, up) and bent round a vertical axis, the middle of its middle surface at
 *  `at`: a piece centred on its bounding box, as compound and the clash check expect. */
export function bentPiece(outline: [number, number][], bend: { r: number; t: number }, at: Vec3, o: Pick<PartPiece, "rot" | "material" | "tone"> = {}): PartPiece {
  const { mid, size } = bentBox(outline, bend);
  return { shape: "bent", outline, bend, size, pos: add(at, o.rot ? rotate(mid, o.rot) : mid), ...o };
}

function inPolygon(pts: [number, number][], x: number, z: number) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function edgeDist(pts: [number, number][], x: number, z: number) {
  return Math.min(
    ...pts.map(([ax, az], i) => {
      const [bx, bz] = pts[(i + 1) % pts.length];
      const k = clamp(((x - ax) * (bx - ax) + (z - az) * (bz - az)) / ((bx - ax) ** 2 + (bz - az) ** 2 || 1), 0, 1);
      return Math.hypot(x - ax - k * (bx - ax), z - az - k * (bz - az));
    }),
  );
}

/** A part's state in step s and the one before it; a ghost (a layout's part shown where it'll go) is for its own step only. */
export function stateAt(states: PartState[], s: number) {
  let st: PartState | null = null;
  let prev: PartState | null = null;
  for (const x of states)
    if (x.step === s || (x.step < s && !x.ghost)) {
      prev = st;
      st = x;
    }
  return { st, prev };
}

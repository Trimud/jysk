import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { faceMaterial, hullMaterial, lineMaterial, withBoxHullDir, withCylHullDir, withHullDir } from "./materials";
import type { HwType, Hole, PartMark, PartType, Pose, Vec3 } from "@/lib/types";
import { FACE } from "./materials";
import { BRACKET, CLIP_BOSS, RUNNER, UNDER } from "./sizes";
import { bendAt, bentBox, spanAt } from "@/lib/plan/math";

export class Drawable {
  root = new THREE.Group();
  faces: THREE.ShaderMaterial[] = [];
  lines: LineMaterial[] = [];
  thin: LineMaterial[] = [];
  hulls: THREE.ShaderMaterial[] = [];
  /** printed text on a face (PartType.mark), faded with the rest */
  decals: THREE.MeshBasicMaterial[] = [];
  meshes: THREE.Mesh[] = [];
  base: THREE.Color[] = [];
  /** a part's material per face (parts only), so a product colour can go on its board panels */
  mats: string[] = [];
  /** a piece's own tone per face, where it has one */
  tones: (number | undefined)[] = [];
  opacity = 1;
}

interface GeoEntry {
  geo: THREE.BufferGeometry;
  edges: LineSegmentsGeometry;
}
const geoCache = new Map<string, GeoEntry>();

function entry(key: string, make: () => THREE.BufferGeometry, threshold = 30): GeoEntry {
  let e = geoCache.get(key);
  if (!e) {
    const geo = make();
    const edges = new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo, threshold));
    e = { geo, edges };
    geoCache.set(key, e);
  }
  return e;
}

type HullKind = "cyl" | "radial" | "box" | "normal" | null;

export function addSolid(
  d: Drawable,
  key: string,
  make: () => THREE.BufferGeometry,
  color: THREE.Color,
  o: { hull?: HullKind; half?: THREE.Vector3Tuple; cy?: number; position?: THREE.Vector3Tuple; rotation?: THREE.Vector3Tuple; edges?: boolean; parent?: THREE.Object3D } = {},
) {
  const e = entry(key, () => {
    const g = make();
    if (o.hull === "cyl") withCylHullDir(g, o.cy ?? 0);
    else if (o.hull === "box" && o.half) withBoxHullDir(g, ...o.half);
    else if (o.hull === "normal") {
      // the outline pushes each point out along its own surface normal: right for a bent tube, whose middle is empty
      g.setAttribute("hullDir", g.getAttribute("normal").clone());
    } else if (o.hull === "radial") {
      g.computeBoundingBox();
      const c = new THREE.Vector3();
      g.boundingBox!.getCenter(c);
      withHullDir(g, c);
    }
    return g;
  });
  const holder = new THREE.Group();
  if (o.position) holder.position.set(...o.position);
  if (o.rotation) holder.rotation.set(...o.rotation);
  const fm = faceMaterial(color);
  const mesh = new THREE.Mesh(e.geo, fm);
  holder.add(mesh);
  d.faces.push(fm);
  d.base.push(color.clone());
  d.meshes.push(mesh);
  if (o.edges !== false) {
    const lm = lineMaterial(1.6);
    const ls = new LineSegments2(e.edges, lm);
    holder.add(ls);
    d.lines.push(lm);
  }
  if (o.hull) {
    const hm = hullMaterial(1.6);
    const hull = new THREE.Mesh(e.geo, hm);
  if (o.hull === "box") hm.uniforms.uWidth.value = 2;
    hull.renderOrder = -1;
    holder.add(hull);
    d.hulls.push(hm);
  }
  (o.parent ?? d.root).add(holder);
  return holder;
}

/* ---------------- parts ---------------- */

const MAT_COLOR: Record<string, THREE.Color> = {
  board: FACE.board,
  fiber: FACE.fiber,
  wood: FACE.wood,
  metal: FACE.metal,
  soft: FACE.soft,
  glass: FACE.glass,
};

export function partDrawable(p: PartType, holes: Hole[]) {
  const d = new Drawable();
  const [sx, sy, sz] = p.size;
  const color = MAT_COLOR[p.material] ?? FACE.board;
  if (p.pieces) {
    for (const q of p.pieces) {
      const [qx, qy, qz] = q.size;
      const mat = q.material ?? p.material;
      const c = MAT_COLOR[mat] ?? FACE.board;
      const at = { position: q.pos, rotation: q.rot };
      // a thin slab (5 mm glass) keeps just its edge lines: at a grazing angle the face's depth offset outruns its
      // thickness and the black outline behind it showed through
      if (q.shape === "slab" && q.outline?.length) addSolid(d, `slab:${qy}:${q.round ?? 0}:${q.outline.flat().map(Math.round).join(",")}`, () => slab(q.outline!, qy, q.round ?? 0), c, { hull: qy < 8 ? null : "radial", ...at });
      else if (q.shape === "bent" && q.outline?.length && q.bend) addSolid(d, `bent:${q.bend.r}:${q.bend.t}:${q.outline.flat().map((v) => v.toFixed(1)).join(",")}`, () => bentBoard(q.outline!, q.bend!), c, { hull: "normal", ...at });
      else if (q.shape === "arc") addSolid(d, `arc:${qx}:${qz}`, () => halfRing((qz - qx) / 2, qx / 2), c, { hull: "normal", ...at });
      // a ball: one smooth outline, no seams between its faces
      else if (q.shape === "ball") addSolid(d, `ball:${qx}:${qy}`, () => cutBall(qx, qy), c, { hull: "radial", edges: false, ...at });
      else if (q.shape === "halfcyl") addSolid(d, `hcyl:${qx}:${qy}`, () => halfDisc(qx, qy), c, { hull: "radial", ...at });
      else if (q.shape === "cyl") {
        // oval when its depth differs from its width (a tapered one's size is only its bounding box)
        const foot = q.foot ?? qx, k = q.foot === undefined ? qz / qx : 1;
        addSolid(d, `cyl:${qx}:${qy}:${foot}:${k}`, () => new THREE.CylinderGeometry(qx / 2, foot / 2, qy, 32).scale(1, 1, k), c, { hull: "cyl", ...at });
      }
      else if (mat === "soft") addSolid(d, `soft:${qx}:${qy}:${qz}`, () => roundedBox(qx, qy, qz, Math.min(42, qy / 2.4, qx / 3, qz / 3)), c, { hull: "box", half: [qx / 2, qy / 2, qz / 2], edges: false, ...at });
      else addSolid(d, `box:${qx}:${qy}:${qz}`, () => new THREE.BoxGeometry(qx, qy, qz), c, at);
      d.mats.push(mat);
      d.tones.push(q.tone);
    }
  } else if (p.shape === "cyl") {
    // oval when its depth differs from its width (a wardrobe rail)
    addSolid(d, `cyl:${sx}:${sy}:${sz}`, () => new THREE.CylinderGeometry(sx / 2, sx / 2, sy, 32).scale(1, 1, sz / sx), color, { hull: "cyl" });
  } else if (p.material === "soft") {
    addSolid(d, `soft:${sx}:${sy}:${sz}`, () => roundedBox(sx, sy, sz, Math.min(42, sy / 2.4, sx / 3, sz / 3)), color, { hull: "box", half: [sx / 2, sy / 2, sz / 2], edges: false });
  } else {
    addSolid(d, `box:${sx}:${sy}:${sz}`, () => new THREE.BoxGeometry(sx, sy, sz), color);
  }
  if (!p.pieces) d.mats.push(p.material);
  if (p.mark) addMark(d, p.size, p.mark);
  // a hole is drawn only where it sits on the part: one recorded off it would float in the air
  const near = (h: Hole) => h.p.every((v, i) => Math.abs(v) <= p.size[i] / 2 + 3);
  holes = holes.filter(near);
  if (holes.length) {
    const pts: number[] = [];
    const seg = 14;
    const n = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (const h of holes) {
      n.set(...h.n).normalize();
      a.set(Math.abs(n.y) < 0.9 ? 0 : 1, Math.abs(n.y) < 0.9 ? 1 : 0, 0).cross(n).normalize();
      b.copy(n).cross(a).normalize();
      c.set(...h.p).addScaledVector(n, 0.35);
      for (let i = 0; i < seg; i++) {
        const t0 = (i / seg) * Math.PI * 2, t1 = ((i + 1) / seg) * Math.PI * 2;
        pts.push(
          c.x + (a.x * Math.cos(t0) + b.x * Math.sin(t0)) * h.r,
          c.y + (a.y * Math.cos(t0) + b.y * Math.sin(t0)) * h.r,
          c.z + (a.z * Math.cos(t0) + b.z * Math.sin(t0)) * h.r,
          c.x + (a.x * Math.cos(t1) + b.x * Math.sin(t1)) * h.r,
          c.y + (a.y * Math.cos(t1) + b.y * Math.sin(t1)) * h.r,
          c.z + (a.z * Math.cos(t1) + b.z * Math.sin(t1)) * h.r,
        );
      }
    }
    const g = new LineSegmentsGeometry();
    g.setPositions(pts);
    const lm = lineMaterial(1);
    d.root.add(new LineSegments2(g, lm));
    d.thin.push(lm);
  }
  return d;
}

/** A w x h plate, t thick (from y = 0 up, then extruded along +z), with a 5 mm wide round-ended slot from y0 to y1. */
function slotted(w: number, h: number, t: number, y0: number, y1: number) {
  const plate = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(w / 2, h), new THREE.Vector2(-w / 2, h)]);
  const r = 2.5, slot = new THREE.Path();
  // round at both ends: under its bottom centre, then over its top one (both arcs had turned inwards, so a short slot,
  // a wall bracket's upright hole, closed up into a sliver across the strip)
  slot.absarc(0, y0 + r, r, Math.PI, Math.PI * 2, false);
  slot.absarc(0, y1 - r, r, 0, Math.PI, false);
  slot.closePath();
  plate.holes.push(slot);
  return new THREE.ExtrudeGeometry(plate, { depth: t, bevelEnabled: false, curveSegments: 8 });
}

// a face's in-plane size [along, across], how to turn a plane (drawn facing +z) onto it, and which way it faces
const MARK_FACE: Record<Pose, { dims: (s: Vec3) => [number, number]; rot: Vec3; n: Vec3 }> = {
  "+z": { dims: (s) => [s[0], s[1]], rot: [0, 0, 0], n: [0, 0, 1] },
  "-z": { dims: (s) => [s[0], s[1]], rot: [0, Math.PI, 0], n: [0, 0, -1] },
  "+y": { dims: (s) => [s[0], s[2]], rot: [-Math.PI / 2, 0, 0], n: [0, 1, 0] },
  "-y": { dims: (s) => [s[0], s[2]], rot: [Math.PI / 2, 0, 0], n: [0, -1, 0] },
  "+x": { dims: (s) => [s[2], s[1]], rot: [0, Math.PI / 2, 0], n: [1, 0, 0] },
  "-x": { dims: (s) => [s[2], s[1]], rot: [0, -Math.PI / 2, 0], n: [-1, 0, 0] },
};
const markTex = new Map<string, THREE.CanvasTexture>();
let markPlane: THREE.PlaneGeometry | undefined; // one unit plane for every mark, scaled to fit

/** Text printed on a face, as on the real part: our own lettering, centred, along the face's length. */
function addMark(d: Drawable, size: Vec3, mark: PartMark) {
  const f = MARK_FACE[mark.face];
  const [w, h] = f.dims(size);
  let tex = markTex.get(mark.text);
  if (!tex) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const x = c.getContext("2d")!;
    x.fillStyle = "#1b2430";
    x.font = "700 84px system-ui, sans-serif";
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(`▲  ${mark.text.toUpperCase()}  ▲`, 512, 66, 1000); // as the LIMFJORDEN manuals print it (p16, p22)
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    markTex.set(mark.text, tex);
  }
  const mw = Math.min(w * 0.6, h * 0.62 * 8), mh = mw / 8;
  const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh((markPlane ??= new THREE.PlaneGeometry(1, 1)), m);
  mesh.scale.set(mw, mh, 1);
  mesh.rotation.set(...f.rot);
  mesh.position.set(...(f.n.map((v, i) => v * (size[i] / 2 + 0.2)) as Vec3));
  d.root.add(mesh);
  d.decals.push(m);
}

/** A pencil line from a to b on a part's surface (its frame): a thin dark rod, half in the surface. */
let pencilRod: THREE.CylinderGeometry | undefined; // one unit rod, shared and stretched: never disposed with a part
export function pencilLine(a: Vec3, b: Vec3) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const mesh = new THREE.Mesh((pencilRod ??= new THREE.CylinderGeometry(1.2, 1.2, 1, 6)), new THREE.MeshBasicMaterial({ color: 0x1b2430, transparent: true }));
  mesh.scale.y = va.distanceTo(vb);
  mesh.position.copy(va).add(vb).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  return mesh;
}

/** A flat board cut to an outline of [x, z] corners, each corner rounded, centred on its thickness. */
function slab(pts: [number, number][], h: number, r: number) {
  const s = new THREE.Shape();
  const n = pts.length;
  pts.forEach((c, i) => {
    const prev = pts[(i + n - 1) % n], next = pts[(i + 1) % n];
    const toward = (o: [number, number], k: number): [number, number] => {
      const dx = o[0] - c[0], dz = o[1] - c[1], l = Math.hypot(dx, dz) || 1;
      return [c[0] + (dx / l) * k, c[1] + (dz / l) * k];
    };
    const k = Math.min(r, Math.hypot(prev[0] - c[0], prev[1] - c[1]) / 2, Math.hypot(next[0] - c[0], next[1] - c[1]) / 2);
    const a = toward(prev, k), b = toward(next, k);
    if (i === 0) s.moveTo(a[0], a[1]);
    else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(c[0], c[1], b[0], b[1]);
  });
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 14 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2, 0);
  return g;
}

/** A tube bent in a half circle (the round top of a frame): bend radius r, tube radius t, in the y-z plane, open ends
 *  down, centred on its box. One smooth piece, so no seam is outlined along the bend. */
function halfRing(r: number, t: number) {
  const g = new THREE.TorusGeometry(r, t, 16, 48, Math.PI);
  g.rotateY(Math.PI / 2);
  g.translate(0, -(r + t) / 2, 0);
  return g;
}

/** A board cut to an outline ([u, y]: along it, up) and bent round a vertical axis (bentPiece in plan/math), centred on
 *  its box. One mesh of narrow columns sharing their points, so lines show only along its outline and where the faces
 *  meet its edges, never between columns. */
function bentBoard(pts: [number, number][], bend: { r: number; t: number }) {
  const { r, t } = bend;
  const us = pts.map((p) => p[0]);
  const u0 = Math.min(...us), u1 = Math.max(...us);
  const step = Math.min(8, (Math.abs(r) * Math.PI) / 90); // 2 degrees at most
  const grid = Array.from({ length: Math.ceil((u1 - u0) / step) }, (_, i) => u0 + i * step);
  const cols = [...us, ...grid, u1].sort((a, b) => a - b).filter((u, i, a) => i === 0 || u - a[i - 1] > 0.05);
  const spans = cols.map((u) => spanAt(pts, u));
  const P = (u: number, y: number, w: number) => new THREE.Vector3(...bendAt(u, y, w, r));
  const pos: number[] = [], nrm: number[] = [];
  // a triangle turned to face `out`; `w` on a face (its normal across the board there), else the triangle's own normal
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, out: THREE.Vector3, w?: number) => {
    let f = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
    if (f.lengthSq() < 1e-8) return;
    if (f.dot(out) < 0) [b, c, f] = [c, b, f.negate()];
    f.normalize();
    for (const p of [a, b, c]) {
      const n = w === undefined ? f : new THREE.Vector3(-p.x / (r - w), 0, (r - p.z) / (r - w)).multiplyScalar(Math.sign(w));
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
    }
  };
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3, w?: number) => {
    tri(a, b, c, out, w);
    tri(a, c, d, out, w);
  };
  const across = (u: number) => new THREE.Vector3(-Math.sin(u / r), 0, Math.cos(u / r));
  const along = (u: number) => new THREE.Vector3(Math.cos(u / r), 0, Math.sin(u / r));
  const up = new THREE.Vector3(0, 1, 0), down = new THREE.Vector3(0, -1, 0);
  for (let i = 0; i + 1 < cols.length; i++) {
    const [ua, ub] = [cols[i], cols[i + 1]], [la, ha] = spans[i], [lb, hb] = spans[i + 1];
    for (const k of [-1, 1]) {
      const w = (k * t) / 2;
      quad(P(ua, la, w), P(ub, lb, w), P(ub, hb, w), P(ua, ha, w), across((ua + ub) / 2).multiplyScalar(k), w);
    }
    quad(P(ua, ha, -t / 2), P(ub, hb, -t / 2), P(ub, hb, t / 2), P(ua, ha, t / 2), up);
    quad(P(ua, la, -t / 2), P(ub, lb, -t / 2), P(ub, lb, t / 2), P(ua, la, t / 2), down);
  }
  // the ends, where the outline runs straight up and down
  for (const [u, [lo, hi], k] of [[u0, spans[0], -1], [u1, spans[spans.length - 1], 1]] as const)
    if (hi > lo) quad(P(u, lo, -t / 2), P(u, lo, t / 2), P(u, hi, t / 2), P(u, hi, -t / 2), along(u).multiplyScalar(k));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  const { mid } = bentBox(pts, bend);
  g.translate(-mid[0], -mid[1], -mid[2]);
  return g;
}

/** Half a disc (one half of a round table top): flat edge along x at the back, curve towards the front, centred on its box. */
function halfDisc(dia: number, h: number) {
  const s = new THREE.Shape();
  s.absarc(0, 0, dia / 2, 0, Math.PI, false);
  s.lineTo(dia / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2, -dia / 4);
  return g;
}

/** A ball dia across, cut flat at its -y end so it is h long, centred on its box (a knob's wooden ball). */
function cutBall(dia: number, h: number) {
  const r = dia / 2, yc = h / 2 - r, a0 = Math.asin(Math.max(-1, Math.min(1, (r - h) / r)));
  const pts = [new THREE.Vector2(0, -h / 2)];
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((Math.PI / 2 - a0) * i) / 24;
    pts.push(new THREE.Vector2(Math.max(0, r * Math.cos(a)), yc + r * Math.sin(a)));
  }
  return new THREE.LatheGeometry(pts, 32);
}

function roundedBox(w0: number, h: number, d0: number, r0: number) {
  // the bevel grows the outline by r/3 all round: drawn that much smaller, the box keeps its size (fittings on its sides
  // sat buried under the padding)
  const g0 = r0 / 3, w = w0 - 2 * g0, dpt = d0 - 2 * g0, r = r0 - g0;
  const shape = new THREE.Shape();
  const x = -w / 2, y = -dpt / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + dpt - r);
  shape.quadraticCurveTo(x + w, y + dpt, x + w - r, y + dpt);
  shape.lineTo(x + r, y + dpt);
  shape.quadraticCurveTo(x, y + dpt, x, y + dpt - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(shape, { depth: h - r0, bevelEnabled: true, bevelThickness: r0 / 2, bevelSize: g0, bevelSegments: 3, curveSegments: 6 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -(h - r0) / 2, 0);
  return g;
}

/* ---------------- hardware ---------------- */

const cyl = (r: number, h: number, seg = 18) => () => new THREE.CylinderGeometry(r, r, h, seg);

/** A bolt head's socket, 0.6 mm deep: a hex, or six round lobes for a Torx key. */
function socket(dia: number, drive?: HwType["drive"]): [string, () => THREE.BufferGeometry] {
  if (drive !== "torx") return [`bolt:hex:${dia}`, cyl(dia * 0.4, 0.6, 6)];
  return [
    `bolt:torx:${dia}`,
    () => {
      const s = new THREE.Shape();
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2, k = dia * 0.4 * (0.8 + 0.2 * Math.cos(6 * a));
        if (i) s.lineTo(Math.cos(a) * k, Math.sin(a) * k);
        else s.moveTo(k, 0);
      }
      return new THREE.ExtrudeGeometry(s, { depth: 0.6, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, -0.3, 0);
    },
  ];
}

/**
 * Hardware is modelled along +Y with the origin on the surface it goes into.
 * Everything below y = 0 ends up inside the panel. `loose`: a hinge on a door that isn't hung yet.
 */
export function hwDrawable({ kind, len, dia, flush = false, roller, form, drive }: Pick<HwType, "kind" | "len" | "dia" | "flush" | "roller" | "form" | "drive">, loose = false) {
  const d = new Drawable();
  const metal = FACE.hwMetal, wood = FACE.hwWood, plastic = FACE.hwPlastic;
  const r = dia / 2;
  switch (kind) {
    case "dowel":
      // seated 12 mm deep, like real face-drilled holes, so it never shows through a 15 mm panel
      addSolid(d, `dowel:${len}:${dia}`, cyl(r, len, 16), wood, { hull: "cyl", position: [0, len / 2 - 12, 0] });
      break;
    case "camScrew":
      addSolid(d, "cs:thread", cyl(2.9, 11, 12), metal, { hull: "cyl", position: [0, -5.5, 0] });
      addSolid(d, "cs:neck", cyl(2.2, 17, 12), metal, { hull: "cyl", position: [0, 8.5, 0] });
      addSolid(d, "cs:head", () => new THREE.SphereGeometry(3.6, 14, 10), metal, { hull: "radial", position: [0, 19.5, 0], edges: false });
      break;
    case "cam": {
      // its own size (a 12 mm lock in a 12 mm drawer side mustn't come out the far face); its top a hair proud of the
      // face, so the two don't flicker into each other where they meet
      const k = dia / 15, deep = len - 0.6;
      addSolid(d, `cam:body:${len}:${dia}`, cyl(dia / 2 - 0.1, deep, 22), metal, { hull: "cyl", position: [0, 0.3 - deep / 2, 0] });
      addSolid(d, `cam:slot:${dia}`, () => new THREE.BoxGeometry(9 * k, 0.8, 1.6), FACE.hwMetal, { position: [0, 0.4, 0] });
      addSolid(d, `cam:arrow:${dia}`, () => new THREE.ConeGeometry(1.4 * k, 2.6 * k, 3), FACE.hwMetal, { position: [5.2 * k, 0.4, 0], rotation: [0, 0, -Math.PI / 2], edges: true });
      break;
    }
    case "screw": {
      if (form === "euro") {
        // a euro screw (a cabinet runner's or a hinge's): a countersunk cross head level with the surface, a thick core
        // with a few coarse thread rings, and a blunt cut end, no point
        const hr = dia, cone = hr - r * 0.8, core = len - cone, pitch = dia * 0.55;
        addSolid(d, `eu:head:${dia}`, () => new THREE.CylinderGeometry(hr, r * 0.8, cone, 18), metal, { hull: "cyl", position: [0, 0.3 - cone / 2, 0] });
        addSolid(d, `eu:core:${len}:${dia}`, cyl(r * 0.78, core, 12), metal, { hull: "cyl", position: [0, 0.3 - cone - core / 2, 0] });
        for (let y = cone + pitch * 0.6; y < len - 0.6; y += pitch) addSolid(d, `eu:ring:${dia}`, cyl(r, 0.7, 14), metal, { position: [0, 0.3 - y, 0] });
        addSolid(d, `sc:x1:${dia}`, () => new THREE.BoxGeometry(hr * 1.2, 0.4, 0.5), metal, { position: [0, 0.35, 0] });
        addSolid(d, `sc:x2:${dia}`, () => new THREE.BoxGeometry(0.5, 0.4, hr * 1.2), metal, { position: [0, 0.35, 0] });
        break;
      }
      const hr = Math.max(dia, 3.2);
      addSolid(d, `sc:shank:${len}:${dia}`, cyl(r * 0.92, len - 2, 10), metal, { hull: "cyl", position: [0, -(len - 2) / 2 - 2, 0] });
      addSolid(d, `sc:tip:${dia}`, () => new THREE.ConeGeometry(r * 0.92, 2.6, 10), metal, { position: [0, -len - 0.7, 0], rotation: [Math.PI, 0, 0], edges: false });
      addSolid(d, `sc:head:${dia}`, cyl(hr, 1.9, 18), metal, { hull: "cyl", position: [0, 0.95, 0] });
      addSolid(d, `sc:x1:${dia}`, () => new THREE.BoxGeometry(hr * 1.2, 0.4, 0.5), metal, { position: [0, 2.0, 0] });
      addSolid(d, `sc:x2:${dia}`, () => new THREE.BoxGeometry(0.5, 0.4, hr * 1.2), metal, { position: [0, 2.0, 0] });
      break;
    }
    case "barrel": {
      // a barrel nut: a plain sleeve, threaded inside, under a cross head pan; the screw from the other side meets it
      const hr = Math.max(dia * 0.9, 3.2);
      addSolid(d, `bn:${len}:${dia}`, cyl(r, len, 14), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, `sc:head:${dia}`, cyl(hr, 1.9, 18), metal, { hull: "cyl", position: [0, 0.95, 0] });
      addSolid(d, `sc:x1:${dia}`, () => new THREE.BoxGeometry(hr * 1.2, 0.4, 0.5), metal, { position: [0, 2.0, 0] });
      addSolid(d, `sc:x2:${dia}`, () => new THREE.BoxGeometry(0.5, 0.4, hr * 1.2), metal, { position: [0, 2.0, 0] });
      break;
    }
    case "nail":
      addSolid(d, `nail:${len}`, cyl(r, len, 8), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "nail:head", cyl(r * 1.7, 0.7, 12), metal, { hull: "cyl", position: [0, 0.35, 0] });
      break;
    case "pin":
      if (form === "support") {
        // a shelf support: its pin in the hole, a plate on the panel and a ledge along its top whose upper face is 3 mm
        // over the origin (local +x up, by a fit's twist), the shelf's underside; a small clip stands on the ledge
        addSolid(d, `pin:sup:${dia}`, cyl(r, len - 1, 12), metal, { hull: "cyl", position: [0, -(len - 1) / 2, 0] });
        addSolid(d, "pin:sup:plate", () => new THREE.BoxGeometry(8, 1.5, 10), metal, { position: [-1, 0.75, 0] });
        addSolid(d, "pin:sup:ledge", () => new THREE.BoxGeometry(1.5, 12, 10), metal, { position: [2.25, 6, 0] });
        addSolid(d, "pin:sup:clip", () => new THREE.BoxGeometry(2.5, 1.2, 3), metal, { position: [4.25, 7.5, 0] });
        break;
      }
      addSolid(d, `pin:${dia}`, cyl(r, 16, 12), metal, { hull: "cyl" });
      addSolid(d, `pin:collar:${dia}`, cyl(r + 1.2, 1.2, 14), metal, { hull: "cyl", position: [0, 0.6, 0] });
      break;
    case "legScrew":
      addSolid(d, `leg:${len}`, cyl(r, len, 14), metal, { hull: "cyl" });
      break;
    case "bolt":
      addSolid(d, `bolt:${len}:${dia}`, cyl(r, len, 12), metal, { hull: "cyl", position: [0, -len / 2, 0] });
      if (form === "countersunk") {
        // a cone under the hex socket, sunk in its dimple, level with the surface
        addSolid(d, `bolt:cone:${dia}`, () => new THREE.CylinderGeometry(dia, r, dia - r, 18), metal, { hull: "cyl", position: [0, 0.3 - (dia - r) / 2, 0] });
        addSolid(d, ...socket(dia, drive), FACE.hwMetal, { position: [0, 0.3, 0] });
        break;
      }
      if (form === "button") {
        // a button head: a low dome dia across each side of the shank (2x its diameter), 3 high, a hex socket on top
        const h = 3, R = (dia * dia + h * h) / (2 * h);
        addSolid(d, `bolt:btn:${dia}`, () => new THREE.SphereGeometry(R, 28, 6, 0, Math.PI * 2, 0, Math.acos((R - h) / R)), metal, { hull: "radial", position: [0, h - R, 0], edges: false });
        addSolid(d, ...socket(dia, drive), FACE.hwMetal, { position: [0, h - 0.1, 0] });
        break;
      }
      // a flush head (a connector screw) sinks level with the surface instead of standing on it, a hair proud like a cam's top
      addSolid(d, `bolt:head:${dia}`, cyl(dia * 0.85, 5, 18), metal, { hull: "cyl", position: [0, flush ? -2.3 : 2.5, 0] });
      addSolid(d, ...socket(dia, drive), FACE.hwMetal, { position: [0, flush ? 0.3 : 5.2, 0] });
      break;
    case "plate":
      if (form === "square") {
        // a flat mending plate across a joint: dia square, len thick, a screw hole near each corner (14 across x, 16
        // along z from its middle: two each side of the joint)
        const sq = new THREE.Shape([new THREE.Vector2(-dia / 2, -dia / 2), new THREE.Vector2(dia / 2, -dia / 2), new THREE.Vector2(dia / 2, dia / 2), new THREE.Vector2(-dia / 2, dia / 2)]);
        for (const [x, y] of [[-14, -16], [14, -16], [14, 16], [-14, 16]]) sq.holes.push(new THREE.Path().absarc(x, y, 2, 0, Math.PI * 2, true));
        addSolid(d, `plate:sq:${len}:${dia}`, () => new THREE.ExtrudeGeometry(sq, { depth: len, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2), metal);
        break;
      }
      if (len < 10) {
        // a small joining plate over a seam: dia long (along x), half as wide, len thick, one screw hole in the middle
        const plate = new THREE.Shape([new THREE.Vector2(-dia / 2, -dia / 4), new THREE.Vector2(dia / 2, -dia / 4), new THREE.Vector2(dia / 2, dia / 4), new THREE.Vector2(-dia / 2, dia / 4)]);
        plate.holes.push(new THREE.Path().absarc(0, 0, Math.min(2.4, dia / 8), 0, Math.PI * 2, true));
        addSolid(d, `plate:${len}:${dia}`, () => new THREE.ExtrudeGeometry(plate, { depth: len, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2), metal);
        break;
      }
      // a leg plate (always drawn 70 mm square) with the socket the leg screws into
      addSolid(d, "plate", () => new THREE.BoxGeometry(70, 3, 70), metal, { position: [0, 1.5, 0] });
      addSolid(d, "plate:sock", cyl(9, 10, 18), metal, { hull: "cyl", position: [0, 8, 0] });
      break;
    case "bracket": {
      // a 15 mm strip bent into an L (78 x 32 x 15): the long leg (len) flat on the panel with a long slot for its two
      // screws, the short leg (dia) standing up at the back with an oval hole for the wall; the bend 16 mm behind the origin
      const { w: W, t: T } = BRACKET, b0 = -BRACKET.bend;
      // each leg a plate with its opening cut through, so the panel shows through the slot round the screws
      addSolid(d, `br:h:${len}`, () => slotted(W, len, T, BRACKET.slot, BRACKET.slot + len * BRACKET.slotK).rotateX(-Math.PI / 2).rotateY(Math.PI), metal, { position: [0, 0, b0] });
      addSolid(d, `br:v:${dia}`, () => slotted(W, dia, T, dia * 0.3, dia * 0.88), metal, { position: [0, 0, b0] });
      break;
    }
    case "runner":
      if (form === "under") {
        // under a drawer side's bottom edge (sizes.ts UNDER): the flange and ledge, the wall up the outer face, the roller
        const { side, out, wall, rollerY } = UNDER, w = 2 * side + out;
        addSolid(d, `run:u:${len}`, () => new THREE.BoxGeometry(w, RUNNER.body, len), metal, { position: [-side + w / 2, RUNNER.body / 2, 0] });
        addSolid(d, `run:u:wall:${len}`, () => new THREE.BoxGeometry(RUNNER.body, wall, len), metal, { position: [side + RUNNER.body / 2, -wall / 2, 0] });
        addSolid(d, "run:u:roller", () => new THREE.CylinderGeometry(RUNNER.roller, RUNNER.roller, 7, 20).rotateZ(Math.PI / 2), plastic, { hull: "radial", position: [side + RUNNER.body + 3.5, rollerY, (roller === "back" ? -1 : 1) * (len / 2 - RUNNER.roller - 2)] });
        break;
      }
      // an L: a thin flange the screws go through, and a lip along one edge (sizes.ts)
      addSolid(d, `run:${len}`, () => new THREE.BoxGeometry(RUNNER.w, RUNNER.body, len), metal, { position: [0, RUNNER.body / 2, 0] });
      addSolid(d, `run:lip:${len}`, () => new THREE.BoxGeometry(RUNNER.lipW, RUNNER.lip, len), metal, { position: [-(RUNNER.w - RUNNER.lipW) / 2, RUNNER.body + RUNNER.lip / 2, 0] });
      // the white roller wheel at one end (the front on a cabinet runner, the back on a drawer's), on its axle
      addSolid(d, "run:roller", cyl(RUNNER.roller, 7, 20), plastic, { hull: "cyl", position: [0, RUNNER.body + 3.5, (roller === "back" ? -1 : 1) * (len / 2 - RUNNER.roller - 2)] });
      break;
    case "knob":
      addSolid(d, "knob:stem", cyl(5.5, 12, 14), wood, { hull: "cyl", position: [0, 6, 0] });
      addSolid(d, "knob:head", () => new THREE.SphereGeometry(14, 22, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), wood, { hull: "radial", position: [0, 14, 0], edges: false });
      break;
    case "handle":
      if (form === "pull") {
        // a curved edge pull, len + 24 long: a flat strip on the face over its bolt line (y = 0, local +z hangs down),
        // and a hood curling out from its top edge and down over the finger gap below
        const t = 2, R = 14;
        const s = new THREE.Shape();
        s.moveTo(-7, 0);
        s.lineTo(R - 7, 0);
        s.lineTo(R - 7, t);
        s.lineTo(-7 + t, t);
        s.absarc(R - 7, 0, R - t, Math.PI * 0.94, Math.PI / 2, true);
        s.lineTo(R - 7 + 6, R - t);
        s.lineTo(R - 7 + 6, R);
        s.absarc(R - 7, 0, R, Math.PI / 2, Math.PI, false);
        // the profile drawn in (z, y), then stood along x
        addSolid(d, `hd:pull:${len}`, () => new THREE.ExtrudeGeometry(s, { depth: len + 24, bevelEnabled: false, curveSegments: 12 }).rotateY(-Math.PI / 2).translate((len + 24) / 2, 0, 0), metal, { hull: "radial" });
        break;
      }
      for (const x of [-len / 2, len / 2]) addSolid(d, "hd:post", cyl(5, 26, 12), metal, { hull: "cyl", position: [x, 13, 0] });
      addSolid(d, `hd:bar:${len}`, () => new THREE.CylinderGeometry(6, 6, len + 24, 14).rotateZ(Math.PI / 2), metal, { hull: "radial", position: [0, 30, 0] });
      break;
    case "hinge":
      addSolid(d, "hg:cup", cyl(17.5, 12, 24), metal, { hull: "cyl", position: [0, -6, 0] });
      // the cup's lip, a ring 1 mm proud of the door round its bore, so the cup shows either side of the flange on it
      addSolid(d, "hg:lip", cyl(19, 1, 32), metal, { hull: "cyl", position: [0, 0.5, 0] });
      // the screw flange runs along the door edge (local z), its two screws either end of it
      addSolid(d, "hg:flange2", () => new THREE.BoxGeometry(26, 1.6, 52), metal, { position: [0, 1.8, 0] });
      if (loose) {
        // a door not hung yet, as the manuals draw it: the arm open flat on the back face, from the cup out past the
        // hinged edge (local -x, by a fit's twist), its mounting plate clipped under the end, kept off the face
        addSolid(d, "hg:arm:loose", () => new THREE.BoxGeometry(70, 10, 14), metal, { position: [-27, 7.6, 0] });
        addSolid(d, "hg:plate:loose", () => new THREE.BoxGeometry(40, 1.3, 30), metal, { position: [-44, 0.95, 0] });
        break;
      }
      addSolid(d, "hg:arm", () => new THREE.BoxGeometry(12, 40, 11), metal, { position: [4, 20, 0] });
      addSolid(d, "hg:plate", () => new THREE.BoxGeometry(4, 18, 40), metal, { position: [-4, 34, 0] });
      break;
    case "glide":
      // a square felt pad, dia across and len thick, stuck on; otherwise a round nail-in glide
      if (form === "square") addSolid(d, `glide:sq:${len}:${dia}`, () => new THREE.BoxGeometry(dia, len, dia), plastic, { position: [0, len / 2, 0] });
      else addSolid(d, "glide", cyl(10, 4, 18), plastic, { hull: "cyl", position: [0, 2, 0] });
      break;
    case "plug":
      addSolid(d, `plug:${len}`, cyl(r, len, 12), plastic, { hull: "cyl", position: [0, -len / 2, 0] });
      addSolid(d, "plug:lip", cyl(r + 1.5, 1.5, 14), plastic, { hull: "cyl", position: [0, 0.75, 0] });
      break;
    case "castor": {
      if (form === "plate") {
        // a plate castor, len tall: a 42 long plate on the face (local z along it), its two screws 32 apart going in
        // through it, a fork and one wheel (dia) under it, no pin
        addSolid(d, "ca:plate", () => new THREE.BoxGeometry(20, 2, 42), metal, { position: [0, 1, 0] });
        for (const x of [-1, 1]) addSolid(d, `ca:cheek:${len}:${dia}`, () => new THREE.BoxGeometry(1.5, len - r, 16), metal, { position: [x * 6.5, 2 + (len - r) / 2, 0] });
        addSolid(d, `ca:wheel1:${dia}`, () => new THREE.CylinderGeometry(r, r, 10, 24).rotateZ(Math.PI / 2), plastic, { hull: "radial", position: [0, len - r, 0] });
        addSolid(d, "ca:axle", () => new THREE.CylinderGeometry(2, 2, 15, 10).rotateZ(Math.PI / 2), metal, { position: [0, len - r, 0] });
        break;
      }
      // a pin that pushes into the base, a hood and twin wheels trailing behind the pin
      addSolid(d, "ca:pin", cyl(5.5, 22, 12), metal, { hull: "cyl", position: [0, -11, 0] });
      addSolid(d, "ca:collar", cyl(9, 3, 16), plastic, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `ca:hood:${dia}`, () => new THREE.BoxGeometry(dia * 0.68, len - r - 2, dia * 0.9), plastic, { position: [0, 3 + (len - r - 2) / 2, -dia * 0.12] });
      for (const x of [-1, 1])
        addSolid(d, `ca:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, dia * 0.26, 24).rotateZ(Math.PI / 2), plastic, { hull: "radial", position: [x * dia * 0.21, len - r, -dia * 0.16] });
      break;
    }
    case "flatHinge":
      // two leaves either side of a pin, lying flat across a joint
      for (const x of [-1, 1]) addSolid(d, `fh:leaf:${len}:${dia}`, () => new THREE.BoxGeometry(len / 2 - 3, 1.6, dia), metal, { position: [x * (len / 4 + 1.5), 0.8, 0] });
      addSolid(d, `fh:pin:${dia}`, () => new THREE.CylinderGeometry(3, 3, dia, 12).rotateX(Math.PI / 2), metal, { hull: "radial", position: [0, 2.2, 0] });
      break;
    case "hook":
      if (form === "cup") {
        // a clothes rail holder, dia tall up local +x (a fit's twist turns it upright), 0.58 dia across and len out from
        // the panel: a back plate with the screw hole 10 mm under the origin and a peg into the panel above it, and an
        // open-topped U standing out of its lower part, round the rail's end
        const x0 = -dia * 0.68, x1 = dia * 0.32, R = dia * 0.29, Ri = R - 1.5, xc = x0 + R, xTop = -4;
        const flat = (s: THREE.Shape, depth: number, at: number) => new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, at).rotateX(-Math.PI / 2);
        addSolid(d, `hk:cup:back:${dia}`, () => {
          const s = new THREE.Shape();
          s.absarc(x1 - R, 0, R, -Math.PI / 2, Math.PI / 2, false);
          s.absarc(x0 + R, 0, R, Math.PI / 2, (3 * Math.PI) / 2, false);
          s.holes.push(new THREE.Path().absarc(-10, 0, 2, 0, Math.PI * 2, true));
          return flat(s, 2, 0);
        }, plastic, { hull: "normal" });
        addSolid(d, `hk:cup:u:${len}:${dia}`, () => {
          const s = new THREE.Shape();
          s.moveTo(xTop, -R);
          s.absarc(xc, 0, R, -Math.PI / 2, Math.PI / 2, true);
          s.lineTo(xTop, R);
          s.lineTo(xTop, Ri);
          s.absarc(xc, 0, Ri, Math.PI / 2, (3 * Math.PI) / 2, false);
          s.lineTo(xTop, -Ri);
          return flat(s, len - 2, 2);
        }, plastic, { hull: "normal" });
        addSolid(d, "hk:cup:peg", cyl(2.4, 6, 12), plastic, { hull: "cyl", position: [x1 - 7, -3, 0] });
        break;
      }
      // a coat peg: a thread into the wood, a round plate against it, a stem, and a ball on the end
      addSolid(d, "hk:thread", cyl(2.5, 12, 10), metal, { hull: "cyl", position: [0, -6, 0] });
      addSolid(d, `hk:plate:${dia}`, cyl(r * 0.55, 3, 20), metal, { hull: "cyl", position: [0, 1.5, 0] });
      addSolid(d, `hk:stem:${len}`, cyl(4, len - 12, 14), metal, { hull: "cyl", position: [0, 3 + (len - 12) / 2, 0] });
      addSolid(d, `hk:ball:${dia}`, () => new THREE.SphereGeometry(r * 0.42, 18, 12), metal, { hull: "radial", position: [0, len - 6, 0], edges: false });
      break;
    case "roller":
      // a sliding door's roller: a plate screwed to the door's edge, an arm, and a wheel that runs in the track
      addSolid(d, `ro:plate:${len}`, () => new THREE.BoxGeometry(len, 3, 14), metal, { position: [0, 1.5, 0] });
      addSolid(d, "ro:arm", () => new THREE.BoxGeometry(8, len * 0.45, 8), metal, { position: [0, 3 + len * 0.22, 0] });
      addSolid(d, `ro:wheel:${dia}`, () => new THREE.CylinderGeometry(r, r, 7, 22).rotateX(Math.PI / 2), plastic, { hull: "radial", position: [0, 3 + len * 0.45 + r * 0.4, 0] });
      break;
    case "connector":
      // a flat strip screwed across the joint between two sofa sections
      addSolid(d, `cn:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2, dia), metal, { position: [0, 1, 0] });
      break;
    case "clip":
      if (form === "sleeve") {
        // half a split sleeve round a pole, its origin on the pole's axis: a half tube (inner radius dia / 2 - 2), len
        // tall along local x, a little wider at its +x end, on the +y side
        const ri = dia / 2 - 2;
        const prof = [new THREE.Vector2(ri, len / 2), new THREE.Vector2(ri + 0.7, -len / 2), new THREE.Vector2(ri + 2.7, -len / 2), new THREE.Vector2(ri + 2, len / 2), new THREE.Vector2(ri, len / 2)];
        addSolid(d, `clip:sleeve:${len}:${dia}`, () => new THREE.LatheGeometry(prof, 16, 0, Math.PI).rotateZ(Math.PI / 2), plastic, { hull: "normal" });
        break;
      }
      if (form === "channel") {
        // a back panel clip, dia across: a low round boss on the origin, its nail hole up the middle, and a U channel
        // (two walls len out of the surface, a slot between) on its +z side
        addSolid(d, "clip:boss", cyl(6, CLIP_BOSS, 18), plastic, { hull: "cyl", position: [0, CLIP_BOSS / 2, 0] });
        addSolid(d, "clip:hole", cyl(1.2, 0.3, 10), plastic, { position: [0, CLIP_BOSS + 0.15, 0] });
        addSolid(d, `clip:base:${dia}`, () => new THREE.BoxGeometry(dia, 2, 9), plastic, { position: [0, 1, 10.5] });
        for (const z of [7.25, 13.75]) addSolid(d, `clip:wall:${len}:${dia}`, () => new THREE.BoxGeometry(dia, len, 2.5), plastic, { position: [0, len / 2, z] });
        break;
      }
      // a push-in plastic clip: a stem into the hole and a flat head
      addSolid(d, "clip:stem", cyl(2.6, 9, 10), plastic, { hull: "cyl", position: [0, -4.5, 0] });
      addSolid(d, `clip:head:${dia}`, () => new THREE.BoxGeometry(dia, 3, dia * 0.7), plastic, { position: [0, 1.5, 0] });
      break;
    case "strap":
      // a wall strap lying flat against the panel
      addSolid(d, `st:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 1.4, len), plastic, { position: [0, 0.7, 0] });
      break;
    case "nut":
      if (form === "acorn") {
        // a domed cap nut, len tall: a short hex and a round dome closing its top
        const h = len * 0.45, dr = Math.min(dia * 0.85, len - h);
        addSolid(d, `nut:ac:${len}:${dia}`, cyl(dia * 0.95, h, 6), metal, { hull: "cyl", position: [0, h / 2, 0] });
        addSolid(d, `nut:dome:${len}:${dia}`, () => new THREE.SphereGeometry(dr, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal, { hull: "radial", position: [0, h, 0], edges: false });
        break;
      }
      if (form === "cross") {
        // a cross dowel barrel nut: a plain cylinder, a screwdriver slot across its end (y = len)
        addSolid(d, `nut:x:${len}:${dia}`, cyl(r, len, 18), metal, { hull: "cyl", position: [0, len / 2, 0] });
        addSolid(d, `nut:x:slot:${dia}`, () => new THREE.BoxGeometry(dia * 0.8, 0.8, 1.4), metal, { position: [0, len - 0.2, 0] });
        break;
      }
      if (form === "housing") {
        // a round cam housing sunk in its hole (y 0 to -len): a threaded hole down its middle for its grub screw, and a
        // hole in its side (+z) the cam bolt hooks into
        addSolid(d, `nut:h:${len}:${dia}`, cyl(r, len, 22), metal, { hull: "cyl", position: [0, 0.3 - len / 2, 0] });
        addSolid(d, `nut:h:mid:${dia}`, cyl(r * 0.5, 0.3, 14), metal, { position: [0, 0.45, 0] });
        addSolid(d, "nut:h:side", () => new THREE.CylinderGeometry(3, 3, 0.3, 14).rotateX(Math.PI / 2), metal, { position: [0, -len / 2, r + 0.15] });
        break;
      }
      if (form === "grub") {
        // a headless grub screw, len long, a hex socket in its end (y = len)
        addSolid(d, `nut:g:${len}:${dia}`, cyl(r, len, 16), metal, { hull: "cyl", position: [0, len / 2, 0] });
        addSolid(d, `nut:g:hex:${dia}`, cyl(r * 0.5, 0.6, 6), FACE.hwMetal, { position: [0, len + 0.1, 0] });
        break;
      }
      addSolid(d, `nut:${dia}`, cyl(dia * 0.95, Math.max(3, len), 6), metal, { hull: "cyl", position: [0, Math.max(3, len) / 2, 0] });
      break;
    case "washer":
      if (form === "split") {
        // a spring washer: a ring split through on one side
        const ri = dia * 0.3, a = 0.18, s = new THREE.Shape();
        s.absarc(0, 0, r, a, Math.PI * 2 - a, false);
        s.absarc(0, 0, ri, Math.PI * 2 - a, a, true);
        addSolid(d, `wa:split:${dia}`, () => new THREE.ExtrudeGeometry(s, { depth: 1.6, bevelEnabled: false, curveSegments: 16 }).rotateX(-Math.PI / 2), metal, { hull: "normal" });
        break;
      }
      if (form === "saddle") {
        // len thick in the middle, its underside hollowed to sit on a round tube as wide as it (the tube along local x)
        addSolid(d, `wa:saddle:${len}:${dia}`, () => {
          const g = new THREE.CylinderGeometry(r, r, len, 24, 1).translate(0, len / 2, 0);
          const pos = g.getAttribute("position");
          for (let i = 0; i < pos.count; i++) if (pos.getY(i) < 0.01) pos.setY(i, Math.sqrt(Math.max(0, r * r - pos.getZ(i) ** 2)) - r);
          g.computeVertexNormals();
          return g;
        }, metal, { hull: "cyl", cy: len / 2 });
        break;
      }
      {
        // a ring as thick as it is (a 4 mm runner spacer, a 1.5 mm washer), its hole for a 5 or 6 mm screw or bolt
        const ring = new THREE.Shape(), ri = Math.max(3.2, dia * 0.17);
        ring.absarc(0, 0, r, 0, Math.PI * 2, false);
        ring.holes.push(new THREE.Path().absarc(0, 0, ri, 0, Math.PI * 2, true));
        addSolid(d, `wa:${len}:${dia}`, () => new THREE.ExtrudeGeometry(ring, { depth: len, bevelEnabled: false, curveSegments: 24 }).rotateX(-Math.PI / 2), metal, { hull: "normal" });
      }
      break;
    case "rod":
      if (form === "collar") {
        // a long bolt with a thin round flange 12 mm from one end: that short end screwed in up to the flange, the
        // flange on the surface, the rest sticking out
        addSolid(d, `rod:${len}:${dia}`, cyl(r, len, 12), metal, { hull: "cyl", position: [0, len / 2 - 12, 0] });
        addSolid(d, `rod:flange:${dia}`, cyl(dia * 1.6, 1.8, 18), metal, { hull: "cyl", position: [0, 0.9, 0] }); // wider than a 16 mm tube end
        // thread rings along the long end, so it reads as a bolt, not a pin
        for (let y = 4; y < len - 14; y += 3) addSolid(d, `rod:ring:${dia}`, cyl(r * 1.12, 0.8, 12), metal, { position: [0, y, 0], edges: false });
        break;
      }
      // a threaded rod with no head, as much of it each side of where it goes in (rails screwed onto both ends)
      addSolid(d, `rod:${len}:${dia}`, cyl(r, len, 12), metal, { hull: "cyl" });
      break;
    case "stud":
      if (form === "double") {
        // a double cam bolt from y0 (in first) to y1: a knob on a neck at each end, a thin rod up to a collar 61% along
        // and a thicker body after it, as the manuals draw it
        const y0 = -10, y1 = len - 10, yc = y0 + len * 0.61;
        for (const [a, s] of [[y0, 1], [y1, -1]]) {
          addSolid(d, `sd2:knob:${dia}`, cyl(r * 0.8, 2.5, 16), metal, { hull: "cyl", position: [0, a + s * 1.25, 0] });
          addSolid(d, `sd2:neck:${dia}`, cyl(r * 0.35, 3, 10), metal, { hull: "cyl", position: [0, a + s * 4, 0] });
        }
        addSolid(d, `sd2:rod:${len}:${dia}`, cyl(r * 0.5, yc - y0 - 5.5, 12), metal, { hull: "cyl", position: [0, (y0 + 5.5 + yc) / 2, 0] });
        addSolid(d, `sd2:collar:${dia}`, cyl(r * 1.25, 1.5, 18), metal, { hull: "cyl", position: [0, yc, 0] });
        addSolid(d, `sd2:body:${len}:${dia}`, cyl(r * 0.75, y1 - 5.5 - yc, 14), metal, { hull: "cyl", position: [0, (y1 - 5.5 + yc) / 2, 0] });
        break;
      }
      addSolid(d, `sd:${len}:${dia}`, cyl(r * 0.8, len, 12), metal, { hull: "cyl", position: [0, len / 2 - 10, 0] });
      addSolid(d, `sd:head:${dia}`, cyl(r * 1.25, 3, 16), metal, { hull: "cyl", position: [0, len - 8.5, 0] });
      break;
    case "clamp":
      if (form === "omega") {
        // a 12 mm strip bent round a pole (Ø19), its origin on the pole's axis: the loop round its +y side, dia deep from
        // the wall to the loop's front, and an ear each side flat on the wall, len across them, a screw hole in each
        const R = 9.5, t = 1.5, Ro = R + t, yw = Ro - dia, e = len / 2;
        const s = new THREE.Shape();
        s.moveTo(-e, yw);
        s.lineTo(-R, yw);
        s.lineTo(-R, 0);
        s.absarc(0, 0, R, Math.PI, 0, true);
        s.lineTo(R, yw);
        s.lineTo(e, yw);
        s.lineTo(e, yw + t);
        s.lineTo(Ro, yw + t);
        s.lineTo(Ro, 0);
        s.absarc(0, 0, Ro, 0, Math.PI, false);
        s.lineTo(-Ro, yw + t);
        s.lineTo(-e, yw + t);
        addSolid(d, `cl:omega:${len}:${dia}`, () => new THREE.ExtrudeGeometry(s, { depth: 12, bevelEnabled: false, curveSegments: 12 }).translate(0, 0, -6), metal, { hull: "normal" });
        for (const x of [-1, 1]) addSolid(d, "cl:omega:hole", cyl(2.2, 0.3, 14), metal, { position: [(x * (e + Ro)) / 2, yw + t + 0.15, 0] });
        break;
      }
      addSolid(d, `cl:${len}:${dia}`, () => new THREE.BoxGeometry(len, 2.5, dia), metal, { position: [0, 1.25, 0] });
      // the bent ends, each with a 5 mm hole for its screw (its middle 6 mm from the bar)
      for (const x of [-1, 1]) addSolid(d, `cl:lip:${dia}`, () => slotted(dia, 9, 2.5, 2, 7).rotateY(Math.PI / 2), metal, { position: [x < 0 ? -len / 2 : len / 2 - 2.5, 1.5, 0] });
      break;
    case "angle":
      addSolid(d, `an:h:${len}:${dia}`, () => new THREE.BoxGeometry(dia, 2, len), metal, { position: [0, 1, 0] });
      addSolid(d, `an:v:${len}:${dia}`, () => new THREE.BoxGeometry(dia, len, 2), metal, { position: [0, len / 2, -len / 2 + 1] });
      break;
    case "wedge": {
      // a solid corner block, len x len, dia wide: its foot on the surface, its upright face (local +z, at z = len / 2)
      // against the panel it holds to, the screw's cross head in the middle of the sloped face
      const h = len / 2;
      addSolid(d, `wg:${len}:${dia}`, () => new THREE.ExtrudeGeometry(new THREE.Shape([new THREE.Vector2(-h, 0), new THREE.Vector2(h, 0), new THREE.Vector2(h, len)]), { depth: dia, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(dia / 2, 0, 0), plastic, { hull: "radial" });
      const n = Math.SQRT1_2, head = (k: number): THREE.Vector3Tuple => [0, h + n * k, -n * k];
      addSolid(d, "wg:head", cyl(3.4, 1.4, 16), metal, { hull: "cyl", position: head(0.7), rotation: [-Math.PI / 4, 0, 0] });
      addSolid(d, "wg:x1", () => new THREE.BoxGeometry(4, 0.4, 0.5), metal, { position: head(1.5), rotation: [-Math.PI / 4, 0, 0] });
      addSolid(d, "wg:x2", () => new THREE.BoxGeometry(0.5, 0.4, 4), metal, { position: head(1.5), rotation: [-Math.PI / 4, 0, 0] });
      break;
    }
    case "foot":
      if (form === "disc") {
        // an adjustable leg: a threaded shaft from 20 mm up its socket down to a dia disc on the floor (y = len)
        addSolid(d, `ft:shaft:${len}`, cyl(6, len + 12, 14), metal, { hull: "cyl", position: [0, (len - 28) / 2, 0] });
        addSolid(d, `ft:disc:${dia}`, cyl(r, 8, 28), plastic, { hull: "cyl", position: [0, len - 4, 0] });
        break;
      }
      addSolid(d, "ft:thread", cyl(4, 14, 10), metal, { hull: "cyl", position: [0, -7, 0] });
      addSolid(d, `ft:body:${len}:${dia}`, cyl(r, len, 20), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      break;
    case "spacer":
      if (form === "saddle") {
        // a wall clip block, dia across and len long, its far end (y = len) hollowed into a half round of its own radius
        // round a post standing along local z, a screw hole down its middle
        addSolid(d, `sp:sad:${len}:${dia}`, () => {
          const g = new THREE.CylinderGeometry(r, r, len, 24, 1).translate(0, len / 2, 0);
          const pos = g.getAttribute("position");
          for (let i = 0; i < pos.count; i++) if (pos.getY(i) > len - 0.01) pos.setY(i, len - Math.sqrt(Math.max(0, r * r - pos.getX(i) ** 2)));
          g.computeVertexNormals();
          return g;
        }, plastic, { hull: "cyl", cy: len / 2, edges: false }); // no edge lines: its hollow end is a fan of facets
        addSolid(d, "sp:sad:hole", cyl(2.2, 0.3, 12), plastic, { position: [0, len - r + 0.15, 0] });
        break;
      }
      if (form === "flange") {
        // a leg cup: a thin dia plate on the face, screwed through outside its socket (about 30 across), len tall
        addSolid(d, `sp:fl:${dia}`, cyl(r, 2, 28), metal, { hull: "cyl", position: [0, 1, 0] });
        addSolid(d, `sp:fl:sock:${len}`, cyl(15, len - 2, 22), metal, { hull: "cyl", position: [0, 2 + (len - 2) / 2, 0] });
        break;
      }
      addSolid(d, `sp:${len}:${dia}`, cyl(r, len, 18), plastic, { hull: "cyl", position: [0, len / 2, 0] });
      addSolid(d, "sp:screw", cyl(2, 10, 10), metal, { hull: "cyl", position: [0, -5, 0] });
      break;
    case "cap":
      if (form === "cup") {
        // a cup over a bolt head: its body len tall, a shallow dome closing its top
        const h = Math.min(2, len / 3), R = (r * r + h * h) / (2 * h);
        addSolid(d, `cap:cup:${len}:${dia}`, cyl(r, len, 22), plastic, { hull: "cyl", position: [0, len / 2, 0] });
        addSolid(d, `cap:dome:${len}:${dia}`, () => new THREE.SphereGeometry(R, 28, 6, 0, Math.PI * 2, 0, Math.acos((R - h) / R)), plastic, { hull: "radial", position: [0, len + h - R, 0], edges: false });
        break;
      }
      addSolid(d, `cap:${dia}`, cyl(r, 2, 18), plastic, { hull: "cyl", position: [0, 1, 0] });
      break;
    case "gasLift": {
      // the narrow end drops into the base; the rod at the top goes up into the seat
      addSolid(d, "gl:foot", cyl(14, 60, 18), metal, { hull: "cyl", position: [0, -30, 0] });
      addSolid(d, `gl:body:${len}:${dia}`, cyl(r, len - 40, 24), metal, { hull: "cyl", position: [0, (len - 40) / 2, 0] });
      addSolid(d, "gl:ring", cyl(18, 6, 20), plastic, { hull: "cyl", position: [0, len - 37, 0] });
      addSolid(d, "gl:rod", cyl(11, 36, 16), metal, { hull: "cyl", position: [0, len - 18, 0] });
      break;
    }
  }
  // a part's face is pushed back a pixel's worth of its slope (polygonOffset), a few mm zoomed out at an angle, so the
  // edge lines of a fitting's piece just inside it (a screw's end 1 mm under a door's front, 2 mm under a shelf's top)
  // showed through. A piece wholly inside (under y = 0) is pushed back too, its faces, outline and lines: a fixed
  // number of depth steps, 5 to 10 mm in the main view (near 10, far 30000; by the depth buffer) and well under a mm in
  // a zoom circle's. What stands out of the part isn't moved.
  d.root.updateMatrixWorld(true);
  for (const m of d.meshes) {
    if (new THREE.Box3().setFromObject(m).max.y > 0.05) continue;
    for (const o of m.parent!.children) {
      const mat = (o as THREE.Mesh).material as THREE.Material | undefined;
      if (mat) Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: mat.polygonOffsetFactor || 0, polygonOffsetUnits: 6000 });
    }
  }
  return d;
}

export function wallDrawable(w: number, h: number) {
  const d = new Drawable();
  addSolid(d, `wall:${w}:${h}`, () => new THREE.BoxGeometry(w, h, 40), FACE.wall);
  return d;
}

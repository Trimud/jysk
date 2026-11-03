import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder, StepDef } from "../builder";
import { add, neg, rotate } from "../math";
import type { Family } from "./family";

/*
 * JYSK JEGIND dining chair, natural wood/black (3640139, 3670229, 82791001), read from its 13-page manual (Rev 5, 18.07.2025).
 * No separate legs: two flat side frames (1, 2), 758x630x25 of black solid wood, each a front leg, a rail and a back leg
 * that kinks up into a backrest post. They cross diagonally under the seat, front leg on one side and post on the other,
 * halved into each other where they meet (2's notch on top, 1's underneath), with one connector screw (B) up through
 * the crossing. The curved oak backrest (3) bolts to the two posts (C), the round seat (4) sits on the rails (E up
 * through them), and two wedge blocks (5) fill the side angles of the cross under the seat, screwed to both rails (A).
 * Part numbers and sizes are the manual's (page 9); x across, y up from the floor, z to the front, the crossing at x = z = 0.
 */

// fittings, page 7 (D, the 4 mm allen key, is a tool here)
const A: HwDef = { kind: "screw", len: 25, dia: 4 };
const B: HwDef = { kind: "bolt", len: 50, dia: 7, name: "Connector screw", flush: true };
const C: HwDef = { kind: "bolt", len: 20, dia: 6 };
const E: HwDef = { kind: "bolt", len: 60, dia: 6, flush: true };
const F: HwDef = { kind: "glide", len: 3, dia: 22 };

const TH = (38 * Math.PI) / 180; // the frames run 38° off front-to-back: 47 wide at the backrest, about 54 deep
const S = Math.sin(TH), K = Math.cos(TH);
const SEAT = 445; // the seat's underside, on the rails: 46 cm seat height
const RAIL = 50; // rail height under the seat
const N = 12.5 / Math.sin(2 * TH); // half the halving notch, along a rail: the other frame's 25 mm crossing at 76°
// a frame in its own plane, u along the diagonal (+ to its front leg), y up: the posts' faces at height y
const uFront = (y: number) => -215 - (50 * (y - 445)) / 313;
const uBack = (y: number) => -250 - (40 * (y - 445)) / 313;
const CY = [690, 735]; // the backrest bolts' heights
const BETA = Math.atan((50 / 313) / K); // the backrest leans back with the posts
const RO = -uFront(712), RI = RO - 15; // the backrest's back and front radius, round the crossing at the bolts' mid height
const ALPHA = Math.asin(232 / RO); // its ends at 464 wide

/** A flat piece cut to an outline of [u, y] corners in a frame's plane, 25 thick. */
function flat(pts: [number, number][], material: "board" | "wood" = "board"): PartPiece {
  const us = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const cu = (Math.min(...us) + Math.max(...us)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    shape: "slab",
    outline: pts.map(([u, y]) => [u - cu, cy - y]),
    size: [Math.max(...us) - Math.min(...us), 25, Math.max(...ys) - Math.min(...ys)],
    pos: [cu, cy, 0],
    rot: [Math.PI / 2, 0, 0],
    material,
  };
}

/** A board cut to an outline of [x, z] corners, `h` thick, centred at height y. */
function slab(pts: [number, number][], h: number, y: number, material: "board" | "wood"): PartPiece {
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  return { shape: "slab", outline: pts.map(([x, z]) => [x - cx, z - cz]), size: [Math.max(...xs) - Math.min(...xs), h, Math.max(...zs) - Math.min(...zs)], pos: [cx, y, cz], material };
}

function build(b: PlanBuilder, s: ProductSpec): boolean {
  if (s.archetype !== "seat" || Math.round(s.size.w) !== 47 || Math.round(s.size.h) !== 80 || Math.round(s.size.d) !== 54) return false;

  /* ---------- parts ---------- */

  // the side frames: front leg, back leg and post, and the rail between, halved in the middle (2 from the top, 1 from below)
  const yr = SEAT - RAIL, ym = SEAT - RAIL / 2;
  const lerp = (a: number, c: number, y: number) => a + ((c - a) * (SEAT - y)) / SEAT; // a leg's inner edge, a at the seat, c at the floor
  const frameT = (label: string, top: boolean) =>
    b.compound("Side frame", [
      flat([[175, 445], [215, 445], [315, 0], [283, 0]]), // front leg
      flat([[-250, 445], [-215, 445], [-283, 0], [-315, 0]]), // back leg
      flat([[-250, 445], [-215, 445], [-265, 758], [-290, 758]]), // post
      flat([[lerp(-215, -283, yr), yr], [-N, yr], [-N, SEAT], [-215, SEAT]]),
      flat([[N, yr], [lerp(175, 283, yr), yr], [175, SEAT], [N, SEAT]]),
      flat(top ? [[-N, yr], [N, yr], [N, ym], [-N, ym]] : [[-N, ym], [N, ym], [N, SEAT], [-N, SEAT]]),
    ], { material: "board", label, tone: 1 }); // the black of "Natural wood+Black"
  /** a frame turned onto its diagonal: g -1 has its front leg on the left (1), g 1 on the right (2) */
  const frame = (label: string, top: boolean, g: number) => {
    const { type, mid } = frameT(label, top);
    const rot: Vec3 = [0, Math.atan2(-K, g * S), 0];
    return { key: b.place(type, rotate(mid, rot), rot), g };
  };
  const f1 = frame("1", false, -1);
  const f2 = frame("2", true, 1);
  /** where a point in a frame's plane is: u along it, y up */
  const at = (g: number, u: number, y: number): Vec3 => [g * S * u, y, K * u];

  // the backrest: a band of the circle round the crossing, leaning back with the posts about the bolts' mid height
  const arc = (r: number, k: number) => Array.from({ length: 17 }, (_, i): [number, number] => {
    const a = -ALPHA + (2 * ALPHA * (k > 0 ? i : 16 - i)) / 16;
    return [r * Math.sin(a), RO * K - r * Math.cos(a)];
  });
  const backBand = b.compound("Backrest", [slab([...arc(RO, 1), ...arc(RI, -1)], 158, 0, "wood")], { material: "wood", label: "3" });
  const backRot: Vec3 = [-BETA, 0, 0];
  const back = b.place(backBand.type, add([0, 712, -RO * K], rotate(backBand.mid, backRot)), backRot);

  const seat = b.place(b.part("Seat", [425, 15, 425], { shape: "cyl", material: "wood", label: "4" }), [0, SEAT + 7.5, 0]);

  // the corner blocks: wedges 96 x 37.5 filling the side angles of the cross (104°), 50 tall, up against the seat
  const x0 = 12.5 / K, x1 = (48 * S + 12.5) / K;
  const block = b.compound("Corner block", [slab([[x0, 0], [x1, 48], [x1, -48]], RAIL, ym, "wood")], { material: "wood", label: "5" });
  const blocks = [1, -1].map((g) => {
    const rot: Vec3 = [0, g > 0 ? 0 : Math.PI, 0];
    return b.place(block.type, rotate(block.mid, rot), rot);
  });

  /* ---------- fittings, where they end up ---------- */

  // C: through each post into the backrest, from a 13 mm recess in the post's back
  const cBolts = [f1, f2].flatMap((f) => CY.map((y) => ({ f, y, dir: at(f.g, 1, 0), face: at(f.g, uBack(y), y) })));
  // E: up through the rails into the seat, two each side of the crossing; B up through the crossing itself
  const eBolts = [f1, f2].flatMap((f) => [-120, 120].map((u): FitOpts => ({ on: f.key, at: at(f.g, u, yr), dir: [0, 1, 0] })));
  // A: from each block's open face square into the two rails, two into each
  const aScrews = [1, -1].flatMap((g, i) =>
    [30, -30].flatMap((z) =>
      [408, 432].map((y): FitOpts => ({ on: blocks[i], at: [g * x1, y, z], dir: [-g * K, 0, Math.sign(z) * S] })),
    ),
  );
  const pads = [f1, f2].flatMap((f) => [299, -299].map((u): FitOpts => ({ on: f.key, at: at(f.g, u, 0), dir: [0, 1, 0] })));

  /* ---------- steps ---------- */

  const step = (d: StepDef, body = () => {}) => b.step(d, body);
  step({
    title: "Drop side frame 1 into side frame 2",
    detail: "Stand frame 2 on its legs and lower frame 1 into it from above, so the notches in their rails slot together in a cross. Check which is which: the posts end up at the back. Then screw the connector screw (B) up through the crossing with the allen key, about 80% tight.",
    tools: ["allen"],
    kind: "join",
    warnings: ["floor"],
  }, () => {
    b.add(f2.key, [300, 0, 0]);
    b.then(0.15);
    b.add(f1.key, [0, 320, 0]);
    b.then(0.15);
    b.fit(B, { on: f2.key, at: [0, yr, 0], dir: [0, 1, 0] });
  });
  step({
    title: "Bolt the backrest (3) to the posts",
    detail: "Hold it in front of the two posts and put two 20 mm bolts (C) through each post from behind. Not the 60 mm ones (E). About 80% tight.",
    tools: ["allen"],
    kind: "bolts",
    warnings: ["loose"],
  }, () => {
    b.add(back, [0, 120, 260]);
    b.then(0.15);
    b.stagger(0.1);
    for (const c of cBolts) {
      b.hole(c.f.key, c.face, neg(c.dir), 6.5);
      b.fit(C, { on: c.f.key, at: add(c.face, at(c.f.g, 13, 0)), dir: c.dir, hole: false });
    }
  });
  step({
    title: "Turn it over onto the seat (4) and bolt it on",
    detail: "Lay the seat face down on something soft and stand the chair upside down on it, centred. Four 60 mm bolts (E) up through the rails into the seat, about 80% tight. Peel the felt pads (F) and press one onto each foot.",
    tools: ["allen"],
    pose: "-y",
    kind: "bolts",
  }, () => {
    b.add(seat, [0, 0, 380]);
    b.then(0.15);
    b.fits(E, eBolts, 0.1);
    b.then(0.1);
    b.fits(F, pads, 0.1);
  });
  step({
    title: "Stand it up and tighten the seat",
    detail: "Turn it onto its feet and press the seat down all round, so all four feet sit flat and it doesn't rock. Then tighten the screw under the crossing (B) and the four seat bolts (E) all the way.",
    tools: ["allen"],
    kind: "bolts",
  });
  step({
    title: "Screw in the two corner blocks (5)",
    detail: "Upside down again. A block goes into each side angle of the cross, tight under the seat: two screws (A) through it into each rail, with a cross-head screwdriver.",
    tools: ["screwdriver"],
    pose: "-y",
    kind: "screws",
  }, () => {
    b.stagger(0.25);
    blocks.forEach((k, i) => b.add(k, [i === 0 ? 220 : -220, 0, 0]));
    b.then(0.15);
    b.fits(A, aScrews, 0.08);
  });
  step({
    title: "Tighten the backrest",
    detail: "Back on its feet: turn the four backrest bolts (C) all the way, and check the screw under the crossing (B) is tight.",
    tools: ["allen"],
    kind: "bolts",
  });
  step({
    title: "Done: retighten later",
    detail: "Tested for 110 kg in the home. Tighten every bolt and screw again after 2 weeks, then every 3 months.",
    kind: "general",
  });
  return true;
}

const family: Family = { names: ["JEGIND"], build };
export default family;

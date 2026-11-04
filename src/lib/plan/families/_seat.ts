import type { PartPiece, ProductSpec, Vec3 } from "../../types";
import type { FitOpts, HwDef, PlanBuilder } from "../builder";
import { sub } from "../math";

/**
 * Shared by the JYSK chairs and armchairs that come with their body made and only take their legs ("Legs must be
 * mounted"): the body drawn as one upholstered part, round legs between two points, and bolts with a washer under
 * each. x across, y up from the floor, z to the front; mm. Not a family itself (the leading _ keeps it out of the index).
 */

export type Body = {
  name: string;
  label: string;
  w: number; // overall width
  d: number; // overall depth
  h: number; // overall height
  base: number; // its underside, where the legs meet it
  seat: number; // top of the seat
  back: number; // how thick the back is
  arm?: number; // top of the arms, when it has them
  armW?: number;
};

/** The made body: a seat block, the back across the rear, and the arms when it has them. Returns its key. */
export function body(b: PlanBuilder, o: Body): string {
  const armW = o.arm ? (o.armW ?? 80) : 0;
  const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });
  const pieces = [
    box([o.w - 2 * armW, o.seat - o.base, o.d - o.back], [0, (o.base + o.seat) / 2, o.back / 2]),
    box([o.w, o.h - o.base, o.back], [0, (o.base + o.h) / 2, -o.d / 2 + o.back / 2]),
    ...(o.arm ? [-1, 1].map((g) => box([armW, o.arm! - o.base, o.d - o.back], [g * (o.w / 2 - armW / 2), (o.base + o.arm!) / 2, o.back / 2])) : []),
  ];
  const { type, mid } = b.compound(o.name, pieces, { material: "soft", label: o.label, made: true });
  return b.place(type, mid);
}

/** A round leg (or rail) from a to c, `dia` thick, as a piece. */
export function rod(a: Vec3, c: Vec3, dia: number): PartPiece {
  const v = sub(c, a);
  const len = Math.hypot(...v);
  const u = v.map((k) => k / len);
  // turns the piece's own y axis onto a -> c (Rz first, then Ry: see math.rotate)
  const tz = Math.acos(u[1]);
  const ty = Math.sin(tz) < 1e-6 ? 0 : Math.atan2(u[2], -u[0]);
  return { shape: "cyl", size: [dia, len, dia], pos: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2], rot: [0, ty, tz] };
}

/** Bolts with a washer under each head: both start at the face the bolt goes in through. */
export function washered(b: PlanBuilder, bolt: HwDef, washer: HwDef, list: FitOpts[], gap = 0.08) {
  for (const o of list) {
    b.fit(washer, { ...o, mate: undefined, hole: false });
    b.fit(bolt, o);
    b.then(gap);
  }
}

/** The manuals' last word on every one of these. */
export const RETIGHTEN = "Tighten the bolts again after 2 weeks, then every 3 months.";

/**
 * A dining chair on two crossed leg frames (BELLINGE, PURHUS): each frame is two splayed round legs joined by a rail,
 * the rails halved into each other in an X under the seat. The frames are crossed and bolted at the middle (A), then
 * stood on the upturned seat and bolted up into it near the legs (B, a washer under each).
 */
export type Crossed = {
  w: number; d: number; h: number; // cm, the product's size, to know it by
  seat: Body;
  frame: { len: number; top: number }; // the frames' length along the diagonal, and the legs' span at the top
  A: HwDef; // the bolt through the crossing
  B: HwDef; // the four into the seat
  D: HwDef; // washer
  crossWasher: boolean; // whether A takes a washer too
  steps: "five" | "three"; // the manual's own split: cross, bolt, seat, stand, tighten; or cross+bolt, seat, stand+tighten
  tested?: string;
};

export function crossed(o: Crossed) {
  return (b: PlanBuilder, s: ProductSpec): boolean => {
    if (s.archetype !== "seat" || Math.round(s.size.w) !== o.w || Math.round(s.size.h) !== o.h || Math.round(s.size.d) !== o.d) return false;
    const base = o.seat.base, RAIL = 40, LEG = 32, RD = 26; // RD: the rail tube's diameter
    const seat = body(b, o.seat);

    // the frames run corner to corner: 2 from back left to front right, 3 from back right to front left
    const n = Math.hypot(o.seat.w, o.seat.d);
    const dir = (g: number): Vec3 => [(g * o.seat.w) / n, 0, o.seat.d / n];
    const at = (g: number, u: number, y: number): Vec3 => [dir(g)[0] * u, y, dir(g)[2] * u];
    const frame = (label: string, g: number) => {
      const { type, mid } = b.compound(
        "Leg frame",
        [
          rod(at(g, -o.frame.top / 2, base), at(g, -o.frame.len / 2 + LEG / 2, 0), LEG),
          rod(at(g, o.frame.top / 2, base), at(g, o.frame.len / 2 - LEG / 2, 0), LEG),
          rod(at(g, -o.frame.top / 2, base - RAIL / 2), at(g, o.frame.top / 2, base - RAIL / 2), RD),
        ],
        { material: "metal", label },
      );
      return b.place(type, mid);
    };
    const f2 = frame("2", 1), f3 = frame("3", -1);

    const cross: FitOpts = { on: f3, at: [0, base, 0], dir: [0, -1, 0], mate: f2 };
    // B: up through each rail end, just inside the legs, into the seat's frame
    const ups = [[f2, 1], [f3, -1]].flatMap(([f, g]) =>
      [-1, 1].map((k): FitOpts => ({ on: f as string, at: at(g as number, (k * o.frame.top) / 2 - k * 45, base - RAIL / 2 - RD / 2), dir: [0, 1, 0], mate: seat })), // from the rail's underside
    );

    const crossIt = () => {
      b.add(f2, [250, 0, 0]);
      b.then(0.15);
      b.add(f3, [0, 300, 0]);
      b.then(0.15);
    };
    const boltCross = () => (o.crossWasher ? washered(b, o.A, o.D, [cross]) : b.fit(o.A, cross));
    const crossTitle = "Cross the two leg frames (2, 3)";
    const crossDetail = "Stand frame 2 on its legs and lower frame 3 into it from above, so the notches in their rails slot together. The arrows printed on the rails must point the same way.";
    const aDetail = `${o.crossWasher ? "One short bolt (A) with a washer (D)" : "One short bolt (A)"} down through the middle of the cross with the allen key, about 80% tight. Not one of the long bolts (B): they are too long here.`;

    if (o.steps === "five") {
      b.step({ title: crossTitle, detail: crossDetail, kind: "join", warnings: ["floor"] }, crossIt);
      b.step({ title: "Bolt the cross together", detail: aDetail, kind: "bolts", tools: ["allen"] }, boltCross);
    } else {
      b.step({ title: `${crossTitle} and bolt them`, detail: `${crossDetail} Then: ${aDetail[0].toLowerCase()}${aDetail.slice(1)}`, kind: "join", tools: ["allen"], warnings: ["floor"] }, () => {
        crossIt();
        boltCross();
      });
    }
    b.step(
      {
        title: "Bolt the legs to the seat (1)",
        detail: "Turn the seat upside down onto its box or a rug and stand the leg cross on it, the arrows on the rails matching the arrows underneath the seat. Four long bolts (B), each with a washer (D), up through the rail ends: about 80% tight.",
        kind: "legs",
        tools: ["allen"],
        pose: "-y",
      },
      () => {
        b.add(seat, [0, 0, 300]);
        b.then(0.15);
        washered(b, o.B, o.D, ups);
      },
    );
    const press = "Turn it onto its feet and press down on the seat, so all four feet sit flat on the floor and it doesn't rock.";
    const tighten = `Then tighten all five bolts the whole way with the allen key. ${o.tested ? o.tested + " " : ""}${RETIGHTEN}`;
    if (o.steps === "five") {
      b.step({ title: "Stand it up and settle it", detail: press, kind: "standup" }, () => {});
      b.step({ title: "Tighten every bolt", detail: tighten, kind: "bolts", tools: ["allen"] }, () => {});
    } else {
      b.step({ title: "Stand it up, settle it and tighten", detail: `${press} ${tighten}`, kind: "standup", tools: ["allen"] }, () => {});
    }
    return true;
  };
}

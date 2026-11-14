import type {
  PlanView,
  HwForm,
  HwItem,
  HwKind,
  HwType,
  Item,
  LayoutOption,
  Opening,
  PartItem,
  PartMaterial,
  PartMark,
  PartPiece,
  PartType,
  Plan,
  Pose,
  ProductSpec,
  Step,
  StepKind,
  ToolId,
  ToolNeed,
  Vec3,
  WarnId,
} from "../types";
import { add, insidePart, mul, neg, rotate, sub, toLocal, unrotate } from "./math";
import { BRACKET, bracketScrews } from "@/engine/sizes";

const LETTERS = "ABCDEFGHJKLMNPRSTUVWXYZ";

export interface HwDef {
  kind: HwKind;
  len: number;
  dia: number;
  notIncluded?: boolean;
  name?: string; // the fitting's own name when the kind's general one doesn't fit ("Catch", "Knob bolt")
  flush?: boolean; // a bolt whose head sinks level with the surface (a connector screw)
  roller?: "back"; // a runner with its roller at the back end (most drawer runners); unset, it is at the front
  form?: HwForm; // its shape, where the kind has more than one (types.ts)
  drive?: "torx"; // turned with a Torx key
}

/** The marking on a rail's underside, where its cam locks go in: the face that goes down. */
export const SIDE_DOWN: PartMark = { text: "This side down", face: "-y" };

/** A drawer runner (wheel at the back end) or cabinet runner (wheel at the front), 20 mm tall. */
export const runner = (len: number, name: string, roller?: "back"): HwDef => ({ kind: "runner", len, dia: 20, name, ...(roller ? { roller } : {}) });

/** A cabinet runner's screws: one in each hole along it, and the front one 11 mm higher, in its raised end hole. */
export const runnerScrews = (x: number, y: number, zs: number[], frontZ: number): Vec3[] => [...zs.map((z): Vec3 => [x, y, z]), [x, y + 11, frontZ]];

export const HW = {
  dowel: { kind: "dowel", len: 30, dia: 8 },
  camScrew: { kind: "camScrew", len: 34, dia: 7 },
  cam: { kind: "cam", len: 13, dia: 15 },
  screwS: { kind: "screw", len: 14, dia: 3.5 },
  screwM: { kind: "screw", len: 30, dia: 4 },
  screwL: { kind: "screw", len: 50, dia: 5 },
  nail: { kind: "nail", len: 20, dia: 1.6 },
  pin: { kind: "pin", len: 16, dia: 5 },
  legScrew: { kind: "legScrew", len: 70, dia: 8 },
  boltS: { kind: "bolt", len: 40, dia: 6 },
  boltL: { kind: "bolt", len: 70, dia: 6 },
  plate: { kind: "plate", len: 80, dia: 80 },
  bracket: { kind: "bracket", len: 60, dia: 40 },
  knob: { kind: "knob", len: 25, dia: 30 },
  handle: { kind: "handle", len: 128, dia: 12 },
  hinge: { kind: "hinge", len: 50, dia: 35 },
  glide: { kind: "glide", len: 4, dia: 20 },
  wallScrew: { kind: "screw", len: 50, dia: 5, notIncluded: true },
  plug: { kind: "plug", len: 35, dia: 8, notIncluded: true },
  castor: { kind: "castor", len: 58, dia: 50 },
  gasLift: { kind: "gasLift", len: 200, dia: 50 },
  connector: { kind: "connector", len: 120, dia: 30 },
  roller: { kind: "roller", len: 44, dia: 26 },
  flatHinge: { kind: "flatHinge", len: 60, dia: 34 },
  hook: { kind: "hook", len: 55, dia: 22 },
  runner: { kind: "runner", len: 400, dia: 40 },
  clip: { kind: "clip", len: 12, dia: 10 },
  strap: { kind: "strap", len: 110, dia: 20 },
  nut: { kind: "nut", len: 5, dia: 6 },
  washer: { kind: "washer", len: 1.5, dia: 16 },
  stud: { kind: "stud", len: 22, dia: 8 },
  clamp: { kind: "clamp", len: 44, dia: 18 },
  angle: { kind: "angle", len: 30, dia: 24 },
  foot: { kind: "foot", len: 30, dia: 32 },
  cap: { kind: "cap", len: 2, dia: 14 },
  spacer: { kind: "spacer", len: 20, dia: 16 },
} satisfies Record<string, HwDef>;

const HW_NAMES: Record<HwKind, string> = {
  dowel: "Wooden dowel",
  camScrew: "Cam bolt",
  cam: "Cam lock",
  screw: "Screw",
  nail: "Nail",
  pin: "Shelf pin",
  legScrew: "Leg bolt",
  bolt: "Allen bolt",
  plate: "Leg plate",
  bracket: "Wall bracket",
  runner: "Drawer runner",
  knob: "Knob",
  handle: "Handle",
  hinge: "Hinge",
  glide: "Felt pad",
  plug: "Wall plug",
  castor: "Castor",
  gasLift: "Gas lift",
  connector: "Connector",
  roller: "Door roller",
  flatHinge: "Flat hinge",
  hook: "Hook",
  clip: "Plastic clip",
  strap: "Wall strap",
  nut: "Nut",
  washer: "Washer",
  stud: "Stud",
  rod: "Threaded rod",
  barrel: "Barrel nut",
  clamp: "Clamp",
  angle: "Angle bracket",
  wedge: "Corner block",
  foot: "Foot",
  cap: "Cover cap",
  spacer: "Wall spacer",
};

/** The fitting a placed one was made from, own name included, to fit the same again (rows repeating a frame). */
export function defOf(ht: HwType): HwDef {
  return { kind: ht.kind, len: ht.len, dia: ht.dia, notIncluded: ht.notIncluded, form: ht.form, drive: ht.drive, ...(ht.name !== HW_NAMES[ht.kind] ? { name: ht.name } : {}) };
}

export function hwSpecText(kind: HwKind, len: number, dia: number) {
  switch (kind) {
    case "dowel":
    case "screw":
    case "nail":
    case "legScrew":
    case "bolt":
    case "plug":
      return `${dia} × ${len} mm`;
    case "camScrew":
      return `${len} mm`;
    case "cam":
      return `${dia} mm`;
    case "pin":
      return `${dia} mm`;
    case "runner":
      return `${len} mm`;
    case "handle":
      return `${len} mm`;
    case "nut":
    case "washer":
      return `${dia} mm`;
    case "stud":
    case "rod":
    case "barrel":
      return `${dia} × ${len} mm`;
    case "wedge":
      return `${len} × ${len} mm`;
    default:
      return "";
  }
}

const DUR = { part: 0.95, hw: 0.6 };

export interface StepDef {
  title: string;
  detail?: string;
  tools?: ToolId[];
  people?: 1 | 2;
  repeat?: number;
  scene?: string;
  pose?: Pose;
  warnings?: WarnId[];
  kind: StepKind;
  check?: "square";
  wall?: boolean;
  weight?: number;
  turn?: number; // radians the view turns round, to show faces that point away from it
  el?: number; // the view's height (radians up), lower to look under a rail or a shelf
  page?: number; // the manual page this step is drawn on, for qa:manual when the manual has no text to read its step numbers
}

export interface FitOpts {
  on?: string;
  at: Vec3; // assembled frame (or scene frame when no parent)
  dir: Vec3;
  twist?: number;
  travel?: number;
  spin?: number;
  turn?: number;
  mate?: string; // part that receives the protruding end
  hole?: number | false;
  mateHole?: number;
  scale?: number;
  wall?: boolean; // fixes it to the wall: kept out of the preview (defaults to the step's own `wall`)
  sunk?: boolean; // its head sits in a counterbore, below the surface (qa:overlaps checks the rest start at it)
}

export class PlanBuilder {
  parts: PartType[] = [];
  hw = new Map<string, HwType>();
  items: Item[] = [];
  /** what opens on the finished piece (drawers, doors), for the preview */
  opens: Opening[] = [];
  map = new Map<string, Item>();
  steps: Step[] = [];
  private n = 0;
  private t = 0;
  private end = 0;
  private gap = 0;
  private cur: Step | null = null;
  private view_?: PlanView;

  spec: ProductSpec;
  constructor(spec: ProductSpec) {
    this.spec = spec;
  }

  part(name: string, size: Vec3, o: { shape?: "box" | "cyl"; material?: PartMaterial; extra?: boolean; made?: boolean; label?: string; tone?: number; mark?: PartMark } = {}) {
    const id = "p" + this.parts.length;
    this.parts.push({
      id,
      label: o.label ?? "",
      name,
      size,
      shape: o.shape ?? "box",
      material: o.material ?? "board",
      qty: 0,
      extra: o.extra,
      ...(o.made ? { made: true } : {}),
      ...(o.tone ? { tone: o.tone } : {}),
      ...(o.mark ? { mark: o.mark } : {}),
    });
    return id;
  }

  /**
   * A part made of several boxes and cylinders (a star base, a cot side with its bars). The part is
   * centred on the bounding box of its pieces: `mid` is that centre in the frame the pieces were given
   * in, so placing the part at `mid` (unturned) puts every piece where it was drawn.
   */
  compound(name: string, pieces: PartPiece[], o: { material?: PartMaterial; extra?: boolean; made?: boolean; label?: string; tone?: number } = {}) {
    const lo: Vec3 = [Infinity, Infinity, Infinity], hi: Vec3 = [-Infinity, -Infinity, -Infinity];
    for (const p of pieces) {
      const [sx, sy, sz] = p.size;
      for (const a of [-1, 1])
        for (const b of [-1, 1])
          for (const c of [-1, 1]) {
            const v = rotate([(a * sx) / 2, (b * sy) / 2, (c * sz) / 2], p.rot ?? [0, 0, 0]);
            for (let i = 0; i < 3; i++) {
              lo[i] = Math.min(lo[i], p.pos[i] + v[i]);
              hi[i] = Math.max(hi[i], p.pos[i] + v[i]);
            }
          }
    }
    const r = (n: number) => Math.round(n * 10) / 10;
    const mid: Vec3 = [r((lo[0] + hi[0]) / 2), r((lo[1] + hi[1]) / 2), r((lo[2] + hi[2]) / 2)];
    const type = this.part(name, [r(hi[0] - lo[0]), r(hi[1] - lo[1]), r(hi[2] - lo[2])], { material: o.material, extra: o.extra, made: o.made, label: o.label, tone: o.tone });
    this.parts[this.parts.length - 1].pieces = pieces.map((p) => ({ ...p, pos: [r(p.pos[0] - mid[0]), r(p.pos[1] - mid[1]), r(p.pos[2] - mid[2])] }));
    return { type, mid };
  }

  place(ref: string, pos: Vec3, rot: Vec3 = [0, 0, 0]) {
    const key = "i" + this.n++;
    const it: PartItem = { key, kind: "part", ref, final: { pos, rot }, states: [], holes: [] };
    this.items.push(it);
    this.map.set(key, it);
    return key;
  }

  /** A drawer as a builder makes it, registered so the preview can open it; returns the drawer. Wrap the object where
   *  the drawer is made, so none can exist unregistered. */
  drawer<T extends { front: string; sides: string[]; back: string; bottom: string }>(d: T, depth: number, out?: Vec3): T {
    this.openDrawer([d.front, ...d.sides, d.back, d.bottom], depth, out);
    return d;
  }

  /** Shows parts in their own scene: as they sit in the finished piece, moved so `centre` is the origin, arriving from `from`. */
  stageAround(keys: string[], centre: Vec3, from?: Vec3) {
    for (const k of keys) {
      const f = this.partItem(k).final;
      this.stage(k, sub(f.pos, centre), f.rot, from);
    }
  }

  /** A drawer on the finished piece: these parts slide out, about two thirds of its depth, along `out` (the front, +z,
   *  unless it opens to a side: a bed's side drawers go out along ±x). */
  openDrawer(parts: string[], depth: number, out: Vec3 = [0, 0, 1]) {
    this.opens.push({ parts, slide: mul(out, Math.round(depth * 0.66)) });
  }

  /** A door on the finished piece, hinged on its left (sgn -1) or right (sgn 1) edge: it swings `deg` (100 by default)
   *  out of the front (+z) about that edge of its front face, both read from where the door was placed. A cup hinge
   *  pivots out in front of the door like that, so the door's edge clears the front or side beside it; turning about
   *  the back face, its front corner would swing into them. Less than 100 when an open drawer beside its hinge would
   *  be in the way.
   *  ponytail: assumes the door stands unrotated, facing +z (every builder places them so). */
  openDoor(key: string, sgn: number, deg = 100) {
    const it = this.partItem(key);
    const [w, , t] = this.parts.find((p) => p.id === it.ref)!.size;
    const [x, , z] = it.final.pos;
    this.opens.push({ parts: [key], hinge: { at: [x + (sgn * w) / 2, 0, z + t / 2], axis: [0, 1, 0], angle: (sgn * deg * Math.PI) / 180 } });
  }

  partItem(key: string) {
    const it = this.map.get(key);
    if (!it || it.kind !== "part") throw new Error("not a part " + key);
    return it;
  }

  hole(key: string, at: Vec3, n: Vec3, r: number) {
    const it = this.partItem(key);
    it.holes.push({ p: toLocal(at, it.final.pos, it.final.rot), n: unrotate(n, it.final.rot), r });
  }

  hwType(def: HwDef) {
    const id = `${def.kind}-${def.len}-${def.dia}${def.notIncluded ? "-x" : ""}${def.flush ? "-f" : ""}${def.form ? "-" + def.form : ""}${def.drive ? "-" + def.drive : ""}${def.name ? "-" + def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") : ""}`;
    if (!this.hw.has(id)) {
      this.hw.set(id, {
        id,
        kind: def.kind,
        name: def.name ?? (def.form === "euro" ? "Euro screw" : HW_NAMES[def.kind]),
        spec: hwSpecText(def.kind, def.len, def.dia),
        len: def.len,
        dia: def.dia,
        qty: 0,
        notIncluded: def.notIncluded,
        ...(def.roller ? { roller: def.roller } : {}),
        flush: def.flush,
        ...(def.form ? { form: def.form } : {}),
        ...(def.drive ? { drive: def.drive } : {}),
      });
    }
    return id;
  }

  /** Where the finished piece is seen from (intro, finished view, preview, thumbnails), when not STEP_CAM.az. */
  view(v: PlanView) {
    this.view_ = v;
  }

  /**
   * One of the manual's either/or choices, offered at the next step (the one where the visitor picks); returns the option
   * to build: the one of them named in spec.layout ("C,R"), else the first. Option ids are unique across a plan's choices.
   */
  layouts(options: LayoutOption[]): string {
    const pick = this.pick(options);
    (this.layouts_ ??= []).push({ step: this.steps.length, pick, options });
    return pick;
  }

  /** The option of a choice this plan builds (see layouts), for placing parts before the step that offers it. */
  pick(options: LayoutOption[]): string {
    return (options.find((o) => this.spec.layout?.split(",").includes(o.id)) ?? options.find((o) => o.first) ?? options[0]).id;
  }
  private layouts_?: Plan["layouts"];

  /* ---------- step context ---------- */

  step(def: StepDef, body: () => void = () => {}) {
    const s: Step = {
      n: this.steps.length,
      title: def.title,
      detail: def.detail,
      tools: def.tools ?? [],
      people: def.people ?? 1,
      repeat: def.repeat,
      scene: def.scene ?? "main",
      pose: def.pose ?? "+y",
      warnings: def.warnings ?? [],
      kind: def.kind,
      check: def.check,
      wall: def.wall,
      minutes: def.weight ?? 0,
      ...(def.turn ? { turn: def.turn } : {}),
      ...(def.el !== undefined ? { el: def.el } : {}),
      ...(def.page ? { page: def.page } : {}),
    };
    this.steps.push(s);
    this.cur = s;
    this.t = 0.15;
    this.end = 0.15;
    this.gap = 0.22;
    body();
    this.cur = null;
    return s;
  }

  private get step_(): Step {
    if (!this.cur) throw new Error("outside step");
    return this.cur;
  }

  stagger(gap: number) {
    this.gap = gap;
  }
  then(pause = 0.12) {
    this.t = this.end + pause;
  }
  wait(sec: number) {
    this.t += sec;
  }

  private slot(dur: number) {
    const d = this.t;
    this.t += this.gap;
    this.end = Math.max(this.end, d + dur);
    return d;
  }

  /** Parts shown faded where they will go, in this step only (the layout a visitor is picking); a later step adds them. */
  ghost(keys: string[]) {
    const s = this.step_;
    for (const k of keys) {
      const it = this.partItem(k);
      it.states.push({ step: s.n, scene: s.scene, pos: it.final.pos, rot: it.final.rot, delay: this.slot(DUR.part), ghost: true });
    }
  }

  /** Part reaches its assembled position in this step. */
  add(key: string, from?: Vec3, o: { spin?: number } = {}) {
    const it = this.partItem(key);
    const s = this.step_;
    // a piece put together in a side scene (a plinth screwed to its bottom) comes in as one: parts last shown in the same
    // other scene, added in this step from the same way, share one slot instead of arriving one after another
    const last = it.states.at(-1);
    const group = last && last.scene !== s.scene ? `${s.n}|${last.scene}|${from?.join() ?? ""}` : null;
    const delay = group && this.group?.key === group ? this.group.delay : this.slot(DUR.part + (o.spin ? 0.4 : 0));
    if (group) this.group = { key: group, delay };
    it.states.push({ step: s.n, scene: s.scene, pos: it.final.pos, rot: it.final.rot, from, spin: o.spin, delay });
  }
  private group?: { key: string; delay: number };

  /** Part is shown somewhere else (laid flat, upside down...) from this step until it is added. */
  /** Where a fitting going in at `at` along `dir` meets a part: its hole is there, not where the fitting starts. */
  entry(key: string, at: Vec3, dir: Vec3, len: number): Vec3 {
    const it = this.partItem(key);
    const t = this.parts.find((p) => p.id === it.ref);
    if (!t) return at;
    const l = toLocal(at, it.final.pos, it.final.rot);
    const n = unrotate(dir, it.final.rot);
    const inside = (q: Vec3) => insidePart(t, q, -0.5);
    if (inside(l)) return at;
    for (let t = 1; t <= len + 2; t++) {
      if (inside([l[0] + n[0] * t, l[1] + n[1] * t, l[2] + n[2] * t])) return [at[0] + dir[0] * t, at[1] + dir[1] * t, at[2] + dir[2] * t];
    }
    return at;
  }

  /** How far `at` reaches into a part along `dir` (mm, 0 when it isn't in the part). */
  private depth(key: string, at: Vec3, dir: Vec3): number {
    const it = this.partItem(key);
    const type = this.parts.find((p) => p.id === it.ref);
    if (!type) return 0;
    const l = toLocal(at, it.final.pos, it.final.rot);
    const n = unrotate(dir, it.final.rot);
    let t = 0;
    while (t < 2000 && insidePart(type, [l[0] + n[0] * (t + 0.5), l[1] + n[1] * (t + 0.5), l[2] + n[2] * (t + 0.5)], -0.5)) t++;
    return t;
  }

  stage(key: string, pos: Vec3, rot: Vec3, from?: Vec3) {
    const it = this.partItem(key);
    const s = this.step_;
    it.states.push({ step: s.n, scene: s.scene, pos, rot, from, delay: this.slot(DUR.part) });
  }

  fit(def: HwDef, o: FitOpts) {
    const s = this.step_;
    const ref = this.hwType(def);
    const key = "h" + this.n++;
    let pos = o.at;
    let dir = o.dir;
    if (o.on) {
      const p = this.partItem(o.on);
      pos = toLocal(o.at, p.final.pos, p.final.rot);
      dir = unrotate(o.dir, p.final.rot);
      const r = o.hole === false ? 0 : (o.hole ?? holeR(def));
      if (r > 0) p.holes.push({ p: pos, n: [-dir[0], -dir[1], -dir[2]], r });
    }
    if (o.mate) this.hole(o.mate, this.entry(o.mate, o.at, o.dir, def.len), o.dir, o.mateHole ?? Math.max(holeR(def), 3));
    // a dowel is drawn 12 mm into its part and the rest out (a cam bolt ~23 mm out): when that is more than the part it
    // goes into, start it deeper in its own part, so its end stays inside (an edge-drilled dowel into a 16 mm face).
    // Its end stays 9 mm under the far face, about where a real hole stops: a face's depth offset (a pixel's worth of its
    // slope, a few mm zoomed out) let the dark outline of an end 2 mm under it show through as a ring
    if (o.on && o.mate && (def.kind === "dowel" || def.kind === "camScrew")) {
      const room = this.depth(o.mate, o.at, neg(o.dir));
      const spare = this.depth(o.on, o.at, o.dir) - (def.kind === "dowel" ? 12 : 11) - 2;
      const k = room > 0 ? Math.min(Math.max(0, (def.kind === "dowel" ? def.len - 12 : 23) - (room - 9)), Math.max(0, spare)) : 0;
      if (k > 0) pos = add(pos, mul(dir, k));
    }
    const travel = o.travel ?? defaultTravel(def);
    const extra = def.kind === "cam" ? 0.7 : o.spin ? 0.35 : 0;
    const it: HwItem = {
      key,
      kind: "hw",
      ref,
      parent: o.on,
      scene: o.on ? undefined : s.scene,
      step: s.n,
      pos,
      dir,
      twist: o.twist,
      travel,
      spin: o.spin ?? defaultSpin(def),
      turn: o.turn ?? (def.kind === "cam" ? Math.PI * 0.75 : undefined),
      delay: this.slot(DUR.hw + extra),
      scale: o.scale,
      ...((o.wall ?? s.wall) ? { wall: true } : {}),
      ...(o.sunk ? { sunk: true } : {}),
    };
    this.items.push(it);
    this.map.set(key, it);
    return key;
  }

  fits(def: HwDef, list: FitOpts[], gap = 0.06) {
    const g = this.gap;
    this.gap = gap;
    const keys = list.map((o) => this.fit(def, o));
    this.gap = g;
    return keys;
  }

  /** A pencil line drawn on part `on` in this step, from a to b (assembled frame, on its surface): shown from now on. */
  pencil(on: string, a: Vec3, b: Vec3) {
    const p = this.partItem(on);
    (p.pencil ??= []).push({ step: this.step_.n, a: toLocal(a, p.final.pos, p.final.rot), b: toLocal(b, p.final.pos, p.final.rot) });
  }

  /** A zoom circle in this step on a detail of part `on` at `at` (assembled frame) rather than on a fitting: no arrows.
   *  `dir` looks into its face (unset: along the view); `size` is the half width it sees (mm). */
  look(on: string, at: Vec3, o: { dir?: Vec3; size?: number } = {}) {
    const p = this.partItem(on);
    (this.step_.looks ??= []).push({ on, at: toLocal(at, p.final.pos, p.final.rot), ...(o.dir ? { dir: unrotate(o.dir, p.final.rot) } : {}), size: o.size ?? 40, delay: this.t });
  }

  /**
   * Wall brackets at each of `list`, then two `screw`s through each one's slot, heads on its plate.
   * ponytail: the flat leg runs along +z, as on a top or shelf with the bracket at its back edge (dir up or down, no
   * twist); turn the offsets by dir and twist when a bracket goes on another face.
   */
  brackets(def: HwDef, screw: HwDef, list: FitOpts[], gap = 0.06) {
    this.fits(def, list, gap);
    this.then(0.1);
    return this.fits(screw, list.flatMap(({ on, at, dir, wall }) => bracketScrews(def.len).map((dz): FitOpts => ({ on, wall, dir, at: add(at, add([0, 0, dz], mul(dir, -BRACKET.t))), hole: false }))), gap);
  }

  /** Hardware already in place on a part (e.g. the 2nd and 3rd drawer): appears with the part, no animation. */
  preset(def: HwDef, o: FitOpts) {
    const k = this.fit(def, { ...o, travel: 0, spin: 0, turn: 0 });
    const it = this.map.get(k) as HwItem;
    it.delay = 0;
    it.preset = true;
    return k;
  }

  /* ---------- finalize ---------- */

  build(): Plan {
    // drop unused parts, assign letters by first appearance
    const firstStep = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const it of this.items) {
      if (it.kind === "part") {
        if (!it.states.length) throw new Error(`part ${it.key} never added`);
        const s = Math.min(...it.states.map((x) => x.step));
        firstStep.set(it.ref, Math.min(firstStep.get(it.ref) ?? 1e9, s));
        counts.set(it.ref, (counts.get(it.ref) ?? 0) + 1);
      } else {
        const t = this.hw.get(it.ref)!;
        t.qty++;
      }
    }
    const used = this.parts.filter((p) => counts.has(p.id));
    used.sort((a, b) => (firstStep.get(a.id)! - firstStep.get(b.id)!) || this.parts.indexOf(a) - this.parts.indexOf(b));
    let li = 0;
    // past Z the letters double up (AA, AB...), and those parts keep the order they were lettered in
    const late = new Map<string, number>();
    for (const p of used) {
      p.qty = counts.get(p.id)!;
      if (!p.extra && !p.label && li >= LETTERS.length) late.set(p.id, li);
      p.label = p.extra ? "" : p.label || (li < LETTERS.length ? LETTERS[li++] : LETTERS[Math.floor(li / LETTERS.length) - 1] + LETTERS[li++ % LETTERS.length]);
    }
    const byLabel = (a: PartType, b: PartType) =>
      late.has(a.id) || late.has(b.id) ? (late.get(a.id) ?? -1) - (late.get(b.id) ?? -1) : a.label.localeCompare(b.label, undefined, { numeric: true });
    used.sort((a, b) => (a.extra ? 1 : 0) - (b.extra ? 1 : 0) || byLabel(a, b));

    // step weights -> minutes
    const weights = this.steps.map((s) => {
      if (s.minutes) return s.minutes;
      if (s.quiet) return 1.6;
      const parts = this.items.filter((i) => i.kind === "part" && i.states[0]?.step === s.n).length + this.items.filter((i) => i.kind === "part" && i.states.length > 1 && i.states.some((x, k) => k > 0 && x.step === s.n)).length * 0.5;
      const hws = this.items.filter((i) => i.kind === "hw" && i.step === s.n && !i.preset).length;
      return (0.8 + parts * 0.6 + hws * 0.12) * (s.repeat ?? 1);
    });
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    this.steps.forEach((s, i) => {
      s.minutes = Math.max(1, Math.round((weights[i] / total) * this.spec.minutes));
    });

    // tools
    const toolSet = new Set<ToolId>();
    this.steps.forEach((s) => s.tools.forEach((t) => toolSet.add(t)));
    const order: ToolId[] = ["allen", "torx", "screwdriver", "flathead", "hammer", "wrench", "tape", "drill", "pencil", "level", "knife"];
    const tools: ToolNeed[] = order
      .filter((t) => toolSet.has(t) || t === "knife")
      .map((id) => {
        const n: ToolNeed = { id };
        if (id === "allen" || id === "torx" || id === "wrench") n.included = true;
        if (id === "drill") {
          n.optional = true;
          n.why = "Only for fixing it to the wall";
        }
        if (id === "tape") {
          n.optional = true;
          n.why = "To check it is square";
        }
        if (id === "pencil" || id === "level") {
          n.optional = true;
          n.why = "Handy for marking the wall";
        }
        if (id === "knife") {
          n.optional = true;
          n.why = "To open the box. Cut the tape, not the panels";
        }
        return n;
      });

    const hardware = [...this.hw.values()].sort((a, b) => (a.notIncluded ? 1 : 0) - (b.notIncluded ? 1 : 0));

    return { spec: this.spec, parts: used, hardware, items: this.items, steps: this.steps, tools, ...(this.opens.length ? { opens: this.opens } : {}), ...(this.view_ ? { view: this.view_ } : {}), ...(this.layouts_ ? { layouts: this.layouts_ } : {}) };
  }
}

export function holeR(def: HwDef) {
  switch (def.kind) {
    case "dowel":
      return 4;
    case "camScrew":
      return 2.5;
    case "cam":
      return def.dia / 2;
    case "screw":
      return def.notIncluded ? 0 : 1.6;
    case "pin":
      return 2.5;
    case "legScrew":
      return 4;
    case "bolt":
    case "stud":
    case "rod":
    case "barrel":
      return 3.5;
    default:
      return 0;
  }
}

function defaultTravel(def: HwDef) {
  switch (def.kind) {
    case "dowel":
      return 34;
    case "camScrew":
      return 30;
    case "cam":
      return 24;
    case "screw":
    case "barrel":
      return def.len + 14;
    case "nail":
      return 22;
    case "pin":
      return 18;
    case "legScrew":
      return 50;
    case "bolt":
      return def.len + 10;
    case "plug":
      return 40;
    case "knob":
    case "handle":
    case "foot":
      return 40;
    case "nut":
    case "washer":
    case "stud":
    case "rod":
    case "clip":
      return 26;
    case "cap":
      return 18;
    default:
      return 50;
  }
}

function defaultSpin(def: HwDef) {
  switch (def.kind) {
    case "camScrew":
      return 3;
    case "screw":
      return 4;
    case "bolt":
      return 3;
    case "legScrew":
    case "foot":
      return 2;
    case "nut":
      return 3;
    default:
      return 0;
  }
}

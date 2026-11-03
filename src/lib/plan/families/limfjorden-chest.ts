import type { ProductSpec, Vec3 } from "../../types";
import { HW, PlanBuilder, type FitOpts, type HwDef, type StepDef } from "../builder";
import { sub } from "../math";
import type { Family } from "./family";

/*
 * LIMFJORDEN 4 drawer chest (JYSK 3670661 and its colours), read from JYSK's 30-page manual (Rev.1, 03.02.2026).
 * The right side (2) lies on the floor with its cam bolts, glides and cabinet runners; the five front rails (5a) and
 * the back plinth (4) stand in it on dowels and cam locks, and the left side (1) goes on top. Standing, the top (3)
 * goes on with its cam bolts and wall bracket, and with the chest on its front the folding back (11) is nailed on.
 * It is fixed to the wall before the drawers: each is built on its front (cam bolts, dowelled sides, bottom slid in,
 * dowelled back on two long allen screws, a support bar inside), gets its runners and slides in.
 * Panel numbers are the manual's; sizes in mm are from its parts pages, so the drawing ignores the rounded catalog size.
 */

// fittings, as the manual lists them on page 9
const A: HwDef = { kind: "dowel", len: 35, dia: 8 };
const B: HwDef = { kind: "dowel", len: 24, dia: 6 };
const C: HwDef = { kind: "screw", len: 13, dia: 5 };
const D: HwDef = { kind: "bolt", len: 50, dia: 7, flush: true };
const E: HwDef = { kind: "cam", len: 10, dia: 12 };
const F: HwDef = { kind: "cam", len: 12, dia: 15 };
const G: HwDef = { kind: "camScrew", len: 34, dia: 6 };
const H: HwDef = { kind: "glide", len: 7, dia: 15, name: "Nail-in glide" };
const J: HwDef = { kind: "clip", len: 20, dia: 30, name: "Back panel clip" };
const L: HwDef = { kind: "screw", len: 16, dia: 3.5 };
const M: HwDef = { kind: "nail", len: 25, dia: 1.4 };
const N: HwDef = { kind: "screw", len: 13, dia: 3.5 };
const Q: HwDef = { kind: "bracket", len: 78, dia: 32 };
const CL: HwDef = { kind: "runner", len: 450, dia: 20, name: "Cabinet runner, left" };
const CR: HwDef = { kind: "runner", len: 450, dia: 20, name: "Cabinet runner, right" };
const DL: HwDef = { kind: "runner", len: 450, dia: 20, name: "Drawer runner, left" };
const DR: HwDef = { kind: "runner", len: 450, dia: 20, name: "Drawer runner, right" };
const WS: HwDef = { kind: "clamp", len: 437, dia: 12, name: "Drawer support bar" };

// carcass (x across, y up from the floor, z to the front)
const GL = 7; // the glides lift the sides: 7 + 977 + 22 = 1006
const TY = GL + 977; // underside of the top
const SX = 392, XI = 384; // side centres and inner faces: 768 between, 800 over the sides, the top 802
const ZF = 218, ZB = -240; // front and back edges of the sides (458 deep); fronts 22 in front, flush with the top
const RZ = ZF - 24 - 16; // rails stand 24 mm in from the front edge, 32 deep
const PZ = ZB + 2.5 + 8; // the plinth stands at the back, against the back panel
const n = 4;
const range = (k: number) => Array.from({ length: k }, (_, i) => i);
const fb = (i: number) => 92 + 223 * i; // bottom of drawer front i (205 high, 18 mm finger-grip gap above)
const yb = (i: number) => fb(i) + 3; // underside of drawer box i
// rail centres: one at the bottom, one under each drawer above, one under the top
const railY = [GL + 30, ...range(n - 1).map((i) => yb(i) + 160 + 31), TY - 30];
const XS = 365; // drawer side centres: 718 back + 2 x 12 sides, 13 mm each side for the runners
const DZB = ZF - 450; // back ends of the drawer sides
const DBZ = DZB + 6; // drawer back centre

const sg = (i: number) => (i === 0 ? -1 : 1);
const spread = (a: number, c: number, k: number) => range(k).map((i) => (k === 1 ? (a + c) / 2 : a + ((c - a) * i) / (k - 1)));

function build(b: PlanBuilder, s: ProductSpec) {
  if (s.archetype !== "drawers" || !/chest/i.test(s.variant) || (s.drawers?.rows ?? n) !== n) return false;

  const sideT = (name: string, label: string) => b.part(name, [16, 977, 458], { label });
  const sides = [b.place(sideT("Left side", "1"), [-SX, GL + 977 / 2, (ZF + ZB) / 2]), b.place(sideT("Right side", "2"), [SX, GL + 977 / 2, (ZF + ZB) / 2])];
  const top = b.place(b.part("Top", [802, 22, 480], { label: "3" }), [0, TY + 11, 0]);
  const plinth = b.place(b.part("Plinth", [768, 88, 16], { label: "4" }), [0, GL + 44, PZ]);
  const railT = b.part("Rail", [768, 60, 32], { label: "5a" });
  const rails = railY.map((y) => b.place(railT, [0, y, RZ]));
  // ponytail: the back folds in two along its middle; drawn as one board, in rebates 11 mm into the sides, top and plinth
  const back = b.place(b.part("Back panel", [790, 935, 2.5], { material: "fiber", label: "11" }), [0, TY + 11 - 935 / 2, ZB + 1.25]);

  // a side's joints: cam bolt in the side, dowel in the rail or plinth end, cam lock in the rail or plinth face
  const railJ = rails.map((k, j) => ({ key: k, bolt: [railY[j], RZ - 8], dowel: [railY[j], RZ + 8], cam: (g: number): FitOpts => ({ on: k, at: [g * (XI - 25), railY[j], RZ - 16], dir: [0, 0, 1] }) }));
  const plinthJ = [{ key: plinth, bolt: [GL + 50, PZ], dowel: [GL + 18, PZ], cam: (g: number): FitOpts => ({ on: plinth, at: [g * (XI - 25), GL + 50, PZ + 8], dir: [0, 0, -1] }) }];
  const joints = [...railJ, ...plinthJ];
  const bolts = (si: number): FitOpts[] => joints.map((j) => ({ on: sides[si], at: [sg(si) * XI, j.bolt[0], j.bolt[1]], dir: [sg(si), 0, 0], mate: j.key, mateHole: 4 }));
  // the builder sinks a dowel whose far end would come out of the thinner part it goes into
  const dowels = (js: typeof joints): FitOpts[] => js.flatMap((j) => [0, 1].map((si): FitOpts => ({ on: j.key, at: [sg(si) * XI, j.dowel[0], j.dowel[1]], dir: [-sg(si), 0, 0], mate: sides[si] })));
  const cams = (si: number, js: typeof joints) => js.map((j) => j.cam(sg(si)));

  // the top: two dowels and two cam bolts over each side, cam locks just under it
  const topBoltZ = [120, ZB + 50], topDowelZ = [60, ZB + 110];
  const sideDowels = (si: number): FitOpts[] => topDowelZ.map((z) => ({ on: sides[si], at: [sg(si) * SX, TY, z], dir: [0, -1, 0], mate: top }));
  const glides = (si: number): FitOpts[] => [ZF - 50, ZB + 50].map((z) => ({ on: sides[si], at: [sg(si) * SX, GL, z], dir: [0, 1, 0], hole: false }));
  const runZ = ZF - 5 - 225;
  const cabRunners = (si: number): FitOpts[] => range(n).map((i) => ({ on: sides[si], at: [sg(si) * XI, yb(i) - 12, runZ], dir: [sg(si), 0, 0], hole: false }));
  const cabScrews = (si: number): FitOpts[] => range(n).flatMap((i) => [runZ + 200, runZ, runZ - 190].map((z): FitOpts => ({ on: sides[si], at: [sg(si) * (XI - 2), yb(i) - 12, z], dir: [sg(si), 0, 0] })));

  /* ---------- the right side, on the floor, and what stands in it ---------- */

  const prepSide = (si: number, label: string, runners: HwDef) => {
    b.step(
      {
        title: `Fit dowels, cam bolts and glides to the ${si ? "right" : "left"} side (${label})`,
        detail: "Lay it inside face up on something soft. Two 8 mm dowels in the top edge (not the thin 6 mm ones), six cam bolts screwed in straight, and two glides tapped into the bottom edge.",
        tools: ["hammer", "screwdriver"],
        scene: "prep",
        kind: "cams",
        warnings: ["floor"],
      },
      () => {
        b.stage(sides[si], [0, 8, 0], [0, 0, sg(si) * -Math.PI / 2], [0, 160, 0]);
        b.then(0.15);
        b.fits(A, sideDowels(si), 0.1);
        b.then(0.1);
        b.fits(G, bolts(si), 0.06);
        b.then(0.1);
        b.fits(H, glides(si), 0.12);
      },
    );
    b.step(
      {
        title: `Screw the four ${si ? "right" : "left"} cabinet runners on`,
        detail: `They're marked ${si ? "CR" : "CL"}. Three screws each, through the holes the arrows point to, roller end at the front.`,
        tools: ["screwdriver"],
        scene: "prep",
        kind: "runners",
      },
      () => {
        b.fits(runners, cabRunners(si), 0.12);
        b.then(0.1);
        b.fits(C, cabScrews(si), 0.04);
      },
    );
  };
  prepSide(1, "2", CR);

  b.step(
    { title: "Tap a dowel into each end of the five rails", detail: "8 mm dowels, one in each end.", tools: ["hammer"], scene: "rails", kind: "dowels" },
    () => {
      b.stagger(0.12);
      rails.forEach((k, i) => b.stage(k, [0, 16, (i - 2) * 120], [Math.PI / 2, 0, 0], [0, 120, 0]));
      b.then(0.15);
      b.fits(A, dowels(railJ), 0.05);
    },
  );
  b.step(
    {
      title: "Stand the rails in the right side and lock them",
      detail: "\"This side down\" towards the side, 24 mm in from its front edge. Push each rail onto its dowel and cam bolt, then turn the cam lock (the big 15 mm one) clockwise with a flat screwdriver.",
      tools: ["flathead"],
      pose: "-x",
      kind: "cams",
      warnings: ["floor"],
    },
    () => {
      b.add(sides[1], [-260, 0, 0]);
      b.then(0.15);
      b.stagger(0.2);
      for (const k of rails) b.add(k, [-300, 0, 0]);
      b.then(0.15);
      b.fits(F, cams(1, railJ), 0.12);
    },
  );
  b.step(
    { title: "Tap a dowel into each end of the plinth", detail: "8 mm dowels again.", tools: ["hammer"], scene: "rails", kind: "dowels" },
    () => {
      b.stage(plinth, [0, 8, 0], [Math.PI / 2, 0, 0], [0, 120, 0]);
      b.then(0.15);
      b.fits(A, dowels(plinthJ), 0.1);
    },
  );
  b.step(
    { title: "Stand the plinth in at the back and lock it", detail: "It goes across the bottom of the back edge. One cam lock.", tools: ["flathead"], pose: "-x", kind: "cams" },
    () => {
      b.add(plinth, [-300, 0, 0]);
      b.then(0.15);
      b.fits(F, cams(1, plinthJ), 0.12);
    },
  );

  /* ---------- the left side on top ---------- */

  prepSide(0, "1", CL);
  b.step(
    {
      title: "Lower the left side on and lock the cam locks",
      detail: "Its cam bolts go into the holes in the ends of the rails and the plinth. Press it down evenly, then turn the six cam locks.",
      tools: ["flathead"],
      people: 2,
      pose: "-x",
      kind: "cams",
    },
    () => {
      b.add(sides[0], [-420, 0, 0]);
      b.then(0.2);
      b.fits(F, cams(0, joints), 0.12);
    },
  );

  /* ---------- the top ---------- */

  const topBolts: FitOpts[] = [0, 1].flatMap((si) => topBoltZ.map((z): FitOpts => ({ on: top, at: [sg(si) * SX, TY, z], dir: [0, 1, 0], mate: sides[si], mateHole: 4 })));
  const qz = ZB + 16; // the bracket stays under the top; its upright leg drops through the hole in the back
  b.step(
    {
      title: "Fit the cam bolts and the wall bracket under the top",
      detail: "Lay the top upside down. Four cam bolts, and the bracket in the middle of the back edge on two 16 mm screws, turned only about 80% of the way in for now.",
      tools: ["screwdriver"],
      scene: "top",
      kind: "cams",
      warnings: ["face"],
    },
    () => {
      b.stage(top, [0, 11, 0], [0, 0, Math.PI], [0, 160, 0]);
      b.then(0.15);
      b.fits(G, topBolts, 0.1);
      b.then(0.1);
      b.fit(Q, { on: top, at: [0, TY, qz], dir: [0, 1, 0], hole: false, wall: true });
      b.then(0.05);
      b.fits(L, [qz + 4, qz + 12].map((z) => ({ on: top, at: [0, TY - 2, z], dir: [0, 1, 0] as Vec3, wall: true })), 0.12);
    },
  );
  b.step(
    {
      title: "Stand it up, put the top on and lock it",
      detail: "Lower the top onto the dowels and cam bolts, then turn the four cam locks just under it.",
      tools: ["flathead"],
      people: 2,
      pose: "+y",
      kind: "cams",
    },
    () => {
      b.add(top, [0, 300, 0]);
      b.then(0.2);
      b.fits(F, [0, 1].flatMap((si) => topBoltZ.map((z): FitOpts => ({ on: sides[si], at: [sg(si) * XI, TY - 25, z], dir: [sg(si), 0, 0] }))), 0.12);
    },
  );

  /* ---------- the back ---------- */

  const nail = (k: string, x: number, y: number): FitOpts => ({ on: k, at: [x, y, ZB], dir: [0, 0, 1], hole: false });
  b.step(
    {
      title: "Lay it on its front and put the back panel in",
      detail: "Unfold the back and drop it into the rebates, with its hole round the wall bracket.",
      pose: "-z",
      kind: "flip",
      warnings: ["floor"],
    },
    () => b.add(back, [0, 0, -340]),
  );
  b.step(
    {
      title: "Clip the back's middle and nail it all round",
      detail: "Check the diagonals match so the chest is square. Nail the clip over the fold at the bottom, then 29 nails along the sides, the top and the plinth.",
      tools: ["hammer", "tape"],
      pose: "-z",
      kind: "nails",
      check: "square",
    },
    () => {
      b.fit(J, { on: plinth, at: [0, GL + 70, ZB], dir: [0, 0, 1], hole: false });
      b.then(0.1);
      const list: FitOpts[] = [nail(plinth, 0, GL + 70)];
      for (const si of [0, 1]) for (const y of spread(120, TY - 60, 8)) list.push(nail(sides[si], sg(si) * SX, y));
      for (const x of spread(-360, 360, 7)) list.push(nail(top, x, TY + 6));
      for (const x of spread(-360, 360, 7).filter((_, i) => i !== 3)) list.push(nail(plinth, x, GL + 70));
      b.fits(M, list, 0.04);
    },
  );
  b.step(
    {
      title: "Stand it up and fix it to the wall",
      detail: "Push it against the wall, mark through the bracket, drill and plug the hole, screw the bracket to the wall and tighten the two bracket screws fully. Wall screws and plugs aren't included: pick ones made for your wall.",
      tools: ["pencil", "drill", "hammer", "screwdriver"],
      pose: "+y",
      kind: "anchor",
      wall: true,
      warnings: ["tip", "wall"],
    },
    () => {
      b.fit(HW.plug, { at: [0, TY - 24, ZB - 3], dir: [0, 0, -1] });
      b.then(0.1);
      b.fit(HW.wallScrew, { at: [0, TY - 24, ZB + 1], dir: [0, 0, -1] });
    },
  );

  /* ---------- the drawers: one built step by step, the others the same ---------- */

  const frT = b.part("Drawer front", [799, 205, 22], { label: "9" });
  const dsT = [b.part("Drawer side, left", [12, 160, 450], { label: "6" }), b.part("Drawer side, right", [12, 160, 450], { label: "7" })];
  const dbT = b.part("Drawer back", [718, 160, 12], { label: "8" });
  const dbtT = b.part("Drawer bottom", [729, 2.5, 450], { material: "fiber", label: "10" });
  const drawers = range(n).map((i) => ({
    y: yb(i),
    front: b.place(frT, [0, fb(i) + 102.5, ZF + 11]),
    sides: [0, 1].map((k) => b.place(dsT[k], [sg(k) * XS, yb(i) + 80, ZF - 225])),
    bottom: b.place(dbtT, [0, yb(i) + 10, ZF - 225]),
    back: b.place(dbT, [0, yb(i) + 80, DBZ]),
  }));
  type Drawer = (typeof drawers)[number];
  const per = (d: Drawer, fn: (g: number, side: string) => FitOpts[]) => [0, 1].flatMap((k) => fn(sg(k), d.sides[k]));
  const fitsOf = (d: Drawer): [HwDef, FitOpts[]][] => [
    [G, per(d, (g, sd) => [d.y + 30, d.y + 130].map((y): FitOpts => ({ on: d.front, at: [g * XS, y, ZF], dir: [0, 0, 1], mate: sd, mateHole: 4 })))],
    [A, per(d, (g, sd) => [d.y + 60, d.y + 100].map((y): FitOpts => ({ on: sd, at: [g * XS, y, ZF], dir: [0, 0, -1], mate: d.front })))],
    [E, per(d, (g, sd) => [d.y + 30, d.y + 130].map((y): FitOpts => ({ on: sd, at: [g * (XS - 6.5), y, ZF - 25], dir: [g, 0, 0] })))],
    [B, per(d, (g, sd) => [d.y + 35, d.y + 125].map((y): FitOpts => ({ on: d.back, at: [g * (XS - 6), y, DBZ], dir: [-g, 0, 0], mate: sd, hole: 3, mateHole: 3 })))],
    [D, per(d, (g, sd) => [{ on: sd, at: [g * (XS + 6), d.y + 80, DBZ], dir: [-g, 0, 0], mate: d.back }])],
    [WS, [{ on: d.bottom, at: [0, d.y + 11.25, (ZF + DBZ + 6) / 2], dir: [0, -1, 0], twist: Math.PI / 2, hole: false }]],
    [N, [{ on: d.front, at: [0, d.y + 16, ZF], dir: [0, 0, 1] }, { on: d.back, at: [0, d.y + 16, DBZ + 6], dir: [0, 0, -1] }]],
    [DL, [{ on: d.sides[0], at: [-XS, d.y, ZF - 5 - 225], dir: [0, 1, 0], hole: false }]],
    [DR, [{ on: d.sides[1], at: [XS, d.y, ZF - 5 - 225], dir: [0, 1, 0], hole: false }]],
    [L, per(d, (g, sd) => [ZF - 30, ZF - 230, ZF - 420].map((z): FitOpts => ({ on: sd, at: [g * XS, d.y - 2, z], dir: [0, 1, 0] })))],
  ];
  const d0 = drawers[0];
  const f0 = new Map(fitsOf(d0).map(([def, list]) => [def, list]));
  const c0: Vec3 = [0, d0.y + 80, ZF - 225];
  const stage = (k: string, from: Vec3) => {
    const it = b.partItem(k);
    b.stage(k, sub(it.final.pos, c0), it.final.rot, from);
  };
  const dstep = (title: string, detail: string, body: () => void, o: Pick<StepDef, "tools" | "kind" | "pose">) =>
    b.step({ title, detail, tools: o.tools, scene: "drawer", pose: o.pose ?? "-z", repeat: n, kind: o.kind }, body);

  dstep("Screw four cam bolts into each drawer front", "Lay the front face down on something soft.", () => {
    stage(d0.front, [0, 0, -160]);
    b.then(0.15);
    b.fits(G, f0.get(G)!, 0.1);
  }, { tools: ["screwdriver"], kind: "cams" });
  dstep("Tap two dowels into the front end of each drawer side", "8 mm dowels. The sides are a left (6) and a right (7) one.", () => {
    b.stagger(0.25);
    for (const sd of d0.sides) stage(sd, [0, 0, -300]);
    b.then(0.15);
    b.fits(A, f0.get(A)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Stand the sides on the front and lock them", "Grooves inwards. Turn the small 12 mm cam locks, not the big ones.", () => b.fits(E, f0.get(E)!, 0.12), { tools: ["flathead"], kind: "cams" });
  dstep("Slide the bottom in", "Down the grooves until it reaches the front.", () => stage(d0.bottom, [0, 0, -420]), { kind: "drawer" });
  dstep("Tap two thin dowels into each end of the drawer back", "The 6 mm dowels this time.", () => {
    stage(d0.back, [0, 0, -260]);
    b.then(0.15);
    b.fits(B, f0.get(B)!, 0.08);
  }, { tools: ["hammer"], kind: "dowels" });
  dstep("Put the back on with two long allen screws", "Spread the sides about 5° to drop the back onto its dowels over the bottom, then screw a long screw through each side with the allen key. Keep it straight and stop when it's flush.", () => b.fits(D, f0.get(D)!, 0.15), { tools: ["allen"], kind: "screws" });
  dstep("Screw the support bar in down the middle", "Stand the drawer up. The bar lies on the bottom from front to back: one short 13 mm screw through each bent end.", () => {
    b.fits(WS, f0.get(WS)!, 0.2);
    b.then(0.1);
    b.fits(N, f0.get(N)!, 0.15);
  }, { tools: ["screwdriver"], kind: "screws" });
  dstep("Turn it upside down and screw on the drawer runners", "DL on the left, DR on the right, three 16 mm screws each.", () => {
    b.fits(DL, f0.get(DL)!, 0.2);
    b.fits(DR, f0.get(DR)!, 0.2);
    b.then(0.1);
    b.fits(L, f0.get(L)!, 0.06);
  }, { tools: ["screwdriver"], kind: "runners", pose: "-y" });

  b.step(
    { title: "Slide in all 4 drawers", detail: "Tip each one so its wheels drop behind the cabinet runners' wheels, then lower it and push it home.", kind: "drawer", warnings: ["tip"] },
    () => {
      for (const [i, d] of drawers.entries()) {
        b.stagger(0);
        for (const k of [d.front, ...d.sides, d.bottom, d.back]) b.add(k, [0, 0, 520]);
        if (i > 0) for (const [def, list] of fitsOf(d)) for (const o of list) b.preset(def, o);
        b.wait(0.22);
      }
    },
  );
  b.steps[b.steps.length - 1].quiet = true;
  b.step({ title: "Mind the load limits", detail: "25 kg at most on the top and 5 kg in each drawer. Only open one drawer at a time.", kind: "general", warnings: ["tip"] }, () => {});
  return true;
}

const family: Family = { names: ["LIMFJORDEN"], build };
export default family;

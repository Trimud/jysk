// insidePart self-check: node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/inside.check.ts
import assert from "node:assert";
import { insidePart } from "@/lib/plan/math";
const box = { shape: "box" as const, size: [100, 20, 50] as [number, number, number] };
assert(insidePart(box, [0, 0, 0]) && !insidePart(box, [0, 11, 0]) && insidePart(box, [0, 10.4, 0], -0.5) && !insidePart(box, [49, 0, 0], 2));
const cyl = { shape: "cyl" as const, size: [32, 100, 32] as [number, number, number] };
assert(insidePart(cyl, [10, 0, 10]) && !insidePart(cyl, [14, 0, 14]));
const slab = { shape: "box" as const, size: [0, 0, 0] as [number, number, number], pieces: [{ shape: "slab" as const, size: [100, 20, 100] as [number, number, number], pos: [10, 0, 0] as [number, number, number], outline: [[-50, -50], [50, -50], [0, 50]] as [number, number][] }] };
assert(insidePart(slab, [10, 0, 0]) && !insidePart(slab, [55, 0, 40]));
const rot = { shape: "box" as const, size: [0, 0, 0] as [number, number, number], pieces: [{ shape: "box" as const, size: [100, 10, 10] as [number, number, number], pos: [0, 0, 0] as [number, number, number], rot: [0, 0, Math.PI / 2] as [number, number, number] }] };
assert(insidePart(rot, [0, 40, 0]) && !insidePart(rot, [40, 0, 0]));
console.log("insidePart ok");

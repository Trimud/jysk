import type { PartPiece, Vec3 } from "../../types";

/**
 * Shared by the JYSK steel-frame shelving (GLUDSTED, VINDINGE, ELVERUM, the TRAPPEDAL hallway unit): boxes,
 * round posts and square-tube ladder frames, drawn as pieces of one part. x across, y up from the floor, z to the
 * front; mm. Not a family itself (the leading _ keeps it out of the index).
 */

export const box = (size: Vec3, pos: Vec3): PartPiece => ({ shape: "box", size, pos });

/** A round tube standing upright from y0 to y1, `dia` thick, at x, z. */
export const post = (x: number, z: number, y0: number, y1: number, dia: number): PartPiece => ({
  shape: "cyl",
  size: [dia, y1 - y0, dia],
  pos: [x, (y0 + y1) / 2, z],
});

/**
 * A ladder frame at x = 0: a square-tube post at the front and back (`t` thick, `d` deep overall, from y0 to h)
 * and a rung across between them at each of `rungs` (its top at that height).
 */
export function ladder(h: number, d: number, t: number, rungs: number[], y0 = 0): PartPiece[] {
  const z = d / 2 - t / 2;
  return [
    ...[-z, z].map((zz) => box([t, h - y0, t], [0, (y0 + h) / 2, zz])),
    ...rungs.map((y) => box([t, t, d - 2 * t], [0, y - t / 2, 0])),
  ];
}


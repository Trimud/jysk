/**
 * Sizes of drawn fittings that scripts/qa/overlaps.ts checks against, so the check and the drawing can't drift apart.
 * A runner stands 12.5 mm off its panel in all, like a real one: drawers leave 13 mm a side for them. It's an L: a thin
 * flange against the panel, which its screws go through (so their heads show), and a lip along one edge.
 */
export const RUNNER = { w: 20, body: 2, lipW: 4, lip: 10.5, roller: 11 };
/** A drawer runner screwed under a drawer side's bottom edge (runner, form "under"), its origin on the middle of that
 *  edge, local +y down, +x outwards: a flange under the edge (`side` is the side's half thickness, ponytail: 16 mm
 *  sides) running on out as a ledge as far as the face runner's lip stood off, a wall up the outer face, and its roller
 *  beside that wall at the height of the face runner's middle. The box round it, for scripts/qa/overlaps.ts. */
export const UNDER = { side: 8, out: RUNNER.body + RUNNER.lip, wall: 16, rollerY: -10 };
export function underBox(len: number): { center: [number, number, number]; half: [number, number, number] } {
  const x0 = -UNDER.side, x1 = UNDER.side + UNDER.out, y0 = UNDER.rollerY - RUNNER.roller, y1 = RUNNER.body;
  return { center: [(x0 + x1) / 2, (y0 + y1) / 2, 0], half: [(x1 - x0) / 2, (y1 - y0) / 2, len / 2] };
}
/** A back panel clip's boss (clip, form "channel"): its nail starts this far off the panel. */
export const CLIP_BOSS = 4;
/** The wall bracket: a 15 mm strip, 2 mm thick, its upright leg's back face `bend` mm behind the fitting's origin. The
 *  flat leg's slot starts `slot` mm past the bend and runs `slotK` of the leg's length; its two screws go in the slot. */
export const BRACKET = { w: 15, t: 2, bend: 16, slot: 12, slotK: 0.6 };
/** A bracket's slot: from and to, mm along its flat leg (+z before any twist) from the fitting's origin. */
export const bracketSlot = (len: number): [number, number] => [BRACKET.slot - BRACKET.bend, BRACKET.slot - BRACKET.bend + BRACKET.slotK * len];
/** Where a bracket's two screws go, near each end of its slot, in the same terms. */
export const bracketScrews = (len: number): [number, number] => {
  const [a, b] = bracketSlot(len);
  return [a + 10, b - 6];
};

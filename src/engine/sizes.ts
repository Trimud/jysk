/**
 * Sizes of drawn fittings that scripts/qa/overlaps.ts checks against, so the check and the drawing can't drift apart.
 * A runner stands 12.5 mm off its panel in all, like a real one: drawers leave 13 mm a side for them. It's an L: a thin
 * flange against the panel, which its screws go through (so their heads show), and a lip along one edge.
 */
export const RUNNER = { w: 20, body: 2, lipW: 4, lip: 10.5, roller: 11 };
/** The wall bracket: a 15 mm strip, 2 mm thick, its upright leg's back face `bend` mm behind the fitting's origin. */
export const BRACKET = { w: 15, t: 2, bend: 16 };

import type { HwForm, HwKind, HwType } from "@/lib/types";

const METAL = "#e3e5e7";
const WOOD = "#f1e2c3";
const PLASTIC = "#f4f4f1";

interface Drawn {
  w: number;
  h: number;
  node: React.ReactNode;
  scalable: boolean;
}

const stroke = { stroke: "var(--ink)", strokeWidth: 1.5, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", strokeLinecap: "round" } as const;
const fine = { stroke: "var(--ink)", strokeWidth: 0.9, vectorEffect: "non-scaling-stroke", opacity: 0.55, strokeLinecap: "round" } as const;

function thread(x0: number, x1: number, r: number, pitch: number) {
  let d = `M${x0} ${-r}`;
  let up = true;
  for (let x = x0 + pitch / 2; x <= x1 + 0.01; x += pitch / 2) {
    d += ` L${Math.min(x, x1)} ${up ? -r * 0.78 : -r}`;
    up = !up;
  }
  d += ` L${x1} ${r}`;
  up = true;
  for (let x = x1 - pitch / 2; x >= x0 - 0.01; x -= pitch / 2) {
    d += ` L${Math.max(x, x0)} ${up ? r * 0.78 : r}`;
    up = !up;
  }
  return d + " Z";
}

function draw(kind: HwKind, len: number, dia: number, form?: HwForm, drive?: HwType["drive"]): Drawn {
  const r = dia / 2;
  switch (kind) {
    case "dowel": {
      const lines = [-r / 2, 0, r / 2].map((y) => <path key={y} d={`M${dia * 0.45} ${y} H${len - dia * 0.45}`} {...fine} />);
      return { w: len, h: dia, scalable: true, node: <g><rect x={0} y={-r} width={len} height={dia} rx={r * 0.55} fill={WOOD} {...stroke} />{lines}</g> };
    }
    case "camScrew":
      return {
        w: 35,
        h: 8,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 11, 2.9, 1.4)} fill={METAL} {...stroke} />
            <rect x={11} y={-3.8} width={1.6} height={7.6} rx={0.6} fill={METAL} {...stroke} />
            <rect x={12.6} y={-2.2} width={15.6} height={4.4} fill={METAL} {...stroke} />
            <circle cx={31.4} cy={0} r={3.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "cam":
      return {
        w: 15,
        h: 16,
        scalable: true,
        node: (
          <g transform="translate(0 -4)">
            <path d="M0 0 V9.5 A7.5 3.2 0 0 0 15 9.5 V0" fill={METAL} {...stroke} />
            <ellipse cx={7.5} cy={0} rx={7.5} ry={3.2} fill="#f2f3f4" {...stroke} />
            <path d="M3.4 -1.1 L11.6 1.1" {...stroke} strokeWidth={2.2} />
            <path d="M10.6 -1.9 L13 -0.6 L11.2 0.6" fill="none" {...stroke} strokeWidth={1.1} />
          </g>
        ),
      };
    case "screw": {
      if (form === "euro") {
        // a euro screw side on: the flat top of its countersunk head on the left, the 45° countersink down to the thread,
        // coarse sawtooth crests round a thick core, and a square cut end on the right (no point)
        const hr = dia * 0.95, rc = r * 0.7, x0 = 0.7 + (hr - r), p = dia * 0.5;
        const top: [number, number][] = [[0, -hr], [0.7, -hr], [x0, -r]];
        for (let x = x0; x + p <= len + 0.01; x += p) top.push([x + p, -rc], [x + p, -r]);
        const pts = [...top, ...[...top].reverse().map(([x, y]): [number, number] => [x, -y])];
        return {
          w: top[top.length - 1][0],
          h: hr * 2,
          scalable: true,
          node: <path d={"M" + pts.map(([x, y]) => `${x} ${y}`).join(" L") + " Z"} fill={METAL} {...stroke} strokeLinejoin="round" />,
        };
      }
      const hr = Math.max(dia * 1.05, 3.4);
      const ticks = [];
      for (let x = 3.4; x < len - 3; x += 1.7) ticks.push(<path key={x} d={`M${x} ${-r * 0.9} L${x + 0.9} ${r * 0.9}`} {...fine} />);
      return {
        w: len + 2,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <path d={`M2 ${-r * 0.9} H${len - 1.5} L${len + 1.6} 0 L${len - 1.5} ${r * 0.9} H2 Z`} fill={METAL} {...stroke} />
            {ticks}
            <path d={`M2 ${-hr} C0.4 ${-hr} 0 ${-hr * 0.6} 0 0 C0 ${hr * 0.6} 0.4 ${hr} 2 ${hr} Z`} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "nail":
      return {
        w: len,
        h: dia * 3.4,
        scalable: true,
        node: (
          <g>
            <path d={`M0.8 ${-r} H${len - 1.8} L${len} 0 L${len - 1.8} ${r} H0.8 Z`} fill={METAL} {...stroke} />
            <rect x={0} y={-dia * 1.7} width={0.9} height={dia * 3.4} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "pin":
      // a shelf support side on: the pin on the left, the plate on the panel, the ledge out along its top, the clip
      if (form === "support") {
        const p = len - 1;
        return {
          w: p + 13.5,
          h: 11,
          scalable: true,
          node: (
            <g>
              <rect x={0} y={-r} width={p} height={dia} rx={0.8} fill={METAL} {...stroke} />
              <path d={`M${p} 5 V-3 H${p + 13.5} V-1.5 H${p + 1.5} V5 Z`} fill={METAL} {...stroke} />
              <rect x={p + 7} y={-4.2} width={1.2} height={1.2} fill={METAL} {...stroke} />
            </g>
          ),
        };
      }
      return {
        w: 17.4,
        h: dia + 2.4,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-r} width={8.4} height={dia} rx={0.8} fill={METAL} {...stroke} />
            <rect x={9.6} y={-r} width={7.8} height={dia} rx={r * 0.8} fill={METAL} {...stroke} />
            <rect x={8.2} y={-r - 1.2} width={1.6} height={dia + 2.4} rx={0.6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "legScrew": {
      const mid = 12;
      const a = (len - mid) / 2;
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, a, r, 1.6)} fill={METAL} {...stroke} />
            <rect x={a} y={-r * 0.82} width={mid} height={r * 1.64} fill={METAL} {...stroke} />
            <path d={thread(a + mid, len, r, 1.6)} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "bolt": {
      // countersunk: a cone of a head, its hex socket on the flat end
      if (form === "countersunk")
        return {
          w: len + dia - r,
          h: dia * 2,
          scalable: true,
          node: (
            <g>
              <path d={thread(dia - r, len + dia - r, r, 1.2)} fill={METAL} {...stroke} />
              <path d={`M0 ${-dia} L${dia - r} ${-r} V${r} L0 ${dia} Z`} fill={METAL} {...stroke} />
            </g>
          ),
        };
      // a button head side on: a low dome, 3 high and twice the shank across
      if (form === "button")
        return {
          w: len + 3,
          h: dia * 2,
          scalable: true,
          node: (
            <g>
              <path d={thread(3, len + 3, r, 1.2)} fill={METAL} {...stroke} />
              <path d={`M3 ${-dia} Q-1 0 3 ${dia} Z`} fill={METAL} {...stroke} />
            </g>
          ),
        };
      const hr = dia * 0.85;
      const t0 = 5 + len * 0.45;
      return {
        w: len + 5,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <rect x={5} y={-r} width={t0 - 5} height={dia} fill={METAL} {...stroke} />
            <path d={thread(t0, len + 5, r, 1.2)} fill={METAL} {...stroke} />
            <rect x={0} y={-hr} width={5.2} height={hr * 2} rx={1} fill={METAL} {...stroke} />
            {drive === "torx" ? (
              // the six-lobed socket, end on, over the head
              <polygon points={[...Array(12).keys()].map((k) => `${2.6 + Math.cos((k * Math.PI) / 6) * hr * (k % 2 ? 0.28 : 0.5)},${Math.sin((k * Math.PI) / 6) * hr * (k % 2 ? 0.28 : 0.5)}`).join(" ")} fill="none" {...fine} />
            ) : (
              <path d={`M1.4 ${-hr * 0.42} H3.6 M1.4 ${hr * 0.42} H3.6`} {...fine} />
            )}
          </g>
        ),
      };
    }
    case "plate":
      // a square mending plate (len its thickness): dia square, a screw hole near each corner
      if (form === "square")
        return {
          w: dia,
          h: dia,
          scalable: true,
          node: (
            <g>
              <rect x={0} y={-dia / 2} width={dia} height={dia} rx={1} fill={METAL} {...stroke} />
              {[0.2, 0.8].flatMap((fx) => [-0.3, 0.3].map((fy) => <circle key={`${fx}${fy}`} cx={dia * fx} cy={dia * fy} r={dia / 16} fill="#fff" {...stroke} />))}
            </g>
          ),
        };
      // a small joining plate (len its thickness): dia long, half as wide, a countersunk hole in the middle
      if (len < 10)
        return {
          w: dia,
          h: dia / 2,
          scalable: true,
          node: (
            <g>
              <rect x={0} y={-dia / 4} width={dia} height={dia / 2} rx={1} fill={METAL} {...stroke} />
              <circle cx={dia / 2} cy={0} r={dia / 7} fill="#eef0f1" {...stroke} />
              <circle cx={dia / 2} cy={0} r={dia / 16} fill="#fff" {...stroke} />
            </g>
          ),
        };
      return {
        w: 70,
        h: 70,
        scalable: true,
        node: (
          <g transform="translate(0 -35)">
            <rect x={0} y={0} width={70} height={70} rx={4} fill={METAL} {...stroke} />
            {[
              [7, 7],
              [63, 7],
              [63, 63],
              [7, 63],
            ].map(([x, y]) => (
              <circle key={x + "-" + y} cx={x} cy={y} r={2.6} fill="#fff" {...stroke} />
            ))}
            <circle cx={35} cy={35} r={10} fill="#eef0f1" {...stroke} />
            <circle cx={35} cy={35} r={4.6} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "bracket":
      return {
        w: 46,
        h: 46,
        scalable: true,
        node: (
          <g transform="translate(0 -23)">
            {/* a narrow L strip: the long leg flat with its screw slot, the short leg up with its wall hole */}
            <path d="M4 36 L32 21 L41 26 L13 41 Z" fill={METAL} {...stroke} />
            <path d="M32 21 L32 3 L41 8 L41 26 Z" fill="#eef0f1" {...stroke} />
            <path d="M11 36.5 L27 28 L30 29.6 L14 38.1 Z" fill="#fff" {...stroke} strokeLinejoin="round" />
            <ellipse cx={36.5} cy={11} rx={1.6} ry={3} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "runner":
      return {
        w: 120,
        h: 22,
        scalable: false,
        node: (
          <g>
            <path d="M0 -6 H114 L120 0 L114 6 H0 Z" fill={METAL} {...stroke} />
            <path d="M0 -10 H112 V-6 H0 Z" fill="#eef0f1" {...stroke} />
            {[12, 52, 92].map((x) => (
              <circle key={x} cx={x} cy={0} r={2} fill="#fff" {...stroke} />
            ))}
            {/* the roller wheel at the runner's end */}
            <circle cx={106} cy={0} r={5.5} fill="#fff" {...stroke} />
            <circle cx={106} cy={0} r={1.2} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "knob":
      return {
        w: 26,
        h: 30,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-5.5} width={12} height={11} rx={1.5} fill={WOOD} {...stroke} />
            <path d="M12 -14 C22 -14 26 -8 26 0 C26 8 22 14 12 14 C10.5 14 10.5 -14 12 -14 Z" fill={WOOD} {...stroke} />
          </g>
        ),
      };
    case "handle":
      // a curved edge pull, from the front: the hood over the finger gap, its lower edge curling in
      if (form === "pull")
        return {
          w: len + 24,
          h: 16,
          scalable: true,
          node: (
            <g>
              <path d={`M4 -8 H${len + 20} Q${len + 24} -8 ${len + 24} -4 V4 Q${len + 24} 8 ${len + 20} 8 H4 Q0 8 0 4 V-4 Q0 -8 4 -8 Z`} fill={METAL} {...stroke} />
              <path d={`M3 3 H${len + 21}`} {...fine} />
            </g>
          ),
        };
      return {
        w: len + 24,
        h: 34,
        scalable: true,
        node: (
          <g transform="translate(0 -6)">
            <rect x={12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} transform={`translate(0 0)`} />
            <rect x={len + 12 - 4} y={-8} width={8} height={26} rx={3} fill={METAL} {...stroke} />
            <rect x={0} y={-14} width={len + 24} height={12} rx={6} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "hinge":
      return {
        w: 78,
        h: 40,
        scalable: true,
        node: (
          <g>
            <rect x={28} y={-7} width={42} height={14} rx={3} fill={METAL} {...stroke} />
            <rect x={66} y={-20} width={10} height={40} rx={2} fill="#eef0f1" {...stroke} />
            <circle cx={17.5} cy={0} r={17.5} fill={METAL} {...stroke} />
            <circle cx={17.5} cy={0} r={12} fill="#eef0f1" {...stroke} />
            <circle cx={3} cy={-15} r={2} fill="#fff" {...stroke} />
          </g>
        ),
      };
    case "glide":
      if (form === "square") return { w: dia, h: dia, scalable: true, node: <rect x={0} y={-dia / 2} width={dia} height={dia} rx={dia * 0.12} fill={PLASTIC} {...stroke} /> };
      return { w: 20, h: 10, scalable: true, node: <g><path d="M0 -1 V2 A10 3.6 0 0 0 20 2 V-1" fill={PLASTIC} {...stroke} /><ellipse cx={10} cy={-1} rx={10} ry={3.6} fill={PLASTIC} {...stroke} /></g> };
    case "plug": {
      const ribs = [];
      for (let x = 5; x < len - 3; x += 4) ribs.push(<path key={x} d={`M${x} ${-r} L${x + 1.6} 0 L${x} ${r}`} fill="none" {...fine} />);
      return {
        w: len,
        h: dia + 3,
        scalable: true,
        node: (
          <g>
            <path d={`M1.5 ${-r} H${len - 2} L${len} 0 L${len - 2} ${r} H1.5 Z`} fill={PLASTIC} {...stroke} />
            {ribs}
            <rect x={0} y={-r - 1.5} width={1.6} height={dia + 3} rx={0.5} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    }
    case "castor":
      // a plate castor side on: the plate on top with its two screw holes, the fork and the wheel
      if (form === "plate")
        return {
          w: 42,
          h: len,
          scalable: true,
          node: (
            <g transform={`translate(0 ${-len / 2})`}>
              <rect x={0} y={0} width={42} height={2} fill={METAL} {...stroke} />
              <path d={`M${21 - 8} 2 V${len - dia / 2 + 2} H${21 + 8} V2`} fill={METAL} {...stroke} />
              <circle cx={21} cy={len - dia / 2} r={dia / 2} fill={PLASTIC} {...stroke} />
              <circle cx={21} cy={len - dia / 2} r={2} fill="#fff" {...stroke} />
              {[5, 37].map((x) => <path key={x} d={`M${x} 0 V2`} {...fine} />)}
            </g>
          ),
        };
      // standing up: the pin on top, the wheel underneath
      return {
        w: 52,
        h: 80,
        scalable: false,
        node: (
          <g>
            <rect x={21.5} y={-40} width={9} height={21} rx={2} fill={METAL} {...stroke} />
            <rect x={15} y={-20} width={22} height={4} rx={1.5} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={25} fill={PLASTIC} {...stroke} />
            <circle cx={28} cy={14} r={6} fill="#fff" {...stroke} />
            <path d="M8 -16 H40 C46 -16 48 -12 48 -6 L46 4 H10 L6 -8 C6 -13 6 -16 8 -16 Z" fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "flatHinge":
      // two leaves with screw holes, the pin between them
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            {[0, len / 2 + 3].map((x) => (
              <rect key={x} x={x} y={-dia / 2} width={len / 2 - 3} height={dia} rx={2} fill={METAL} {...stroke} />
            ))}
            <rect x={len / 2 - 4} y={-dia / 2 - 1} width={8} height={dia + 2} rx={4} fill={METAL} {...stroke} />
            {[len * 0.17, len * 0.83].flatMap((x) => [-dia / 4, dia / 4].map((y) => <circle key={`${x}:${y}`} cx={x} cy={y} r={2.2} fill="#fff" {...stroke} />))}
          </g>
        ),
      };
    case "roller":
      // a plate with two screw holes, an arm, and the wheel on top
      return {
        w: len,
        h: dia + 26,
        scalable: true,
        node: (
          <g transform={`translate(0 ${(dia + 26) / 2 - 4})`}>
            <rect x={len / 2 - 4} y={-22} width={8} height={20} rx={2} fill={METAL} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={dia / 2} fill={PLASTIC} {...stroke} />
            <circle cx={len / 2} cy={-22 - dia / 2 + 4} r={3} fill="#fff" {...stroke} />
            <rect x={0} y={-3} width={len} height={7} rx={2} fill={METAL} {...stroke} />
            {[len * 0.18, len * 0.82].map((x) => (
              <circle key={x} cx={x} cy={0.5} r={1.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "hook":
      // a clothes rail holder from the front, lying down: the back plate, the U open towards the right, its screw hole
      if (form === "cup") {
        const R = dia * 0.29, Ri = R - 1.5, xc = R, xt = dia * 0.68 - 4;
        return {
          w: dia,
          h: R * 2,
          scalable: true,
          node: (
            <g>
              <rect x={0} y={-R} width={dia} height={R * 2} rx={R} fill={PLASTIC} {...stroke} />
              <path d={`M${xt} ${-R} H${xc} A${R} ${R} 0 0 0 ${xc} ${R} H${xt} V${Ri} H${xc} A${Ri} ${Ri} 0 0 1 ${xc} ${-Ri} H${xt} Z`} fill={PLASTIC} {...stroke} />
              <circle cx={dia * 0.68 - 10} cy={0} r={2} fill="#fff" {...stroke} />
            </g>
          ),
        };
      }
      // lying down: the thread on the left, the plate, the stem and its ball
      return {
        w: len + 12,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-2.5} width={12} height={5} rx={1} fill={METAL} {...stroke} />
            <rect x={12} y={-dia * 0.28} width={3} height={dia * 0.56} rx={1} fill={METAL} {...stroke} />
            <rect x={15} y={-4} width={len - 18} height={8} rx={3} fill={METAL} {...stroke} />
            <circle cx={len + 12 - dia * 0.42} cy={0} r={dia * 0.42} fill={METAL} {...stroke} />
          </g>
        ),
      };
    case "connector":
      // a flat strip with a screw hole at each end
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={3} fill={METAL} {...stroke} />
            {[len / 4, (3 * len) / 4].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "clip":
      // half a split sleeve, from the front: a band a little wider at the bottom, its notch at the top
      if (form === "sleeve")
        return { w: dia, h: len, scalable: true, node: <path d={`M2 ${-len / 2} H${dia - 2} L${dia} ${len / 2} H0 Z M${dia / 2 - 2.5} ${-len / 2} V${-len / 4} H${dia / 2 + 2.5} V${-len / 2}`} fill={PLASTIC} {...stroke} /> };
      // a back panel clip from above: the U channel, and the round boss with its nail hole in front
      if (form === "channel")
        return {
          w: dia,
          h: 22,
          scalable: true,
          node: (
            <g>
              <path d={`M0 -11 H${dia} V-1 H0 Z M2 -7 H${dia - 2} V-5 H2 Z`} fill={PLASTIC} fillRule="evenodd" {...stroke} />
              <circle cx={dia / 2} cy={5} r={6} fill={PLASTIC} {...stroke} />
              <circle cx={dia / 2} cy={5} r={1.4} fill="#fff" {...stroke} />
            </g>
          ),
        };
      // side on: the flat head on the left, the stem with its barbs
      return {
        w: 18,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={3.5} height={dia} rx={1} fill={PLASTIC} {...stroke} />
            <path d="M3.5 -2.6 H14 L18 0 L14 2.6 H3.5 Z" fill={PLASTIC} {...stroke} />
            <path d="M8 -2.6 L10 -4 M12 -2.6 L14 -4 M8 2.6 L10 4 M12 2.6 L14 4" fill="none" {...fine} />
          </g>
        ),
      };
    case "strap":
      return {
        w: len,
        h: dia,
        scalable: true,
        node: (
          <g>
            <rect x={0} y={-dia / 2} width={len} height={dia} rx={4} fill={PLASTIC} {...stroke} />
            {[10, len - 10].map((x) => (
              <circle key={x} cx={x} cy={0} r={2.6} fill="#fff" {...stroke} />
            ))}
          </g>
        ),
      };
    case "nut": {
      const R = dia * 0.95;
      // a cross dowel barrel nut side on, its slot across the end on the right
      if (form === "cross")
        return { w: len, h: dia, scalable: true, node: <g><rect x={0} y={-r} width={len} height={dia} rx={0.8} fill={METAL} {...stroke} /><path d={`M${len - 0.8} ${-r * 0.8} V${r * 0.8}`} {...stroke} /><circle cx={len / 2} cy={0} r={r * 0.45} fill="#fff" {...stroke} /></g> };
      // a cam housing end on: the round body, its threaded middle; the side hole on its rim
      if (form === "housing")
        return { w: dia, h: dia, scalable: true, node: <g><circle cx={r} cy={0} r={r} fill={METAL} {...stroke} /><circle cx={r} cy={0} r={r * 0.5} fill="#fff" {...stroke} /><circle cx={r} cy={0} r={r * 0.38} fill="none" {...fine} /><path d={`M${dia - 1} -2.5 V2.5`} {...stroke} /></g> };
      // a grub screw side on: a short thread, the hex socket in its right end
      if (form === "grub")
        return { w: len, h: dia, scalable: true, node: <g><path d={thread(0, len, r, 1.2)} fill={METAL} {...stroke} /><path d={`M${len} ${-r * 0.5} V${r * 0.5}`} {...stroke} strokeWidth={2.2} /></g> };
      // a domed cap nut side on: the hex, the dome on top
      if (form === "acorn") {
        const h = len * 0.45, dr = Math.min(dia * 0.85, len - h);
        return {
          w: R * 2,
          h: len,
          scalable: true,
          node: (
            <g transform={`translate(0 ${len / 2})`}>
              <rect x={0} y={-h} width={R * 2} height={h} rx={0.4} fill={METAL} {...stroke} />
              <path d={`M${R - dr} ${-h} A${dr} ${dr} 0 0 1 ${R + dr} ${-h} Z`} fill={METAL} {...stroke} />
              <path d={`M${R * 0.5} ${-h} V0 M${R * 1.5} ${-h} V0`} {...fine} />
            </g>
          ),
        };
      }
      const pts = [0, 1, 2, 3, 4, 5].map((k) => `${R + R * Math.cos((k * Math.PI) / 3)},${R * Math.sin((k * Math.PI) / 3)}`).join(" ");
      return { w: R * 2, h: R * 1.8, scalable: true, node: <g><polygon points={pts} fill={METAL} {...stroke} /><circle cx={R} cy={0} r={dia / 2} fill="#fff" {...stroke} /></g> };
    }
    case "washer":
      // a spring washer: the ring, cut through on the right
      if (form === "split")
        return {
          w: dia,
          h: dia,
          scalable: true,
          node: (
            <g>
              <circle cx={dia / 2} cy={0} r={dia / 2} fill={METAL} {...stroke} />
              <circle cx={dia / 2} cy={0} r={dia * 0.3} fill="#fff" {...stroke} />
              <path d={`M${dia * 0.8} -0.8 L${dia} -1.3 M${dia * 0.8} 0.8 L${dia} 0.3`} {...stroke} />
            </g>
          ),
        };
      // a saddle washer side on: its flat top, its underside hollowed for the tube
      if (form === "saddle") return { w: dia, h: len + r, scalable: true, node: <path d={`M0 ${-len} H${dia} V${r} A${r} ${r} 0 0 0 0 ${r} Z`} transform={`translate(0 ${(len - r) / 2})`} fill={METAL} {...stroke} /> };
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={METAL} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 5} fill="#fff" {...stroke} /></g> };
    case "stud": {
      // a double cam bolt side on: a knob on a neck at each end, a thin rod to the collar, a thicker body after it
      if (form === "double") {
        const c = len * 0.61;
        return {
          w: len,
          h: dia * 1.25,
          scalable: true,
          node: (
            <g>
              <rect x={5.5} y={-r * 0.5} width={c - 5.5} height={r} fill={METAL} {...stroke} />
              <rect x={c} y={-r * 0.75} width={len - 5.5 - c} height={r * 1.5} fill={METAL} {...stroke} />
              <rect x={c - 0.75} y={-r * 1.25} width={1.5} height={r * 2.5} fill={METAL} {...stroke} />
              {[2.5, len - 5.5].map((x) => <rect key={x} x={x} y={-r * 0.35} width={3} height={r * 0.7} fill={METAL} {...stroke} />)}
              {[0, len - 2.5].map((x) => <rect key={x} x={x} y={-r * 0.8} width={2.5} height={r * 1.6} rx={0.8} fill={METAL} {...stroke} />)}
            </g>
          ),
        };
      }
      return {
        w: len,
        h: dia * 1.25,
        scalable: true,
        node: (
          <g>
            <path d={thread(3, len, (dia / 2) * 0.8, 1.4)} fill={METAL} {...stroke} />
            <rect x={0} y={(-dia * 1.25) / 2} width={3} height={dia * 1.25} rx={1} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "barrel": {
      const hr = Math.max(dia * 0.95, 3.4);
      return {
        w: len + 2,
        h: hr * 2,
        scalable: true,
        node: (
          <g>
            <rect x={2} y={-r} width={len} height={r * 2} fill={METAL} {...stroke} />
            <path d={`M2 ${-hr} C0.4 ${-hr} 0 ${-hr * 0.6} 0 0 C0 ${hr * 0.6} 0.4 ${hr} 2 ${hr} Z`} fill={METAL} {...stroke} />
          </g>
        ),
      };
    }
    case "rod":
      // a long bolt with a thin round flange a quarter along, side on
      if (form === "collar")
        return {
          w: len,
          h: dia * 2,
          scalable: true,
          node: (
            <g>
              <path d={thread(0, len, dia / 2, 1.4)} fill={METAL} {...stroke} />
              <rect x={len * 0.24 - 0.9} y={-dia} width={1.8} height={dia * 2} rx={0.6} fill={METAL} {...stroke} />
            </g>
          ),
        };
      return { w: len, h: dia, scalable: true, node: <path d={thread(0, len, dia / 2, 1.4)} fill={METAL} {...stroke} /> };
    case "clamp":
      // a strap bent round a pole, end on: the loop, and an ear each side with its screw hole
      if (form === "omega") {
        const R = 9.5, t = 1.5, Ro = R + t, yw = dia - Ro, e = len / 2;
        return {
          w: len,
          h: dia,
          scalable: true,
          node: (
            <g transform={`translate(${e} ${Ro - dia / 2})`}>
              <path d={`M${-e} ${yw} H${-R} V0 A${R} ${R} 0 0 1 ${R} 0 V${yw} H${e} V${yw - t} H${Ro} V0 A${Ro} ${Ro} 0 0 0 ${-Ro} 0 V${yw - t} H${-e} Z`} fill={METAL} {...stroke} />
            </g>
          ),
        };
      }
      return { w: len, h: 10, scalable: true, node: <path d={`M0 -5 V5 H${len} V-5 H${len - 2.5} V2.5 H2.5 V-5 Z`} fill={METAL} {...stroke} /> };
    case "angle":
      return {
        w: len,
        h: len,
        scalable: true,
        node: (
          <g transform={`translate(0 ${-len / 2})`}>
            <path d={`M0 0 H2.5 V${len - 2.5} H${len} V${len} H0 Z`} fill={METAL} {...stroke} />
            <circle cx={len * 0.6} cy={len - 1.2} r={0.9} fill="#fff" {...fine} />
          </g>
        ),
      };
    case "wedge": {
      // side on: the triangular block, the screw's cross head on its slope
      const h = len / 2;
      return {
        w: len,
        h: len,
        scalable: true,
        node: (
          <g>
            <path d={`M0 ${h} H${len} V${-h} Z`} fill={PLASTIC} {...stroke} />
            <circle cx={h} cy={0} r={len * 0.2} fill={METAL} {...stroke} />
            <path d={`M${h - len * 0.1} 0 H${h + len * 0.1} M${h} ${-len * 0.1} V${len * 0.1}`} {...fine} />
          </g>
        ),
      };
    }
    case "foot":
      // an adjustable leg lying down: the threaded shaft, the disc on its foot at the right
      if (form === "disc")
        return { w: len, h: dia, scalable: false, node: <g><path d={thread(0, len - 8, 6, 6)} fill={METAL} {...stroke} /><rect x={len - 8} y={-r} width={8} height={dia} rx={2} fill={PLASTIC} {...stroke} /></g> };
      return {
        w: len + 14,
        h: dia,
        scalable: true,
        node: (
          <g>
            <path d={thread(0, 14, 4, 1.6)} fill={METAL} {...stroke} />
            <rect x={14} y={-dia / 2} width={len} height={dia} rx={3} fill={PLASTIC} {...stroke} />
          </g>
        ),
      };
    case "spacer":
      // a wall clip side on: the block, its right end hollowed round the post, the screw hole through it
      if (form === "saddle")
        return { w: len, h: dia, scalable: true, node: <g><path d={`M0 ${-r} H${len} A${r} ${r} 0 0 0 ${len} ${r} H0 Z`} fill={PLASTIC} {...stroke} /><path d={`M0 0 H${len - r}`} {...fine} /></g> };
      // a leg cup side on: the flange plate and the socket standing on it
      if (form === "flange")
        return { w: len, h: dia, scalable: true, node: <path d={`M0 ${-r} H2 V-15 H${len} V15 H2 V${r} H0 Z`} fill={METAL} {...stroke} /> };
      return { w: len, h: dia, scalable: true, node: <rect x={0} y={-dia / 2} width={len} height={dia} rx={2} fill={PLASTIC} {...stroke} /> };
    case "cap":
      // a cup side on: its body, the shallow dome on top
      if (form === "cup") return { w: dia, h: len + 2, scalable: true, node: <path d={`M0 ${len / 2 + 1} V${-len / 2 + 1} Q${r} ${-len / 2 - 3} ${dia} ${-len / 2 + 1} V${len / 2 + 1} Z`} fill={PLASTIC} {...stroke} /> };
      return { w: dia, h: dia, scalable: true, node: <g><circle cx={dia / 2} cy={0} r={dia / 2} fill={PLASTIC} {...stroke} /><circle cx={dia / 2} cy={0} r={dia / 2 - 2} fill="none" {...fine} /></g> };
    case "gasLift":
      // lying down: the narrow end that drops into the base on the left, the rod for the seat on the right
      return {
        w: 132,
        h: 26,
        scalable: false,
        node: (
          <g>
            <rect x={0} y={-7} width={26} height={14} rx={2} fill={METAL} {...stroke} />
            <rect x={24} y={-13} width={82} height={26} rx={3} fill={METAL} {...stroke} />
            <path d="M34 -6 H96" {...fine} />
            <rect x={104} y={-9} width={6} height={18} rx={1.5} fill={PLASTIC} {...stroke} />
            <rect x={110} y={-5.5} width={22} height={11} rx={2} fill={METAL} {...stroke} />
          </g>
        ),
      };
  }
}

/**
 * Hardware drawing. `fit` draws it inside a square box of that many pixels;
 * `pxPerMm` draws it at real size.
 */
export function HwArt({ kind, len, dia, form, drive, fit = 72, pxPerMm, className }: Readonly<{ kind: HwKind; len: number; dia: number; form?: HwForm; drive?: HwType["drive"]; fit?: number; pxPerMm?: number; className?: string }>) {
  const d = draw(kind, len, dia, form, drive);
  const pad = Math.max(d.w, d.h) * 0.06 + 1;
  const vbW = d.w + pad * 2, vbH = d.h + pad * 2;
  let width: number, height: number;
  if (pxPerMm && d.scalable) {
    width = vbW * pxPerMm;
    height = vbH * pxPerMm;
  } else {
    const k = fit / Math.max(vbW, vbH * 1.15);
    width = vbW * k;
    height = vbH * k;
  }
  return (
    <svg className={className} viewBox={`${-pad} ${-d.h / 2 - pad} ${vbW} ${vbH}`} width={width} height={height} aria-hidden="true" overflow="visible">
      {d.node}
    </svg>
  );
}

export function canActualSize(kind: HwKind) {
  return kind !== "runner" && kind !== "castor" && kind !== "gasLift";
}

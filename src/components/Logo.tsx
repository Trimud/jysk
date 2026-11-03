import Link from "next/link";

// the o: a bolt head seen from above, a ring as heavy as the letters, the Allen key's hex socket in its middle
// (32 box; the share card draws the same paths on its canvas)
export const RING = "M16 0 A16 16 0 1 0 16 32 A16 16 0 1 0 16 0 Z M16 7.6 A8.4 8.4 0 1 0 16 24.4 A8.4 8.4 0 1 0 16 7.6 Z";
export const SOCKET = "M16 11.2 L20.16 13.6 L20.16 18.4 L16 20.8 L11.84 18.4 L11.84 13.6 Z";

function Bolt() {
  return (
    <>
      <path fillRule="evenodd" d={RING} />
      <path className="mark-socket" d={SOCKET} />
    </>
  );
}

/** The mark alone (favicon, the guide's corner): the bolt, white on the blue block. */
export function LogoMark({ size = 32, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={"mark " + (className ?? "")} aria-hidden="true">
      <rect width="48" height="48" rx="5" fill="var(--logo-bg, var(--brand))" />
      <g transform="translate(8 8)" fill="var(--logo-ink, #fff)">
        <Bolt />
      </g>
    </svg>
  );
}

/** The name, linked home, set at `size` px: "monta" in white on a blue block, its o the bolt. */
export default function Logo({ href = "/", size = 24 }: Readonly<{ href?: string; size?: number }>) {
  return (
    <Link href={href} className="logo" aria-label="Monta home" style={{ fontSize: size }}>
      <span className="wordmark">
        m
        <svg viewBox="0 0 32 32" className="wordmark-o" fill="currentColor" aria-hidden="true">
          <Bolt />
        </svg>
        nta
      </span>
    </Link>
  );
}

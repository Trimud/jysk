import Link from "next/link";

// the a of "assemble": a bolt head seen from above (a ring as heavy as the letters) with a stem down its right side,
// the Allen key's hex socket in its counter. A 33 x 32 box; the share cards draw the same paths.
export const RING = "M16 0 A16 16 0 1 0 16 32 A16 16 0 1 0 16 0 Z M16 7.6 A8.4 8.4 0 1 0 16 24.4 A8.4 8.4 0 1 0 16 7.6 Z";
export const STEM = "M25.2 0.6 H33 V32 H25.2 Z";
export const SOCKET = "M16 11.2 L20.16 13.6 L20.16 18.4 L16 20.8 L11.84 18.4 L11.84 13.6 Z";

function BoltA() {
  return (
    <>
      <path fillRule="evenodd" d={RING} />
      <path d={STEM} />
      <path className="mark-socket" d={SOCKET} />
    </>
  );
}

/** The small logo (favicon, the guide's corner): the bolt a, white on the blue block. */
export function LogoMark({ size = 32, className }: Readonly<{ size?: number; className?: string }>) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} className={"mark " + (className ?? "")} aria-hidden="true">
      <rect width="48" height="48" rx="5" fill="var(--logo-bg, var(--brand))" />
      <g transform="translate(7.5 8)" fill="var(--logo-ink, #fff)">
        <BoltA />
      </g>
    </svg>
  );
}

/** The name, linked home, set at `size` px: "assemble.help" in white on a blue block, its a the bolt, ".help" a step lighter. */
export default function Logo({ href = "/", size = 24 }: Readonly<{ href?: string; size?: number }>) {
  return (
    <Link href={href} className="logo" aria-label="assemble.help home" style={{ fontSize: size }}>
      <span className="wordmark">
        <svg viewBox="0 0 33 32" className="wordmark-a" fill="currentColor" aria-hidden="true">
          <BoltA />
        </svg>
        ssemble<span className="wordmark-tld">.help</span>
      </span>
    </Link>
  );
}

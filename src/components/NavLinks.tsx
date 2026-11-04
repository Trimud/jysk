"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { listProgress } from "@/lib/store";
import { useMounted } from "@/lib/useMounted";
import BrowseMenu, { type MenuNode } from "./BrowseMenu";

const LINKS = [{ href: "/builds", label: "Workshop" }];

export default function NavLinks({ rooms }: Readonly<{ rooms: MenuNode[] }>) {
  const path = usePathname();
  const mounted = useMounted();
  const builds = useMemo(() => (mounted ? listProgress().filter((p) => p.phase !== "cover").length : 0), [mounted]);
  return (
    <nav className="site-nav" aria-label="Main">
      <BrowseMenu rooms={rooms} />
      {LINKS.map((l) => {
        const on = path === l.href;
        return (
          <Link key={l.href} href={l.href} className={"nav-link" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>
            {l.label}
            {l.href === "/builds" && builds > 0 && <span className="nav-count">{builds}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

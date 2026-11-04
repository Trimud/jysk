"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IArrowLeft, IChevron, IChevronDown, IClose } from "./art/Icons";

/** A category as the menu needs it (src/lib/categories.ts, slimmed by SiteHeader). */
export type MenuNode = { href: string; label: string; children: MenuNode[] };

/**
 * "Browse": JYSK's categories. On a wide screen a panel drops under the header, the rooms down the side and the hovered
 * room's categories beside them; on a phone a sheet steps down one level at a time, with back and "Show all".
 */
export default function BrowseMenu({ rooms }: Readonly<{ rooms: MenuNode[] }>) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [room, setRoom] = useState(rooms[0]?.href ?? "");
  // the phone sheet's levels: [] is the rooms, then each category stepped into
  const [stack, setStack] = useState<MenuNode[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const btn = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    setStack([]);
  };
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      close();
      btn.current?.focus();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  // a mouse opens it by hovering; touch and keyboard by the button
  const hover = (e: React.PointerEvent, on: boolean) => {
    if (e.pointerType !== "mouse" || window.matchMedia("(max-width: 820px)").matches) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (on ? setOpen(true) : close()), on ? 80 : 180);
  };
  const enter = (e: React.PointerEvent) => hover(e, true);
  const leave = (e: React.PointerEvent) => hover(e, false);

  const here = path === "/browse" || rooms.some((r) => path === r.href || path.startsWith(r.href + "/"));
  const active = rooms.find((r) => r.href === room) ?? rooms[0];
  const level = stack[stack.length - 1];
  const items = level ? level.children : rooms;

  return (
    <div className="bm" onPointerEnter={enter} onPointerLeave={leave}>
      <button ref={btn} type="button" className={"nav-link bm-btn" + (here ? " on" : "")} aria-expanded={open} aria-controls="browse-menu" onClick={() => (open ? close() : setOpen(true))}>
        Browse <IChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="bm-scrim" onClick={close} onPointerEnter={leave} aria-hidden />
          {/* a link followed closes the menu */}
          <div id="browse-menu" className="bm-panel" onPointerEnter={enter} onClick={(e) => (e.target as HTMLElement).closest("a") && close()}>
            <div className="bm-desk">
              <ul className="bm-rooms">
                {rooms.map((r) => (
                  <li key={r.href}>
                    <Link href={r.href} className={"bm-room" + (r === active ? " on" : "")} onPointerEnter={() => setRoom(r.href)} onFocus={() => setRoom(r.href)}>
                      {r.label} <IChevron size={14} />
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/browse" className="bm-room bm-all">
                    All guides
                  </Link>
                </li>
              </ul>
              {active && (
                <div className="bm-cols">
                  <Link href={active.href} className="bm-show">
                    Show all {active.label.toLowerCase()}
                  </Link>
                  <ul className="bm-grid">
                    {active.children.map((c) => (
                      <li key={c.href}>
                        <Link href={c.href} className="bm-head">
                          {c.label}
                        </Link>
                        {c.children.length > 0 && (
                          <ul>
                            {c.children.map((g) => (
                              <li key={g.href}>
                                <Link href={g.href}>{g.label}</Link>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="bm-mob" role="dialog" aria-label={level ? level.label : "Browse"}>
              <div className="bm-bar">
                {level ? (
                  <button type="button" className="bm-icon" onClick={() => setStack(stack.slice(0, -1))} aria-label="Back">
                    <IArrowLeft size={20} />
                  </button>
                ) : (
                  <span className="bm-icon" />
                )}
                <b>{level ? level.label : "Browse"}</b>
                <button type="button" className="bm-icon" onClick={close} aria-label="Close menu">
                  <IClose size={20} />
                </button>
              </div>
              <ul className="bm-list">
                <li>
                  <Link href={level ? level.href : "/browse"} className="bm-show">
                    {level ? "Show all" : "All guides"}
                  </Link>
                </li>
                {items.map((c) => (
                  <li key={c.href}>
                    {c.children.length ? (
                      <button type="button" onClick={() => setStack([...stack, c])}>
                        {c.label} <IChevron size={18} />
                      </button>
                    ) : (
                      <Link href={c.href}>{c.label}</Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

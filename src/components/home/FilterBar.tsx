"use client";

import { useEffect, useRef } from "react";
import { COLOUR_HEX, SORTS, type FacetGroup, type Filters, type Sort } from "@/lib/facets";
import { IChevronDown, IClose, IFilter } from "../art/Icons";

/** How many filters get a button of their own over the grid; the rest are in "All filters". */
const TOP = 3;

type Props = Readonly<{
  groups: FacetGroup[];
  filters: Filters;
  toggle: (group: string, option: string) => void;
  clear: () => void;
  sort: Sort;
  setSort: (s: Sort) => void;
  total: number;
}>;

/**
 * The browse filters, laid out like JYSK's: a few filter buttons and Sort, each opening a list, then "All filters" for a
 * side panel with every filter. Each option shows how many guides picking it gives; the grid follows as you pick.
 */
export default function FilterBar({ groups, filters, toggle, clear, sort, setSort, total }: Props) {
  const bar = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const picked = groups.flatMap((g) => g.options.filter((o) => filters[g.id]?.includes(o.id)).map((o) => ({ g, o })));

  // an open list closes on a click outside it
  useEffect(() => {
    const out = (e: PointerEvent) => bar.current?.querySelectorAll("details[open]").forEach((d) => !d.contains(e.target as Node) && d.removeAttribute("open"));
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
  }, []);

  const options = (g: FacetGroup) => (
    <ul className="fopts">
      {g.options.map((o) => (
        <li key={o.id}>
          <label className="fopt">
            <input type="checkbox" checked={!!filters[g.id]?.includes(o.id)} onChange={() => toggle(g.id, o.id)} />
            {g.swatch && <i className="fswatch" style={{ background: COLOUR_HEX[o.id] }} />}
            <span>{o.label}</span>
            <small>{o.n}</small>
          </label>
        </li>
      ))}
    </ul>
  );
  const count = (g: FacetGroup) => filters[g.id]?.length || 0;

  return (
    <div className="fbar-wrap">
      <div className="fbar" ref={bar}>
        {groups.slice(0, TOP).map((g) => (
          <details key={g.id} name="fdrop" className="fdrop">
            <summary className={"fbtn" + (count(g) ? " on" : "")}>
              {g.label}
              {count(g) > 0 && <b className="fbtn-n">{count(g)}</b>}
              <IChevronDown size={16} />
            </summary>
            <div className="fmenu">{options(g)}</div>
          </details>
        ))}
        <details name="fdrop" className="fdrop">
          <summary className="fbtn">
            Sort <IChevronDown size={16} />
          </summary>
          <div className="fmenu">
            <ul className="fopts">
              {SORTS.map((s) => (
                <li key={s.id}>
                  <label className="fopt">
                    <input type="radio" name="sort" checked={sort === s.id} onChange={() => setSort(s.id)} />
                    <span>{s.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </details>
        {groups.length > TOP && (
          <button
            type="button"
            className="fbtn"
            onClick={() => {
              bar.current?.querySelectorAll("details[open]").forEach((d) => d.removeAttribute("open"));
              panel.current?.showModal();
            }}
          >
            <IFilter size={16} /> All filters
            {picked.length > 0 && <b className="fbtn-n">{picked.length}</b>}
          </button>
        )}
        <span className="fcount">
          {total} {total === 1 ? "guide" : "guides"}
        </span>
      </div>

      {picked.length > 0 && (
        <ul className="fchips">
          {picked.map(({ g, o }) => (
            <li key={g.id + o.id}>
              <button type="button" className="fchip" onClick={() => toggle(g.id, o.id)} aria-label={`Remove ${g.label}: ${o.label}`}>
                {g.id === "colour" || g.id === "series" ? o.label : `${g.label}: ${o.label}`} <IClose size={14} />
              </button>
            </li>
          ))}
          <li>
            <button type="button" className="fclear" onClick={clear}>
              Clear all
            </button>
          </li>
        </ul>
      )}

      <dialog ref={panel} className="fpanel" aria-label="Filter" onClick={(e) => e.target === panel.current && panel.current.close()}>
        <div className="fpanel-in">
          <header className="fpanel-head">
            <b>Filter</b>
            <button type="button" className="bm-icon" onClick={() => panel.current?.close()} aria-label="Close filters">
              <IClose size={20} />
            </button>
          </header>
          <div className="fpanel-body">
            {groups.map((g) => (
              <details key={g.id} className="fsec" open={count(g) > 0 || undefined}>
                <summary>
                  {g.label}
                  {count(g) > 0 && <b className="fbtn-n">{count(g)}</b>}
                  <IChevronDown size={18} />
                </summary>
                {options(g)}
              </details>
            ))}
          </div>
          <footer className="fpanel-foot">
            <button type="button" className="fpanel-clear" onClick={clear} disabled={!picked.length}>
              Clear all
            </button>
            <button type="button" className="fpanel-go" onClick={() => panel.current?.close()}>
              Show {total} {total === 1 ? "guide" : "guides"}
            </button>
          </footer>
        </div>
      </dialog>
    </div>
  );
}

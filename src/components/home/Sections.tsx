"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { POPULAR, articleNo, articleSlug, fold, kindOf, searchCatalog, searchText, slugify } from "@/lib/search";
import { PRODUCTS, type CatalogEntry } from "@/lib/catalog";
import { nodeAt } from "@/lib/categories";
import { NO_FILTERS, SORTS, applyFilters, facets, readFilters, sortList, writeFilters, type Filters, type Sort } from "@/lib/facets";
import FilterBar from "./FilterBar";
import Drawing from "../Drawing";
import { useUserKey } from "@/lib/userKey";
import { Dots } from "../guide/ui";
import { IArrowRight, IClock, IClose, ISearch } from "../art/Icons";

/** Cards added per "Show more": a multiple of the 2 and 3 column grids. */
const PAGE = 24;

export function ProductCard({ e, i = 0 }: { e: CatalogEntry; i?: number }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.4, delay: Math.min(0.3, (i % 12) * 0.03), ease: [0.22, 1, 0.36, 1] }}>
      <Link href={`/build/${e.slug}`} className="pcard">
        <span className="pcard-art">
          <Drawing name={e.slug} fallback={e.kind ? `kind-${e.kind}` : undefined} w={420} h={320} className="pcard-thumb" alt={`${e.name} line drawing`} eager={i < 6} />
        </span>
        <span className="pcard-text">
          <span className="pcard-top">
            <b>{e.name}</b>
            <span className="pcard-go">
              <IArrowRight size={17} />
            </span>
          </span>
          <span className="pcard-variant">{e.variant}</span>
          <span className="pcard-meta">
            <span>
              <IClock size={15} /> {e.minutes < 60 ? `${e.minutes} min` : `${Math.round(e.minutes / 6) / 10} h`}
            </span>
            <Dots value={e.difficulty} />
            <span className="pcard-cat">{e.category}</span>
          </span>
        </span>
      </Link>
    </motion.div>
  );
}

/**
 * A grid of guides. On the home page it shows a short pick; a category page (`at`, its address: "/bedroom/beds", or ""
 * for every guide) shows all of the category's guides with a filter, a page of cards at a time (each card's drawing
 * renders only while it is on screen).
 */
export function Catalog({ limit, search, at = "" }: Readonly<{ limit?: number; search?: boolean; at?: string }>) {
  const [q, setQ] = useState("");
  const [more, setMore] = useState({ view: "", n: PAGE });
  const no = search ? articleNo(q) : null;
  // the filters and sort live in the address too (/dining-room/dining-tables?colour=black), so a filtered view can be shared
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [sort, setSort] = useState<Sort>("name");
  useEffect(() => {
    if (!search) return;
    const read = () => {
      const p = new URLSearchParams(window.location.search);
      setFilters(readFilters(p));
      setSort((SORTS.find((x) => x.id === p.get("sort"))?.id ?? "name") as Sort);
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [search]);
  const query = (f: Filters, s: Sort) => {
    const p = writeFilters(f);
    if (s !== "name") p.set("sort", s);
    // commas read better in an address than %2C
    const str = p.toString().replace(/%2C/g, ",");
    return str ? "?" + str : "";
  };
  const update = (f: Filters) => {
    setFilters(f);
    window.history.replaceState(null, "", window.location.pathname + query(f, sort));
  };
  const toggle = (k: string, v: string) => {
    const on = filters[k] ?? [];
    update({ ...filters, [k]: on.includes(v) ? on.filter((x) => x !== v) : [...on, v] });
  };
  const changeSort = (v: Sort) => {
    setSort(v);
    window.history.replaceState(null, "", window.location.pathname + query(filters, v));
  };

  // the category's products before any filter: what the filters' options and counts are taken over
  const inTab = search ? (nodeAt(at)?.guides ?? PRODUCTS) : limit ? POPULAR : PRODUCTS;
  const opts = search ? facets(inTab, filters) : null;

  const list = (() => {
    let l = search ? applyFilters(inTab, filters) : inTab;
    const f = fold(q);
    let ranked = false;
    if (no) {
      const slug = articleSlug(no);
      l = l.filter((e) => e.slug === slug);
    } else if (f) {
      // every word starts a word of the product's name, type, category or keywords
      const words = f.split(" ");
      const literal = l.filter((e) => {
        const text = searchText(e);
        return words.every((w) => text.includes(" " + w));
      });
      // a type word ("crib", "desk chair") or a typo ("kalax") goes through the same search as the home page, best first
      if (kindOf(q) || !literal.length) {
        const inView = new Set(l);
        const hits = searchCatalog(q, 600).map((h) => h.entry).filter((e) => inView.has(e));
        const seen = new Set(hits);
        l = [...hits, ...literal.filter((e) => !seen.has(e))];
        ranked = hits.length > 0;
      } else l = literal;
    }
    if (!limit && !ranked) l = sortList(l, sort);
    return limit ? l.slice(0, limit) : l;
  })();

  const view = at + "|" + q + "|" + query(filters, sort);
  const n = limit ? list.length : more.view === view ? more.n : PAGE;
  const shown = list.slice(0, n);

  return (
    <div className="catalog">
      {search && (
        <div className="cat-bar">
          <label className="cat-search">
            <ISearch size={20} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or article number" aria-label="Filter by name or article number" enterKeyHint="search" autoComplete="off" spellCheck={false} />
            {q && (
              <button type="button" className="cat-clear" onClick={() => setQ("")} aria-label="Clear filter">
                <IClose size={16} />
              </button>
            )}
          </label>
        </div>
      )}
      {opts && <FilterBar groups={opts} filters={filters} toggle={toggle} clear={() => update(NO_FILTERS)} sort={sort} setSort={changeSort} total={list.length} />}
      <motion.div layout className="pgrid">
        <AnimatePresence mode="popLayout">
          {shown.map((e, i) => (
            <ProductCard key={e.slug} e={e} i={i} />
          ))}
        </AnimatePresence>
      </motion.div>
      {list.length === 0 && (
        <div className="empty">
          {no ? (
            <p>No guide for that article number yet. Try the name on the box.</p>
          ) : (
            <>
              <p>{q.trim() ? <>Nothing here matches &ldquo;{q.trim()}&rdquo;.</> : "Nothing matches these filters."}</p>
              {q.trim() && (
                <Link href={`/build/${slugify(q)}?q=${encodeURIComponent(q.trim())}`} className="empty-go">
                  Make a guide for {q.trim()} <IArrowRight size={16} />
                </Link>
              )}
            </>
          )}
        </div>
      )}
      {!limit && list.length > shown.length && (
        <div className="cat-more">
          <button type="button" className="cat-more-btn" onClick={() => setMore({ view, n: n + PAGE })}>
            Show {Math.min(PAGE, list.length - shown.length)} more
          </button>
          <span>
            {shown.length} of {list.length}
          </span>
        </div>
      )}
    </div>
  );
}

/** AI features run on the person's own key: they're on once one is saved. */
export function useAiStatus() {
  return !!useUserKey();
}

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { POPULAR, PRODUCT_COUNT, articleNo, articleSlug, fold, kindOf, searchCatalog, searchText, slugify } from "@/lib/search";
import { PRODUCTS, type CatalogEntry } from "@/lib/catalog";
import { KIND_ARCH } from "@/lib/products";
import type { Archetype } from "@/lib/types";
import { CATS, catNoun } from "@/lib/categories";
import Drawing from "../Drawing";
import { useUserKey } from "@/lib/userKey";
import { Dots } from "../guide/ui";
import { IArrowRight, IClock, IClose, ISearch } from "../art/Icons";

// a kind no tab names yet still lands in the tab for its furniture type
const LISTED = new Set(CATS.flatMap((c) => c.kinds ?? []));
const BY_ARCH: Record<Archetype, string> = { shelf: "shelves", drawers: "drawers", cabinet: "cabinets", table: "tables", bed: "beds", seat: "chairs", sofa: "sofas", custom: "cabinets" };

const inCat = (e: CatalogEntry, c: (typeof CATS)[number]) => {
  if (!c.kinds && !c.tag) return true;
  if (c.tag && e.keywords?.includes(c.tag)) return true;
  // a clothes rail makes it a wardrobe, whatever kind builds it (a wardrobe with drawers is the "mixed" kind)
  if (!c.tag && e.cabinet?.rail) return c.id === "wardrobes";
  if (!e.kind) return false;
  return !!c.kinds?.includes(e.kind) || (!LISTED.has(e.kind) && BY_ARCH[KIND_ARCH[e.kind] ?? e.archetype] === c.id);
};

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

/** The tab an address points at: /browse/beds is "beds", /browse is "all". */
const catOf = (path: string) => CATS.find((c) => c.id === path.split("/")[2]) ?? CATS[0];

// the catalogue is fixed at build time: count each tab once
const COUNTS = new Map(CATS.map((c) => [c.id, PRODUCTS.filter((e) => inCat(e, c)).length]));

/** The /browse heading names the tab in the address, and follows it as the tabs change it. */
export function BrowseHead() {
  const c = catOf(usePathname());
  const n = COUNTS.get(c.id)!;
  const all = c.id === "all";
  return (
    <header className="page-head">
      <h1>{all ? "All guides" : c.label}</h1>
      <p className="lead">
        {all
          ? `${PRODUCT_COUNT.toLocaleString("en-US")} JYSK products in ${PRODUCTS.length.toLocaleString("en-US")} sizes, drawn and ready to build.`
          : `${n} ${n === 1 ? "guide" : "guides"} for JYSK ${catNoun(c)}, drawn and ready to build.`}
      </p>
    </header>
  );
}

/**
 * Category tabs plus a grid. On the home page it shows a short pick; /browse shows everything with a filter,
 * a page of cards at a time (each card's drawing renders only while it is on screen).
 */
export function Catalog({ limit, search }: Readonly<{ limit?: number; search?: boolean }>) {
  // on /browse the tab is the address (/browse/beds), so a link or the back button lands on it; the home page keeps it in state
  const path = usePathname();
  const [homeCat, setHomeCat] = useState("all");
  const cat = search ? catOf(path).id : homeCat;
  const setCat = (id: string) => (search ? window.history.pushState(null, "", id === "all" ? "/browse" : `/browse/${id}`) : setHomeCat(id));
  const [q, setQ] = useState("");
  const [more, setMore] = useState({ view: "", n: PAGE });
  const no = search ? articleNo(q) : null;

  const list = useMemo(() => {
    const c = CATS.find((x) => x.id === cat)!;
    let l = c.kinds || c.tag ? PRODUCTS.filter((e) => inCat(e, c)) : limit ? POPULAR : PRODUCTS;
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
    if (!limit && !ranked) l = [...l].sort((a, b) => a.name.localeCompare(b.name, "sv") || a.variant.localeCompare(b.variant, "sv"));
    return limit ? l.slice(0, limit) : l;
  }, [cat, q, limit, no]);

  const view = cat + "|" + q;
  const n = limit ? list.length : more.view === view ? more.n : PAGE;
  const shown = list.slice(0, n);

  return (
    <div className="catalog">
      <div className="cat-bar">
        {search && (
          <label className="cat-search">
            <ISearch size={20} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or article number" aria-label="Filter by name or article number" enterKeyHint="search" autoComplete="off" spellCheck={false} />
            {q && (
              <button type="button" className="cat-clear" onClick={() => setQ("")} aria-label="Clear filter">
                <IClose size={16} />
              </button>
            )}
          </label>
        )}
        <div className="cat-tabs" role="tablist">
          {CATS.map((c) => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={"cat-tab" + (cat === c.id ? " on" : "")} onClick={() => setCat(c.id)}>
              {cat === c.id && <motion.i layoutId={"cat-bg" + (search ? "b" : "h")} className="cat-bg" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
              <span>{c.label}</span>
              {search && <small className="cat-n">{COUNTS.get(c.id)}</small>}
            </button>
          ))}
        </div>
      </div>
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
              <p>Nothing here matches &ldquo;{q.trim()}&rdquo;.</p>
              <Link href={`/build/${slugify(q)}?q=${encodeURIComponent(q.trim())}`} className="empty-go">
                Make a guide for {q.trim()} <IArrowRight size={16} />
              </Link>
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

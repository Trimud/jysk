import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Catalog } from "@/components/home/Sections";
import CatTiles from "@/components/home/CatTiles";
import { PRODUCT_COUNT } from "@/lib/search";
import { PRODUCTS } from "@/lib/catalog";
import { ROOT, catNoun, nodeAt, pageOf, trail } from "@/lib/categories";

/** /browse and every category page (/bedroom/beds): the category's address picks its guides. */
export default function Browse({ at = "" }: Readonly<{ at?: string }>) {
  const node = nodeAt(at) ?? ROOT;
  const n = node.guides.length;
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse">
        {node !== ROOT && (
          <nav className="crumbs" aria-label="Breadcrumb">
            <ol>
              <li>
                <Link href="/browse">All guides</Link>
              </li>
              {trail(node).map((c) => (
                <li key={c.href}>
                  <Link href={pageOf(c)}>{c.label}</Link>
                </li>
              ))}
              <li aria-current="page">{node.label}</li>
            </ol>
          </nav>
        )}
        <header className="page-head">
          <h1>{node.label}</h1>
          <p className="lead">
            {node === ROOT
              ? `${PRODUCT_COUNT.toLocaleString("en-US")} JYSK products in ${PRODUCTS.length.toLocaleString("en-US")} sizes, drawn and ready to build.`
              : `${n} ${n === 1 ? "guide" : "guides"} for JYSK ${catNoun(node)}, drawn and ready to build.`}
          </p>
        </header>
        <CatTiles nodes={node.children} />
        <Catalog search at={node.href} />
      </main>
      <SiteFooter />
    </div>
  );
}

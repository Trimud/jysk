import Link from "next/link";
import Drawing from "../Drawing";
import { coverOf, pageOf, type CatNode } from "@/lib/categories";

/** A row of categories to step into, each drawn as one of its own guides. */
export default function CatTiles({ nodes }: Readonly<{ nodes: CatNode[] }>) {
  if (!nodes.length) return null;
  return (
    <ul className="cat-tiles">
      {nodes.map((c) => {
        const e = coverOf(c);
        return (
          <li key={c.href}>
            <Link href={pageOf(c)} className="cat-tile">
              <span className="cat-tile-art">
                <Drawing name={e.slug} fallback={e.kind ? `kind-${e.kind}` : undefined} w={160} h={122} />
              </span>
              <span className="cat-tile-label">{c.label}</span>
              <small>{c.guides.length}</small>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { BrowseHead, Catalog } from "@/components/home/Sections";

/** /browse and /browse/<category>: the same page, the tab and its heading come from the address. */
export default function Browse() {
  return (
    <div className="site">
      <SiteHeader />
      <main className="browse">
        <BrowseHead />
        <Catalog search />
      </main>
      <SiteFooter />
    </div>
  );
}

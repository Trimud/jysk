import Logo from "./Logo";
import NavLinks from "./NavLinks";
import { ROOMS, type CatNode } from "@/lib/categories";
import type { MenuNode } from "./BrowseMenu";

// the menu needs only names and addresses, not the guides under each category
const slim = (n: CatNode): MenuNode => ({ href: n.href, label: n.label, children: n.children.map(slim) });
const MENU = ROOMS.map(slim);

export default function SiteHeader() {
  return (
    <header className="site-head">
      <div className="head-left">
        <Logo />
        <NavLinks rooms={MENU} />
      </div>
    </header>
  );
}

import Logo from "./Logo";
import NavLinks from "./NavLinks";

export default function SiteHeader() {
  return (
    <header className="site-head">
      <div className="head-left">
        <Logo />
        <NavLinks />
      </div>
    </header>
  );
}

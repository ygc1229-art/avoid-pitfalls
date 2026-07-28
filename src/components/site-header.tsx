import Image from "next/image";
import Link from "next/link";
import { AccountLink } from "./account-link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-shell header-inner">
        <Link className="brand" href="/" aria-label="避坑指南首页">
          <Image src="/brand/logo-mark.svg" alt="" width={34} height={34} priority />
          <span>避坑指南</span>
          <small>AVOID PITFALLS</small>
        </Link>
        <nav className="main-nav" aria-label="主导航">
          <Link href="/search">发现</Link>
          <Link href="/search?cardType=rule_update">规则更新</Link>
          <Link href="/submit">投稿</Link>
        </nav>
        <div className="header-actions">
          <Link className="header-search-link" href="/search" aria-label="搜索">⌕ 搜索</Link>
          <AccountLink />
        </div>
      </div>
    </header>
  );
}

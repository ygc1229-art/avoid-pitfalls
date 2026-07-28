import type { Metadata } from "next";
import { FilterForm } from "@/components/filter-form";
import { PostExplorer } from "@/components/post-explorer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "搜索经验" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const value = (key: string) => {
    const current = params[key];
    return Array.isArray(current) ? current[0] : current;
  };
  const filters = {
    query: value("query"),
    domain: value("domain"),
    region: value("region"),
    risk: value("risk"),
    cardType: value("cardType"),
    category: value("category"),
  };

  return (
    <>
      <SiteHeader />
      <main className="page-shell inner-page">
        <header className="page-title-row">
          <div>
            <p className="eyebrow">SEARCH BEFORE YOU MOVE / 行动前查一下</p>
            <h1>搜一条能马上用的经验</h1>
          </div>
          <p>无需注册即可搜索、筛选和阅读。评论、收藏和投稿时再登录。</p>
        </header>
        <FilterForm values={filters} />
        <PostExplorer filters={filters} />
      </main>
    </>
  );
}

type SearchBarProps = {
  prominent?: boolean;
  defaultValue?: string;
};

export function SearchBar({ prominent = false, defaultValue = "" }: SearchBarProps) {
  return (
    <form className={prominent ? "search-bar search-bar-prominent" : "search-bar"} action="/search">
      <label className="sr-only" htmlFor={prominent ? "hero-search" : "site-search"}>搜索避坑内容</label>
      <span aria-hidden="true">⌕</span>
      <input
        id={prominent ? "hero-search" : "site-search"}
        name="query"
        defaultValue={defaultValue}
        placeholder="搜场景、问题或地区，例如：租房 押金"
      />
      <button type="submit">查一下</button>
    </form>
  );
}

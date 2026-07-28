import { SearchBar } from "./search-bar";

type FilterValues = {
  query?: string;
  domain?: string;
  region?: string;
  risk?: string;
  cardType?: string;
  category?: string;
};

const selectOptions = {
  domain: ["租房", "求职", "留学", "旅行", "消费"],
  region: [
    ["CN", "中国"],
    ["HK", "中国香港"],
    ["CA", "加拿大"],
    ["GB", "英国"],
    ["GB-ENG", "英国·英格兰"],
    ["US", "美国"],
    ["AU", "澳大利亚"],
  ],
  risk: [
    ["U1", "低"],
    ["U2", "中"],
    ["U3", "较高"],
    ["U4", "高"],
  ],
  category: [
    ["H1", "租金与总成本"],
    ["H2", "房源与用途核查"],
    ["H3", "看房与安全"],
    ["H4", "费用与押金"],
    ["H5", "合同条款"],
    ["H6", "入住与维修"],
    ["H7", "退租与纠纷"],
    ["H8", "中介与身份"],
    ["J1", "招聘骗局"],
    ["J2", "公司与岗位核验"],
    ["J3", "面试与测试"],
    ["J4", "合同与试用"],
    ["J5", "薪酬与工时"],
    ["J6", "平台与灵活用工"],
    ["J7", "离职与证明"],
    ["J8", "职场权益"],
    ["E1", "学校与课程"],
    ["E2", "申请与录取"],
    ["E3", "学费与退款"],
    ["E4", "签证与资金"],
    ["E5", "住宿"],
    ["E6", "支持服务"],
    ["E7", "申诉与投诉"],
    ["E8", "就业数据"],
    ["E9", "高风险身份事项"],
    ["T1", "入境与证件"],
    ["T2", "交通"],
    ["T3", "住宿"],
    ["T4", "支付与换汇"],
    ["T5", "景点与季节"],
    ["T6", "施工与运营变化"],
    ["T7", "安全与灾害"],
    ["T8", "无障碍"],
    ["C1", "订阅与自动续费"],
    ["C2", "退款与售后"],
    ["C3", "二手与大额交易"],
  ],
};

export function FilterForm({ values }: { values: FilterValues }) {
  return (
    <div className="filter-panel">
      <SearchBar defaultValue={values.query} />
      <form className="filters" action="/search">
        {values.query && <input type="hidden" name="query" value={values.query} />}
        <label>
          <span>场景</span>
          <select name="domain" defaultValue={values.domain ?? ""}>
            <option value="">全部场景</option>
            {selectOptions.domain.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <span>地区</span>
          <select name="region" defaultValue={values.region ?? ""}>
            <option value="">全部地区</option>
            {selectOptions.region.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </label>
        <label>
          <span>风险</span>
          <select name="risk" defaultValue={values.risk ?? ""}>
            <option value="">全部风险</option>
            {selectOptions.risk.map(([value, label]) => <option value={value} key={value}>{label}风险</option>)}
          </select>
        </label>
        <label>
          <span>问题类型</span>
          <select name="category" defaultValue={values.category ?? ""}>
            <option value="">全部问题类型</option>
            {selectOptions.category.map(([value, label]) => (
              <option value={value} key={value}>{value} · {label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>内容类型</span>
          <select name="cardType" defaultValue={values.cardType ?? ""}>
            <option value="">全部类型</option>
            <option value="experience">公开案例</option>
            <option value="rule_update">规则更新</option>
            <option value="action_checklist">行动清单</option>
          </select>
        </label>
        <button className="button button-primary filter-submit" type="submit">应用筛选</button>
        <a className="filter-reset" href="/search">重置</a>
      </form>
    </div>
  );
}

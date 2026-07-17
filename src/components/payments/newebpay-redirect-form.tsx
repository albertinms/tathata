// 藍新 MPG／定期定额皆要求浏览器端 HTML Form Post（TradeInfo／TradeSha 是签章过的密文，
// 无法用简单 302 query string 导向），见 .claude/specs/T3.1-T3.2-newebpay-spec.md 1.2 节步骤 3。
// 纯 server component：无需客端互动，inline script 自动送出表单，<noscript> 提供无 JS 环境的手动按钮。
export function NewebPayRedirectForm({
  gatewayUrl,
  fields,
}: {
  gatewayUrl: string;
  fields: Record<string, string>;
}) {
  return (
    <form method="POST" action={gatewayUrl} id="newebpay-redirect-form">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p>正在导向付款页面…</p>
      <noscript>
        <button type="submit">继续付款</button>
      </noscript>
      <script
        dangerouslySetInnerHTML={{
          __html: "document.getElementById('newebpay-redirect-form').submit();",
        }}
      />
    </form>
  );
}

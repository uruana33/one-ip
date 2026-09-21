const ORIGIN = "https://ip.gogoxy.com";
const SITE_NAME = "出口观测台";

const META = {
  "/": {
    title: "出口观测台与 IP 质量 · ip.gogoxy.com",
    description:
      "面向代理与分流用户：对照国内与海外出口是否按规则走，检查 WebRTC／DNS，并查看 IP 质量分与机房／代理特征标记。",
    h1: "出口有没有按规则走？",
  },
  "/network/egress": {
    title: "分流出口检测 · 网站／DNS／CDN · 出口观测台",
    description:
      "按网站、DNS、CDN 来源查看实际出口，核对分流规则是否按预期生效。不同地址不直接证明规则完美，但足以定位分流问题。",
    h1: "规则有没有真正生效？",
  },
  "/network/ip": {
    title: "IP 质量与归属 · 出口观测台",
    description:
      "查看 IP 归属、ASN、质量分与机房／代理／VPN 等特征标记；用于判断出口画像，不代表任何平台官方判定。",
    h1: "查这个出口的画像",
  },
  "/webrtc": {
    title: "WebRTC 出口对照 · 出口观测台",
    description:
      "对照 HTTP 出口与 WebRTC／STUN 的 UDP 候选，排查代理或 TUN 下的 UDP 分流差异。只建数据通道，不申请摄像头麦克风。",
    h1: "UDP 出口和网页出口一致吗？",
  },
  "/ai/": {
    title: "AI 平台出口与状态 · 出口观测台",
    description:
      "检测 ChatGPT、Claude、DeepSeek、通义等平台的连通、出口与官方状态。公开端点可响应不等于可登录或可对话。",
    h1: "模型站通不通、从哪出去",
  },
  "/status/": {
    title: "AI 与云服务官方状态 · 出口观测台",
    description:
      "聚合 OpenAI、Claude、云厂商等公开状态，便于和出口问题交叉排查：是你的网络，还是服务挂了。",
    h1: "是你的网络，还是服务状态异常？",
  },
  "/docs/health": {
    title: "IP 健康报告 API · 出口观测台",
    description:
      "一行 curl 获取 IP 质量分与机房／代理特征标记，方便换节点后对比。参考值，不代表平台官方判定。",
    h1: "一行 curl，查看出口画像",
  },
  "/whois": {
    title: "WHOIS／RDAP 查询 · 出口观测台",
    description: "查询域名与 IP 注册信息，辅助核对出口归属。",
    h1: "域名与 IP 注册信息",
  },
  "/ping": {
    title: "全球延迟抽样 · 出口观测台",
    description:
      "多地探针延迟抽样，用来感受这个出口在各地快不快。参考值，不是业务可用性保证。",
    h1: "这个出口在各地快不快",
  },
};

const ROBOTS = `User-agent: *
Allow: /

Disallow: /api/
Disallow: /cdn-cgi/

Sitemap: ${ORIGIN}/sitemap.xml
`;

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function pathMeta(pathname) {
  if (META[pathname]) return pathname;
  if (pathname.startsWith("/network/ip/")) return "/network/ip";
  if (pathname.startsWith("/ai/")) return "/ai/";
  if (pathname.startsWith("/status/")) return "/status/";
  return null;
}

function routeUrl(pathname) {
  return pathname === "/" ? `${ORIGIN}/` : `${ORIGIN}${pathname}`;
}

function replaceMeta(html, pattern, tag) {
  return pattern.test(html) ? html.replace(pattern, tag) : html;
}

function injectHead(html, pathname) {
  const key = pathMeta(pathname);
  if (!key) return html;
  const meta = META[key];
  const canonical = routeUrl(
    key === "/ai/" || key === "/status/" ? key : pathname,
  );
  const title = escapeAttribute(meta.title);
  const description = escapeAttribute(meta.description);
  let output = html;
  output = replaceMeta(
    output,
    /<title>[^<]*<\/title>/i,
    `<title>${title}</title>`,
  );
  output = replaceMeta(
    output,
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?\s*>/i,
    `<meta name="description" content="${description}" />`,
  );
  output = replaceMeta(
    output,
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?\s*>/i,
    `<meta property="og:title" content="${title}" />`,
  );
  output = replaceMeta(
    output,
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?\s*>/i,
    `<meta property="og:description" content="${description}" />`,
  );
  output = replaceMeta(
    output,
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/?\s*>/i,
    `<meta name="twitter:title" content="${title}" />`,
  );
  output = replaceMeta(
    output,
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/?\s*>/i,
    `<meta name="twitter:description" content="${description}" />`,
  );

  const extra = `
    <link rel="canonical" href="${escapeAttribute(canonical)}" />
    <meta property="og:url" content="${escapeAttribute(canonical)}" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <script type="application/ld+json">${escapeJson({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: canonical,
      applicationCategory: "NetworkApplication",
      operatingSystem: "Any",
      description: meta.description,
      inLanguage: "zh-CN",
    })}</script>
    <noscript><h1>${escapeAttribute(meta.h1)}</h1><p>${description}</p></noscript>
  `;
  return /rel="canonical"/i.test(output)
    ? output
    : output.replace(/<\/head>/i, `${extra}</head>`);
}

function textResponse(body, contentType) {
  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": contentType,
    },
  });
}

export async function handleSeo(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/robots.txt")
    return textResponse(ROBOTS, "text/plain; charset=utf-8");
  if (url.pathname === "/sitemap.xml") return env.ASSETS.fetch(request);

  if (url.pathname.startsWith("/assets/")) {
    const asset = await env.ASSETS.fetch(request);
    const contentType = asset.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return asset;
    return new Response("Not found", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
      },
    });
  }

  if (url.pathname.startsWith("/api/") || url.pathname === "/favicon.svg")
    return env.ASSETS.fetch(request);

  const response = await env.ASSETS.fetch(request);
  const contentType = response.headers.get("content-type") ?? "";
  if (
    request.method === "HEAD" ||
    !pathMeta(url.pathname) ||
    !contentType.includes("text/html")
  )
    return response;

  const headers = new Headers(response.headers);
  headers.set("cache-control", "public, max-age=0, must-revalidate");
  return new Response(injectHead(await response.text(), url.pathname), {
    status: response.status,
    headers,
  });
}

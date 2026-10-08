import { edgeMemory, remember, rememberEdge } from "./edge-memory.js";
import { boundedJson, json, publicIp } from "./http.js";

let retryAfter = 0;

export async function ipType(value, origin) {
  const ip = publicIp(value);
  const cacheKey = `${origin}\0${ip}`;
  const memory = rememberEdge() ? edgeMemory().type : null;
  const hit = memory?.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.response.clone();
  if (Date.now() < retryAfter) return json({ available: false });
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,query,hosting,mobile,proxy`,
      { redirect: "manual", signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 429 || response.headers.get("X-Rl") === "0") {
      const ttl = Number(response.headers.get("X-Ttl"));
      retryAfter =
        Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : 60) * 1000;
    }
    if (!response.ok) {
      await response.body?.cancel();
      return json({ available: false });
    }
    const data = await boundedJson(response, 4096);
    if (
      data.status !== "success" ||
      ![data.hosting, data.mobile, data.proxy].every(
        (flag) => typeof flag === "boolean",
      ) ||
      publicIp(data.query) !== ip
    )
      return json({ available: false });
    const result = Response.json(
      {
        available: true,
        hosting: data.hosting,
        mobile: data.mobile,
        proxy: data.proxy,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
    if (memory)
      remember(
        memory,
        cacheKey,
        { expires: Date.now() + 3_600_000, response: result.clone() },
        100,
      );
    return result;
  } catch {
    return json({ available: false });
  }
}

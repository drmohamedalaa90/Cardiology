const NEON_AUTH_ORIGIN = "https://ep-mute-sky-zantnre1.neonauth.c-2.eu-west-2.aws.neon.tech";
const NEON_AUTH_PATH = "/neondb/auth";

function rewriteCookie(cookie) {
  const parts = cookie.split(";").map((part) => part.trim());
  const kept = parts.filter((part, index) => index === 0 || !/^domain=/i.test(part));
  const pathIndex = kept.findIndex((part, index) => index > 0 && /^path=/i.test(part));
  if (pathIndex >= 0) kept[pathIndex] = "Path=/";
  else kept.push("Path=/");
  return kept.join("; ");
}

export async function onRequest(context) {
  const { request, params } = context;
  const incoming = new URL(request.url);
  const tail = Array.isArray(params.path) ? params.path.join("/") : String(params.path || "");
  const upstreamUrl = new URL(NEON_AUTH_PATH + (tail ? "/" + tail : "") + incoming.search, NEON_AUTH_ORIGIN);

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.set("origin", request.headers.get("Origin") || incoming.origin);
  headers.set("x-forwarded-host", incoming.host);
  headers.set("x-forwarded-proto", incoming.protocol.slice(0, -1));

  const method = request.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await request.arrayBuffer();
  const upstreamResponse = await fetch(new Request(upstreamUrl, {
    method,
    headers,
    body,
    redirect: "manual"
  }));

  const responseHeaders = new Headers(upstreamResponse.headers);
  const cookies = responseHeaders.getSetCookie?.() || [];
  if (cookies.length) {
    responseHeaders.delete("set-cookie");
    for (const cookie of cookies) responseHeaders.append("set-cookie", rewriteCookie(cookie));
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

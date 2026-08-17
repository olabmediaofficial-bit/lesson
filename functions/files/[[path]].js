import { text } from "../_shared.js";

export async function onRequest(context) {
  const { request, env, params } = context;
  if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed", 405);
  if (!env.LESSON_FILES) return text("R2 bucket is not configured", 500);

  const parts = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  const key = parts.join("/");
  if (!key) return text("Not found", 404);

  const object = await env.LESSON_FILES.get(key);
  if (!object) return text("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

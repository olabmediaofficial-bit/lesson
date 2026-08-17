import { getShareOrigin, json, text } from "../_shared.js";

export function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "GET") return text("Method not allowed", 405);
  return json({ shareOrigin: getShareOrigin(request, env) });
}

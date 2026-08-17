import { adminPassword, createToken, json, readJson, text } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return text("Method not allowed", 405);

  try {
    const body = await readJson(request);
    if (body.password !== adminPassword(env)) {
      return json({ error: "Invalid password" }, 401);
    }
    return json({ token: await createToken(env) });
  } catch {
    return text("Invalid JSON", 400);
  }
}

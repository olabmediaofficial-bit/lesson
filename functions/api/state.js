import { json, mergeState, readJson, readState, requireAuth, text, writeState } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = await requireAuth(request, env);
  if (authResponse) return authResponse;

  if (request.method === "GET") {
    try {
      const state = await readState(env);
      return state ? json(state) : new Response("", { status: 204, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return json({ error: "State storage unavailable", detail: error.message || String(error) }, 500);
    }
  }

  if (request.method !== "POST") return text("Method not allowed", 405);

  try {
    const body = await readJson(request);
    const saveMode = request.headers.get("X-Save-Mode") || "merge";
    const currentState = saveMode === "overwrite" ? null : await readState(env);
    const stateToWrite = saveMode === "overwrite" ? body : mergeState(currentState, body);
    await writeState(env, stateToWrite);
    return json({ ok: true });
  } catch (error) {
    return json(
      {
        error: "Unable to save state",
        detail: error.message || String(error),
      },
      500,
    );
  }
}

import { json, readJson, requireAuth, text, uploadResourceToR2 } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = await requireAuth(request, env);
  if (authResponse) return authResponse;
  if (request.method !== "POST") return text("Method not allowed", 405);

  try {
    const body = await readJson(request);
    const resource = await uploadResourceToR2(env, body);
    return json(resource);
  } catch (error) {
    return json(
      {
        error: "Unable to upload file",
        detail: error.message || String(error),
      },
      500,
    );
  }
}

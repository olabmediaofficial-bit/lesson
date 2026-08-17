import {
  adminPassword,
  createToken,
  getShareOrigin,
  json,
  mergeState,
  readJson,
  readState,
  requireAuth,
  text,
  uploadResourceToR2,
  writeState,
} from "./functions/_shared.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/login") return handleLogin(request, env);
    if (url.pathname === "/api/state") return handleState(request, env);
    if (url.pathname === "/api/upload") return handleUpload(request, env);
    if (url.pathname === "/api/room") return handleRoom(request, env);
    if (url.pathname === "/api/info") return handleInfo(request, env);
    if (url.pathname.startsWith("/files/")) return handleFile(request, env);

    return env.ASSETS.fetch(request);
  },
};

async function handleLogin(request, env) {
  if (request.method !== "POST") return text("Method not allowed", 405);

  try {
    const body = await readJson(request);
    if (body.password !== adminPassword(env)) return json({ error: "Invalid password" }, 401);
    return json({ token: await createToken(env) });
  } catch {
    return text("Invalid JSON", 400);
  }
}

async function handleState(request, env) {
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
    return json({ error: "Unable to save state", detail: error.message || String(error) }, 500);
  }
}

async function handleUpload(request, env) {
  const authResponse = await requireAuth(request, env);
  if (authResponse) return authResponse;
  if (request.method !== "POST") return text("Method not allowed", 405);

  try {
    const body = await readJson(request);
    return json(await uploadResourceToR2(env, body));
  } catch (error) {
    return json({ error: "Unable to upload file", detail: error.message || String(error) }, 500);
  }
}

async function handleRoom(request, env) {
  if (request.method !== "GET") return text("Method not allowed", 405);

  const url = new URL(request.url);
  const roomId = url.searchParams.get("room");
  if (!roomId) return json({ error: "Room not found" }, 404);

  try {
    const state = await readState(env);
    const student = state?.students?.find((item) => item.id === roomId);
    if (!state || !student) return json({ error: "Room not found" }, 404);

    const blockIds = new Set(student.lessons.flatMap((lesson) => lesson.blockIds || []));
    const blocks = state.blocks.filter((block) => blockIds.has(block.id));
    return json({
      blocks,
      students: [student],
      resourceLibraryUrl: state.resourceLibraryUrl || "",
    });
  } catch (error) {
    return json({ error: "Room storage unavailable", detail: error.message || String(error) }, 500);
  }
}

function handleInfo(request, env) {
  if (request.method !== "GET") return text("Method not allowed", 405);
  return json({ shareOrigin: getShareOrigin(request, env) });
}

async function handleFile(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return text("Method not allowed", 405);
  if (!env.LESSON_FILES) return text("R2 bucket is not configured", 500);

  const key = new URL(request.url).pathname.replace(/^\/files\//, "");
  if (!key) return text("Not found", 404);

  const object = await env.LESSON_FILES.get(key);
  if (!object) return text("Not found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000");

  return new Response(request.method === "HEAD" ? null : object.body, { headers });
}

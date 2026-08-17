const STATE_ID = "main";
const DEFAULT_ADMIN_PASSWORD = "lesson-admin";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export function text(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("Invalid JSON");
  }
}

export async function readState(env) {
  ensureDatabase(env);
  const row = await env.LESSON_DB.prepare("select state from lesson_app_state where id = ? limit 1").bind(STATE_ID).first();
  return row?.state ? JSON.parse(row.state) : null;
}

export async function writeState(env, state) {
  ensureDatabase(env);
  await env.LESSON_DB.prepare(
    "insert into lesson_app_state (id, state, updated_at) values (?, ?, ?) on conflict(id) do update set state = excluded.state, updated_at = excluded.updated_at",
  )
    .bind(STATE_ID, JSON.stringify(state), new Date().toISOString())
    .run();
}

export async function requireAuth(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token && (await verifyToken(token, env))) return null;
  return json({ error: "Unauthorized" }, 401);
}

export async function createToken(env) {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + TOKEN_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload, tokenSecret(env));
  return `${encodedPayload}.${signature}`;
}

export async function verifyToken(token, env) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return false;
  const expected = await sign(encodedPayload, tokenSecret(env));
  if (signature !== expected) return false;

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    return Number(payload.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function adminPassword(env) {
  return env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
}

export function getShareOrigin(request, env) {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function uploadResourceToR2(env, file) {
  if (!env.LESSON_FILES) throw new Error("R2 bucket is not configured");

  const { bytes, contentType } = await readResourceBytes(file);
  const key = createStorageKey(file.name || "file", contentType);

  await env.LESSON_FILES.put(key, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000",
    },
  });

  return {
    name: file.name || "첨부 파일",
    type: contentType,
    data: `/files/${key}`,
    storagePath: key,
  };
}

async function readResourceBytes(file) {
  const data = String(file.data || "");
  const embedded = data.match(/^data:([^;]+);base64,(.+)$/);
  if (embedded) {
    return {
      contentType: file.type || embedded[1] || "application/octet-stream",
      bytes: base64ToUint8Array(embedded[2]),
    };
  }

  if (/^https?:\/\//i.test(data)) {
    const response = await fetch(data);
    if (!response.ok) {
      throw new Error(`원본 파일을 가져오지 못했습니다: ${response.status}`);
    }
    const headerType = response.headers.get("Content-Type")?.split(";")[0] || "";
    return {
      contentType: inferContentType(file.name, file.type || headerType),
      bytes: new Uint8Array(await response.arrayBuffer()),
    };
  }

  throw new Error("Invalid file data");
}

export function unique(items = []) {
  return [...new Set(items.filter(Boolean))];
}

export function mergeState(serverState, incomingState) {
  if (!serverState) return incomingState;
  return {
    ...serverState,
    ...incomingState,
    resourceLibraryUrl: incomingState.resourceLibraryUrl ?? serverState.resourceLibraryUrl ?? "",
    blocks: mergeBlocks(serverState.blocks || [], incomingState.blocks || []),
    students: mergeStudents(serverState.students || [], incomingState.students || []),
  };
}

function mergeBlocks(serverBlocks = [], incomingBlocks = []) {
  const blocks = new Map();
  serverBlocks.forEach((block) => blocks.set(block.id, block));
  incomingBlocks.forEach((block) => {
    const existing = blocks.get(block.id);
    if (!existing || isIncomingNewer(existing, block)) {
      blocks.set(block.id, { ...(existing || {}), ...block });
    }
  });
  return [...blocks.values()];
}

function mergeStudents(serverStudents = [], incomingStudents = []) {
  const students = new Map();
  serverStudents.forEach((student) => {
    students.set(student.id, {
      ...student,
      lessons: mergeLessons([], student.lessons || []),
    });
  });
  incomingStudents.forEach((student) => {
    const existing = students.get(student.id);
    students.set(student.id, {
      ...(existing || {}),
      ...student,
      lessons: mergeLessons(existing?.lessons || [], student.lessons || []),
    });
  });
  return [...students.values()];
}

function mergeLessons(serverLessons = [], incomingLessons = []) {
  const lessons = new Map();
  serverLessons.forEach((lesson) => {
    lessons.set(lesson.id, {
      ...lesson,
      blockIds: unique(lesson.blockIds || lesson.materialIds || []),
    });
  });
  incomingLessons.forEach((lesson) => {
    const existing = lessons.get(lesson.id);
    const base = existing && !isIncomingNewer(existing, lesson) ? existing : { ...(existing || {}), ...lesson };
    lessons.set(lesson.id, {
      ...base,
      blockIds: unique([...(existing?.blockIds || []), ...(lesson.blockIds || lesson.materialIds || [])]),
    });
  });
  return [...lessons.values()];
}

function isIncomingNewer(existing = {}, incoming = {}) {
  const existingTime = Date.parse(existing.updatedAt || "");
  const incomingTime = Date.parse(incoming.updatedAt || "");
  if (Number.isNaN(existingTime) && Number.isNaN(incomingTime)) return true;
  if (Number.isNaN(existingTime)) return true;
  if (Number.isNaN(incomingTime)) return false;
  return incomingTime >= existingTime;
}

function ensureDatabase(env) {
  if (!env.LESSON_DB) throw new Error("D1 database is not configured");
}

function tokenSecret(env) {
  return `${adminPassword(env)}:${env.TOKEN_SECRET || "lesson-room-token"}`;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function base64UrlEncode(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(value));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

function base64ToUint8Array(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function createStorageKey(name, contentType) {
  const extension = storageExtension(name, contentType);
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `lesson-assets/${Date.now()}-${[...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("")}${extension}`;
}

function storageExtension(name, contentType) {
  const fromName = String(name).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  if ([".png", ".jpg", ".jpeg", ".pdf", ".webp"].includes(fromName)) return fromName;
  return {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  }[contentType] || "";
}

function inferContentType(name, fallback = "") {
  const extension = String(name).toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  return (
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
    }[extension] ||
    fallback ||
    "application/octet-stream"
  );
}

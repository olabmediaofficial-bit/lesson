const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = __dirname;
const staticRoot = findStaticRoot(root);
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const dataPath = path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 5173);
const host = "0.0.0.0";
const maxBodyBytes = 150 * 1024 * 1024;
const adminPassword = process.env.ADMIN_PASSWORD || "lesson-admin";
const sessions = new Set();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
};

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function findStaticRoot(baseDir) {
  const directIndex = path.join(baseDir, "index.html");
  if (fs.existsSync(directIndex)) return baseDir;

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (["node_modules", "data", ".git"].includes(entry.name)) continue;

    const candidate = path.join(baseDir, entry.name);
    if (fs.existsSync(path.join(candidate, "index.html"))) return candidate;
  }

  return baseDir;
}

function readJsonBody(request, maxBytes = maxBodyBytes) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("Request body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(dataPath, "utf8"));
  } catch {
    return null;
  }
}

function isAuthorized(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return sessions.has(token);
}

function requireAuth(request, response) {
  if (isAuthorized(request)) return true;
  send(response, 401, JSON.stringify({ error: "Unauthorized" }), "application/json; charset=utf-8");
  return false;
}

function serveFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const rawPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(staticRoot, rawPath));

  if (!filePath.startsWith(staticRoot) || filePath.startsWith(path.join(root, "data"))) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(
        response,
        404,
        `Not found: ${rawPath}\nStatic root: ${staticRoot}\nFiles: ${fs.readdirSync(staticRoot).join(", ")}`,
      );
      return;
    }
    const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    send(response, 200, data, contentType);
  });
}

function handleApiState(request, response) {
  if (!requireAuth(request, response)) return;

  if (request.method === "GET") {
    const state = readState();
    if (!state) send(response, 204, "");
    else send(response, 200, JSON.stringify(state), "application/json; charset=utf-8");
    return;
  }

  if (request.method !== "POST") {
    send(response, 405, "Method not allowed");
    return;
  }

  readJsonBody(request)
    .then((body) => {
      fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(dataPath, JSON.stringify(body));
      send(response, 200, JSON.stringify({ ok: true }), "application/json; charset=utf-8");
    })
    .catch(() => {
      send(response, 400, "Invalid JSON");
    });
}

function handleLogin(request, response) {
  if (request.method !== "POST") {
    send(response, 405, "Method not allowed");
    return;
  }

  readJsonBody(request, 1024 * 10)
    .then((body) => {
      if (body.password !== adminPassword) {
        send(response, 401, JSON.stringify({ error: "Invalid password" }), "application/json; charset=utf-8");
        return;
      }
      const token = crypto.randomBytes(32).toString("hex");
      sessions.add(token);
      send(response, 200, JSON.stringify({ token }), "application/json; charset=utf-8");
    })
    .catch(() => {
      send(response, 400, "Invalid JSON");
    });
}

function handlePublicRoom(request, response) {
  if (request.method !== "GET") {
    send(response, 405, "Method not allowed");
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);
  const roomId = url.searchParams.get("room");
  const state = readState();
  const student = state?.students?.find((item) => item.id === roomId);

  if (!state || !student) {
    send(response, 404, JSON.stringify({ error: "Room not found" }), "application/json; charset=utf-8");
    return;
  }

  const blockIds = new Set(student.lessons.flatMap((lesson) => lesson.blockIds || []));
  const blocks = state.blocks.filter((block) => blockIds.has(block.id));
  send(response, 200, JSON.stringify({ blocks, students: [student] }), "application/json; charset=utf-8");
}

function getLocalAddress() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return "localhost";
}

function getShareOrigin(request) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, "");

  const forwardedHost = request.headers["x-forwarded-host"];
  const forwardedProto = request.headers["x-forwarded-proto"];
  const requestHost = forwardedHost || request.headers.host || `localhost:${port}`;
  const proto = forwardedProto || "http";

  if (requestHost.startsWith("localhost") || requestHost.startsWith("127.0.0.1")) {
    return `http://${getLocalAddress()}:${port}`;
  }

  return `${proto}://${requestHost}`;
}

const server = http.createServer((request, response) => {
  if (request.url.startsWith("/api/login")) {
    handleLogin(request, response);
    return;
  }
  if (request.url.startsWith("/api/state")) {
    handleApiState(request, response);
    return;
  }
  if (request.url.startsWith("/api/room")) {
    handlePublicRoom(request, response);
    return;
  }
  if (request.url.startsWith("/api/info")) {
    send(
      response,
      200,
      JSON.stringify({ shareOrigin: getShareOrigin(request) }),
      "application/json; charset=utf-8",
    );
    return;
  }
  serveFile(request, response);
});

server.listen(port, host, () => {
  console.log(`Lesson Room server running at http://localhost:${port}`);
  console.log(`Static files served from ${staticRoot}`);
  console.log("Open this from another device using this Mac's Wi-Fi IP address.");
});

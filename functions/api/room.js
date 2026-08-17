import { json, readState, text } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
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

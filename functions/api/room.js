import { json, readJson, readState, text, writeState } from "../_shared.js";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const roomId = url.searchParams.get("room");
  if (!roomId) return json({ error: "Room not found" }, 404);

  try {
    const state = await readState(env);
    const student = state?.students?.find((item) => item.id === roomId);

    if (!state || !student) return json({ error: "Room not found" }, 404);

    if (request.method === "POST") {
      const body = await readJson(request);
      student.theoryPractice = sanitizeTheoryPractice(body.theoryPractice);
      await writeState(env, state);
      return json({ ok: true });
    }
    if (request.method !== "GET") return text("Method not allowed", 405);

    const blockIds = new Set(student.lessons.flatMap((lesson) => lesson.blockIds || []));
    const blocks = state.blocks.filter((block) => blockIds.has(block.id));
    const customChords = (state.customChords || []).filter((chord) => !chord.studentId || chord.studentId === student.id);
    const rhythmIds = new Set(blocks.flatMap((block) => block.rhythms || []));
    const customRhythms = (state.customRhythms || []).filter((rhythm) => rhythmIds.has(rhythm.id));
    return json({
      blocks,
      students: [student],
      customChords,
      customRhythms,
      practiceProgressScale: state.practiceProgressScale || "four-step",
      resourceLibraryUrl: state.resourceLibraryUrl || "",
      usefulSites: state.usefulSites,
    });
  } catch (error) {
    return json({ error: "Room storage unavailable", detail: error.message || String(error) }, 500);
  }
}

function sanitizeTheoryPractice(value = {}) {
  const tables = value?.diatonic?.tables && typeof value.diatonic.tables === "object" ? value.diatonic.tables : {};
  const sanitizeRows = (rows = {}) => Object.fromEntries(Object.entries(rows).slice(0, 20).map(([key, values]) => [
    String(key).slice(0, 20),
    {
      scale: Array.from({ length: 8 }, (_, index) => String(values?.scale?.[index] || "").slice(0, 40)),
      chords: Array.from({ length: 8 }, (_, index) => String(values?.chords?.[index] || values?.[index] || "").slice(0, 40)),
    },
  ]));
  return {
    fretboard: {
      cells: Array.from({ length: 36 }, (_, index) => String(value?.fretboard?.cells?.[index] || "").slice(0, 20)),
      scaleNames: Array.from({ length: 7 }, (_, index) => String(value?.fretboard?.scaleNames?.[index] || "").slice(0, 20)),
    },
    triads: { rows: sanitizeChordRows(value?.triads?.rows, 3) },
    sevenths: { rows: sanitizeChordRows(value?.sevenths?.rows, 4) },
    diatonic: {
      tables: Object.fromEntries(Object.entries(tables).slice(0, 4).map(([type, rows]) => [String(type).slice(0, 20), sanitizeRows(rows)])),
    },
  };
}

function sanitizeChordRows(rows = {}, length = 3) {
  return Object.fromEntries(Object.entries(rows && typeof rows === "object" ? rows : {}).slice(0, 20).map(([key, values]) => [
    String(key).slice(0, 20),
    Array.from({ length }, (_, index) => String(values?.[index] || "").slice(0, 20)),
  ]));
}

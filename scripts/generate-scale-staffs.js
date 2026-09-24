const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "scale-staffs");
const letterIndex = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

const scales = [
  { key: "C", notes: ["C", "D", "E", "F", "G", "A", "B"], signature: [] },
  { key: "Db", notes: ["Db", "Eb", "F", "Gb", "Ab", "Bb", "C"], signature: ["Bb", "Eb", "Ab", "Db", "Gb"] },
  { key: "D", notes: ["D", "E", "F#", "G", "A", "B", "C#"], signature: ["F#", "C#"] },
  { key: "Eb", notes: ["Eb", "F", "G", "Ab", "Bb", "C", "D"], signature: ["Bb", "Eb", "Ab"] },
  { key: "E", notes: ["E", "F#", "G#", "A", "B", "C#", "D#"], signature: ["F#", "C#", "G#", "D#"] },
  { key: "F", notes: ["F", "G", "A", "Bb", "C", "D", "E"], signature: ["Bb"] },
  { key: "F#", notes: ["F#", "G#", "A#", "B", "C#", "D#", "E#"], signature: ["F#", "C#", "G#", "D#", "A#", "E#"] },
  { key: "G", notes: ["G", "A", "B", "C", "D", "E", "F#"], signature: ["F#"] },
  { key: "Ab", notes: ["Ab", "Bb", "C", "Db", "Eb", "F", "G"], signature: ["Bb", "Eb", "Ab", "Db"] },
  { key: "A", notes: ["A", "B", "C#", "D", "E", "F#", "G#"], signature: ["F#", "C#", "G#"] },
  { key: "Bb", notes: ["Bb", "C", "D", "Eb", "F", "G", "A"], signature: ["Bb", "Eb"] },
  { key: "B", notes: ["B", "C#", "D#", "E", "F#", "G#", "A#"], signature: ["F#", "C#", "G#", "D#", "A#"] },
];

const signatureY = {
  "F#": 48, "C#": 72, "G#": 40, "D#": 64, "A#": 88, "E#": 56,
  Bb: 80, Eb: 56, Ab: 88, Db: 64, Gb: 96,
};

function fileKey(key) {
  return key.replace("#", "-sharp").replace("b", "-flat");
}

function staffY(letter, octave) {
  const degree = octave * 7 + letterIndex[letter];
  const e4 = 4 * 7 + letterIndex.E;
  return 112 - (degree - e4) * 8;
}

function notePositions(scale) {
  const notes = [...scale.notes, scale.notes[0]];
  let octave = 4;
  let previous = letterIndex[notes[0][0]];
  return notes.map((note, index) => {
    const current = letterIndex[note[0]];
    if (index > 0 && current <= previous) octave += 1;
    previous = current;
    return { note, y: staffY(note[0], octave) };
  });
}

function svgFor(scale) {
  const width = 900;
  const height = 230;
  const signature = scale.signature.map((symbol, index) => {
    const accidental = symbol.includes("#") ? "♯" : "♭";
    return `<text x="${98 + index * 19}" y="${signatureY[symbol] + 10}" font-family="Georgia, serif" font-size="31" font-weight="700">${accidental}</text>`;
  }).join("");
  const startX = 160 + scale.signature.length * 15;
  const step = (820 - startX) / 7;
  const notes = notePositions(scale).map(({ note, y }, index) => {
    const x = startX + index * step;
    const ledger = y >= 128
      ? `<line x1="${x - 18}" y1="128" x2="${x + 18}" y2="128" stroke="#2f2925" stroke-width="2" />`
      : y <= 32
        ? `<line x1="${x - 18}" y1="32" x2="${x + 18}" y2="32" stroke="#2f2925" stroke-width="2" />`
        : "";
    const stemDown = y <= 72;
    const stem = stemDown
      ? `<line x1="${x - 10}" y1="${y + 2}" x2="${x - 10}" y2="${y + 42}" stroke="#2f2925" stroke-width="3" />`
      : `<line x1="${x + 10}" y1="${y - 2}" x2="${x + 10}" y2="${y - 42}" stroke="#2f2925" stroke-width="3" />`;
    return `${ledger}<ellipse cx="${x}" cy="${y}" rx="12" ry="8" fill="#2f2925" transform="rotate(-17 ${x} ${y})" />${stem}<text x="${x}" y="188" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#5f4b3d">${note}</text>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${scale.key} major scale">
  <rect width="900" height="230" rx="12" fill="#fffdf9" />
  ${[48, 64, 80, 96, 112].map((y) => `<line x1="42" y1="${y}" x2="858" y2="${y}" stroke="#574b43" stroke-width="2" />`).join("\n  ")}
  <text x="43" y="118" font-family="Georgia, serif" font-size="91" fill="#2f2925">𝄞</text>
  ${signature}
  ${notes}
  <text x="450" y="218" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#8a7567">${scale.key} MAJOR SCALE</text>
</svg>\n`;
}

fs.mkdirSync(output, { recursive: true });
for (const scale of scales) {
  fs.writeFileSync(path.join(output, `${fileKey(scale.key)}-major.svg`), svgFor(scale));
}
console.log(`Generated ${scales.length} scale staff images in ${output}`);

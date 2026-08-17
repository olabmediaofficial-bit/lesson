const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "public");
const files = ["index.html", "app.js", "styles.css", "somun-paradise.png"];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}

console.log(`Cloudflare static files copied to ${output}`);

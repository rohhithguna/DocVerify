const fs = require("fs");
const path = require("path");

const tsconfigPath = path.join(
  __dirname,
  "..",
  "node_modules",
  "html2canvas",
  "tsconfig.json"
);

try {
  if (!fs.existsSync(tsconfigPath)) {
    process.exit(0);
  }

  const raw = fs.readFileSync(tsconfigPath, "utf8");
  const json = JSON.parse(raw);

  // Published html2canvas package does not ship src/, which triggers
  // "No inputs were found" diagnostics in some editors.
  // Use a non-excluded file so tsserver can resolve a valid project input.
  json.include = ["package.json"];
  if (json.compilerOptions) {
    json.compilerOptions.types = [];
  }

  fs.writeFileSync(tsconfigPath, JSON.stringify(json, null, 4) + "\n", "utf8");
  process.exit(0);
} catch (error) {
  console.error("[postinstall] Failed to patch html2canvas tsconfig:", error);
  process.exit(0);
}

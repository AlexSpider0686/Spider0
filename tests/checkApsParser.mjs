import fs from "node:fs";

const [, , ...inputPaths] = process.argv;

if (!inputPaths.length) {
  console.error("Usage: node --loader ./tests/esm-loader.mjs ./tests/checkApsParser.mjs <pdf1> <pdf2> ...");
  process.exit(1);
}

const { parseApsProjectPdf } = await import("../src/lib/apsProjectParser.js");

function toFileObject(path) {
  const buffer = fs.readFileSync(path);
  return {
    name: path.split(/[\\/]/u).at(-1) || path,
    async arrayBuffer() {
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    },
  };
}

function printTop(title, list, mapper) {
  console.log(`  ${title}:`);
  if (!list.length) {
    console.log("    -");
    return;
  }
  list.forEach((item) => {
    console.log(`    ${mapper(item)}`);
  });
}

for (const path of inputPaths) {
  console.log(`\n=== ${path} ===`);
  try {
    const parsed = await parseApsProjectPdf(toFileObject(path));
    const metrics = parsed.metrics || {};
    const quality = parsed.parseQuality || {};

    console.log(`pages: ${parsed.pages}, scannedRows: ${parsed.linesScanned}`);
    console.log(
      `recognized: ${parsed.items.length}, unresolved: ${parsed.unrecognizedRows?.length || 0}, recognitionRate: ${(
        (quality.recognitionRate || 0) * 100
      ).toFixed(1)}%`
    );
    console.log(
      `detectors: ${metrics.detectorsQty || 0}, panels: ${metrics.panelQty || 0}, notifications: ${metrics.notificationQty || 0}, cableM: ${(
        metrics.cableLengthM || 0
      ).toFixed(1)}, fasteners: ${metrics.fastenerQty || 0}`
    );

    const firstItems = (parsed.items || []).slice(0, 8);
    printTop(
      "first items",
      firstItems,
      (item) =>
        `${item.position || "-"} | ${item.name || "-"} | ${item.model || "-"} | ${item.qty || 0} ${item.unit || ""}`.trim()
    );

    const unresolved = (parsed.unrecognizedRows || []).slice(0, 8);
    printTop(
      "unresolved",
      unresolved,
      (row) => `${row.position || "-"} | ${row.reason || "-"} | ${(row.rawLine || "").slice(0, 160)}`
    );
  } catch (error) {
    console.log(`ERROR: ${error?.message || error}`);
  }
}

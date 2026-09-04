const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");
const xlsx = require("xlsx");

/**
 * Normalizes object key strings by trimming and lowercasing.
 */
const normalizeKeys = (row) => {
  const normalized = {};
  for (const key of Object.keys(row)) {
    const cleanKey = key.trim().toLowerCase().replace(/[\s_\-]+/g, "");
    normalized[cleanKey] = typeof row[key] === "string" ? row[key].trim() : row[key];
    // Keep original key as well for fallback
    normalized[key] = row[key];
  }
  return normalized;
};

/**
 * Parses a CSV or Excel lead file and returns an array of normalized row objects.
 * @param {string} filePath - Absolute path to the uploaded file.
 * @returns {Promise<Array<Object>>} List of row objects.
 */
const parseLeadFile = async (filePath) => {
  const ext = path.extname(filePath).toLowerCase();

  let rawRows = [];

  if (ext === ".csv") {
    rawRows = await new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on("data", (data) => rows.push(data))
        .on("end", () => resolve(rows))
        .on("error", (err) => reject(err));
    });
  } else {
    const workbook = xlsx.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
  }

  return rawRows.map(normalizeKeys);
};

module.exports = parseLeadFile;

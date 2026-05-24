#!/usr/bin/env node

import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptsDir, "..");
const nomenclaturesPath = path.join(projectRoot, "data/reference/nomenclatures.json");
const canonicalCaseFiles = [path.join(projectRoot, "public/data/cases.geojson")];

const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", "coverage", ".next"]);
const ignoredRelativePrefixes = ["data/reference/", "data/schemas/"];

const fallbackReservedBusinessFields = [
  "terrain_cat",
  "terrain_type",
  "relief",
  "terrain_secondaire",
  "faction",
  "peuple",
  "bonus_speciaux",
  "empl_base",
  "empl_max",
  "controleur",
  "controle_type",
  "note_publique",
  "note_staff",
];

const coreFields = ["id_case", "region", "sous_region", "cote", "lac_majeur", "cours_eau_majeur"];
const waterBooleanFields = ["cote", "lac_majeur", "cours_eau_majeur"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toRelativePath(targetPath) {
  return path.relative(projectRoot, targetPath).split(path.sep).join("/");
}

function isNilOrEmpty(value) {
  return value === undefined || value === null || value === "";
}

function pushIssue(issues, scope, propertyPath, messages) {
  issues.push({
    scope,
    propertyPath,
    messages: Array.isArray(messages) ? messages : [messages],
  });
}

async function loadJson(jsonPath) {
  const raw = await readFile(jsonPath, "utf8");
  return JSON.parse(raw);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        results.push(...(await walkFiles(path.join(directory, entry.name))));
      }
      continue;
    }

    if (entry.isFile()) {
      results.push(path.join(directory, entry.name));
    }
  }

  return results;
}

function isCasesDataFile(filePath) {
  const relativePath = toRelativePath(filePath);
  const fileName = path.basename(filePath).toLowerCase();

  if (ignoredRelativePrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    return false;
  }

  return /^cases.*\.(json|geojson)$/i.test(fileName);
}

async function discoverCaseFiles() {
  const existingCanonicalCaseFiles = [];

  for (const filePath of canonicalCaseFiles) {
    if (await fileExists(filePath)) {
      existingCanonicalCaseFiles.push(filePath);
    }
  }

  if (existingCanonicalCaseFiles.length > 0) {
    return existingCanonicalCaseFiles;
  }

  const files = await walkFiles(projectRoot);
  return files.filter((filePath) => isCasesDataFile(filePath)).sort((left, right) => left.localeCompare(right));
}

function extractCases(data, filePath) {
  const relativePath = toRelativePath(filePath);
  const issues = [];

  if (Array.isArray(data)) {
    return {
      cases: data.map((item, index) => ({
        record: item,
        geometry: null,
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}[${index}]`,
        requiresGeometry: false,
      })),
      issues,
    };
  }

  if (!isPlainObject(data)) {
    pushIssue(issues, `[file ${relativePath}]`, "root", "Unsupported JSON root. Expected an array, a GeoJSON FeatureCollection, a GeoJSON Feature, or an object with a cases array.");
    return { cases: [], issues };
  }

  if (data.type === "FeatureCollection") {
    if (!Array.isArray(data.features)) {
      pushIssue(issues, `[file ${relativePath}]`, "features", "Invalid GeoJSON FeatureCollection. Expected a features array.");
      return { cases: [], issues };
    }

    return {
      cases: data.features.map((feature, index) => ({
        record: isPlainObject(feature) ? feature.properties : undefined,
        geometry: isPlainObject(feature) ? feature.geometry : undefined,
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}.features[${index}].properties`,
        requiresGeometry: true,
      })),
      issues,
    };
  }

  if (data.type === "Feature") {
    return {
      cases: [
        {
          record: data.properties,
          geometry: data.geometry,
          scope: "[feature #1]",
          sourcePath: `${relativePath}.properties`,
          requiresGeometry: true,
        },
      ],
      issues,
    };
  }

  if (Array.isArray(data.cases)) {
    return {
      cases: data.cases.map((item, index) => ({
        record: item,
        geometry: null,
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}.cases[${index}]`,
        requiresGeometry: false,
      })),
      issues,
    };
  }

  pushIssue(issues, `[file ${relativePath}]`, "root", "Unsupported cases format. Expected a GeoJSON FeatureCollection or a JSON array of case records.");
  return { cases: [], issues };
}

function validateReferenceData(nomenclatures) {
  const issues = [];

  for (const key of ["case_core_fields", "water_boolean_fields", "reserved_business_fields"]) {
    if (!Array.isArray(nomenclatures[key])) {
      pushIssue(issues, "[reference data/reference/nomenclatures.json]", key, `Expected an array for ${key}.`);
    }
  }

  return issues;
}

function validateGeometry(geometry, context) {
  const issues = [];

  if (!isPlainObject(geometry)) {
    pushIssue(issues, context.scope, "geometry", "Missing or invalid geometry. Expected a GeoJSON Polygon or MultiPolygon.");
    return issues;
  }

  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon") {
    pushIssue(issues, context.scope, "geometry.type", `Invalid geometry type "${geometry.type}". Expected Polygon or MultiPolygon.`);
  }

  if (!Array.isArray(geometry.coordinates)) {
    pushIssue(issues, context.scope, "geometry.coordinates", "Missing or invalid geometry coordinates.");
  }

  return issues;
}

function validateCaseRecord(caseRecord, context) {
  const { scope, seenIds, reservedBusinessFields, relativePath, geometry, requiresGeometry } = context;
  const issues = [];

  if (!isPlainObject(caseRecord)) {
    pushIssue(issues, scope, "properties", `Invalid case payload in ${relativePath}. Expected an object for feature.properties.`);
    return issues;
  }

  const rawId = caseRecord.id_case;
  const hasValidId = typeof rawId === "string" && rawId.trim().length > 0;
  const normalizedId = hasValidId ? rawId.trim() : "";
  const effectiveScope = hasValidId ? `[case ${normalizedId}]` : scope;

  if (!hasValidId) {
    pushIssue(issues, effectiveScope, "properties.id_case", "Missing or empty id_case.");
  } else if (seenIds.has(normalizedId)) {
    pushIssue(issues, effectiveScope, "properties.id_case", `Duplicate id_case "${normalizedId}" across validated files.`);
  } else {
    seenIds.add(normalizedId);
  }

  for (const field of ["region", "sous_region"]) {
    const value = caseRecord[field];
    if (value !== undefined && value !== null && (typeof value !== "string" || value.trim().length === 0)) {
      pushIssue(issues, effectiveScope, `properties.${field}`, `Invalid ${field}. Expected a non-empty string or null.`);
    }
  }

  for (const field of waterBooleanFields) {
    const value = caseRecord[field];
    if (value !== undefined && value !== null && value !== true && value !== false) {
      pushIssue(issues, effectiveScope, `properties.${field}`, [`Invalid value ${JSON.stringify(value)}.`, "Expected boolean true, boolean false, or null."]);
    }
  }

  for (const field of reservedBusinessFields) {
    if (!isNilOrEmpty(caseRecord[field])) {
      pushIssue(issues, effectiveScope, `properties.${field}`, `${field} is a business field and must not be stored in the stable cases layer.`);
    }
  }

  for (const field of Object.keys(caseRecord)) {
    if (!coreFields.includes(field) && !reservedBusinessFields.includes(field)) {
      pushIssue(issues, effectiveScope, `properties.${field}`, `Unknown field "${field}" in stable cases layer. Expected one of: ${coreFields.join(", ")}.`);
    }
  }

  if (requiresGeometry) {
    issues.push(...validateGeometry(geometry, { scope: effectiveScope }));
  }

  return issues;
}

function formatIssues(issues) {
  const lines = [`Validation failed: ${issues.length} error(s)`, ""];

  for (const issue of issues) {
    lines.push(`${issue.scope} ${issue.propertyPath}`);
    for (const message of issue.messages) {
      lines.push(`  ${message}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

async function resolveCandidateFiles(args) {
  if (args.length === 0) {
    return discoverCaseFiles();
  }

  return args.map((inputPath) => path.resolve(process.cwd(), inputPath));
}

async function loadNomenclatures() {
  try {
    return await loadJson(nomenclaturesPath);
  } catch {
    return {
      reserved_business_fields: fallbackReservedBusinessFields,
    };
  }
}

async function main() {
  const nomenclatures = await loadNomenclatures();
  const issues = validateReferenceData(nomenclatures);
  const reservedBusinessFields = Array.isArray(nomenclatures.reserved_business_fields)
    ? nomenclatures.reserved_business_fields
    : fallbackReservedBusinessFields;
  const candidateFiles = await resolveCandidateFiles(process.argv.slice(2));
  const seenIds = new Set();
  let checkedCases = 0;

  for (const filePath of candidateFiles) {
    const relativePath = toRelativePath(filePath);
    let data;

    try {
      data = await loadJson(filePath);
    } catch (error) {
      pushIssue(issues, `[file ${relativePath}]`, "root", `Unable to read or parse JSON: ${error.message}`);
      continue;
    }

    const extraction = extractCases(data, filePath);
    issues.push(...extraction.issues);

    for (const item of extraction.cases) {
      checkedCases += 1;
      issues.push(
        ...validateCaseRecord(item.record, {
          scope: item.scope,
          seenIds,
          reservedBusinessFields,
          relativePath,
          geometry: item.geometry,
          requiresGeometry: item.requiresGeometry,
        }),
      );
    }
  }

  if (issues.length > 0) {
    console.error(formatIssues(issues));
    process.exitCode = 1;
    return;
  }

  if (candidateFiles.length === 0) {
    console.log("Data validation passed: 0 case(s) checked. No cases data file found in the repository.");
    process.exitCode = 0;
    return;
  }

  console.log(`Data validation passed: ${checkedCases} case(s) checked.`);
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(`Validation failed: unexpected error\n\n${error.stack ?? error.message}`);
  process.exitCode = 1;
});

#!/usr/bin/env node

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptPath);
const projectRoot = path.resolve(scriptsDir, "..");

const schemaPath = path.join(projectRoot, "data/schemas/cases.schema.json");
const nomenclaturesPath = path.join(projectRoot, "data/reference/nomenclatures.json");
const emplacementsRulesPath = path.join(projectRoot, "data/reference/emplacements_rules.json");

const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", "coverage", ".next"]);
const ignoredRelativePrefixes = ["data/reference/", "data/schemas/"];

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

async function walkFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) {
        continue;
      }
      results.push(...(await walkFiles(entryPath)));
      continue;
    }

    if (entry.isFile()) {
      results.push(entryPath);
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
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}[${index}]`,
      })),
      issues,
    };
  }

  if (!isPlainObject(data)) {
    pushIssue(
      issues,
      `[file ${relativePath}]`,
      "root",
      "Unsupported JSON root. Expected an array, a GeoJSON FeatureCollection, a GeoJSON Feature, or an object with a cases array."
    );
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
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}.features[${index}].properties`,
      })),
      issues,
    };
  }

  if (data.type === "Feature") {
    return {
      cases: [{ record: data.properties, scope: "[feature #1]", sourcePath: `${relativePath}.properties` }],
      issues,
    };
  }

  if (Array.isArray(data.cases)) {
    return {
      cases: data.cases.map((item, index) => ({
        record: item,
        scope: `[feature #${index + 1}]`,
        sourcePath: `${relativePath}.cases[${index}]`,
      })),
      issues,
    };
  }

  pushIssue(issues, `[file ${relativePath}]`, "root", "Unsupported cases format. Expected a GeoJSON FeatureCollection or a JSON array of cases.");
  return { cases: [], issues };
}

function getAllowedTerrainTypes(terrainCat, nomenclatures) {
  if (!terrainCat || !isPlainObject(nomenclatures.terrain_type_by_cat)) {
    return [];
  }

  const values = nomenclatures.terrain_type_by_cat[terrainCat];
  return Array.isArray(values) ? values : [];
}

function hasMajorWater(caseRecord) {
  return caseRecord.cote === true || caseRecord.lac_majeur === true || caseRecord.cours_eau_majeur === true;
}

function matchesConditions(ruleConditions, caseRecord) {
  if (!isPlainObject(ruleConditions)) {
    return true;
  }

  return Object.entries(ruleConditions).every(([key, expected]) => {
    if (key === "terrain_cat_any") {
      return Array.isArray(expected) && expected.includes(caseRecord.terrain_cat);
    }

    if (key === "terrain_type_any") {
      return Array.isArray(expected) && expected.includes(caseRecord.terrain_type);
    }

    if (key === "eau_majeure") {
      return expected === hasMajorWater(caseRecord);
    }

    return caseRecord[key] === expected;
  });
}

function expandPeopleSelector(selector, peopleGroups) {
  if (Array.isArray(selector)) {
    return selector.flatMap((value) => expandPeopleSelector(value, peopleGroups));
  }

  if (typeof selector !== "string" || selector.length === 0) {
    return [];
  }

  if (Array.isArray(peopleGroups?.[selector])) {
    return peopleGroups[selector];
  }

  return [selector];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getBonusSpecialRulesById(emplacementsRules) {
  return new Map((emplacementsRules.bonus_by_special ?? []).map((rule) => [rule.id, rule]));
}

function calculateExpectedEmplacements(caseRecord, emplacementsRules) {
  const terrainBase = emplacementsRules.base_by_terrain_type?.[caseRecord.terrain_type];
  if (!Number.isInteger(terrainBase)) {
    return { expectedBase: null, expectedMax: null };
  }

  let reliefModifiers = 0;
  for (const rule of emplacementsRules.relief_modifiers ?? []) {
    if (caseRecord.relief === rule.relief && matchesConditions(rule.conditions, caseRecord)) {
      reliefModifiers += Number(rule.modifier) || 0;
    }
  }

  const expectedBase = terrainBase + reliefModifiers;
  let modifiers = 0;
  const peopleGroups = emplacementsRules.people_groups ?? {};

  for (const rule of emplacementsRules.bonus_by_people ?? []) {
    const eligiblePeople = expandPeopleSelector(rule.people, peopleGroups);
    if (eligiblePeople.includes(caseRecord.peuple_majoritaire) && matchesConditions(rule.conditions, caseRecord)) {
      modifiers += Number(rule.modifier) || 0;
    }
  }

  const specialRulesById = getBonusSpecialRulesById(emplacementsRules);
  const bonusSpeciaux = Array.isArray(caseRecord.bonus_speciaux) ? caseRecord.bonus_speciaux : [];

  for (const bonusId of bonusSpeciaux) {
    const rule = specialRulesById.get(bonusId);
    if (rule && matchesConditions(rule.conditions, caseRecord)) {
      modifiers += Number(rule.modifier) || 0;
    }
  }

  const min = emplacementsRules.bounds?.min ?? 1;
  const max = emplacementsRules.bounds?.max ?? 5;

  return { expectedBase, expectedMax: clamp(expectedBase + modifiers, min, max) };
}

function validateNomenclatures(schema, nomenclatures, emplacementsRules) {
  const issues = [];
  const schemaProperties = schema?.items?.properties ?? {};
  const expectedArrayKeys = ["terrain_cat", "terrain_type", "relief", "controle_type", "peuple_majoritaire", "faction", "bonus_special"];

  for (const key of expectedArrayKeys) {
    if (!Array.isArray(nomenclatures[key])) {
      pushIssue(issues, "[reference data/reference/nomenclatures.json]", key, `Expected an array for "${key}".`);
    }
  }

  if (!isPlainObject(nomenclatures.terrain_type_by_cat)) {
    pushIssue(issues, "[reference data/reference/nomenclatures.json]", "terrain_type_by_cat", 'Expected an object for "terrain_type_by_cat".');
  } else {
    for (const [terrainCat, terrainTypes] of Object.entries(nomenclatures.terrain_type_by_cat)) {
      if (!nomenclatures.terrain_cat?.includes(terrainCat)) {
        pushIssue(issues, "[reference data/reference/nomenclatures.json]", `terrain_type_by_cat.${terrainCat}`, `Unknown terrain_cat "${terrainCat}".`);
      }

      if (!Array.isArray(terrainTypes)) {
        pushIssue(issues, "[reference data/reference/nomenclatures.json]", `terrain_type_by_cat.${terrainCat}`, "Expected an array of terrain types.");
        continue;
      }

      for (const terrainType of terrainTypes) {
        if (!nomenclatures.terrain_type?.includes(terrainType)) {
          pushIssue(issues, "[reference data/reference/nomenclatures.json]", `terrain_type_by_cat.${terrainCat}`, `Unknown terrain_type "${terrainType}" referenced by terrain_cat "${terrainCat}".`);
        }
      }
    }
  }

  const schemaToNomenclatureChecks = [
    ["terrain_cat", schemaProperties.terrain_cat?.enum],
    ["terrain_type", schemaProperties.terrain_type?.enum],
    ["relief", schemaProperties.relief?.enum?.filter((value) => value !== null)],
    ["controle_type", schemaProperties.controle_type?.enum?.filter((value) => value !== null)],
    ["bonus_special", schemaProperties.bonus_speciaux?.items?.enum],
  ];

  for (const [key, schemaValues] of schemaToNomenclatureChecks) {
    if (!Array.isArray(nomenclatures[key]) || !Array.isArray(schemaValues)) {
      continue;
    }

    const missingFromSchema = nomenclatures[key].filter((value) => !schemaValues.includes(value));
    const missingFromNomenclatures = schemaValues.filter((value) => !nomenclatures[key].includes(value));

    if (missingFromSchema.length > 0) {
      pushIssue(issues, "[reference consistency]", key, `Values present in nomenclatures but missing from schema: ${missingFromSchema.join(", ")}`);
    }

    if (missingFromNomenclatures.length > 0) {
      pushIssue(issues, "[reference consistency]", key, `Values present in schema but missing from nomenclatures: ${missingFromNomenclatures.join(", ")}`);
    }
  }

  if (!isPlainObject(emplacementsRules.base_by_terrain_type)) {
    pushIssue(issues, "[reference data/reference/emplacements_rules.json]", "base_by_terrain_type", 'Expected an object for "base_by_terrain_type".');
  } else {
    for (const [terrainType, value] of Object.entries(emplacementsRules.base_by_terrain_type)) {
      if (!nomenclatures.terrain_type?.includes(terrainType)) {
        pushIssue(issues, "[reference data/reference/emplacements_rules.json]", `base_by_terrain_type.${terrainType}`, `Unknown terrain_type "${terrainType}".`);
      }
      if (!Number.isInteger(value)) {
        pushIssue(issues, "[reference data/reference/emplacements_rules.json]", `base_by_terrain_type.${terrainType}`, "Expected an integer base value.");
      }
    }
  }

  for (const rule of emplacementsRules.relief_modifiers ?? []) {
    if (!nomenclatures.relief?.includes(rule.relief)) {
      pushIssue(issues, "[reference data/reference/emplacements_rules.json]", "relief_modifiers", `Unknown relief "${rule.relief}".`);
    }
  }

  if (isPlainObject(emplacementsRules.people_groups)) {
    for (const [groupName, people] of Object.entries(emplacementsRules.people_groups)) {
      if (!Array.isArray(people)) {
        pushIssue(issues, "[reference data/reference/emplacements_rules.json]", `people_groups.${groupName}`, "Expected an array of people identifiers.");
        continue;
      }
      for (const peopleId of people) {
        if (!nomenclatures.peuple_majoritaire?.includes(peopleId)) {
          pushIssue(issues, "[reference data/reference/emplacements_rules.json]", `people_groups.${groupName}`, `Unknown peuple_majoritaire "${peopleId}".`);
        }
      }
    }
  }

  for (const rule of emplacementsRules.bonus_by_special ?? []) {
    if (!nomenclatures.bonus_special?.includes(rule.id)) {
      pushIssue(issues, "[reference data/reference/emplacements_rules.json]", "bonus_by_special", `Unknown bonus_special "${rule.id}".`);
    }
  }

  return issues;
}

function validateStrictBoolean(caseRecord, key, issues, scope) {
  if (caseRecord[key] !== undefined && caseRecord[key] !== null && caseRecord[key] !== true && caseRecord[key] !== false) {
    pushIssue(issues, scope, `properties.${key}`, [`Invalid value ${JSON.stringify(caseRecord[key])}.`, "Expected boolean true, boolean false, or null."]);
  }
}

function validateCaseRecord(caseRecord, context) {
  const { scope, seenIds, nomenclatures, emplacementsRules, relativePath } = context;
  const issues = [];

  if (!isPlainObject(caseRecord)) {
    pushIssue(issues, scope, "properties", `Invalid case payload in ${relativePath}. Expected an object for feature.properties.`);
    return issues;
  }

  const rawId = caseRecord.id_case;
  const hasValidId = typeof rawId === "string" && rawId.trim().length > 0;
  const effectiveScope = hasValidId ? `[case ${rawId.trim()}]` : scope;

  if (!hasValidId) {
    pushIssue(issues, effectiveScope, "properties.id_case", "Missing or empty id_case.");
  } else if (seenIds.has(rawId.trim())) {
    pushIssue(issues, effectiveScope, "properties.id_case", `Duplicate id_case "${rawId.trim()}" across validated files.`);
  } else {
    seenIds.add(rawId.trim());
  }

  if (!isNilOrEmpty(caseRecord.terrain_secondaire)) {
    pushIssue(issues, effectiveScope, "properties.terrain_secondaire", "terrain_secondaire is deprecated. Use relief instead.");
  }

  const terrainCat = caseRecord.terrain_cat;
  if (typeof terrainCat !== "string" || terrainCat.length === 0) {
    pushIssue(issues, effectiveScope, "properties.terrain_cat", "Missing terrain_cat.");
  } else if (!nomenclatures.terrain_cat.includes(terrainCat)) {
    pushIssue(issues, effectiveScope, "properties.terrain_cat", [`Invalid terrain_cat "${terrainCat}".`, `Expected one of: ${nomenclatures.terrain_cat.join(", ")}`]);
  }

  const terrainType = caseRecord.terrain_type;
  if (typeof terrainType !== "string" || terrainType.length === 0) {
    pushIssue(issues, effectiveScope, "properties.terrain_type", "Missing terrain_type.");
  } else if (!nomenclatures.terrain_type.includes(terrainType)) {
    pushIssue(issues, effectiveScope, "properties.terrain_type", [`Invalid terrain_type "${terrainType}".`, `Expected one of: ${nomenclatures.terrain_type.join(", ")}`]);
  } else if (typeof terrainCat === "string" && nomenclatures.terrain_cat.includes(terrainCat)) {
    const allowedTerrainTypes = getAllowedTerrainTypes(terrainCat, nomenclatures);
    if (allowedTerrainTypes.length > 0 && !allowedTerrainTypes.includes(terrainType)) {
      pushIssue(issues, effectiveScope, "properties.terrain_type", [`Invalid terrain_type "${terrainType}" for terrain_cat "${terrainCat}".`, `Expected one of: ${allowedTerrainTypes.join(", ")}`]);
    }
  }

  if (!isNilOrEmpty(caseRecord.relief) && !nomenclatures.relief.includes(caseRecord.relief)) {
    pushIssue(issues, effectiveScope, "properties.relief", [`Invalid relief "${caseRecord.relief}".`, `Expected one of: ${nomenclatures.relief.join(", ")}, null`]);
  }

  validateStrictBoolean(caseRecord, "cote", issues, effectiveScope);
  validateStrictBoolean(caseRecord, "lac_majeur", issues, effectiveScope);
  validateStrictBoolean(caseRecord, "cours_eau_majeur", issues, effectiveScope);

  if (!isNilOrEmpty(caseRecord.peuple_majoritaire) && !nomenclatures.peuple_majoritaire.includes(caseRecord.peuple_majoritaire)) {
    pushIssue(issues, effectiveScope, "properties.peuple_majoritaire", [`Invalid peuple_majoritaire "${caseRecord.peuple_majoritaire}".`, `Expected one of: ${nomenclatures.peuple_majoritaire.join(", ")}`]);
  }

  if (!isNilOrEmpty(caseRecord.controle_type) && !nomenclatures.controle_type.includes(caseRecord.controle_type)) {
    pushIssue(issues, effectiveScope, "properties.controle_type", [`Invalid controle_type "${caseRecord.controle_type}".`, `Expected one of: ${nomenclatures.controle_type.join(", ")}`]);
  }

  if (!isNilOrEmpty(caseRecord.faction) && Array.isArray(nomenclatures.faction) && !nomenclatures.faction.includes(caseRecord.faction)) {
    pushIssue(issues, effectiveScope, "properties.faction", [`Invalid faction "${caseRecord.faction}".`, `Expected one of: ${nomenclatures.faction.join(", ")}`]);
  }

  const specialRulesById = getBonusSpecialRulesById(emplacementsRules);
  if (caseRecord.bonus_speciaux !== undefined && caseRecord.bonus_speciaux !== null && !Array.isArray(caseRecord.bonus_speciaux)) {
    pushIssue(issues, effectiveScope, "properties.bonus_speciaux", "Invalid bonus_speciaux. Expected an array of strings or null.");
  }

  if (Array.isArray(caseRecord.bonus_speciaux)) {
    for (const bonusId of caseRecord.bonus_speciaux) {
      if (typeof bonusId !== "string") {
        pushIssue(issues, effectiveScope, "properties.bonus_speciaux", `Invalid bonus special value ${JSON.stringify(bonusId)}. Expected a string identifier.`);
        continue;
      }

      if (!nomenclatures.bonus_special.includes(bonusId) && !specialRulesById.has(bonusId)) {
        pushIssue(issues, effectiveScope, "properties.bonus_speciaux", `Unknown bonus special "${bonusId}".`);
        continue;
      }

      const rule = specialRulesById.get(bonusId);
      if (rule && !matchesConditions(rule.conditions, caseRecord)) {
        pushIssue(issues, effectiveScope, "properties.bonus_speciaux", `Bonus special "${bonusId}" is not applicable to this case.`);
      }
    }
  }

  const { expectedBase, expectedMax } = calculateExpectedEmplacements(caseRecord, emplacementsRules);
  if (expectedBase !== null) {
    if (!Number.isInteger(caseRecord.empl_base)) {
      pushIssue(issues, effectiveScope, "properties.empl_base", `Missing or invalid empl_base. Expected integer ${expectedBase}.`);
    } else if (caseRecord.empl_base !== expectedBase) {
      pushIssue(issues, effectiveScope, "properties.empl_base", `Invalid empl_base ${caseRecord.empl_base}. Expected ${expectedBase} from terrain_type and relief.`);
    }

    if (!Number.isInteger(caseRecord.empl_max)) {
      pushIssue(issues, effectiveScope, "properties.empl_max", `Missing or invalid empl_max. Expected integer ${expectedMax}.`);
    } else {
      if (caseRecord.empl_max < 1 || caseRecord.empl_max > 5) {
        pushIssue(issues, effectiveScope, "properties.empl_max", `Invalid empl_max ${caseRecord.empl_max}. Expected an integer between 1 and 5.`);
      }
      if (caseRecord.empl_max !== expectedMax) {
        pushIssue(issues, effectiveScope, "properties.empl_max", `Invalid empl_max ${caseRecord.empl_max}. Expected ${expectedMax} from emplacements_rules.json.`);
      }
    }
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

async function main() {
  const schema = await loadJson(schemaPath);
  const nomenclatures = await loadJson(nomenclaturesPath);
  const emplacementsRules = await loadJson(emplacementsRulesPath);
  const issues = validateNomenclatures(schema, nomenclatures, emplacementsRules);
  const candidateFiles = await resolveCandidateFiles(process.argv.slice(2));
  let checkedCases = 0;

  for (const filePath of candidateFiles) {
    const relativePath = toRelativePath(filePath);
    const seenIds = new Set();
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
          nomenclatures,
          emplacementsRules,
          relativePath,
        })
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

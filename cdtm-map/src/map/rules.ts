export const LITTORAL_WATER_LOGICAL_GROUP = "littoral_et_eaux_majeures";

export const TERRAIN_DEFINITIONS = [
  {
    slug: "prairie",
    category: "plaine",
    label: "Prairie",
    emplacements_base: 5,
  },
  {
    slug: "plaine_aride",
    category: "plaine",
    label: "Plaine aride",
    emplacements_base: 5,
  },
  { slug: "bocage", category: "plaine", label: "Bocage", emplacements_base: 4 },
  {
    slug: "toundra",
    category: "plaine",
    label: "Toundra",
    emplacements_base: 3,
  },
  { slug: "foret", category: "foret", label: "Foret", emplacements_base: 3 },
  { slug: "taiga", category: "foret", label: "Taiga", emplacements_base: 3 },
  {
    slug: "foret_luxuriante",
    category: "foret",
    label: "Foret luxuriante",
    emplacements_base: 2,
  },
  {
    slug: "montagne",
    category: "montagne",
    label: "Montagne",
    emplacements_base: 2,
  },
  {
    slug: "montagne_riche",
    category: "montagne",
    label: "Montagne riche",
    emplacements_base: 2,
  },
  { slug: "marais", category: "marais", label: "Marais", emplacements_base: 2 },
  { slug: "desert", category: "desert", label: "Desert", emplacements_base: 1 },
  {
    slug: "terres_gelees",
    category: "desert",
    label: "Terres gelees",
    emplacements_base: 1,
  },
  {
    slug: "terre_desolee",
    category: "desert",
    label: "Terre desolee",
    emplacements_base: 1,
  },
] as const;

export type TerrainDefinition = (typeof TERRAIN_DEFINITIONS)[number];

export const TERRAIN_DEFINITIONS_BY_SLUG: Record<string, TerrainDefinition> =
  Object.fromEntries(
    TERRAIN_DEFINITIONS.map((terrain) => [terrain.slug, terrain]),
  ) as Record<string, TerrainDefinition>;

export const PEUPLE_MODIFICATEURS_V1 = [
  {
    peuple_slug: "orques",
    type_declencheur: "terrain",
    declencheur: "terre_desolee",
    valeur: 4,
  },
  {
    peuple_slug: "orques",
    type_declencheur: "terrain",
    declencheur: "montagne",
    valeur: 2,
  },
  {
    peuple_slug: "nains",
    type_declencheur: "terrain",
    declencheur: "montagne",
    valeur: 3,
  },
  {
    peuple_slug: "nains",
    type_declencheur: "attribut",
    declencheur: "colline",
    valeur: 1,
  },
  {
    peuple_slug: "hobbits",
    type_declencheur: "attribut",
    declencheur: "colline",
    valeur: 2,
  },
  {
    peuple_slug: "hobbits",
    type_declencheur: "terrain",
    declencheur: "marais",
    valeur: 1,
  },
  {
    peuple_slug: "nandor",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 2,
  },
  {
    peuple_slug: "noldor",
    type_declencheur: "terrain",
    declencheur: "montagne",
    valeur: 1,
  },
  {
    peuple_slug: "noldor",
    type_declencheur: "attribut",
    declencheur: "colline",
    valeur: 1,
  },
  {
    peuple_slug: "noldor",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 1,
  },
  {
    peuple_slug: "sindar",
    type_declencheur: "groupe_logique",
    declencheur: LITTORAL_WATER_LOGICAL_GROUP,
    valeur: 1,
    groupe_logique: LITTORAL_WATER_LOGICAL_GROUP,
  },
  {
    peuple_slug: "sindar",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 1,
  },
  {
    peuple_slug: "avari",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 2,
  },
  {
    peuple_slug: "lossoths",
    type_declencheur: "terrain",
    declencheur: "terres_gelees",
    valeur: 2,
  },
  {
    peuple_slug: "enedwaithrim",
    type_declencheur: "attribut",
    declencheur: "colline",
    valeur: 1,
  },
  {
    peuple_slug: "enedwaithrim",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 1,
  },
  {
    peuple_slug: "druedain",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 2,
  },
  {
    peuple_slug: "haradrim",
    type_declencheur: "terrain",
    declencheur: "desert",
    valeur: 2,
  },
  {
    peuple_slug: "heritiers_numenor",
    type_declencheur: "attribut",
    declencheur: "colline",
    valeur: 1,
  },
  {
    peuple_slug: "heritiers_numenor",
    type_declencheur: "groupe_logique",
    declencheur: LITTORAL_WATER_LOGICAL_GROUP,
    valeur: 1,
    groupe_logique: LITTORAL_WATER_LOGICAL_GROUP,
  },
  {
    peuple_slug: "umbareens",
    type_declencheur: "groupe_logique",
    declencheur: LITTORAL_WATER_LOGICAL_GROUP,
    valeur: 1,
    groupe_logique: LITTORAL_WATER_LOGICAL_GROUP,
  },
  {
    peuple_slug: "hommes_vertbois",
    type_declencheur: "terrain",
    declencheur: "foret",
    valeur: 1,
  },
] as const satisfies readonly PeupleModifier[];

export type RuleTriggerType = "terrain" | "attribut" | "groupe_logique";

export type PeupleModifier = {
  peuple_slug: string;
  type_declencheur: RuleTriggerType;
  declencheur: string;
  valeur: number;
  groupe_logique?: string | null;
  description?: string | null;
};

export type ContextualBonus = {
  slug: string;
  label?: string | null;
  valeur: number;
  description?: string | null;
};

export type CaseRuleAttributes = {
  cote?: boolean | null;
  lac?: boolean | null;
  fluvial?: boolean | null;
  colline?: boolean | null;
};

export type SlotConsumer = {
  consumes_slot: boolean;
  emp_requis: number;
};

export type LocalityUpgradeValidationInput = {
  current_id?: string | null;
  current_case_id?: string | null;
  dependency_id?: string | null;
  expected_previous_type_key?: string | null;
  dependency_type_key?: string | null;
  dependency_case_id?: string | null;
  dependency_status?: string | null;
};

export type AppliedModifierLine = {
  source: "terrain_base" | "attribut" | "peuple" | "bonus_contextuel";
  label: string;
  valeur: number;
  declencheur?: string;
  type_declencheur?: RuleTriggerType;
};

export type SlotCalculationUnavailable = {
  available: false;
  reason: string;
  modifiers: AppliedModifierLine[];
};

export type SlotCalculationAvailable = {
  available: true;
  emplacements_base: number;
  malus_colline: number;
  modificateur_peuple: number;
  bonus_contextuel: number;
  emplacements_bruts: number;
  emplacements_max: number;
  emplacements_utilises: number;
  emplacements_restants: number;
  depassement: boolean;
  modifiers: AppliedModifierLine[];
};

export type SlotCalculationResult =
  | SlotCalculationUnavailable
  | SlotCalculationAvailable;

export type CalculateSlotsInput = {
  terrain_type?: string | null;
  peuple_slug?: string | null;
  attributes?: CaseRuleAttributes;
  peuple_modificateurs?: readonly PeupleModifier[];
  bonus_contextuels?: readonly ContextualBonus[];
  emplacements_utilises?: number | null;
};

export function clampSlots(value: number): number {
  return Math.min(Math.max(value, 1), 5);
}

export function countConsumedSlots(consumers: readonly SlotConsumer[]): number {
  return consumers.reduce((total, consumer) => {
    if (!consumer.consumes_slot) {
      return total;
    }

    return total + Math.max(0, Math.trunc(consumer.emp_requis));
  }, 0);
}

export function validateLocalityUpgradeLink(
  input: LocalityUpgradeValidationInput,
): { valid: boolean; reason?: string } {
  const dependencyId = input.dependency_id?.trim() ?? "";

  if (!dependencyId) {
    return { valid: true };
  }

  if (input.current_id && dependencyId === input.current_id) {
    return {
      valid: false,
      reason: "Une localite ne peut pas dependre d'elle-meme.",
    };
  }

  if (!input.expected_previous_type_key) {
    return {
      valid: false,
      reason: "Ce type de localite ne declare pas d'amelioration.",
    };
  }

  if (input.dependency_status === "archived") {
    return {
      valid: false,
      reason: "La localite amelioree ne peut pas etre archivee.",
    };
  }

  if (input.dependency_type_key !== input.expected_previous_type_key) {
    return {
      valid: false,
      reason: "La localite amelioree n'a pas le type attendu.",
    };
  }

  if (
    !input.current_case_id ||
    !input.dependency_case_id ||
    input.current_case_id !== input.dependency_case_id
  ) {
    return {
      valid: false,
      reason: "Une amelioration doit rester sur la meme case.",
    };
  }

  return { valid: true };
}

export function isLogicalGroupActive(
  group: string,
  attributes: CaseRuleAttributes,
): boolean {
  if (group === LITTORAL_WATER_LOGICAL_GROUP) {
    return (
      attributes.cote === true ||
      attributes.lac === true ||
      attributes.fluvial === true
    );
  }

  return false;
}

function isAttributeActive(
  attribute: string,
  attributes: CaseRuleAttributes,
): boolean {
  return attributes[attribute as keyof CaseRuleAttributes] === true;
}

export function calculateCaseSlots(
  input: CalculateSlotsInput,
): SlotCalculationResult {
  const terrainSlug = input.terrain_type?.trim() ?? "";

  if (!terrainSlug) {
    return {
      available: false,
      reason: "calcul indisponible : terrain principal non renseigné",
      modifiers: [],
    };
  }

  const terrain = TERRAIN_DEFINITIONS_BY_SLUG[terrainSlug];

  if (!terrain) {
    return {
      available: false,
      reason: `calcul indisponible : terrain principal inconnu (${terrainSlug})`,
      modifiers: [],
    };
  }

  const attributes = input.attributes ?? {};
  const peupleSlug = input.peuple_slug?.trim() ?? "";
  const modifiers: AppliedModifierLine[] = [
    {
      source: "terrain_base",
      label: `Terrain principal : ${terrain.slug}`,
      valeur: terrain.emplacements_base,
      declencheur: terrain.slug,
      type_declencheur: "terrain",
    },
  ];

  const malusColline = attributes.colline === true ? -1 : 0;

  if (malusColline !== 0) {
    modifiers.push({
      source: "attribut",
      label: "Malus technique : colline",
      valeur: malusColline,
      declencheur: "colline",
      type_declencheur: "attribut",
    });
  }

  let peupleModifierTotal = 0;
  const appliedLogicalGroups = new Set<string>();

  for (const modifier of input.peuple_modificateurs ?? []) {
    if (!peupleSlug || modifier.peuple_slug !== peupleSlug) {
      continue;
    }

    let applies = false;
    const logicalGroup =
      modifier.groupe_logique ??
      (modifier.type_declencheur === "groupe_logique"
        ? modifier.declencheur
        : null);

    if (logicalGroup) {
      applies = isLogicalGroupActive(logicalGroup, attributes);

      if (applies && appliedLogicalGroups.has(logicalGroup)) {
        continue;
      }
    } else if (modifier.type_declencheur === "terrain") {
      applies = modifier.declencheur === terrain.slug;
    } else if (modifier.type_declencheur === "attribut") {
      applies = isAttributeActive(modifier.declencheur, attributes);
    }

    if (!applies) {
      continue;
    }

    if (logicalGroup) {
      appliedLogicalGroups.add(logicalGroup);
    }

    peupleModifierTotal += modifier.valeur;
    modifiers.push({
      source: "peuple",
      label: modifier.description ?? `${peupleSlug} : ${modifier.declencheur}`,
      valeur: modifier.valeur,
      declencheur: modifier.declencheur,
      type_declencheur: modifier.type_declencheur,
    });
  }

  const contextualBonusTotal = (input.bonus_contextuels ?? []).reduce(
    (total, bonus) => {
      modifiers.push({
        source: "bonus_contextuel",
        label: bonus.label ?? bonus.slug,
        valeur: bonus.valeur,
        declencheur: bonus.slug,
      });

      return total + bonus.valeur;
    },
    0,
  );

  const rawSlots =
    terrain.emplacements_base +
    malusColline +
    peupleModifierTotal +
    contextualBonusTotal;
  const maxSlots = clampSlots(rawSlots);
  const usedSlots = Math.max(0, Math.trunc(input.emplacements_utilises ?? 0));

  return {
    available: true,
    emplacements_base: terrain.emplacements_base,
    malus_colline: malusColline,
    modificateur_peuple: peupleModifierTotal,
    bonus_contextuel: contextualBonusTotal,
    emplacements_bruts: rawSlots,
    emplacements_max: maxSlots,
    emplacements_utilises: usedSlots,
    emplacements_restants: maxSlots - usedSlots,
    depassement: usedSlots > maxSlots,
    modifiers,
  };
}

export function validateSlotConsumption(
  calculation: SlotCalculationResult,
  nextConsumers: readonly SlotConsumer[],
  options: { force?: boolean | null } = {},
): {
  valid: boolean;
  forced: boolean;
  depassement: boolean;
  emplacements_utilises: number | null;
  reason?: string;
} {
  if (!calculation.available) {
    return {
      valid: options.force === true,
      forced: options.force === true,
      depassement: false,
      emplacements_utilises: null,
      reason: calculation.reason,
    };
  }

  const emplacementsUtilises = countConsumedSlots(nextConsumers);
  const depassement = emplacementsUtilises > calculation.emplacements_max;

  return {
    valid: !depassement || options.force === true,
    forced: depassement && options.force === true,
    depassement,
    emplacements_utilises: emplacementsUtilises,
    reason: depassement ? "emplacements insuffisants" : undefined,
  };
}

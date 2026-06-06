import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";

import type {
  AdminBlockMeta,
  AdminBonusContextuel,
  AdminBulkEditDraft,
  AdminCaseDraft,
  AdminCaseRecord,
  AdminDynamicSectionRecord,
} from "@/admin/types";
import { Button } from "@/components/ui/button";
import type { StableCaseProperties } from "@/map/types";

type StaticAdminDraftSection = "public" | "terrain" | "control";

type CaseAdminEditorProps = {
  activeCase: StableCaseProperties | null;
  selectedCaseIds: string[];
  activeAdminRecord: AdminCaseRecord | null;
  selectedAdminRecords: AdminCaseRecord[];
  singleDraft: AdminCaseDraft;
  bulkDraft: AdminBulkEditDraft;
  adminLoading: boolean;
  adminSaving: boolean;
  adminError: string | null;
  adminDirty: boolean;
  onSingleFieldChange: (
    section: StaticAdminDraftSection,
    field: string,
    value: string,
  ) => void;
  onSingleBonusContextuelsChange: (bonusSlugs: string[]) => void;
  onDynamicFieldChange: (
    tableKey: string,
    field: string,
    value: string,
  ) => void;
  onBulkFieldChange: (
    section: keyof AdminBulkEditDraft,
    field: string,
    value: string,
  ) => void;
  onBulkBonusContextuelsChange: (bonusSlugs: string[]) => void;
  onCancelEdit: () => void;
  onSave: () => void;
};

type BulkFieldState = {
  value: string;
  touched: boolean;
  mixed: boolean;
};

type SelectFieldOption =
  | string
  | { value: string; label: string; peuple_key?: string | null };

const fieldClassName =
  "w-full rounded-[16px] border border-border/80 bg-background/55 px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

const booleanOptions = [
  { label: "Non renseigne", value: "" },
  { label: "Oui", value: "true" },
  { label: "Non", value: "false" },
] as const;

const controlActorTypeOptions = ["faction", "controleur"] as const;

function formatMeta(meta: AdminBlockMeta | null | undefined): string {
  if (!meta?.updated_at) {
    return "Aucune sauvegarde";
  }

  const updatedAt = new Date(meta.updated_at).toLocaleString("fr-FR");
  return meta.updated_by ? `${updatedAt} par ${meta.updated_by}` : updatedAt;
}

function summarizeMeta(metas: AdminBlockMeta[]): string {
  if (metas.length === 0) {
    return "Aucune sauvegarde";
  }

  const normalized = metas.map(
    (meta) => `${meta.updated_at ?? ""}|${meta.updated_by ?? ""}`,
  );
  const uniqueValues = Array.from(new Set(normalized));

  return uniqueValues.length === 1
    ? formatMeta(metas[0])
    : "Sauvegardes variables";
}

function getTerrainTypeOptions(
  record: AdminCaseRecord | null,
  category: string | null | undefined,
): SelectFieldOption[] {
  if (!record || !category) {
    return [];
  }

  return record.reference_data.terrain_types_by_category[category] ?? [];
}

function renderBulkHelper(field: BulkFieldState): string | undefined {
  if (field.touched) {
    return "Cette valeur sera appliquee a toute la selection.";
  }

  if (field.mixed) {
    return "Valeur differente selon la selection.";
  }

  return undefined;
}

function renderBulkListHelper(field: {
  touched: boolean;
  mixed: boolean;
}): string | undefined {
  if (field.touched) {
    return "Cette liste remplacera les bonus de toute la selection.";
  }

  if (field.mixed) {
    return "Bonus differents selon la selection.";
  }

  return undefined;
}

function formatBonusOption(option: AdminBonusContextuel): string {
  const signedValue =
    option.valeur > 0 ? `+${option.valeur}` : String(option.valeur);
  return `${option.label} (${signedValue})`;
}

function getControlActorIdOptions(
  actorType: string,
  factionOptions: SelectFieldOption[],
  controllerOptions: SelectFieldOption[],
): SelectFieldOption[] {
  if (actorType === "faction") {
    return factionOptions;
  }

  if (actorType === "controleur") {
    return controllerOptions;
  }

  return [];
}

function getSelectOptionValue(option: SelectFieldOption): string {
  return typeof option === "string" ? option : option.value;
}

function getSelectOptionLabel(option: SelectFieldOption): string {
  return typeof option === "string" ? option : option.label;
}

function normalizeOptionSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 first:pt-0 last:border-b-0 last:pb-0">
      <p className="shrink-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-right text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SectionTitle({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h3 className="text-xl font-semibold text-foreground">{title}</h3>
      {meta ? (
        <p className="text-right text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {meta}
        </p>
      ) : null}
    </div>
  );
}

function CollapsibleSection({
  title,
  meta,
  children,
  defaultOpen = false,
  variant = "default",
}: {
  title: string;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "default" | "primary";
}) {
  const className =
    variant === "primary"
      ? "rounded-[24px] border border-primary/25 bg-primary/8 p-4"
      : "rounded-[24px] border border-border/70 bg-background/40 p-4";

  return (
    <details className={`${className} group`} open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
        <SectionTitle title={title} meta={meta} />
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function FormRow({
  label,
  children,
  helper,
  mixed = false,
}: {
  label: string;
  children: ReactNode;
  helper?: string;
  mixed?: boolean;
}) {
  return (
    <div className="border-b border-border/50 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="grid gap-3 sm:grid-cols-[8.25rem_minmax(12rem,1fr)] sm:items-start">
        <div className="flex min-w-0 items-center gap-2 sm:pt-2">
          <p className="min-w-0 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          {mixed ? (
            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
              Etat mixte
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          {children}
          {helper ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {helper}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SelectField({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: readonly SelectFieldOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const selectedOption = options.find(
    (option) => getSelectOptionValue(option) === value,
  );
  const selectedLabel = value
    ? selectedOption
      ? getSelectOptionLabel(selectedOption)
      : value
    : "";
  const normalizedQuery = normalizeOptionSearch(query);
  const filteredOptions = useMemo(
    () =>
      normalizedQuery
        ? options.filter((option) => {
            const optionValue = getSelectOptionValue(option);
            const optionLabel = getSelectOptionLabel(option);
            const haystack = normalizeOptionSearch(
              `${optionLabel} ${optionValue}`,
            );

            return haystack.includes(normalizedQuery);
          })
        : [...options],
    [normalizedQuery, options],
  );
  const visibleOptions = useMemo(
    () => [{ value: "", label: "Non renseigne" }, ...filteredOptions],
    [filteredOptions],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  function commitValue(nextValue: string) {
    const nextOption = options.find(
      (option) => getSelectOptionValue(option) === nextValue,
    );

    onChange(nextValue);
    setQuery(nextOption ? getSelectOptionLabel(nextOption) : "");
    setHighlightedIndex(0);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) =>
        Math.min(index + 1, visibleOptions.length - 1),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter" && open) {
      event.preventDefault();
      const option = visibleOptions[highlightedIndex];

      if (option) {
        commitValue(getSelectOptionValue(option));
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(selectedLabel);
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <input
        className={`${fieldClassName} pr-10`}
        value={open ? query : selectedLabel}
        placeholder="Non renseigne"
        title={selectedLabel || undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        disabled={disabled}
        onFocus={() => {
          setQuery("");
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onClick={() => {
          setQuery("");
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlightedIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition hover:bg-background/70 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        aria-label={value ? "Vider la selection" : "Ouvrir la liste"}
        disabled={disabled}
        onClick={() => {
          if (value) {
            commitValue("");
            return;
          }

          setQuery("");
          setHighlightedIndex(0);
          setOpen((current) => !current);
        }}
      >
        {value ? "x" : <ChevronDown className="size-4" />}
      </button>
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute right-0 top-[calc(100%+0.35rem)] z-50 max-h-[min(18rem,45dvh)] w-full min-w-[min(24rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[16px] border border-border/80 bg-background/98 p-1 shadow-[0_18px_50px_hsl(var(--shadow)/0.45)]"
        >
          {visibleOptions.length === 1 && filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Aucun resultat.
            </p>
          ) : null}
          {visibleOptions.map((option, index) => {
            const optionValue = getSelectOptionValue(option);
            const optionLabel = getSelectOptionLabel(option);
            const selected = optionValue === value;

            return (
              <button
                key={optionValue || "__empty__"}
                type="button"
                role="option"
                aria-selected={selected}
                className={`flex w-full min-w-0 items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-left text-sm transition ${
                  highlightedIndex === index
                    ? "bg-primary/18 text-foreground"
                    : "text-foreground hover:bg-background/70"
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitValue(optionValue);
                }}
              >
                <span className="min-w-0 whitespace-normal break-words leading-5">
                  {optionLabel}
                </span>
                {selected ? (
                  <span className="shrink-0 text-xs uppercase tracking-[0.16em] text-primary">
                    Actif
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function BooleanField({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className={fieldClassName}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
    >
      {booleanOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function CheckboxListField({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: readonly AdminBonusContextuel[];
  value: readonly string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const selected = new Set(value);

  if (options.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Aucun bonus contextuel disponible.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const checked = selected.has(option.slug);

        return (
          <label
            key={option.slug}
            className="flex items-start gap-3 rounded-[12px] border border-border/60 bg-background/35 px-3 py-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={checked}
              disabled={disabled}
              onChange={(event) => {
                if (event.target.checked) {
                  onChange([...value, option.slug]);
                } else {
                  onChange(value.filter((slug) => slug !== option.slug));
                }
              }}
            />
            <span>
              <span className="font-medium">{formatBonusOption(option)}</span>
              {option.description ? (
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function DynamicFieldInput({
  section,
  fieldKey,
  disabled,
  draft,
  onDynamicFieldChange,
}: {
  section: AdminDynamicSectionRecord;
  fieldKey: string;
  disabled: boolean;
  draft: AdminCaseDraft;
  onDynamicFieldChange: (
    tableKey: string,
    field: string,
    value: string,
  ) => void;
}) {
  const field = section.fields.find((item) => item.field_key === fieldKey);

  if (!field) {
    return null;
  }

  const value = draft.dynamic[section.table_key]?.[field.field_key] ?? "";

  if (field.field_type === "boolean") {
    return (
      <BooleanField
        value={value}
        onChange={(nextValue) =>
          onDynamicFieldChange(section.table_key, field.field_key, nextValue)
        }
        disabled={disabled}
      />
    );
  }

  if (field.field_type === "reference") {
    return (
      <select
        className={fieldClassName}
        value={value}
        onChange={(event) =>
          onDynamicFieldChange(
            section.table_key,
            field.field_key,
            event.target.value,
          )
        }
        disabled={disabled}
      >
        <option value="">Non renseigne</option>
        {field.reference_options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.field_type === "textarea") {
    return (
      <textarea
        className={`${fieldClassName} min-h-24 resize-y`}
        value={value}
        onChange={(event) =>
          onDynamicFieldChange(
            section.table_key,
            field.field_key,
            event.target.value,
          )
        }
        disabled={disabled}
      />
    );
  }

  return (
    <input
      className={fieldClassName}
      type={field.field_type === "integer" ? "number" : "text"}
      value={value}
      onChange={(event) =>
        onDynamicFieldChange(
          section.table_key,
          field.field_key,
          event.target.value,
        )
      }
      disabled={disabled}
    />
  );
}

export function CaseAdminEditor(props: CaseAdminEditorProps) {
  const {
    activeCase,
    selectedCaseIds,
    activeAdminRecord,
    selectedAdminRecords,
    singleDraft,
    bulkDraft,
    adminLoading,
    adminSaving,
    adminError,
    adminDirty,
    onSingleFieldChange,
    onSingleBonusContextuelsChange,
    onDynamicFieldChange,
    onBulkFieldChange,
    onBulkBonusContextuelsChange,
    onCancelEdit,
    onSave,
  } = props;

  const isMultiSelection = selectedCaseIds.length > 1;
  const terrainCategoryOptions =
    activeAdminRecord?.reference_data.terrain_categories ?? [];
  const bulkTerrainCategory =
    bulkDraft.terrain.terrain_cat.mixed &&
    !bulkDraft.terrain.terrain_cat.touched
      ? ""
      : bulkDraft.terrain.terrain_cat.value;
  const singleTerrainTypeOptions = getTerrainTypeOptions(
    activeAdminRecord,
    singleDraft.terrain.terrain_cat,
  );
  const bulkTerrainTypeOptions = getTerrainTypeOptions(
    activeAdminRecord,
    bulkTerrainCategory,
  );
  const bonusContextuelOptions =
    activeAdminRecord?.reference_data.bonus_contextuel_options ?? [];
  const selectedBonusContextuels = isMultiSelection
    ? bulkDraft.bonus_contextuels.value
    : (singleDraft.bonus_contextuels ?? []);
  const peupleOptions =
    activeAdminRecord?.reference_data.peuple_options ?? [];
  const factionOptions =
    activeAdminRecord?.reference_data.faction_options ?? [];
  const controllerOptions =
    activeAdminRecord?.reference_data.controller_options ?? [];
  const controlTypeOptions =
    activeAdminRecord?.reference_data.control_type_options ?? [];
  const selectedSecondaryActorType = isMultiSelection
    ? bulkDraft.control.controle_secondaire_type.value
    : singleDraft.control.controle_secondaire_type;
  const secondaryActorOptions = getControlActorIdOptions(
    selectedSecondaryActorType,
    factionOptions,
    controllerOptions,
  );
  const publicMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.public.meta))
    : formatMeta(activeAdminRecord?.public.meta);
  const terrainMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.terrain.meta))
    : formatMeta(activeAdminRecord?.terrain.meta);
  const controlMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.control.meta))
    : formatMeta(activeAdminRecord?.control.meta);
  const dynamicSections = !isMultiSelection
    ? (activeAdminRecord?.dynamic_sections ?? [])
    : [];
  const selectionKey = `${activeCase?.id_case ?? "none"}:${selectedCaseIds.join(",")}`;
  const slotSummary =
    !isMultiSelection && activeAdminRecord
      ? activeAdminRecord.emplacements.available
        ? `${activeAdminRecord.emplacements.emplacements_restants}/${activeAdminRecord.emplacements.emplacements_max} restants`
        : activeAdminRecord.emplacements.reason
      : "Non renseigne";
  const terrainSecondaireOptions = Object.values(
    activeAdminRecord?.reference_data.terrain_types_by_category ?? {},
  )
    .flat();

  function resolvePeupleForControlSelection(
    faction: string,
    controleur: string,
  ): string {
    if (controleur) {
      return (
        activeAdminRecord?.reference_data.controller_options.find(
          (option) => option.value === controleur,
        )?.peuple_key ?? ""
      );
    }

    if (faction) {
      return (
        activeAdminRecord?.reference_data.faction_options.find(
          (option) => option.value === faction,
        )?.peuple_key ?? ""
      );
    }

    return "";
  }

  function handleSingleControlFieldChange(field: string, value: string) {
    const previousAutoPeuple = resolvePeupleForControlSelection(
      singleDraft.control.faction,
      singleDraft.control.controleur,
    );
    onSingleFieldChange("control", field, value);

    if (field !== "faction" && field !== "controleur") {
      return;
    }

    const nextFaction =
      field === "faction" ? value : singleDraft.control.faction;
    const nextControleur =
      field === "controleur" ? value : singleDraft.control.controleur;
    const currentPeuple = singleDraft.control.peuple.trim();

    if (currentPeuple && currentPeuple !== previousAutoPeuple) {
      return;
    }

    onSingleFieldChange(
      "control",
      "peuple",
      resolvePeupleForControlSelection(nextFaction, nextControleur),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSection
        key={`summary:${selectionKey}`}
        title="Modification de case"
        defaultOpen
        variant="primary"
      >
        <div className="mt-4">
          <CompactInfoRow
            label="Cases selectionnees"
            value={String(selectedCaseIds.length)}
          />
          <CompactInfoRow
            label="Case active"
            value={activeCase?.id_case ?? "Aucune"}
          />
          <CompactInfoRow label="Emplacements" value={slotSummary} />
        </div>
        {adminLoading ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Chargement des donnees admin...
          </p>
        ) : null}
      </CollapsibleSection>

      <CollapsibleSection
        key={`public:${selectionKey}`}
        title="Case"
        meta={publicMeta}
      >
        <div className="mt-4">
          {!isMultiSelection ? (
            <FormRow label="id_case">
              <input
                className={fieldClassName}
                value={singleDraft.public.id_case}
                onChange={(event) =>
                  onSingleFieldChange("public", "id_case", event.target.value)
                }
                disabled={adminLoading || adminSaving}
              />
            </FormRow>
          ) : null}
          <FormRow
            label="Region"
            mixed={isMultiSelection ? bulkDraft.public.region.mixed : false}
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.public.region)
                : undefined
            }
          >
            <input
              className={fieldClassName}
              value={
                isMultiSelection
                  ? bulkDraft.public.region.value
                  : singleDraft.public.region
              }
              onChange={(event) =>
                isMultiSelection
                  ? onBulkFieldChange("public", "region", event.target.value)
                  : onSingleFieldChange("public", "region", event.target.value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Sous-region"
            mixed={
              isMultiSelection ? bulkDraft.public.sous_region.mixed : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.public.sous_region)
                : undefined
            }
          >
            <input
              className={fieldClassName}
              value={
                isMultiSelection
                  ? bulkDraft.public.sous_region.value
                  : singleDraft.public.sous_region
              }
              onChange={(event) =>
                isMultiSelection
                  ? onBulkFieldChange(
                      "public",
                      "sous_region",
                      event.target.value,
                    )
                  : onSingleFieldChange(
                      "public",
                      "sous_region",
                      event.target.value,
                    )
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          {(["cote", "lac", "fluvial"] as const).map((field) => (
            <FormRow
              key={field}
              label={field}
              mixed={isMultiSelection ? bulkDraft.public[field].mixed : false}
              helper={
                isMultiSelection
                  ? renderBulkHelper(bulkDraft.public[field])
                  : undefined
              }
            >
              <BooleanField
                value={
                  isMultiSelection
                    ? bulkDraft.public[field].value
                    : singleDraft.public[field]
                }
                onChange={(value) =>
                  isMultiSelection
                    ? onBulkFieldChange("public", field, value)
                    : onSingleFieldChange("public", field, value)
                }
                disabled={adminLoading || adminSaving}
              />
            </FormRow>
          ))}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        key={`terrain:${selectionKey}`}
        title="Terrain"
        meta={terrainMeta}
      >
        <div className="mt-4">
          <FormRow
            label="Categorie"
            mixed={
              isMultiSelection ? bulkDraft.terrain.terrain_cat.mixed : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.terrain.terrain_cat)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.terrain.terrain_cat.value
                  : singleDraft.terrain.terrain_cat
              }
              options={terrainCategoryOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("terrain", "terrain_cat", value)
                  : onSingleFieldChange("terrain", "terrain_cat", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Type"
            mixed={
              isMultiSelection ? bulkDraft.terrain.terrain_type.mixed : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.terrain.terrain_type)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.terrain.terrain_type.value
                  : singleDraft.terrain.terrain_type
              }
              options={
                isMultiSelection
                  ? bulkTerrainTypeOptions
                  : singleTerrainTypeOptions
              }
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("terrain", "terrain_type", value)
                  : onSingleFieldChange("terrain", "terrain_type", value)
              }
              disabled={
                adminLoading ||
                adminSaving ||
                (isMultiSelection
                  ? bulkTerrainTypeOptions
                  : singleTerrainTypeOptions
                ).length === 0
              }
            />
          </FormRow>
          <FormRow
            label="Terrain secondaire"
            mixed={
              isMultiSelection
                ? bulkDraft.terrain.terrain_secondaire.mixed
                : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.terrain.terrain_secondaire)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.terrain.terrain_secondaire.value
                  : singleDraft.terrain.terrain_secondaire
              }
              options={terrainSecondaireOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("terrain", "terrain_secondaire", value)
                  : onSingleFieldChange("terrain", "terrain_secondaire", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Colline"
            mixed={isMultiSelection ? bulkDraft.terrain.colline.mixed : false}
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.terrain.colline)
                : undefined
            }
          >
            <BooleanField
              value={
                isMultiSelection
                  ? bulkDraft.terrain.colline.value
                  : singleDraft.terrain.colline
              }
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("terrain", "colline", value)
                  : onSingleFieldChange("terrain", "colline", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        key={`control:${selectionKey}`}
        title="Controle"
        meta={controlMeta}
      >
        <div className="mt-4">
          <FormRow
            label="Peuple"
            mixed={isMultiSelection ? bulkDraft.control.peuple.mixed : false}
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.peuple)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.control.peuple.value
                  : singleDraft.control.peuple
              }
              options={peupleOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("control", "peuple", value)
                  : onSingleFieldChange("control", "peuple", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Faction"
            mixed={isMultiSelection ? bulkDraft.control.faction.mixed : false}
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.faction)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.control.faction.value
                  : singleDraft.control.faction
              }
              options={factionOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("control", "faction", value)
                  : handleSingleControlFieldChange("faction", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Controleur"
            mixed={
              isMultiSelection ? bulkDraft.control.controleur.mixed : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.controleur)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.control.controleur.value
                  : singleDraft.control.controleur
              }
              options={controllerOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("control", "controleur", value)
                  : handleSingleControlFieldChange("controleur", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Type de controle"
            mixed={
              isMultiSelection ? bulkDraft.control.controle_type.mixed : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.controle_type)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.control.controle_type.value
                  : singleDraft.control.controle_type
              }
              options={controlTypeOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange("control", "controle_type", value)
                  : onSingleFieldChange("control", "controle_type", value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Acteur relationnel"
            mixed={
              isMultiSelection
                ? bulkDraft.control.controle_secondaire_type.mixed
                : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.controle_secondaire_type)
                : undefined
            }
          >
            <SelectField
              value={selectedSecondaryActorType}
              options={controlActorTypeOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange(
                      "control",
                      "controle_secondaire_type",
                      value,
                    )
                  : onSingleFieldChange(
                      "control",
                      "controle_secondaire_type",
                      value,
                    )
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
          <FormRow
            label="Reference relationnelle"
            mixed={
              isMultiSelection
                ? bulkDraft.control.controle_secondaire_id.mixed
                : false
            }
            helper={
              isMultiSelection
                ? renderBulkHelper(bulkDraft.control.controle_secondaire_id)
                : undefined
            }
          >
            <SelectField
              value={
                isMultiSelection
                  ? bulkDraft.control.controle_secondaire_id.value
                  : singleDraft.control.controle_secondaire_id
              }
              options={secondaryActorOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkFieldChange(
                      "control",
                      "controle_secondaire_id",
                      value,
                    )
                  : onSingleFieldChange(
                      "control",
                      "controle_secondaire_id",
                      value,
                    )
              }
              disabled={
                adminLoading ||
                adminSaving ||
                selectedSecondaryActorType.length === 0
              }
            />
          </FormRow>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        key={`bonus:${selectionKey}`}
        title="Bonus contextuels"
      >
        <div className="mt-4">
          <FormRow
            label="Bonus"
            mixed={isMultiSelection ? bulkDraft.bonus_contextuels.mixed : false}
            helper={
              isMultiSelection
                ? renderBulkListHelper(bulkDraft.bonus_contextuels)
                : undefined
            }
          >
            <CheckboxListField
              value={selectedBonusContextuels}
              options={bonusContextuelOptions}
              onChange={(value) =>
                isMultiSelection
                  ? onBulkBonusContextuelsChange(value)
                  : onSingleBonusContextuelsChange(value)
              }
              disabled={adminLoading || adminSaving}
            />
          </FormRow>
        </div>
      </CollapsibleSection>

      {dynamicSections.map((section) => (
        <CollapsibleSection
          key={`${selectionKey}:${section.table_key}`}
          title={section.title}
          meta={formatMeta(section.meta)}
        >
          <div className="mt-4">
            {section.fields.map((field) => (
              <FormRow
                key={`${section.table_key}:${field.field_key}`}
                label={field.label}
              >
                <DynamicFieldInput
                  section={section}
                  fieldKey={field.field_key}
                  disabled={adminLoading || adminSaving}
                  draft={singleDraft}
                  onDynamicFieldChange={onDynamicFieldChange}
                />
              </FormRow>
            ))}
          </div>
        </CollapsibleSection>
      ))}

      {adminError ? (
        <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
          {adminError}
        </div>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-3 border-t border-border/70 bg-background/95 px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancelEdit}
          disabled={adminSaving}
        >
          Annuler
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={adminSaving || !adminDirty}
        >
          Enregistrer
        </Button>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

import type {
  AdminBlockMeta,
  AdminBulkEditDraft,
  AdminCaseDraft,
  AdminCaseRecord,
  AdminDynamicSectionRecord,
} from "@/admin/types";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { StableCaseProperties } from "@/map/types";

type AdminPanelMode = "read" | "edit";
type StaticAdminDraftSection = "public" | "notes" | "terrain" | "control";

type CaseInfoPanelProps = {
  activeCase: StableCaseProperties | null;
  selectedCases: StableCaseProperties[];
  selectedCaseIds: string[];
  totalCases?: number;
  casesVisible: boolean;
  adminModeEnabled: boolean;
  adminPanelMode: AdminPanelMode;
  activeAdminRecord: AdminCaseRecord | null;
  selectedAdminRecords: AdminCaseRecord[];
  singleDraft: AdminCaseDraft;
  bulkDraft: AdminBulkEditDraft;
  adminLoading: boolean;
  adminSaving: boolean;
  adminError: string | null;
  adminDirty: boolean;
  searchValue: string;
  searchError: string | null;
  availableCaseIds: string[];
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSingleFieldChange: (section: StaticAdminDraftSection, field: string, value: string) => void;
  onDynamicFieldChange: (tableKey: string, field: string, value: string) => void;
  onBulkFieldChange: (section: keyof AdminBulkEditDraft, field: string, value: string) => void;
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
};

type BulkFieldState = {
  value: string;
  touched: boolean;
  mixed: boolean;
};

const fieldClassName =
  "w-full rounded-[16px] border border-border/80 bg-background/55 px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

const booleanOptions = [
  { label: "Non renseigne", value: "" },
  { label: "Oui", value: "true" },
  { label: "Non", value: "false" },
] as const;

function summarizeStrings(values: Array<string | null | undefined>): string {
  const normalizedValues = values.map((value) => (value ?? "").trim());
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (uniqueValues.length === 0 || (uniqueValues.length === 1 && uniqueValues[0] === "")) {
    return "Non renseigne";
  }

  return uniqueValues.length === 1 ? uniqueValues[0] : "Etat mixte";
}

function summarizeBooleans(values: Array<boolean | null | undefined>): string {
  const normalizedValues = values.map((value) =>
    value === true ? "Oui" : value === false ? "Non" : "Non renseigne",
  );
  const uniqueValues = Array.from(new Set(normalizedValues));

  return uniqueValues.length === 1 ? uniqueValues[0] : "Etat mixte";
}

function isDisplayValueEmpty(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.length === 0 || normalized === "non renseigne";
}

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

  const normalized = metas.map((meta) => `${meta.updated_at ?? ""}|${meta.updated_by ?? ""}`);
  const uniqueValues = Array.from(new Set(normalized));

  return uniqueValues.length === 1 ? formatMeta(metas[0]) : "Sauvegardes variables";
}

function getTerrainTypeOptions(record: AdminCaseRecord | null, category: string | null | undefined): string[] {
  if (!record || !category) {
    return [];
  }

  return (record.reference_data.terrain_types_by_category[category] ?? []).map((option) => option.value);
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

function CompactInfoList({
  rows,
  emptyMessage,
}: {
  rows: Array<{ label: string; value: string }>;
  emptyMessage: string;
}) {
  const visibleRows = rows.filter((row) => !isDisplayValueEmpty(row.value));

  if (visibleRows.length === 0) {
    return <p className="text-sm leading-6 text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div>
      {visibleRows.map((row) => (
        <CompactInfoRow key={row.label} label={row.label} value={row.value} />
      ))}
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

function FormRow({ label, children, helper, mixed = false }: { label: string; children: ReactNode; helper?: string; mixed?: boolean }) {
  return (
    <div className="border-b border-border/50 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
        <div className="flex items-center gap-2 sm:pt-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          {mixed ? (
            <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
              Etat mixte
            </span>
          ) : null}
        </div>
        <div className="min-w-0">
          {children}
          {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
        </div>
      </div>
    </div>
  );
}

function SelectField({ value, options, onChange, disabled = false }: { value: string; options: readonly string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select className={fieldClassName} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      <option value="">Non renseigne</option>
      {options.map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function BooleanField({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <select className={fieldClassName} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
      {booleanOptions.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function DynamicFieldInput({ section, fieldKey, disabled, draft, onDynamicFieldChange }: { section: AdminDynamicSectionRecord; fieldKey: string; disabled: boolean; draft: AdminCaseDraft; onDynamicFieldChange: (tableKey: string, field: string, value: string) => void; }) {
  const field = section.fields.find((item) => item.field_key === fieldKey);

  if (!field) {
    return null;
  }

  const value = draft.dynamic[section.table_key]?.[field.field_key] ?? "";

  if (field.field_type === "boolean") {
    return <BooleanField value={value} onChange={(nextValue) => onDynamicFieldChange(section.table_key, field.field_key, nextValue)} disabled={disabled} />;
  }

  if (field.field_type === "reference") {
    return (
      <select className={fieldClassName} value={value} onChange={(event) => onDynamicFieldChange(section.table_key, field.field_key, event.target.value)} disabled={disabled}>
        <option value="">Non renseigne</option>
        {field.reference_options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    );
  }

  if (field.field_type === "textarea") {
    return <textarea className={`${fieldClassName} min-h-24 resize-y`} value={value} onChange={(event) => onDynamicFieldChange(section.table_key, field.field_key, event.target.value)} disabled={disabled} />;
  }

  return <input className={fieldClassName} type={field.field_type === "integer" ? "number" : "text"} value={value} onChange={(event) => onDynamicFieldChange(section.table_key, field.field_key, event.target.value)} disabled={disabled} />;
}

function AdminSearchBox({ searchValue, searchError, availableCaseIds, onSearchValueChange, onSearchSubmit }: { searchValue: string; searchError: string | null; availableCaseIds: string[]; onSearchValueChange: (value: string) => void; onSearchSubmit: () => void; }) {
  return (
    <div className="rounded-[22px] border border-primary/20 bg-primary/8 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Recherche</p>
      <form className="mt-3 flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); onSearchSubmit(); }}>
        <input list="case-id-list" className={fieldClassName} placeholder="Aller a une case" value={searchValue} onChange={(event) => onSearchValueChange(event.target.value)} />
        <datalist id="case-id-list">
          {availableCaseIds.map((caseId) => <option key={caseId} value={caseId} />)}
        </datalist>
        <Button type="submit" variant="outline">Rechercher</Button>
      </form>
      {searchError ? <p className="mt-3 text-sm text-destructive">{searchError}</p> : null}
    </div>
  );
}

export function CaseInfoPanel(props: CaseInfoPanelProps) {
  const {
    activeCase,
    selectedCases,
    selectedCaseIds,
    totalCases = 0,
    casesVisible,
    adminModeEnabled,
    adminPanelMode,
    activeAdminRecord,
    selectedAdminRecords,
    singleDraft,
    bulkDraft,
    adminLoading,
    adminSaving,
    adminError,
    adminDirty,
    searchValue,
    searchError,
    availableCaseIds,
    onSearchValueChange,
    onSearchSubmit,
    onSingleFieldChange,
    onDynamicFieldChange,
    onBulkFieldChange,
    onEnterEditMode,
    onCancelEdit,
    onSave,
  } = props;

  const isMultiSelection = selectedCaseIds.length > 1;
  const hasSelection = selectedCaseIds.length > 0;
  const terrainCategoryOptions = activeAdminRecord?.reference_data.terrain_categories.map((option) => option.value) ?? [];
  const bulkTerrainCategory = bulkDraft.terrain.terrain_cat.mixed && !bulkDraft.terrain.terrain_cat.touched ? "" : bulkDraft.terrain.terrain_cat.value;
  const singleTerrainTypeOptions = getTerrainTypeOptions(activeAdminRecord, singleDraft.terrain.terrain_cat);
  const bulkTerrainTypeOptions = getTerrainTypeOptions(activeAdminRecord, bulkTerrainCategory);
  const reliefOptions = activeAdminRecord?.reference_data.relief_options.map((option) => option.value) ?? [];
  const factionOptions = activeAdminRecord?.reference_data.faction_options.map((option) => option.value) ?? [];
  const controlTypeOptions = activeAdminRecord?.reference_data.control_type_options.map((option) => option.value) ?? [];
  const publicMeta = isMultiSelection ? summarizeMeta(selectedAdminRecords.map((record) => record.public.meta)) : formatMeta(activeAdminRecord?.public.meta);
  const terrainMeta = isMultiSelection ? summarizeMeta(selectedAdminRecords.map((record) => record.terrain.meta)) : formatMeta(activeAdminRecord?.terrain.meta);
  const controlMeta = isMultiSelection ? summarizeMeta(selectedAdminRecords.map((record) => record.control.meta)) : formatMeta(activeAdminRecord?.control.meta);
  const dynamicSections = !isMultiSelection ? activeAdminRecord?.dynamic_sections ?? [] : [];

  const identityRows = [
    {
      label: "Cases selectionnees",
      value: String(selectedCaseIds.length),
    },
    {
      label: "Case active",
      value: activeCase?.id_case ?? "Aucune",
    },
  ];
  const localizationRows = [
    { label: "Region", value: summarizeStrings(selectedCases.map((item) => item.region)) },
    { label: "Sous-region", value: summarizeStrings(selectedCases.map((item) => item.sous_region)) },
    { label: "Cote", value: summarizeBooleans(selectedCases.map((item) => item.cote)) },
    { label: "Lac majeur", value: summarizeBooleans(selectedCases.map((item) => item.lac_majeur)) },
    {
      label: "Cours d'eau majeur",
      value: summarizeBooleans(selectedCases.map((item) => item.cours_eau_majeur)),
    },
  ];
  const terrainRows = [
    { label: "Categorie", value: summarizeStrings(selectedCases.map((item) => item.terrain_cat)) },
    { label: "Type", value: summarizeStrings(selectedCases.map((item) => item.terrain_type)) },
    { label: "Relief", value: summarizeStrings(selectedCases.map((item) => item.relief)) },
  ];
  const controlRows = [
    { label: "Faction", value: summarizeStrings(selectedCases.map((item) => item.faction)) },
    { label: "Controleur", value: summarizeStrings(selectedCases.map((item) => item.controleur)) },
    { label: "Type de controle", value: summarizeStrings(selectedCases.map((item) => item.controle_type)) },
  ];
  const visibleDynamicSections = dynamicSections
    .map((section) => ({
      ...section,
      rows: section.fields
        .map((field) => {
          const rawValue = section.values[field.field_key];
          const value =
            rawValue === null || rawValue === undefined
              ? "Non renseigne"
              : typeof rawValue === "boolean"
                ? rawValue
                  ? "Oui"
                  : "Non"
                : String(rawValue);

          return {
            label: field.label,
            value,
          };
        })
        .filter((row) => !isDisplayValueEmpty(row.value)),
    }))
    .filter((section) => section.rows.length > 0);

  return (
    <aside aria-live="polite">
      <SectionPanel className="flex h-full flex-col">
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <header className="space-y-4">
            <h2 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">Informations de case</h2>
            {adminModeEnabled ? <AdminSearchBox searchValue={searchValue} searchError={searchError} availableCaseIds={availableCaseIds} onSearchValueChange={onSearchValueChange} onSearchSubmit={onSearchSubmit} /> : null}
            {adminModeEnabled && hasSelection && adminPanelMode === "read" ? (
              <div className="rounded-[22px] border border-primary/25 bg-primary/8 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Edition</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {adminLoading
                        ? "Chargement des donnees admin..."
                        : "Ouvre directement le formulaire de modification de la selection."}
                    </p>
                  </div>
                  <Button type="button" onClick={onEnterEditMode} disabled={adminLoading || !hasSelection}>
                    Modifier
                  </Button>
                </div>
                {adminError ? <p className="mt-3 text-sm text-destructive">{adminError}</p> : null}
              </div>
            ) : null}
          </header>

          <Separator className="my-5" />

          {!casesVisible ? (
            <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">La couche des cases est masquee.</p>
              <p>Reactive les contours pour cliquer sur une case et consulter ses informations.</p>
            </div>
          ) : !hasSelection ? (
            <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">Aucune case selectionnee.</p>
              <p>Clique sur une case pour afficher son resume.</p>
              <p className="mt-2">{totalCases || "..."} case(s) sont actuellement chargee(s).</p>
            </div>
          ) : adminModeEnabled && adminPanelMode === "edit" ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <section className="rounded-[24px] border border-primary/25 bg-primary/8 p-4">
                <SectionTitle title="Modification staff" />
                <div className="mt-4">
                  <CompactInfoRow label="Cases selectionnees" value={String(selectedCaseIds.length)} />
                  <CompactInfoRow label="Case active" value={activeCase?.id_case ?? "Aucune"} />
                  <CompactInfoRow label="Mode" value={isMultiSelection ? "Masse" : "Simple"} />
                  <CompactInfoRow label="Etat" value={adminSaving ? "Enregistrement..." : adminDirty ? "Brouillon modifie" : "Pret a enregistrer"} />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Case" meta={publicMeta} />
                <div className="mt-4">
                  {!isMultiSelection ? (
                    <FormRow label="id_case">
                      <input className={fieldClassName} value={singleDraft.public.id_case} onChange={(event) => onSingleFieldChange("public", "id_case", event.target.value)} disabled={adminLoading || adminSaving} />
                    </FormRow>
                  ) : null}
                  <FormRow label="Region" mixed={isMultiSelection ? bulkDraft.public.region.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.public.region) : undefined}>
                    <input className={fieldClassName} value={isMultiSelection ? bulkDraft.public.region.value : singleDraft.public.region} onChange={(event) => isMultiSelection ? onBulkFieldChange("public", "region", event.target.value) : onSingleFieldChange("public", "region", event.target.value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                  <FormRow label="Sous-region" mixed={isMultiSelection ? bulkDraft.public.sous_region.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.public.sous_region) : undefined}>
                    <input className={fieldClassName} value={isMultiSelection ? bulkDraft.public.sous_region.value : singleDraft.public.sous_region} onChange={(event) => isMultiSelection ? onBulkFieldChange("public", "sous_region", event.target.value) : onSingleFieldChange("public", "sous_region", event.target.value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                  {(["cote", "lac_majeur", "cours_eau_majeur"] as const).map((field) => (
                    <FormRow key={field} label={field} mixed={isMultiSelection ? bulkDraft.public[field].mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.public[field]) : undefined}>
                      <BooleanField value={isMultiSelection ? bulkDraft.public[field].value : singleDraft.public[field]} onChange={(value) => isMultiSelection ? onBulkFieldChange("public", field, value) : onSingleFieldChange("public", field, value)} disabled={adminLoading || adminSaving} />
                    </FormRow>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Terrain" meta={terrainMeta} />
                <div className="mt-4">
                  <FormRow label="Categorie" mixed={isMultiSelection ? bulkDraft.terrain.terrain_cat.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.terrain.terrain_cat) : undefined}>
                    <SelectField value={isMultiSelection ? bulkDraft.terrain.terrain_cat.value : singleDraft.terrain.terrain_cat} options={terrainCategoryOptions} onChange={(value) => isMultiSelection ? onBulkFieldChange("terrain", "terrain_cat", value) : onSingleFieldChange("terrain", "terrain_cat", value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                  <FormRow label="Type" mixed={isMultiSelection ? bulkDraft.terrain.terrain_type.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.terrain.terrain_type) : undefined}>
                    <SelectField value={isMultiSelection ? bulkDraft.terrain.terrain_type.value : singleDraft.terrain.terrain_type} options={isMultiSelection ? bulkTerrainTypeOptions : singleTerrainTypeOptions} onChange={(value) => isMultiSelection ? onBulkFieldChange("terrain", "terrain_type", value) : onSingleFieldChange("terrain", "terrain_type", value)} disabled={adminLoading || adminSaving || (isMultiSelection ? bulkTerrainTypeOptions : singleTerrainTypeOptions).length === 0} />
                  </FormRow>
                  <FormRow label="Relief" mixed={isMultiSelection ? bulkDraft.terrain.relief.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.terrain.relief) : undefined}>
                    <SelectField value={isMultiSelection ? bulkDraft.terrain.relief.value : singleDraft.terrain.relief} options={reliefOptions} onChange={(value) => isMultiSelection ? onBulkFieldChange("terrain", "relief", value) : onSingleFieldChange("terrain", "relief", value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Controle" meta={controlMeta} />
                <div className="mt-4">
                  <FormRow label="Faction" mixed={isMultiSelection ? bulkDraft.control.faction.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.control.faction) : undefined}>
                    <SelectField value={isMultiSelection ? bulkDraft.control.faction.value : singleDraft.control.faction} options={factionOptions} onChange={(value) => isMultiSelection ? onBulkFieldChange("control", "faction", value) : onSingleFieldChange("control", "faction", value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                  <FormRow label="Controleur" mixed={isMultiSelection ? bulkDraft.control.controleur.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.control.controleur) : undefined}>
                    <input className={fieldClassName} value={isMultiSelection ? bulkDraft.control.controleur.value : singleDraft.control.controleur} onChange={(event) => isMultiSelection ? onBulkFieldChange("control", "controleur", event.target.value) : onSingleFieldChange("control", "controleur", event.target.value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                  <FormRow label="Type de controle" mixed={isMultiSelection ? bulkDraft.control.controle_type.mixed : false} helper={isMultiSelection ? renderBulkHelper(bulkDraft.control.controle_type) : undefined}>
                    <SelectField value={isMultiSelection ? bulkDraft.control.controle_type.value : singleDraft.control.controle_type} options={controlTypeOptions} onChange={(value) => isMultiSelection ? onBulkFieldChange("control", "controle_type", value) : onSingleFieldChange("control", "controle_type", value)} disabled={adminLoading || adminSaving} />
                  </FormRow>
                </div>
              </section>

              {dynamicSections.map((section) => (
                <section key={section.table_key} className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                  <SectionTitle title={section.title} meta={formatMeta(section.meta)} />
                  <div className="mt-4">
                    {section.fields.map((field) => (
                      <FormRow key={`${section.table_key}:${field.field_key}`} label={field.label}>
                        <DynamicFieldInput section={section} fieldKey={field.field_key} disabled={adminLoading || adminSaving} draft={singleDraft} onDynamicFieldChange={onDynamicFieldChange} />
                      </FormRow>
                    ))}
                  </div>
                </section>
              ))}

              {adminError ? <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">{adminError}</div> : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={adminSaving}>Annuler</Button>
                <Button type="button" onClick={onSave} disabled={adminSaving || !adminDirty}>Enregistrer</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Identite" />
                <div className="mt-4">
                  <CompactInfoList rows={identityRows} emptyMessage="Aucune case selectionnee." />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Localisation" />
                <div className="mt-4">
                  <CompactInfoList rows={localizationRows} emptyMessage="Aucune donnee de localisation renseignee." />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Terrain" />
                <div className="mt-4">
                  <CompactInfoList rows={terrainRows} emptyMessage="Aucune donnee de terrain renseignee." />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Controle" />
                <div className="mt-4">
                  <CompactInfoList rows={controlRows} emptyMessage="Aucune donnee de controle renseignee." />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Donnees personnalisees" />
                <div className="mt-4 space-y-4">
                  {visibleDynamicSections.length === 0 ? (
                    <p className="text-sm leading-6 text-muted-foreground">
                      Aucune donnee complementaire renseignee.
                    </p>
                  ) : (
                    visibleDynamicSections.map((section) => (
                      <div key={section.table_key} className="rounded-[18px] border border-border/60 bg-background/30 p-4">
                        <p className="text-sm font-semibold text-foreground">{section.title}</p>
                        {section.description ? (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{section.description}</p>
                        ) : null}
                        <div className="mt-3">
                          <CompactInfoList rows={section.rows} emptyMessage="Aucune donnee complementaire renseignee." />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </SectionPanel>
    </aside>
  );
}

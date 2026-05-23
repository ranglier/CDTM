import type { ReactNode } from "react";

import {
  controlTypeOptions,
  factionOptions,
  getTerrainTypesForCategory,
  reliefOptions,
  terrainCategories,
} from "@/admin/options";
import type { AdminBlockMeta, AdminBulkEditDraft, AdminCaseDraft, AdminCaseRecord } from "@/admin/types";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { StableCaseProperties } from "@/map/types";

type AdminPanelMode = "read" | "edit";

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
  onSingleFieldChange: (section: keyof AdminCaseDraft, field: string, value: string) => void;
  onBulkFieldChange: (section: keyof AdminBulkEditDraft, field: string, value: string) => void;
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
};

type ValueSummary = {
  value: string;
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

function summarizeStrings(values: Array<string | null | undefined>): ValueSummary {
  const normalizedValues = values.map((value) => (value ?? "").trim());
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (uniqueValues.length === 0 || (uniqueValues.length === 1 && uniqueValues[0] === "")) {
    return { value: "Non renseigne" };
  }

  if (uniqueValues.length === 1) {
    return { value: uniqueValues[0] };
  }

  return { value: "Etat mixte" };
}

function summarizeBooleans(values: Array<boolean | null | undefined>): ValueSummary {
  const normalizedValues = values.map((value) =>
    value === true ? "Oui" : value === false ? "Non" : "Non renseigne",
  );
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (uniqueValues.length === 1) {
    return { value: uniqueValues[0] };
  }

  return { value: "Etat mixte" };
}

function formatMeta(meta: AdminBlockMeta): string {
  if (!meta.updated_at) {
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

  if (uniqueValues.length === 1) {
    return formatMeta(metas[0]);
  }

  return "Sauvegardes variables";
}

function CompactInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-b-0 last:pb-0 first:pt-0">
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

function MixedBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <span className="rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-primary">
      Etat mixte
    </span>
  );
}

function FormRow({
  label,
  children,
  mixed = false,
  helper,
}: {
  label: string;
  children: ReactNode;
  mixed?: boolean;
  helper?: string;
}) {
  return (
    <div className="border-b border-border/50 py-3 last:border-b-0 last:pb-0 first:pt-0">
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
        <div className="flex items-center gap-2 sm:pt-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <MixedBadge visible={mixed} />
        </div>
        <div className="min-w-0">
          {children}
          {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
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
  options: readonly string[];
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
      <option value="">Non renseigne</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
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

function AdminSearchBox({
  searchValue,
  searchError,
  availableCaseIds,
  onSearchValueChange,
  onSearchSubmit,
}: {
  searchValue: string;
  searchError: string | null;
  availableCaseIds: string[];
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-primary/20 bg-primary/8 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Recherche</p>
      <form
        className="mt-3 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <input
          list="case-id-list"
          className={fieldClassName}
          placeholder="Aller a une case"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
        />
        <datalist id="case-id-list">
          {availableCaseIds.map((caseId) => (
            <option key={caseId} value={caseId} />
          ))}
        </datalist>
        <Button type="submit" variant="outline">
          Rechercher
        </Button>
      </form>
      {searchError ? <p className="mt-3 text-sm text-destructive">{searchError}</p> : null}
    </div>
  );
}

function buildSelectionSummary(selectedCases: StableCaseProperties[], activeCase: StableCaseProperties | null) {
  return {
    count: String(selectedCases.length),
    activeCaseId: activeCase?.id_case ?? "Aucune",
    region: summarizeStrings(selectedCases.map((item) => item.region)).value,
    sousRegion: summarizeStrings(selectedCases.map((item) => item.sous_region)).value,
    cote: summarizeBooleans(selectedCases.map((item) => item.cote)).value,
    lac: summarizeBooleans(selectedCases.map((item) => item.lac_majeur)).value,
    coursEau: summarizeBooleans(selectedCases.map((item) => item.cours_eau_majeur)).value,
  };
}

function buildAdminReadSummary(
  selectedCaseIds: string[],
  activeAdminRecord: AdminCaseRecord | null,
  selectedAdminRecords: AdminCaseRecord[],
) {
  const hasEveryAdminRecord =
    selectedAdminRecords.length > 0 && selectedAdminRecords.length === selectedCaseIds.length;

  const notePublique = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.notes.note_publique)).value
    : summarizeStrings([activeAdminRecord?.notes.note_publique]).value;

  const noteStaff = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.notes.note_staff)).value
    : summarizeStrings([activeAdminRecord?.notes.note_staff]).value;

  const terrainCat = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.terrain_cat)).value
    : summarizeStrings([activeAdminRecord?.terrain.terrain_cat]).value;

  const terrainType = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.terrain_type)).value
    : summarizeStrings([activeAdminRecord?.terrain.terrain_type]).value;

  const relief = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.relief)).value
    : summarizeStrings([activeAdminRecord?.terrain.relief]).value;

  const faction = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.faction)).value
    : summarizeStrings([activeAdminRecord?.control.faction]).value;

  const controleur = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.controleur)).value
    : summarizeStrings([activeAdminRecord?.control.controleur]).value;

  const controleType = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.controle_type)).value
    : summarizeStrings([activeAdminRecord?.control.controle_type]).value;

  return {
    notePublique,
    noteStaff,
    terrainCat,
    terrainType,
    relief,
    faction,
    controleur,
    controleType,
  };
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

export function CaseInfoPanel({
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
  onBulkFieldChange,
  onEnterEditMode,
  onCancelEdit,
  onSave,
}: CaseInfoPanelProps) {
  const isMultiSelection = selectedCaseIds.length > 1;
  const hasSelection = selectedCaseIds.length > 0;
  const selectionSummary = buildSelectionSummary(selectedCases, activeCase);
  const adminReadSummary = buildAdminReadSummary(
    selectedCaseIds,
    activeAdminRecord,
    selectedAdminRecords,
  );
  const singleTerrainTypeOptions = getTerrainTypesForCategory(singleDraft.terrain.terrain_cat);
  const bulkTerrainCategory =
    bulkDraft.terrain.terrain_cat.mixed && !bulkDraft.terrain.terrain_cat.touched
      ? ""
      : bulkDraft.terrain.terrain_cat.value;
  const bulkTerrainTypeOptions = getTerrainTypesForCategory(bulkTerrainCategory);
  const notesMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.notes.meta))
    : formatMeta(activeAdminRecord?.notes.meta ?? { updated_at: null, updated_by: null });
  const publicMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.public.meta))
    : formatMeta(activeAdminRecord?.public.meta ?? { updated_at: null, updated_by: null });
  const terrainMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.terrain.meta))
    : formatMeta(activeAdminRecord?.terrain.meta ?? { updated_at: null, updated_by: null });
  const controlMeta = isMultiSelection
    ? summarizeMeta(selectedAdminRecords.map((record) => record.control.meta))
    : formatMeta(activeAdminRecord?.control.meta ?? { updated_at: null, updated_by: null });

  return (
    <aside aria-live="polite">
      <SectionPanel className="flex h-full flex-col">
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <header className="space-y-4">
            <h2 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
              Informations de case
            </h2>
            {adminModeEnabled ? (
              <AdminSearchBox
                searchValue={searchValue}
                searchError={searchError}
                availableCaseIds={availableCaseIds}
                onSearchValueChange={onSearchValueChange}
                onSearchSubmit={onSearchSubmit}
              />
            ) : null}
          </header>

          <Separator className="my-5" />

          {!casesVisible ? (
            <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
              <p className="font-medium text-foreground">La couche des cases est masquee.</p>
              <p>Reactive les contours pour cliquer sur une case et consulter ou modifier ses informations.</p>
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
                <SectionTitle title="Modification" />
                <div className="mt-4">
                  <CompactInfoRow label="Cases selectionnees" value={String(selectedCaseIds.length)} />
                  <CompactInfoRow label="Case active" value={activeCase?.id_case ?? "Aucune"} />
                  <CompactInfoRow label="Mode" value={isMultiSelection ? "Masse" : "Simple"} />
                  <CompactInfoRow
                    label="Etat"
                    value={
                      adminSaving
                        ? "Enregistrement..."
                        : adminDirty
                          ? "Brouillon modifie"
                          : "Pret a enregistrer"
                    }
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Case" meta={publicMeta} />
                <div className="mt-4">
                  {!isMultiSelection ? (
                    <FormRow label="id_case">
                      <input
                        className={fieldClassName}
                        value={singleDraft.public.id_case}
                        onChange={(event) => onSingleFieldChange("public", "id_case", event.target.value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </FormRow>
                  ) : null}
                  <FormRow
                    label="Region"
                    mixed={isMultiSelection ? bulkDraft.public.region.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.public.region) : undefined}
                  >
                    <input
                      className={fieldClassName}
                      value={isMultiSelection ? bulkDraft.public.region.value : singleDraft.public.region}
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
                    mixed={isMultiSelection ? bulkDraft.public.sous_region.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.public.sous_region) : undefined
                    }
                  >
                    <input
                      className={fieldClassName}
                      value={
                        isMultiSelection ? bulkDraft.public.sous_region.value : singleDraft.public.sous_region
                      }
                      onChange={(event) =>
                        isMultiSelection
                          ? onBulkFieldChange("public", "sous_region", event.target.value)
                          : onSingleFieldChange("public", "sous_region", event.target.value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Cote"
                    mixed={isMultiSelection ? bulkDraft.public.cote.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.public.cote) : undefined}
                  >
                    <BooleanField
                      value={isMultiSelection ? bulkDraft.public.cote.value : singleDraft.public.cote}
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("public", "cote", value)
                          : onSingleFieldChange("public", "cote", value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Lac majeur"
                    mixed={isMultiSelection ? bulkDraft.public.lac_majeur.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.public.lac_majeur) : undefined
                    }
                  >
                    <BooleanField
                      value={
                        isMultiSelection ? bulkDraft.public.lac_majeur.value : singleDraft.public.lac_majeur
                      }
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("public", "lac_majeur", value)
                          : onSingleFieldChange("public", "lac_majeur", value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Cours d'eau majeur"
                    mixed={isMultiSelection ? bulkDraft.public.cours_eau_majeur.mixed : false}
                    helper={
                      isMultiSelection
                        ? renderBulkHelper(bulkDraft.public.cours_eau_majeur)
                        : undefined
                    }
                  >
                    <BooleanField
                      value={
                        isMultiSelection
                          ? bulkDraft.public.cours_eau_majeur.value
                          : singleDraft.public.cours_eau_majeur
                      }
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("public", "cours_eau_majeur", value)
                          : onSingleFieldChange("public", "cours_eau_majeur", value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Notes" meta={notesMeta} />
                <div className="mt-4">
                  <FormRow
                    label="Note publique"
                    mixed={isMultiSelection ? bulkDraft.notes.note_publique.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.notes.note_publique) : undefined
                    }
                  >
                    <textarea
                      className={`${fieldClassName} min-h-24 resize-y`}
                      value={
                        isMultiSelection ? bulkDraft.notes.note_publique.value : singleDraft.notes.note_publique
                      }
                      onChange={(event) =>
                        isMultiSelection
                          ? onBulkFieldChange("notes", "note_publique", event.target.value)
                          : onSingleFieldChange("notes", "note_publique", event.target.value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Note staff"
                    mixed={isMultiSelection ? bulkDraft.notes.note_staff.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.notes.note_staff) : undefined}
                  >
                    <textarea
                      className={`${fieldClassName} min-h-28 resize-y`}
                      value={isMultiSelection ? bulkDraft.notes.note_staff.value : singleDraft.notes.note_staff}
                      onChange={(event) =>
                        isMultiSelection
                          ? onBulkFieldChange("notes", "note_staff", event.target.value)
                          : onSingleFieldChange("notes", "note_staff", event.target.value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Terrain" meta={terrainMeta} />
                <div className="mt-4">
                  <FormRow
                    label="Categorie"
                    mixed={isMultiSelection ? bulkDraft.terrain.terrain_cat.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.terrain.terrain_cat) : undefined
                    }
                  >
                    <SelectField
                      value={isMultiSelection ? bulkDraft.terrain.terrain_cat.value : singleDraft.terrain.terrain_cat}
                      options={terrainCategories}
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
                    mixed={isMultiSelection ? bulkDraft.terrain.terrain_type.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.terrain.terrain_type) : undefined
                    }
                  >
                    <SelectField
                      value={isMultiSelection ? bulkDraft.terrain.terrain_type.value : singleDraft.terrain.terrain_type}
                      options={isMultiSelection ? bulkTerrainTypeOptions : singleTerrainTypeOptions}
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("terrain", "terrain_type", value)
                          : onSingleFieldChange("terrain", "terrain_type", value)
                      }
                      disabled={
                        adminLoading ||
                        adminSaving ||
                        (isMultiSelection ? bulkTerrainTypeOptions : singleTerrainTypeOptions).length === 0
                      }
                    />
                  </FormRow>
                  <FormRow
                    label="Relief"
                    mixed={isMultiSelection ? bulkDraft.terrain.relief.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.terrain.relief) : undefined}
                  >
                    <SelectField
                      value={isMultiSelection ? bulkDraft.terrain.relief.value : singleDraft.terrain.relief}
                      options={reliefOptions}
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("terrain", "relief", value)
                          : onSingleFieldChange("terrain", "relief", value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Controle" meta={controlMeta} />
                <div className="mt-4">
                  <FormRow
                    label="Faction"
                    mixed={isMultiSelection ? bulkDraft.control.faction.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.control.faction) : undefined}
                  >
                    <SelectField
                      value={isMultiSelection ? bulkDraft.control.faction.value : singleDraft.control.faction}
                      options={factionOptions}
                      onChange={(value) =>
                        isMultiSelection
                          ? onBulkFieldChange("control", "faction", value)
                          : onSingleFieldChange("control", "faction", value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Controleur"
                    mixed={isMultiSelection ? bulkDraft.control.controleur.mixed : false}
                    helper={isMultiSelection ? renderBulkHelper(bulkDraft.control.controleur) : undefined}
                  >
                    <input
                      className={fieldClassName}
                      value={isMultiSelection ? bulkDraft.control.controleur.value : singleDraft.control.controleur}
                      onChange={(event) =>
                        isMultiSelection
                          ? onBulkFieldChange("control", "controleur", event.target.value)
                          : onSingleFieldChange("control", "controleur", event.target.value)
                      }
                      disabled={adminLoading || adminSaving}
                    />
                  </FormRow>
                  <FormRow
                    label="Type de controle"
                    mixed={isMultiSelection ? bulkDraft.control.controle_type.mixed : false}
                    helper={
                      isMultiSelection ? renderBulkHelper(bulkDraft.control.controle_type) : undefined
                    }
                  >
                    <SelectField
                      value={
                        isMultiSelection ? bulkDraft.control.controle_type.value : singleDraft.control.controle_type
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
                </div>
              </section>

              {adminError ? (
                <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
                  {adminError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={adminLoading || adminSaving}>
                  Annuler
                </Button>
                <Button type="button" onClick={onSave} disabled={adminLoading || adminSaving || !adminDirty}>
                  {adminSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionTitle title="Public" />
                <div className="mt-4">
                  <CompactInfoRow label="Cases selectionnees" value={selectionSummary.count} />
                  <CompactInfoRow label="Case active" value={selectionSummary.activeCaseId} />
                  <CompactInfoRow label="Region" value={selectionSummary.region} />
                  <CompactInfoRow label="Sous-region" value={selectionSummary.sousRegion} />
                  <CompactInfoRow label="Cote" value={selectionSummary.cote} />
                  <CompactInfoRow label="Lac majeur" value={selectionSummary.lac} />
                  <CompactInfoRow label="Cours d'eau majeur" value={selectionSummary.coursEau} />
                  {adminModeEnabled ? (
                    <CompactInfoRow label="Note publique" value={adminReadSummary.notePublique} />
                  ) : null}
                </div>
              </section>

              {adminModeEnabled ? (
                <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                  <SectionTitle title="Admin" />
                  <div className="mt-4">
                    <CompactInfoRow label="Note staff" value={adminReadSummary.noteStaff} />
                    <CompactInfoRow label="Categorie" value={adminReadSummary.terrainCat} />
                    <CompactInfoRow label="Type" value={adminReadSummary.terrainType} />
                    <CompactInfoRow label="Relief" value={adminReadSummary.relief} />
                    <CompactInfoRow label="Faction" value={adminReadSummary.faction} />
                    <CompactInfoRow label="Controleur" value={adminReadSummary.controleur} />
                    <CompactInfoRow label="Type de controle" value={adminReadSummary.controleType} />
                    <CompactInfoRow label="Case" value={publicMeta} />
                    <CompactInfoRow label="Notes" value={notesMeta} />
                    <CompactInfoRow label="Terrain" value={terrainMeta} />
                    <CompactInfoRow label="Controle" value={controlMeta} />
                  </div>
                </section>
              ) : null}

              {adminError ? (
                <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
                  {adminError}
                </div>
              ) : null}

              {adminModeEnabled ? (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button
                    type="button"
                    onClick={onEnterEditMode}
                    disabled={adminLoading || adminSaving || selectedAdminRecords.length !== selectedCaseIds.length}
                  >
                    Modifier
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </SectionPanel>
    </aside>
  );
}

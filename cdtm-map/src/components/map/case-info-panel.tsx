import {
  controlTypeOptions,
  factionOptions,
  getTerrainTypesForCategory,
  reliefOptions,
  terrainCategories,
} from "@/admin/options";
import type {
  AdminBlockMeta,
  AdminBulkEditDraft,
  AdminCaseDraft,
  AdminCaseRecord,
  PublicCaseSupplement,
} from "@/admin/types";
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
  publicSupplement: PublicCaseSupplement | null;
  publicSupplementPending: boolean;
  adminAuthenticated: boolean;
  adminModeEnabled: boolean;
  adminUsername: string | null;
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
  onSingleFieldChange: (
    section: keyof AdminCaseDraft,
    field: string,
    value: string,
  ) => void;
  onBulkFieldChange: (
    section: keyof AdminBulkEditDraft,
    field: string,
    value: string,
  ) => void;
  onEnterEditMode: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onAdminLogout: () => void;
  onOpenAdminLogin: () => void;
  onToggleAdminMode: () => void;
};

type ValueSummary = {
  value: string;
  mixed: boolean;
  empty: boolean;
};

type BulkFieldState = {
  value: string;
  touched: boolean;
  mixed: boolean;
};

const fieldClassName =
  "w-full rounded-[18px] border border-border/80 bg-background/55 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60";

function summarizeStrings(values: Array<string | null | undefined>): ValueSummary {
  const normalizedValues = values.map((value) => (value ?? "").trim());
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (uniqueValues.length === 0 || (uniqueValues.length === 1 && uniqueValues[0] === "")) {
    return {
      value: "Non renseigne",
      mixed: false,
      empty: true,
    };
  }

  if (uniqueValues.length === 1) {
    return {
      value: uniqueValues[0],
      mixed: false,
      empty: false,
    };
  }

  return {
    value: "Etat mixte",
    mixed: true,
    empty: false,
  };
}

function summarizeBooleans(values: Array<boolean | null | undefined>): ValueSummary {
  const normalizedValues = values.map((value) =>
    value === true ? "Oui" : value === false ? "Non" : "Non renseigne",
  );
  const uniqueValues = Array.from(new Set(normalizedValues));

  if (uniqueValues.length === 1) {
    return {
      value: uniqueValues[0],
      mixed: false,
      empty: uniqueValues[0] === "Non renseigne",
    };
  }

  return {
    value: "Etat mixte",
    mixed: true,
    empty: false,
  };
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

  const datedMetas = metas.filter((meta) => meta.updated_at);

  if (datedMetas.length === 0) {
    return "Sauvegardes variables";
  }

  const latestMeta = datedMetas.reduce((latest, current) => {
    if (!latest.updated_at) {
      return current;
    }

    if (!current.updated_at) {
      return latest;
    }

    return new Date(current.updated_at).getTime() > new Date(latest.updated_at).getTime()
      ? current
      : latest;
  });

  return `Derniere sauvegarde ${formatMeta(latestMeta)}`;
}

function ReadValue({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p
        className={
          compact
            ? "mt-2 text-sm font-medium text-foreground"
            : "mt-2 text-sm leading-6 text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SectionHeading({
  title,
  meta,
  description,
}: {
  title: string;
  meta?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {meta ? (
        <p className="max-w-[14rem] text-right text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
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

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  helper?: string;
  mixed?: boolean;
};

function SelectField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  helper,
  mixed = false,
}: SelectFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <MixedBadge visible={mixed} />
      </span>
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
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </label>
  );
}

function InputField({
  label,
  value,
  onChange,
  disabled = false,
  helper,
  mixed = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helper?: string;
  mixed?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <MixedBadge visible={mixed} />
      </span>
      <input
        className={fieldClassName}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  disabled = false,
  minHeightClassName = "min-h-28",
  helper,
  mixed = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  minHeightClassName?: string;
  helper?: string;
  mixed?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span>{label}</span>
        <MixedBadge visible={mixed} />
      </span>
      <textarea
        className={`${fieldClassName} ${minHeightClassName} resize-y`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      />
      {helper ? <p className="text-xs leading-5 text-muted-foreground">{helper}</p> : null}
    </label>
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Recherche admin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Recherche par <span className="font-medium text-foreground">id_case</span> et
            recentrage sur la carte.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Shift, Ctrl ou Cmd pour multiselection</p>
      </div>
      <form
        className="mt-4 flex flex-col gap-3 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          onSearchSubmit();
        }}
      >
        <input
          list="case-id-list"
          className={fieldClassName}
          placeholder="Aller a une case par id_case"
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

function buildSelectionSummary(
  selectedCases: StableCaseProperties[],
  activeCase: StableCaseProperties | null,
) {
  return {
    region: summarizeStrings(selectedCases.map((item) => item.region)),
    sousRegion: summarizeStrings(selectedCases.map((item) => item.sous_region)),
    cote: summarizeBooleans(selectedCases.map((item) => item.cote)),
    lac: summarizeBooleans(selectedCases.map((item) => item.lac_majeur)),
    coursEau: summarizeBooleans(selectedCases.map((item) => item.cours_eau_majeur)),
    activeCaseId: activeCase?.id_case ?? "Aucune",
    count: selectedCases.length,
  };
}

function buildAdminReadSummary(
  selectedCaseIds: string[],
  activeAdminRecord: AdminCaseRecord | null,
  selectedAdminRecords: AdminCaseRecord[],
  publicSupplement: PublicCaseSupplement | null,
) {
  const isMultiSelection = selectedCaseIds.length > 1;
  const hasEveryAdminRecord =
    selectedAdminRecords.length > 0 && selectedAdminRecords.length === selectedCaseIds.length;

  const publicNoteSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.notes.note_publique))
    : summarizeStrings([publicSupplement?.note_publique]);

  const staffNoteSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.notes.note_staff))
    : summarizeStrings([activeAdminRecord?.notes.note_staff]);

  const terrainCatSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.terrain_cat))
    : summarizeStrings([activeAdminRecord?.terrain.terrain_cat]);

  const terrainTypeSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.terrain_type))
    : summarizeStrings([activeAdminRecord?.terrain.terrain_type]);

  const reliefSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.terrain.relief))
    : summarizeStrings([activeAdminRecord?.terrain.relief]);

  const factionSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.faction))
    : summarizeStrings([activeAdminRecord?.control.faction]);

  const controleurSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.controleur))
    : summarizeStrings([activeAdminRecord?.control.controleur]);

  const controlTypeSummary = hasEveryAdminRecord
    ? summarizeStrings(selectedAdminRecords.map((record) => record.control.controle_type))
    : summarizeStrings([activeAdminRecord?.control.controle_type]);

  return {
    publicNoteSummary,
    staffNoteSummary,
    terrainCatSummary,
    terrainTypeSummary,
    reliefSummary,
    factionSummary,
    controleurSummary,
    controlTypeSummary,
    notesMeta: hasEveryAdminRecord
      ? summarizeMeta(selectedAdminRecords.map((record) => record.notes.meta))
      : formatMeta(activeAdminRecord?.notes.meta ?? { updated_at: null, updated_by: null }),
    terrainMeta: hasEveryAdminRecord
      ? summarizeMeta(selectedAdminRecords.map((record) => record.terrain.meta))
      : formatMeta(activeAdminRecord?.terrain.meta ?? { updated_at: null, updated_by: null }),
    controlMeta: hasEveryAdminRecord
      ? summarizeMeta(selectedAdminRecords.map((record) => record.control.meta))
      : formatMeta(activeAdminRecord?.control.meta ?? { updated_at: null, updated_by: null }),
    hasEveryAdminRecord,
    isMultiSelection,
  };
}

function renderValue(value: ValueSummary): string {
  return value.value;
}

function renderBulkHelper(field: BulkFieldState, singular: string, plural: string): string | undefined {
  if (field.touched) {
    return `La nouvelle valeur sera appliquee a ${plural}.`;
  }

  if (field.mixed) {
    return `${singular} different selon la selection. Modifie ce champ pour uniformiser.`;
  }

  return undefined;
}

export function CaseInfoPanel({
  activeCase,
  selectedCases,
  selectedCaseIds,
  totalCases = 0,
  casesVisible,
  publicSupplement,
  publicSupplementPending,
  adminAuthenticated,
  adminModeEnabled,
  adminUsername,
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
  onAdminLogout,
  onOpenAdminLogin,
  onToggleAdminMode,
}: CaseInfoPanelProps) {
  const isMultiSelection = selectedCaseIds.length > 1;
  const hasSelection = selectedCaseIds.length > 0;
  const selectionSummary = buildSelectionSummary(selectedCases, activeCase);
  const adminSummary = buildAdminReadSummary(
    selectedCaseIds,
    activeAdminRecord,
    selectedAdminRecords,
    publicSupplement,
  );
  const singleTerrainTypeOptions = getTerrainTypesForCategory(singleDraft.terrain.terrain_cat);
  const bulkTerrainCategory =
    bulkDraft.terrain.terrain_cat.mixed && !bulkDraft.terrain.terrain_cat.touched
      ? ""
      : bulkDraft.terrain.terrain_cat.value;
  const bulkTerrainTypeOptions = getTerrainTypesForCategory(bulkTerrainCategory);

  return (
    <aside aria-live="polite">
      <SectionPanel className="flex h-full flex-col">
        <div className="flex flex-1 flex-col p-5 sm:p-6">
          <header className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-primary">Carte</p>
                <h2 className="mt-2 font-chronicle text-3xl tracking-[0.04em] text-foreground">
                  Informations de case
                </h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {adminAuthenticated ? (
                  <>
                    <Button
                      type="button"
                      variant={adminModeEnabled ? "secondary" : "outline"}
                      size="sm"
                      onClick={onToggleAdminMode}
                    >
                      {adminModeEnabled ? "Admin actif" : "Admin"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={onAdminLogout}>
                      Deconnexion
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="outline" size="sm" onClick={onOpenAdminLogin}>
                    Admin
                  </Button>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Selection
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {hasSelection
                    ? `${selectedCaseIds.length} case${selectedCaseIds.length > 1 ? "s" : ""} selectionnee${selectedCaseIds.length > 1 ? "s" : ""}`
                    : "Aucune case selectionnee"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {casesVisible
                    ? "Shift, Ctrl ou Cmd permet d'ajouter ou retirer des cases."
                    : "Reactive d'abord les cases sur la carte pour selectionner."}
                </p>
              </div>
              <div className="rounded-[20px] border border-border/70 bg-background/40 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  Session
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {adminAuthenticated
                    ? `Connecte en tant que ${adminUsername ?? "staff"}`
                    : "Aucune session staff ouverte"}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {adminModeEnabled
                    ? adminPanelMode === "edit"
                      ? "Edition en cours."
                      : "Lecture admin active."
                    : "La vue publique reste isolee des donnees staff."}
                </p>
              </div>
            </div>
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
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
                <p className="font-medium text-foreground">Aucune case selectionnee.</p>
                <p>
                  Clique sur une case pour afficher son resume. Utilise Shift, Ctrl ou Cmd pour
                  construire une selection multiple.
                </p>
                <p className="mt-2">{totalCases || "..."} case(s) sont actuellement chargee(s).</p>
              </div>
            </div>
          ) : adminModeEnabled && adminPanelMode === "edit" ? (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="rounded-[24px] border border-primary/25 bg-primary/8 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.18em] text-primary">
                      {isMultiSelection ? "Edition de masse" : "Edition"}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-foreground">
                      {isMultiSelection
                        ? `${selectedCaseIds.length} cases selectionnees`
                        : activeCase?.id_case ?? "Case active"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isMultiSelection
                        ? "Seuls les champs modifies seront appliques a toute la selection."
                        : "Le formulaire remplace temporairement la vue de lecture."}
                    </p>
                  </div>
                  <div className="rounded-full border border-border/70 bg-background/55 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    {adminSaving
                      ? "Enregistrement..."
                      : adminDirty
                        ? "Brouillon modifie"
                        : "Pret a enregistrer"}
                  </div>
                </div>
              </div>

              {isMultiSelection ? (
                <>
                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Notes"
                      meta={adminSummary.notesMeta}
                      description="Les champs modifies seront recopies sur toute la selection."
                    />
                    <div className="mt-4 grid gap-3">
                      <TextareaField
                        label="Note publique"
                        value={bulkDraft.notes.note_publique.value}
                        mixed={bulkDraft.notes.note_publique.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.notes.note_publique,
                          "Valeur publique",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("notes", "note_publique", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <TextareaField
                        label="Note staff"
                        value={bulkDraft.notes.note_staff.value}
                        mixed={bulkDraft.notes.note_staff.mixed}
                        minHeightClassName="min-h-32"
                        helper={renderBulkHelper(
                          bulkDraft.notes.note_staff,
                          "Valeur staff",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("notes", "note_staff", value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Terrain"
                      meta={adminSummary.terrainMeta}
                      description="Pour l'edition de masse, categorie et type doivent etre confirmes ensemble."
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <SelectField
                        label="Categorie"
                        value={bulkDraft.terrain.terrain_cat.value}
                        options={terrainCategories}
                        mixed={bulkDraft.terrain.terrain_cat.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.terrain.terrain_cat,
                          "Categorie",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("terrain", "terrain_cat", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <SelectField
                        label="Type"
                        value={bulkDraft.terrain.terrain_type.value}
                        options={bulkTerrainTypeOptions}
                        mixed={bulkDraft.terrain.terrain_type.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.terrain.terrain_type,
                          "Type",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("terrain", "terrain_type", value)}
                        disabled={
                          adminLoading ||
                          adminSaving ||
                          bulkTerrainTypeOptions.length === 0
                        }
                      />
                      <SelectField
                        label="Relief"
                        value={bulkDraft.terrain.relief.value}
                        options={reliefOptions}
                        mixed={bulkDraft.terrain.relief.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.terrain.relief,
                          "Relief",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("terrain", "relief", value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Controle"
                      meta={adminSummary.controlMeta}
                      description="Le controleur reste libre, les autres champs suivent les nomenclatures."
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <SelectField
                        label="Faction"
                        value={bulkDraft.control.faction.value}
                        options={factionOptions}
                        mixed={bulkDraft.control.faction.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.control.faction,
                          "Faction",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("control", "faction", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <InputField
                        label="Controleur"
                        value={bulkDraft.control.controleur.value}
                        mixed={bulkDraft.control.controleur.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.control.controleur,
                          "Controleur",
                          "toutes les cases",
                        )}
                        onChange={(value) => onBulkFieldChange("control", "controleur", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <SelectField
                        label="Type de controle"
                        value={bulkDraft.control.controle_type.value}
                        options={controlTypeOptions}
                        mixed={bulkDraft.control.controle_type.mixed}
                        helper={renderBulkHelper(
                          bulkDraft.control.controle_type,
                          "Type de controle",
                          "toutes les cases",
                        )}
                        onChange={(value) =>
                          onBulkFieldChange("control", "controle_type", value)
                        }
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Notes"
                      meta={formatMeta(activeAdminRecord?.notes.meta ?? { updated_at: null, updated_by: null })}
                    />
                    <div className="mt-4 grid gap-3">
                      <TextareaField
                        label="Note publique"
                        value={singleDraft.notes.note_publique}
                        onChange={(value) => onSingleFieldChange("notes", "note_publique", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <TextareaField
                        label="Note staff"
                        value={singleDraft.notes.note_staff}
                        minHeightClassName="min-h-32"
                        onChange={(value) => onSingleFieldChange("notes", "note_staff", value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Terrain"
                      meta={formatMeta(activeAdminRecord?.terrain.meta ?? { updated_at: null, updated_by: null })}
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <SelectField
                        label="Categorie"
                        value={singleDraft.terrain.terrain_cat}
                        options={terrainCategories}
                        onChange={(value) => onSingleFieldChange("terrain", "terrain_cat", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <SelectField
                        label="Type"
                        value={singleDraft.terrain.terrain_type}
                        options={singleTerrainTypeOptions}
                        onChange={(value) => onSingleFieldChange("terrain", "terrain_type", value)}
                        disabled={
                          adminLoading ||
                          adminSaving ||
                          singleTerrainTypeOptions.length === 0
                        }
                      />
                      <SelectField
                        label="Relief"
                        value={singleDraft.terrain.relief}
                        options={reliefOptions}
                        onChange={(value) => onSingleFieldChange("terrain", "relief", value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                    <SectionHeading
                      title="Controle"
                      meta={formatMeta(activeAdminRecord?.control.meta ?? { updated_at: null, updated_by: null })}
                    />
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <SelectField
                        label="Faction"
                        value={singleDraft.control.faction}
                        options={factionOptions}
                        onChange={(value) => onSingleFieldChange("control", "faction", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <InputField
                        label="Controleur"
                        value={singleDraft.control.controleur}
                        onChange={(value) => onSingleFieldChange("control", "controleur", value)}
                        disabled={adminLoading || adminSaving}
                      />
                      <SelectField
                        label="Type de controle"
                        value={singleDraft.control.controle_type}
                        options={controlTypeOptions}
                        onChange={(value) => onSingleFieldChange("control", "controle_type", value)}
                        disabled={adminLoading || adminSaving}
                      />
                    </div>
                  </section>
                </>
              )}

              {adminError ? (
                <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
                  {adminError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onCancelEdit}
                  disabled={adminLoading || adminSaving}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={onSave}
                  disabled={adminLoading || adminSaving || !adminDirty}
                >
                  {adminSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid gap-3 sm:grid-cols-2">
                <SummaryCard
                  label="Cases selectionnees"
                  value={String(selectionSummary.count)}
                  hint={isMultiSelection ? "Selection multiple active" : "Selection simple"}
                />
                <SummaryCard
                  label="Case active"
                  value={selectionSummary.activeCaseId}
                  hint={isMultiSelection ? "Reference courante dans la selection" : "Case affichee"}
                />
              </div>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionHeading
                  title="Resume de selection"
                  description="Les informations stables restent issues de la couche publique."
                />
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <ReadValue label="Region" value={renderValue(selectionSummary.region)} compact />
                  <ReadValue
                    label="Sous-region"
                    value={renderValue(selectionSummary.sousRegion)}
                    compact
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <ReadValue label="Cote" value={renderValue(selectionSummary.cote)} compact />
                  <ReadValue label="Lac majeur" value={renderValue(selectionSummary.lac)} compact />
                  <ReadValue
                    label="Cours d'eau majeur"
                    value={renderValue(selectionSummary.coursEau)}
                    compact
                  />
                </div>
              </section>

              <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                <SectionHeading
                  title="Donnees publiques"
                  description={
                    publicSupplementPending
                      ? "Chargement du complement public."
                      : "La note publique reste visible hors mode admin."
                  }
                />
                <div className="mt-4 grid gap-3">
                  <ReadValue
                    label="Note publique"
                    value={
                      publicSupplementPending
                        ? "Chargement..."
                        : isMultiSelection && !adminSummary.hasEveryAdminRecord
                          ? "Visible pour la case active. Passe en mode admin pour un resume agrege."
                        : renderValue(adminSummary.publicNoteSummary)
                    }
                  />
                </div>
              </section>

              {adminModeEnabled ? (
                <section className="rounded-[24px] border border-primary/25 bg-primary/8 p-4">
                  <SectionHeading
                    title="Donnees admin"
                    description={
                      adminLoading
                        ? "Chargement des donnees staff."
                        : isMultiSelection
                          ? "Resume agrege de la selection, avec indication des etats mixtes."
                          : "Etat courant admin de la case active."
                    }
                  />
                  <div className="mt-4 grid gap-3">
                    <ReadValue label="Note staff" value={renderValue(adminSummary.staffNoteSummary)} />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ReadValue
                        label="Categorie terrain"
                        value={renderValue(adminSummary.terrainCatSummary)}
                        compact
                      />
                      <ReadValue
                        label="Type terrain"
                        value={renderValue(adminSummary.terrainTypeSummary)}
                        compact
                      />
                      <ReadValue
                        label="Relief"
                        value={renderValue(adminSummary.reliefSummary)}
                        compact
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ReadValue
                        label="Faction"
                        value={renderValue(adminSummary.factionSummary)}
                        compact
                      />
                      <ReadValue
                        label="Controleur"
                        value={renderValue(adminSummary.controleurSummary)}
                        compact
                      />
                      <ReadValue
                        label="Type de controle"
                        value={renderValue(adminSummary.controlTypeSummary)}
                        compact
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <ReadValue label="Meta notes" value={adminSummary.notesMeta} compact />
                      <ReadValue label="Meta terrain" value={adminSummary.terrainMeta} compact />
                      <ReadValue label="Meta controle" value={adminSummary.controlMeta} compact />
                    </div>
                  </div>
                </section>
              ) : null}

              {adminError ? (
                <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
                  {adminError}
                </div>
              ) : null}

              <div className="flex flex-wrap justify-between gap-3">
                <p className="text-sm leading-6 text-muted-foreground">
                  {adminModeEnabled
                    ? isMultiSelection
                      ? "La vue de lecture met en evidence les divergences avant une edition de masse."
                      : "Passe en edition uniquement quand tu veux modifier la case active."
                    : "Active le mode admin pour modifier les donnees staff et lancer des mises a jour de masse."}
                </p>
                {adminModeEnabled ? (
                  <Button
                    type="button"
                    onClick={onEnterEditMode}
                    disabled={
                      adminLoading ||
                      adminSaving ||
                      selectedAdminRecords.length !== selectedCaseIds.length
                    }
                  >
                    Modifier
                  </Button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </SectionPanel>
    </aside>
  );
}

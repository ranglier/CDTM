import {
  controlTypeOptions,
  factionOptions,
  getTerrainTypesForCategory,
  reliefOptions,
  terrainCategories,
} from "@/admin/options";
import type {
  AdminCaseDraft,
  AdminCaseRecord,
  PublicCaseSupplement,
} from "@/admin/types";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { StableCaseProperties } from "@/map/types";

type CaseInfoPanelProps = {
  selectedCase: StableCaseProperties | null;
  totalCases?: number;
  casesVisible: boolean;
  publicSupplement: PublicCaseSupplement | null;
  publicSupplementPending: boolean;
  adminAuthenticated: boolean;
  adminModeEnabled: boolean;
  adminUsername: string | null;
  adminDraft: AdminCaseDraft;
  adminRecord: AdminCaseRecord | null;
  adminLoading: boolean;
  adminSaving: boolean;
  adminError: string | null;
  adminDirty: boolean;
  searchValue: string;
  searchError: string | null;
  availableCaseIds: string[];
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
  onAdminFieldChange: (
    section: keyof AdminCaseDraft,
    field: string,
    value: string,
  ) => void;
  onAdminReset: () => void;
  onAdminSave: () => void;
  onAdminLogout: () => void;
  onOpenAdminLogin: () => void;
  onToggleAdminMode: () => void;
};

function formatText(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "Non renseigne";
}

function formatFlag(value: boolean | null | undefined): string {
  return value === true ? "Oui" : "Non";
}

function formatMeta(meta: AdminCaseRecord["notes"]["meta"]): string {
  if (!meta.updated_at) {
    return "Aucune sauvegarde";
  }

  const updatedAt = new Date(meta.updated_at).toLocaleString("fr-FR");

  return meta.updated_by ? `${updatedAt} par ${meta.updated_by}` : updatedAt;
}

const fieldClassName =
  "w-full rounded-[18px] border border-border/80 bg-background/55 px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/40";

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
};

function SelectField({ label, value, options, onChange, disabled = false }: SelectFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
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
    </label>
  );
}

type AdminSearchBoxProps = {
  searchValue: string;
  searchError: string | null;
  availableCaseIds: string[];
  onSearchValueChange: (value: string) => void;
  onSearchSubmit: () => void;
};

function AdminSearchBox({
  searchValue,
  searchError,
  availableCaseIds,
  onSearchValueChange,
  onSearchSubmit,
}: AdminSearchBoxProps) {
  return (
    <div className="rounded-[24px] border border-primary/25 bg-primary/8 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-primary">Recherche admin</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Va directement a une case par son identifiant stable.
        </p>
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
          placeholder="Rechercher une case par id_case"
          value={searchValue}
          onChange={(event) => onSearchValueChange(event.target.value)}
        />
        <datalist id="case-id-list">
          {availableCaseIds.map((caseId) => (
            <option key={caseId} value={caseId} />
          ))}
        </datalist>
        <Button type="submit" variant="outline">
          Aller a la case
        </Button>
      </form>
      {searchError ? <p className="mt-3 text-sm text-destructive">{searchError}</p> : null}
    </div>
  );
}

export function CaseInfoPanel({
  selectedCase,
  totalCases = 0,
  casesVisible,
  publicSupplement,
  publicSupplementPending,
  adminAuthenticated,
  adminModeEnabled,
  adminUsername,
  adminDraft,
  adminRecord,
  adminLoading,
  adminSaving,
  adminError,
  adminDirty,
  searchValue,
  searchError,
  availableCaseIds,
  onSearchValueChange,
  onSearchSubmit,
  onAdminFieldChange,
  onAdminReset,
  onAdminSave,
  onAdminLogout,
  onOpenAdminLogin,
  onToggleAdminMode,
}: CaseInfoPanelProps) {
  const terrainTypeOptions = getTerrainTypesForCategory(adminDraft.terrain.terrain_cat);

  return (
    <aside aria-live="polite">
      <SectionPanel className="flex h-full flex-col">
        <div className="flex flex-1 flex-col p-6">
          <header className="space-y-4">
            <h2 className="font-chronicle text-3xl tracking-[0.04em] text-foreground">
              Informations de case
            </h2>
            <div className="flex flex-wrap gap-2">
              {adminAuthenticated ? (
                <>
                  <Button type="button" variant={adminModeEnabled ? "secondary" : "outline"} size="sm" onClick={onToggleAdminMode}>
                    {adminModeEnabled ? "Mode admin actif" : "Activer le mode admin"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={onAdminLogout}>
                    Deconnexion
                  </Button>
                </>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={onOpenAdminLogin}>
                  Connexion staff
                </Button>
              )}
            </div>
            {adminAuthenticated ? (
              <p className="text-sm text-muted-foreground">
                Session staff ouverte pour {adminUsername ?? "staff"}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Le mode admin reste isole du flux public tant qu&apos;aucune session staff n&apos;est ouverte.
              </p>
            )}
          </header>

          <Separator className="my-5" />

          {!casesVisible ? (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
                <p className="font-medium text-foreground">
                  La couche des cases est actuellement masquee.
                </p>
                <p>Reactive les contours pour cliquer sur une case et afficher ses informations.</p>
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
            </div>
          ) : selectedCase ? (
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center justify-between gap-3 rounded-[24px] border border-primary/30 bg-primary/10 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-primary">
                    Case selectionnee
                  </p>
                  <p className="mt-1 text-xl font-semibold text-foreground">
                    {selectedCase.id_case}
                  </p>
                </div>
              </div>

              <dl className="grid gap-3">
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Region
                  </dt>
                  <dd className="mt-2 text-base font-medium text-foreground">
                    {formatText(selectedCase.region)}
                  </dd>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Sous-region
                  </dt>
                  <dd className="mt-2 text-base font-medium text-foreground">
                    {formatText(selectedCase.sous_region)}
                  </dd>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Cote
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.cote)}
                    </dd>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Lac majeur
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.lac_majeur)}
                    </dd>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                    <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Cours d&apos;eau majeur
                    </dt>
                    <dd className="mt-2 text-base font-medium text-foreground">
                      {formatFlag(selectedCase.cours_eau_majeur)}
                    </dd>
                  </div>
                </div>
                <div className="rounded-[22px] border border-border/70 bg-background/40 p-4">
                  <dt className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Note publique
                  </dt>
                  <dd className="mt-2 text-sm leading-7 text-foreground">
                    {publicSupplementPending
                      ? "Chargement..."
                      : formatText(publicSupplement?.note_publique)}
                  </dd>
                </div>
              </dl>

              {adminModeEnabled ? (
                <div className="mt-2 grid gap-4">
                  <div className="rounded-[24px] border border-primary/25 bg-primary/8 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-primary">
                          Console admin
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Recherche directe, edition et sauvegarde de l&apos;etat courant.
                        </p>
                      </div>
                      <div className="rounded-full border border-border/70 bg-background/45 px-3 py-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {adminSaving
                          ? "Enregistrement..."
                          : adminDirty
                            ? "Brouillon modifie"
                            : "Synchronise"}
                      </div>
                    </div>
                    <div className="mt-4">
                      <AdminSearchBox
                        searchValue={searchValue}
                        searchError={searchError}
                        availableCaseIds={availableCaseIds}
                        onSearchValueChange={onSearchValueChange}
                        onSearchSubmit={onSearchSubmit}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Notes</h3>
                          <p className="text-sm text-muted-foreground">
                            Public visible et reserve staff, distincts par design.
                          </p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {formatMeta(adminRecord?.notes.meta ?? { updated_at: null, updated_by: null })}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Note publique
                          </span>
                          <textarea
                            className={`${fieldClassName} min-h-28 resize-y`}
                            value={adminDraft.notes.note_publique}
                            onChange={(event) =>
                              onAdminFieldChange("notes", "note_publique", event.target.value)
                            }
                            disabled={adminLoading || adminSaving}
                          />
                        </label>
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Note staff
                          </span>
                          <textarea
                            className={`${fieldClassName} min-h-32 resize-y`}
                            value={adminDraft.notes.note_staff}
                            onChange={(event) =>
                              onAdminFieldChange("notes", "note_staff", event.target.value)
                            }
                            disabled={adminLoading || adminSaving}
                          />
                        </label>
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Terrain</h3>
                          <p className="text-sm text-muted-foreground">
                            Champs metier relies aux nomenclatures de travail.
                          </p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {formatMeta(adminRecord?.terrain.meta ?? { updated_at: null, updated_by: null })}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <SelectField
                          label="Categorie"
                          value={adminDraft.terrain.terrain_cat}
                          options={terrainCategories}
                          onChange={(value) => onAdminFieldChange("terrain", "terrain_cat", value)}
                          disabled={adminLoading || adminSaving}
                        />
                        <SelectField
                          label="Type"
                          value={adminDraft.terrain.terrain_type}
                          options={terrainTypeOptions}
                          onChange={(value) => onAdminFieldChange("terrain", "terrain_type", value)}
                          disabled={adminLoading || adminSaving || terrainTypeOptions.length === 0}
                        />
                        <SelectField
                          label="Relief"
                          value={adminDraft.terrain.relief}
                          options={reliefOptions}
                          onChange={(value) => onAdminFieldChange("terrain", "relief", value)}
                          disabled={adminLoading || adminSaving}
                        />
                      </div>
                    </section>

                    <section className="rounded-[24px] border border-border/70 bg-background/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">Controle</h3>
                          <p className="text-sm text-muted-foreground">
                            Etat courant de la case sans historisation en V1.
                          </p>
                        </div>
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                          {formatMeta(adminRecord?.control.meta ?? { updated_at: null, updated_by: null })}
                        </p>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <SelectField
                          label="Faction"
                          value={adminDraft.control.faction}
                          options={factionOptions}
                          onChange={(value) => onAdminFieldChange("control", "faction", value)}
                          disabled={adminLoading || adminSaving}
                        />
                        <label className="block space-y-2">
                          <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                            Controleur
                          </span>
                          <input
                            className={fieldClassName}
                            value={adminDraft.control.controleur}
                            onChange={(event) =>
                              onAdminFieldChange("control", "controleur", event.target.value)
                            }
                            disabled={adminLoading || adminSaving}
                          />
                        </label>
                        <SelectField
                          label="Type de controle"
                          value={adminDraft.control.controle_type}
                          options={controlTypeOptions}
                          onChange={(value) =>
                            onAdminFieldChange("control", "controle_type", value)
                          }
                          disabled={adminLoading || adminSaving}
                        />
                      </div>
                    </section>
                  </div>

                  {adminError ? (
                    <div className="rounded-[22px] border border-destructive/60 bg-destructive/15 px-4 py-3 text-sm text-foreground">
                      {adminError}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onAdminReset}
                      disabled={adminLoading || adminSaving || !adminDirty}
                    >
                      Annuler
                    </Button>
                    <Button
                      type="button"
                      onClick={onAdminSave}
                      disabled={adminLoading || adminSaving}
                    >
                      {adminSaving ? "Enregistrement..." : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="rounded-[24px] border border-border/70 bg-background/40 p-5 text-sm leading-7 text-muted-foreground">
                <p className="font-medium text-foreground">Aucune case selectionnee.</p>
                <p>
                  Clique sur un contour pour afficher ici l&apos;identifiant stable, la
                  region, la sous-region, les indicateurs d&apos;eau majeure et la note publique.
                </p>
                <p className="mt-2">{totalCases || "..."} case(s) sont actuellement chargee(s).</p>
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
            </div>
          )}
        </div>
      </SectionPanel>
    </aside>
  );
}

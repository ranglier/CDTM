"use client";

import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/admin/tech/image-preview";
import { ReferenceFieldEditor } from "@/components/admin/tech/reference-field-editor";
import {
  buildReferenceRowsSectionTitle,
  DEFAULT_PATTERN_COLOR,
  DEFAULT_STYLE_STROKE,
  getFriendlyFieldLabel,
  getReferenceRowSummary,
  isHexColorInputValid,
  isPatternTypeInputValid,
  LOCKED_REFERENCE_FIELDS,
  PATTERN_TYPE_OPTIONS,
  REFERENCE_TECHNICAL_FIELDS,
  STYLE_FIELDS,
  type StyleFieldName,
} from "@/components/admin/tech/reference-utils";
import { StylePreview } from "@/components/admin/tech/style-preview";
import type { ReferencePanelProps } from "@/components/admin/tech/types";
import { normalizeHexColor } from "@/map/types";

export function ReferenceAdminPanel({
  activeReference,
  activeReferenceSection,
  activeReferenceView,
  referenceRowsLoading,
  referenceRows,
  referenceError,
  selectedReferenceRowId,
  setSelectedReferenceRowId,
  referenceSearchInput,
  setReferenceSearchInput,
  setReferenceSearch,
  onAddReferenceRow,
  onReferenceRowValueChange,
  onMapIconUpload,
  onSaveReferenceRow,
  onDeleteReferenceRow,
  onSelectReferenceView,
  referenceFieldOptions,
  terrainCategoryOptions,
  terrainCategoryLabelByKey,
}: ReferencePanelProps) {
  if (activeReference) {
    return (
      <>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-foreground">
                {activeReferenceView?.title ?? activeReference.definition.title}
              </h2>
              <Button type="button" onClick={onAddReferenceRow} disabled={!activeReferenceView}>
                Ajouter une valeur
              </Button>
            </div>

            <form
              className="flex gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                setReferenceSearch(referenceSearchInput.trim());
              }}
            >
              <input
                className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 sm:w-72"
                placeholder="Filtrer cette liste"
                value={referenceSearchInput}
                onChange={(event) => setReferenceSearchInput(event.target.value)}
              />
              <Button type="submit" variant="outline">
                Filtrer
              </Button>
            </form>
          </div>
        </div>

        {referenceError ? <p className="mt-4 text-sm text-destructive">{referenceError}</p> : null}

        <div className="mt-6 space-y-4">
          {referenceRowsLoading ? (
            <p className="text-sm text-muted-foreground">Chargement des lignes...</p>
          ) : referenceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune ligne pour cette vue.</p>
          ) : (
            <section className="rounded-[20px] border border-border/70 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Valeurs</p>
                <p className="text-sm text-muted-foreground">
                  {buildReferenceRowsSectionTitle(referenceRows.length)}
                </p>
              </div>
              <div className="mt-4 space-y-3">
                {referenceRows.map((row) => {
                  const displayFields = activeReference.definition.fields.filter(
                    (field) =>
                      !REFERENCE_TECHNICAL_FIELDS.has(field.name) &&
                      !STYLE_FIELDS.includes(field.name as StyleFieldName),
                  );
                  const technicalFields = activeReference.definition.fields.filter((field) =>
                    REFERENCE_TECHNICAL_FIELDS.has(field.name),
                  );
                  const showStyles = Boolean(activeReferenceView?.styleTargetType);
                  const hasImageFields =
                    activeReference.definition.fields.some((field) => field.name === "image_path") &&
                    activeReference.definition.fields.some((field) => field.name === "image_alt");
                  const previewAlt =
                    row.values.image_alt ||
                    row.values.label ||
                    row.values.nom ||
                    row.values.icon_key ||
                    "Apercu";
                  const summaryText = getReferenceRowSummary(
                    activeReference.definition,
                    activeReferenceView,
                    row,
                    displayFields,
                    referenceFieldOptions,
                    terrainCategoryLabelByKey,
                  );

                  return (
                    <details
                      key={row.localId}
                      open={selectedReferenceRowId === row.localId}
                      className="rounded-[16px] border border-border/60 bg-background/30 px-4 py-3"
                    >
                      <summary
                        className="flex cursor-pointer list-none flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
                        onClick={(event) => {
                          event.preventDefault();
                          setSelectedReferenceRowId(selectedReferenceRowId === row.localId ? null : row.localId);
                        }}
                      >
                        <div className="flex items-center gap-4 text-left">
                          {showStyles ? (
                            <StylePreview
                              fill={row.values.fill ?? ""}
                              stroke={row.values.stroke ?? ""}
                              patternType={row.values.pattern_type ?? "none"}
                              patternColor={row.values.pattern_color ?? ""}
                            />
                          ) : null}
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {row.values.label ||
                                row.values.nom ||
                                row.values.entry_key ||
                                row.values[activeReference.definition.primary_key] ||
                                "Nouvelle ligne"}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">{summaryText}</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={row.saving || row.uploading}
                            onClick={(event) => {
                              event.preventDefault();
                              void onDeleteReferenceRow(row);
                            }}
                          >
                            Supprimer
                          </Button>
                          <Button type="button" size="sm" disabled={row.saving || row.uploading}>
                            Modifier
                          </Button>
                        </div>
                      </summary>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        {displayFields.map((field) => (
                          <div
                            key={`${row.localId}:${field.name}`}
                            className={field.type === "textarea" ? "lg:col-span-2" : ""}
                          >
                            <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {getFriendlyFieldLabel(field.label)}
                            </p>
                            {activeReferenceView?.supportsTerrainParentSelect && field.name === "parent_entry_key" ? (
                              <select
                                className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                                value={row.values[field.name] ?? ""}
                                disabled={row.saving}
                                onChange={(event) =>
                                  onReferenceRowValueChange(row.localId, field.name, event.target.value)
                                }
                              >
                                <option value="">Aucune categorie parente</option>
                                {terrainCategoryOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <ReferenceFieldEditor
                                field={field}
                                value={row.values[field.name] ?? ""}
                                disabled={row.saving || row.uploading}
                                options={referenceFieldOptions[field.name]}
                                onChange={(value) => onReferenceRowValueChange(row.localId, field.name, value)}
                              />
                            )}
                          </div>
                        ))}

                        {hasImageFields ? (
                          <div className="lg:col-span-2">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Image importee
                              </p>
                              <label className="inline-flex cursor-pointer items-center rounded-full border border-border/70 bg-background/35 px-3 py-1.5 text-sm text-foreground transition hover:border-primary/60">
                                <input
                                  type="file"
                                  accept=".png,.webp,.svg,image/png,image/webp,image/svg+xml"
                                  className="hidden"
                                  disabled={row.saving || row.uploading}
                                  onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null;
                                    void onMapIconUpload(row, file);
                                    event.currentTarget.value = "";
                                  }}
                                />
                                {row.uploading ? "Import..." : "Importer une image"}
                              </label>
                            </div>
                            <ImagePreview
                              key={`${row.localId}:${row.values.image_path ?? ""}`}
                              imageUrl={row.values.image_path ?? ""}
                              imageAlt={previewAlt}
                            />
                          </div>
                        ) : null}

                        {showStyles ? (
                          <>
                            <div>
                              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Couleur de fond
                              </p>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                  value={normalizeHexColor(row.values.fill ?? "") ?? "#5f6b7a"}
                                  disabled={row.saving}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "fill", event.target.value)
                                  }
                                />
                                <input
                                  className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                    isHexColorInputValid(row.values.fill ?? "")
                                      ? "border-border/70"
                                      : "border-destructive/70"
                                  }`}
                                  value={row.values.fill ?? ""}
                                  disabled={row.saving}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "fill", event.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Couleur de contour
                              </p>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                  value={normalizeHexColor(row.values.stroke ?? "") ?? DEFAULT_STYLE_STROKE}
                                  disabled={row.saving}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "stroke", event.target.value)
                                  }
                                />
                                <input
                                  className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                    isHexColorInputValid(row.values.stroke ?? "")
                                      ? "border-border/70"
                                      : "border-destructive/70"
                                  }`}
                                  value={row.values.stroke ?? ""}
                                  disabled={row.saving}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "stroke", event.target.value)
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Motif
                              </p>
                              <select
                                className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                  isPatternTypeInputValid(row.values.pattern_type ?? "")
                                    ? "border-border/70"
                                    : "border-destructive/70"
                                }`}
                                value={row.values.pattern_type ?? "none"}
                                disabled={row.saving}
                                onChange={(event) =>
                                  onReferenceRowValueChange(row.localId, "pattern_type", event.target.value)
                                }
                              >
                                {PATTERN_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                Couleur du motif
                              </p>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  className="h-11 w-14 shrink-0 rounded-[14px] border border-border/70 bg-background/55 p-1"
                                  value={normalizeHexColor(row.values.pattern_color ?? "") ?? DEFAULT_PATTERN_COLOR}
                                  disabled={row.saving || (row.values.pattern_type ?? "none") === "none"}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "pattern_color", event.target.value)
                                  }
                                />
                                <input
                                  className={`w-full rounded-[14px] border bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 ${
                                    isHexColorInputValid(row.values.pattern_color ?? "")
                                      ? "border-border/70"
                                      : "border-destructive/70"
                                  }`}
                                  value={row.values.pattern_color ?? ""}
                                  disabled={row.saving || (row.values.pattern_type ?? "none") === "none"}
                                  onChange={(event) =>
                                    onReferenceRowValueChange(row.localId, "pattern_color", event.target.value)
                                  }
                                />
                              </div>
                            </div>
                          </>
                        ) : null}
                      </div>

                      {technicalFields.length > 0 ? (
                        <details className="mt-4 rounded-[14px] border border-border/60 bg-background/25 px-4 py-3">
                          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            Details techniques
                          </summary>
                          <div className="mt-4 grid gap-4 lg:grid-cols-2">
                            {technicalFields.map((field) => (
                              <div
                                key={`${row.localId}:tech:${field.name}`}
                                className={field.type === "textarea" ? "lg:col-span-2" : ""}
                              >
                                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {getFriendlyFieldLabel(field.label)}
                                </p>
                                {activeReferenceView?.supportsTerrainParentSelect &&
                                field.name === "parent_entry_key" ? (
                                  <select
                                    className="w-full rounded-[14px] border border-border/70 bg-background/55 px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary/80 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    value={row.values[field.name] ?? ""}
                                    disabled={row.saving || row.uploading}
                                    onChange={(event) =>
                                      onReferenceRowValueChange(row.localId, field.name, event.target.value)
                                    }
                                  >
                                    <option value="">Aucune categorie parente</option>
                                    {terrainCategoryOptions.map((option) => (
                                      <option key={option.value} value={option.value}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <ReferenceFieldEditor
                                    field={field}
                                    value={row.values[field.name] ?? ""}
                                    disabled={
                                      row.saving || row.uploading || LOCKED_REFERENCE_FIELDS.has(field.name)
                                    }
                                    options={referenceFieldOptions[field.name]}
                                    onChange={(value) =>
                                      onReferenceRowValueChange(row.localId, field.name, value)
                                    }
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}

                      {row.error ? <p className="mt-4 text-sm text-destructive">{row.error}</p> : null}

                      <div className="mt-4 flex justify-end gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={row.saving || row.uploading}
                          onClick={() => {
                            if (row.isNew) {
                              void onDeleteReferenceRow(row);
                              return;
                            }

                            setSelectedReferenceRowId(null);
                          }}
                        >
                          Annuler
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={row.saving || row.uploading}
                          onClick={() => void onSaveReferenceRow(row)}
                        >
                          {row.saving ? "Enregistrement..." : row.uploading ? "Import..." : "Enregistrer"}
                        </Button>
                      </div>
                    </details>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </>
    );
  }

  if (activeReferenceSection) {
    return (
      <>
        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-semibold text-foreground">{activeReferenceSection.title}</h2>
          <p className="text-sm text-muted-foreground">Selectionne une liste dans cette categorie.</p>
        </div>

        <section className="mt-6 rounded-[20px] border border-border/70 bg-background/35 p-4">
          <div className="space-y-3">
            {activeReferenceSection.views.map((view) => (
              <button
                key={view.id}
                type="button"
                className="w-full rounded-[16px] border border-border/70 bg-background/35 px-4 py-4 text-left transition hover:border-primary/25 hover:bg-background/50"
                onClick={() => onSelectReferenceView(view.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">{view.title}</span>
                  {view.rowCount !== null ? (
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {view.rowCount}
                    </span>
                  ) : null}
                </div>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  return <p className="text-sm text-muted-foreground">Aucune liste de valeurs selectionnee.</p>;
}

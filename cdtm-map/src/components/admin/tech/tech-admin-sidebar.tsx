"use client";

import type { Dispatch, SetStateAction } from "react";

import { CollapsibleSidebarSection } from "@/components/admin/tech/collapsible-sidebar-section";
import type { SidebarSection, TabKey } from "@/components/admin/tech/types";

type TechAdminSidebarProps = {
  sidebarSections: SidebarSection[];
  activeTab: TabKey;
  activeSidebarRootId: string | null;
  activeReferenceViewId: string | null;
  activeSchemaKey: string | null;
  activeAccountId: number | null;
  activeSidebarSectionIds: string[];
  sidebarSectionOpenState: Record<string, boolean>;
  setSidebarSectionOpenState: Dispatch<SetStateAction<Record<string, boolean>>>;
  referenceViewSectionsIds: string[];
  onSelectReferenceRoot: (sectionId: string) => void;
  onSelectSchemaRoot: () => void;
  onSelectAccountsRoot: () => void;
  onSelectReferenceView: (sectionId: string, viewId: string) => void;
  onSelectSchemaItem: (itemId: string) => void;
  onSelectAccountItem: (itemId: string) => void;
  onSelectMapBackgrounds: () => void;
};

export function TechAdminSidebar({
  sidebarSections,
  activeTab,
  activeSidebarRootId,
  activeReferenceViewId,
  activeSchemaKey,
  activeAccountId,
  activeSidebarSectionIds,
  sidebarSectionOpenState,
  setSidebarSectionOpenState,
  referenceViewSectionsIds,
  onSelectReferenceRoot,
  onSelectSchemaRoot,
  onSelectAccountsRoot,
  onSelectReferenceView,
  onSelectSchemaItem,
  onSelectAccountItem,
  onSelectMapBackgrounds,
}: TechAdminSidebarProps) {
  return (
    <div className="mt-6 space-y-4">
      {sidebarSections.map((section) => (
        <CollapsibleSidebarSection
          key={section.id}
          title={section.title}
          selected={
            (activeTab === "references" &&
              activeSidebarRootId === section.id) ||
            (activeTab === "schema" && section.id === "schema") ||
            (activeTab === "accounts" && section.id === "accounts") ||
            (activeTab === "map-backgrounds" &&
              section.id === "objets-cartographiques")
          }
          onSelect={() => {
            if (referenceViewSectionsIds.includes(section.id)) {
              onSelectReferenceRoot(section.id);
              return;
            }

            if (section.id === "schema") {
              onSelectSchemaRoot();
              return;
            }

            if (section.id === "accounts") {
              onSelectAccountsRoot();
            }
          }}
          open={
            sidebarSectionOpenState[section.id] ??
            activeSidebarSectionIds.includes(section.id)
          }
          onToggle={() =>
            setSidebarSectionOpenState((current) => ({
              ...current,
              [section.id]: !(
                current[section.id] ??
                activeSidebarSectionIds.includes(section.id)
              ),
            }))
          }
        >
          <div className="space-y-2">
            {section.items.map((item) => {
              const isActive =
                item.kind === "reference"
                  ? activeTab === "references" &&
                    item.id === activeReferenceViewId
                  : item.kind === "schema"
                    ? activeTab === "schema" && item.id === activeSchemaKey
                    : item.kind === "account"
                      ? activeTab === "accounts" &&
                        item.id === String(activeAccountId)
                      : activeTab === "map-backgrounds";

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full rounded-[16px] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-primary/45 bg-primary/10"
                      : "border-border/70 bg-background/35 hover:border-primary/25 hover:bg-background/50"
                  }`}
                  onClick={() => {
                    if (item.kind === "reference") {
                      onSelectReferenceView(section.id, item.id);
                      return;
                    }

                    if (item.kind === "schema") {
                      onSelectSchemaItem(item.id);
                      return;
                    }

                    if (item.kind === "account") {
                      onSelectAccountItem(item.id);
                      return;
                    }

                    onSelectMapBackgrounds();
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    {item.count !== null ? (
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {item.count}
                      </span>
                    ) : null}
                  </div>
                  {item.kind === "account" ? (
                    <span className="mt-1 block text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      Utilisateur
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </CollapsibleSidebarSection>
      ))}
    </div>
  );
}

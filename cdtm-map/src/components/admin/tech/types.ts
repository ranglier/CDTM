import type { ReactNode } from "react";

import type {
  DynamicCaseTableFieldType,
  ReferenceOption,
  ReferenceTableDefinition,
  ReferenceTableKey,
} from "@/admin/tech-types";
import type { MapStyleTargetType } from "@/map/types";

export type TabKey = "references" | "schema" | "accounts";

export type EditableRow = {
  localId: string;
  values: Record<string, string>;
  originalPrimaryKey: string;
  saving: boolean;
  uploading: boolean;
  error: string | null;
  isNew: boolean;
};

export type ReferenceView = {
  id: string;
  tableKey: ReferenceTableKey;
  title: string;
  groupKey: string | null;
  rowCount: number | null;
  styleTargetType?: MapStyleTargetType | null;
  supportsTerrainParentSelect?: boolean;
};

export type ReferenceViewSection = {
  id: string;
  title: string;
  views: ReferenceView[];
};

export type SidebarSection = {
  id: string;
  title: string;
  items: Array<
    | { kind: "reference"; id: string; label: string; count: number | null }
    | { kind: "schema"; id: string; label: string; count: number | null }
    | { kind: "account"; id: string; label: string; count: number | null }
  >;
};

export type ReferencePanelProps = {
  activeReference: { definition: ReferenceTableDefinition } | null;
  activeReferenceSection: ReferenceViewSection | null;
  activeReferenceView: ReferenceView | null;
  referenceRowsLoading: boolean;
  referenceRows: EditableRow[];
  referenceError: string | null;
  selectedReferenceRowId: string | null;
  setSelectedReferenceRowId: (value: string | null) => void;
  referenceSearchInput: string;
  setReferenceSearchInput: (value: string) => void;
  setReferenceSearch: (value: string) => void;
  onAddReferenceRow: () => void;
  onReferenceRowValueChange: (localId: string, fieldName: string, value: string) => void;
  onMapIconUpload: (row: EditableRow, file: File | null) => Promise<void>;
  onSaveReferenceRow: (row: EditableRow) => Promise<void>;
  onDeleteReferenceRow: (row: EditableRow) => Promise<void>;
  onSelectReferenceView: (viewId: string) => void;
  referenceFieldOptions: Record<string, ReferenceOption[]>;
  terrainCategoryOptions: Array<{ value: string; label: string }>;
  terrainCategoryLabelByKey: Record<string, string>;
};

export type FieldEditorProps = {
  field: {
    name: string;
    label: string;
    type: DynamicCaseTableFieldType | "text" | "textarea" | "boolean" | "integer" | "number" | "datetime" | "reference";
    readOnly?: boolean;
    reference_table_key?: ReferenceTableKey | null;
  };
  value: string;
  disabled: boolean;
  options?: ReferenceOption[];
  onChange: (value: string) => void;
};

export type StylePreviewProps = {
  fill: string;
  stroke: string;
  patternType: string;
  patternColor: string;
};

export type ImagePreviewProps = {
  imageUrl: string;
  imageAlt: string;
};

export type CollapsibleSidebarSectionProps = {
  title: string;
  selected: boolean;
  onSelect: () => void;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export type ReferenceAutoFillTableKey =
  | ReferenceTableKey
  | "locality_types"
  | "landmark_types"
  | "force_types";

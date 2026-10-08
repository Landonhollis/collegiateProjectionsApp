import { useState } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppData } from "../../context/AppDataContext";
import { bottomMenuSpace } from "../../components/TabButton";
import { useTheme } from "../../context/ThemeContext";
import CaseCard from "../../components/caseCard";
import CaseEntitiesPanel, { CASE_PANEL_OVERLAP } from "../../components/caseEntitiesPanel";
import ReorderableGrid from "../../components/reorderableGrid";
import EditCaseCard from "../../components/editCaseCard";
import EditStartingAgeCard from "../../components/editStartingAgeCard";
import ConfirmDialog from "../../components/confirmDialog";
import { EmptyState, FLOATING_ROW_SPACE, FloatingRow } from "../../components/screenParts";
import { ageLabel } from "../../components/formParsing";
import type { Case } from "../../TypesAndVariables/types";

/** What the edit case popup is showing, or null when it's closed. */
type Editor = { editType: "add" } | { editType: "edit"; existingCase: Case } | null;

// Cases tab: a list of full-width case cards in caseIndex order. Drag a card by its grip to reorder.
// A row floats over the top of the list: the starting age (shared by every case; tap to change it), then the plus (new case).
// Tapping a card shows that case's entities under it (one case at a time; tap it again to put them away).
// The plus / Edit open the edit case popup;
// Delete asks first (it also deletes the case's entities).
export default function CasesScreen() {
  const { cases, entities, startingAge, deleteCase, toggleCaseHidden, reorderCases } = useAppData();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<Case | null>(null);
  const [editingAge, setEditingAge] = useState(false);
  // The one case whose entities are showing under its card. Tapping another case's card moves it there; tapping it again closes it.
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...cases].sort((a, b) => a.caseIndex - b.caseIndex);
  const entityCount = (caseId: string) => entities.filter((e) => e.caseId === caseId).length;
  const deletingCount = deleting ? entityCount(deleting.caseId) : 0;
  const expandedCase = sorted.find((c) => c.caseId === expandedId); // undefined when none is open (or it was deleted)

  return (
    <View className="flex-1 bg-canvas">
      {/* The list fills this whole area; the starting age floats over its top. */}
      <View className="flex-1">
        <ReorderableGrid
          data={sorted}
          keyOf={(c) => c.caseId}
          columns={1}
          gap={12}
          paddingTop={FLOATING_ROW_SPACE}
          paddingBottom={bottomMenuSpace(insets.bottom)}
          paddingHorizontal={16}
          onReorder={reorderCases}
          expanded={
            expandedCase
              ? {
                  key: expandedCase.caseId,
                  overlap: CASE_PANEL_OVERLAP,
                  content: (
                    <CaseEntitiesPanel
                      caseColor={expandedCase.caseColor}
                      entities={entities.filter((e) => e.caseId === expandedCase.caseId)}
                    />
                  ),
                }
              : null
          }
          renderItem={(item, drag) => (
            <CaseCard
              caseName={item.caseName}
              caseColor={item.caseColor}
              isHidden={item.isHidden}
              entityCount={entityCount(item.caseId)}
              isExpanded={item.caseId === expandedId}
              onToggleExpanded={() => setExpandedId(item.caseId === expandedId ? null : item.caseId)}
              onDelete={() => setDeleting(item)}
              onToggleHidden={() => {
                Haptics.selectionAsync();
                toggleCaseHidden(item.caseId);
              }}
              onEdit={() => setEditor({ editType: "edit", existingCase: item })}
              {...drag}
            />
          )}
          empty={
            <EmptyState
              icon="folder-open-outline"
              title="No cases yet"
              message="A case is one version of your future, like “Buy a house at 30” or “Keep renting.”"
              action={{ label: "Make your first case", onPress: () => setEditor({ editType: "add" }) }}
            />
          }
        />

        {/* Floats so the cards scroll under it: the starting age (tap to change it), then the plus (new case). */}
        <FloatingRow
          onAdd={() => setEditor({ editType: "add" })}
          addLabel="New case"
          onPressBar={() => setEditingAge(true)}
          barLabel={`Starting age: ${ageLabel(startingAge)}. Change`}
        >
          <Ionicons name="person-outline" size={19} color={colors.ink} />
          <Text className="ml-2.5 flex-1 font-inter-semibold text-base text-ink" numberOfLines={1}>
            Starting age
          </Text>
          <Text className="mr-1.5 font-inter-semibold text-sm text-muted">{ageLabel(startingAge)}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </FloatingRow>
      </View>

      {editingAge ? <EditStartingAgeCard onClose={() => setEditingAge(false)} /> : null}

      {editor ? (
        editor.editType === "add" ? (
          <EditCaseCard editType="add" onClose={() => setEditor(null)} />
        ) : (
          <EditCaseCard editType="edit" existingCase={editor.existingCase} onClose={() => setEditor(null)} />
        )
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title={`Delete “${deleting.caseName}”?`}
          message={
            deletingCount > 0
              ? `This also deletes its ${deletingCount} ${deletingCount === 1 ? "entity" : "entities"}. This can't be undone.`
              : "This can't be undone."
          }
          confirmLabel="Delete"
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            deleteCase(deleting.caseId);
            setDeleting(null);
          }}
        />
      ) : null}
    </View>
  );
}

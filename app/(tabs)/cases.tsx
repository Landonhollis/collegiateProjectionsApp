import { useState } from "react";
import { FlatList, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useAppData } from "../../context/AppDataContext";
import CaseCard from "../../components/caseCard";
import EditCaseCard from "../../components/editCaseCard";
import ConfirmDialog from "../../components/confirmDialog";
import { AddButton, EmptyState } from "../../components/screenParts";
import type { Case } from "../../TypesAndVariables/types";

/** What the edit case popup is showing, or null when it's closed. */
type Editor = { editType: "add" } | { editType: "edit"; existingCase: Case } | null;

// Cases tab: a list of full-width case cards in caseIndex order. Add / Edit open the edit case popup;
// Delete asks first (it also deletes the case's entities).
export default function CasesScreen() {
  const { cases, entities, deleteCase, toggleCaseHidden } = useAppData();
  const [editor, setEditor] = useState<Editor>(null);
  const [deleting, setDeleting] = useState<Case | null>(null);

  const sorted = [...cases].sort((a, b) => a.caseIndex - b.caseIndex);
  const entityCount = (caseId: string) => entities.filter((e) => e.caseId === caseId).length;
  const deletingCount = deleting ? entityCount(deleting.caseId) : 0;

  return (
    <View className="flex-1 bg-canvas">
      {/* Toolbar: count on the left, Add on the right */}
      <View className="flex-row items-center px-4 pb-2 pt-4">
        <Text className="flex-1 font-inter-semibold text-[15px] text-muted">
          {cases.length} {cases.length === 1 ? "case" : "cases"}
        </Text>
        <AddButton label="New case" onPress={() => setEditor({ editType: "add" })} />
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(c) => c.caseId}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 12 }}
        renderItem={({ item }) => (
          <CaseCard
            caseName={item.caseName}
            caseColor={item.caseColor}
            isHidden={item.isHidden}
            entityCount={entityCount(item.caseId)}
            onDelete={() => setDeleting(item)}
            onToggleHidden={() => {
              Haptics.selectionAsync();
              toggleCaseHidden(item.caseId);
            }}
            onEdit={() => setEditor({ editType: "edit", existingCase: item })}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No cases yet"
            message="A case is one version of your future, like “Buy a house at 30” or “Keep renting.”"
            action={{ label: "Make your first case", onPress: () => setEditor({ editType: "add" }) }}
          />
        }
      />

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

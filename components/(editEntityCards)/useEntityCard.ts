import { useState } from "react";
import { useAppData } from "../../context/AppDataContext";
import { entityTypeOf, makeEntityId } from "../../Engines/masterEngine";
import { ENTITY_TYPE_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import type { EditEntityCardProps, EntityTypeKey } from "../../TypesAndVariables/types";
import type { EntityForm, FormInputs } from "./entityForms";

// The part every edit entity card shares: it holds the name, the case and the text in the boxes,
// knows whether the card can be saved, and saves the entity.
//
//   const card = useEntityCard(props, "renting", rentingForm);
//   <EditEntityCard {...card.frame}> … boxes reading card.text and writing with card.set("rent") … </EditEntityCard>
//
// `type` and `form` must belong together: the form's inputs have to be that type's engine inputs
// (FormInputs<K>), so a card can't save something its engine doesn't read.
export function useEntityCard<K extends EntityTypeKey, Text>(props: EditEntityCardProps, type: K, form: EntityForm<Text, FormInputs<K>>) {
  const { saveEntity } = useAppData();
  const existing = props.entity;
  if (existing && entityTypeOf(existing.entityId) !== type) {
    throw new Error(`The ${type} edit card was opened for entity "${existing.entityId}", which is a ${entityTypeOf(existing.entityId)}`);
  }

  const [name, setName] = useState(existing?.name ?? "");
  const [caseId, setCaseId] = useState<string | null>(existing?.caseId ?? null);
  const [text, setText] = useState<Text>(() => form.read(existing?.inputs));

  const inputs = form.toInputs(text); // null while anything is missing or not valid
  const canSubmit = name.trim() !== "" && caseId !== null && inputs !== null;

  /** A setter for one box: set("rent") gives the function that updates text.rent. */
  function set<Key extends keyof Text>(key: Key): (value: Text[Key]) => void {
    return (value) => setText((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (caseId === null || inputs === null || name.trim() === "") throw new Error(`Edit ${type} card: submit while invalid`);
    saveEntity({
      entityId: existing?.entityId ?? makeEntityId(type), // an edit keeps its id (and so its place and its type)
      caseId,
      name: name.trim(),
      isHidden: existing?.isHidden ?? false,
      inputs: { ...inputs },
    });
    props.onClose();
  }

  return {
    text,
    set,
    setText,
    /** Spread onto <EditEntityCard>. */
    frame: {
      entityEditType: props.entityEditType,
      typeLabel: ENTITY_TYPE_LABELS[type],
      entityName: name,
      onChangeEntityName: setName,
      caseId,
      onChangeCaseId: setCaseId,
      canSubmit,
      onCancel: props.onClose,
      onSubmit: submit,
    },
  };
}

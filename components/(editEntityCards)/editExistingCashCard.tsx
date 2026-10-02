import { useState } from "react";
import EditEntityCard from "../editEntityCard";
import { ERRORS, NumberField, fieldError, parseDollars, readDollarsText } from "../formFields";
import { useAppData } from "../../context/AppDataContext";
import { makeEntityId } from "../../Engines/masterEngine";
import { ENTITY_TYPE_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import type { EditEntityCardProps, OpeningCashInput } from "../../TypesAndVariables/types";

// Edit card for the openingCash entity type: the cash you have today.
export default function EditExistingCashCard(props: EditEntityCardProps) {
  const { saveEntity } = useAppData();
  const [name, setName] = useState(props.entity?.name ?? "");
  const [caseId, setCaseId] = useState<string | null>(props.entity?.caseId ?? null);
  const [amount, setAmount] = useState(readDollarsText(props.entity?.inputs.amount));

  const amountValue = parseDollars(amount);
  const canSubmit = name.trim() !== "" && caseId !== null && amountValue !== null;

  function submit() {
    if (caseId === null || amountValue === null) throw new Error("EditExistingCashCard: submit while invalid");
    const inputs: OpeningCashInput = { amount: amountValue };
    saveEntity({
      entityId: props.entity?.entityId ?? makeEntityId("openingCash"),
      caseId,
      name: name.trim(),
      isHidden: props.entity?.isHidden ?? false,
      inputs,
    });
    props.onClose();
  }

  return (
    <EditEntityCard
      entityEditType={props.entityEditType}
      typeLabel={ENTITY_TYPE_LABELS.openingCash}
      entityName={name}
      onChangeEntityName={setName}
      caseId={caseId}
      onChangeCaseId={setCaseId}
      canSubmit={canSubmit}
      onCancel={props.onClose}
      onSubmit={submit}
    >
      <NumberField
        label="Cash today"
        hint="checking + savings"
        kind="dollars"
        value={amount}
        onChange={setAmount}
        error={fieldError(amount, amountValue, ERRORS.dollars)}
      />
    </EditEntityCard>
  );
}

import { useState } from "react";
import EditEntityCard from "../editEntityCard";
import {
  AgeField,
  ERRORS,
  NumberField,
  fieldError,
  parseDollars,
  parseOptionalAge,
  parsePercent,
  parseWhole,
  readAgeText,
  readDollarsText,
  readNumberText,
} from "../formFields";
import { useAppData } from "../../context/AppDataContext";
import { makeEntityId } from "../../Engines/masterEngine";
import { ENTITY_TYPE_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import type { EditEntityCardProps, ExistingHomeInput } from "../../TypesAndVariables/types";

// Edit card for the existingHome entity type: a home you already own.
export default function EditExistingHomeCard(props: EditEntityCardProps) {
  const { saveEntity } = useAppData();
  const saved = props.entity?.inputs;
  const [name, setName] = useState(props.entity?.name ?? "");
  const [caseId, setCaseId] = useState<string | null>(props.entity?.caseId ?? null);
  const [price, setPrice] = useState(readDollarsText(saved?.totalPropertyValue));
  const [downPct, setDownPct] = useState(readNumberText(saved?.downPaymentPct));
  const [termYears, setTermYears] = useState(readNumberText(saved?.mortgageTermYears));
  const [ratePct, setRatePct] = useState(readNumberText(saved?.interestRatePct));
  const [remaining, setRemaining] = useState(readDollarsText(saved?.remainingBalance));
  const [purchaseAge, setPurchaseAge] = useState(readAgeText(saved?.purchaseAge));
  const [sellAge, setSellAge] = useState(readAgeText(saved?.sellAge));

  // null = not valid yet; for the optional ages, null = not given and undefined = not valid
  const v = {
    price: parseDollars(price),
    downPct: parsePercent(downPct),
    termYears: parseWhole(termYears, 1),
    ratePct: parsePercent(ratePct),
    remaining: parseDollars(remaining),
    purchaseAge: parseOptionalAge(purchaseAge),
    sellAge: parseOptionalAge(sellAge),
  };
  const canSubmit =
    name.trim() !== "" &&
    caseId !== null &&
    v.price !== null &&
    v.downPct !== null &&
    v.termYears !== null &&
    v.ratePct !== null &&
    v.remaining !== null &&
    v.purchaseAge !== undefined &&
    v.sellAge !== undefined;

  function submit() {
    if (
      caseId === null ||
      v.price === null ||
      v.downPct === null ||
      v.termYears === null ||
      v.ratePct === null ||
      v.remaining === null ||
      v.purchaseAge === undefined ||
      v.sellAge === undefined
    ) {
      throw new Error("EditExistingHomeCard: submit while invalid");
    }
    const inputs: ExistingHomeInput = {
      totalPropertyValue: v.price,
      downPaymentPct: v.downPct,
      mortgageTermYears: v.termYears,
      interestRatePct: v.ratePct,
      remainingBalance: v.remaining,
      purchaseAge: v.purchaseAge,
      sellAge: v.sellAge,
    };
    saveEntity({
      entityId: props.entity?.entityId ?? makeEntityId("existingHome"),
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
      typeLabel={ENTITY_TYPE_LABELS.existingHome}
      entityName={name}
      onChangeEntityName={setName}
      caseId={caseId}
      onChangeCaseId={setCaseId}
      canSubmit={canSubmit}
      onCancel={props.onClose}
      onSubmit={submit}
    >
      <NumberField
        label="Purchase price"
        hint="what you paid"
        kind="dollars"
        value={price}
        onChange={setPrice}
        error={fieldError(price, v.price, ERRORS.dollars)}
      />
      <NumberField
        label="Down payment"
        kind="percent"
        value={downPct}
        onChange={setDownPct}
        error={fieldError(downPct, v.downPct, ERRORS.percent)}
      />
      <NumberField
        label="Mortgage term"
        kind="years"
        value={termYears}
        onChange={setTermYears}
        error={fieldError(termYears, v.termYears, ERRORS.years)}
      />
      <NumberField
        label="Interest rate"
        kind="percent"
        value={ratePct}
        onChange={setRatePct}
        error={fieldError(ratePct, v.ratePct, ERRORS.percent)}
      />
      <NumberField
        label="Remaining balance"
        hint="0 = paid off"
        kind="dollars"
        value={remaining}
        onChange={setRemaining}
        error={fieldError(remaining, v.remaining, ERRORS.dollars)}
      />
      <AgeField
        label="Age you bought it"
        hint="optional"
        value={purchaseAge}
        onChange={setPurchaseAge}
        error={v.purchaseAge === undefined ? ERRORS.age : null}
      />
      <AgeField
        label="Age you'll sell it"
        hint="optional"
        value={sellAge}
        onChange={setSellAge}
        error={v.sellAge === undefined ? ERRORS.age : null}
      />
    </EditEntityCard>
  );
}

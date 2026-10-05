import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, Field, LoanAny3Fields, NumberField, Segmented } from "../formFields";
import { otherExistingAssetForm, type OtherExistingAssetText } from "./entityForms";

const FINANCED_OPTIONS: { value: OtherExistingAssetText["financed"]; label: string }[] = [
  { value: "none", label: "No loan" },
  { value: "loan", label: "Has a loan" },
];

// Edit card for the otherExistingAsset entity type: something else you own that holds value (a boat, land, …).
// "Has a loan" shows the loan boxes; "No loan" hides them.
export default function EditOtherExistingAssetCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "otherExistingAsset", otherExistingAssetForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Purchase price" hint="what you paid" kind="dollars" value={t.value} onChange={set("value")} />
      <NumberField
        label="Yearly change in value"
        hint="negative = loses value"
        kind="signedPercent"
        value={t.appreciationPct}
        onChange={set("appreciationPct")}
      />
      <AgeField label="Age you bought it" value={t.purchaseAge} onChange={set("purchaseAge")} />
      <Field label="Loan on it">
        <Segmented options={FINANCED_OPTIONS} value={t.financed} onChange={set("financed")} />
      </Field>
      {t.financed === "loan" ? <LoanAny3Fields value={t.loan} onChange={set("loan")} /> : null}
    </EditEntityCard>
  );
}

import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, ERRORS, Field, NumberField, Segmented, isBefore } from "../formFields";
import { existingVehicleForm, type ExistingVehicleText } from "./entityForms";

const FINANCING_OPTIONS: { value: ExistingVehicleText["financing"]; label: string }[] = [
  { value: "loan", label: "Loan" },
  { value: "full", label: "Paid in full" },
];

// Edit card for the existingVehicle entity type: a vehicle you already own.
// "Loan" shows the loan boxes; "Paid in full" hides them and needs the age you bought it instead
// (that's how the engine knows how much value the vehicle has lost).
// Insurance, maintenance and depreciation are worked out by the engine, so they aren't asked for.
export default function EditExistingVehicleCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "existingVehicle", existingVehicleForm);
  const { text: t, set } = card;
  const isLoan = t.financing === "loan";
  return (
    <EditEntityCard {...card.frame}>
      <Field label="How you bought it">
        <Segmented options={FINANCING_OPTIONS} value={t.financing} onChange={set("financing")} />
      </Field>
      <NumberField label="Purchase price" hint="what you paid" kind="dollars" value={t.price} onChange={set("price")} />
      {isLoan ? (
        <>
          <NumberField label="Down payment" kind="percent" value={t.downPct} onChange={set("downPct")} />
          <NumberField label="Loan term" kind="months" value={t.termMonths} onChange={set("termMonths")} />
          <NumberField label="Interest rate" kind="percent" value={t.ratePct} onChange={set("ratePct")} />
          <NumberField label="Remaining balance" hint="0 = paid off" kind="dollars" value={t.remaining} onChange={set("remaining")} />
        </>
      ) : null}
      <AgeField label="Age you bought it" hint={isLoan ? "optional" : undefined} value={t.purchaseAge} onChange={set("purchaseAge")} />
      <AgeField
        label="Age you'll sell it"
        hint="optional"
        value={t.sellAge}
        onChange={set("sellAge")}
        error={isBefore(t.sellAge, t.purchaseAge) ? ERRORS.sellBeforeBuy : undefined}
      />
    </EditEntityCard>
  );
}

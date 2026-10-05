import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, ERRORS, Field, NumberField, Segmented, isBefore } from "../formFields";
import { buyingCarForm, type BuyingCarText } from "./entityForms";
import { VEHICLE } from "../../TypesAndVariables/presetVars";

const FINANCING_OPTIONS: { value: BuyingCarText["financing"]; label: string }[] = [
  { value: "loan", label: "Loan" },
  { value: "full", label: "Pay in full" },
];

// Edit card for the buyingCar entity type: a car you'll buy.
// "Loan" shows the loan boxes; "Pay in full" hides them.
// Insurance and maintenance are yours to set, or blank for the average. Depreciation is worked out by the engine.
export default function EditBuyingCarCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "buyingCar", buyingCarForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <Field label="How you'll pay">
        <Segmented options={FINANCING_OPTIONS} value={t.financing} onChange={set("financing")} />
      </Field>
      <AgeField label="Age you'll buy it" value={t.purchaseAge} onChange={set("purchaseAge")} />
      <NumberField label="Price" kind="dollars" value={t.price} onChange={set("price")} />
      {t.financing === "loan" ? (
        <>
          <NumberField label="Down payment" kind="percent" value={t.downPct} onChange={set("downPct")} />
          <NumberField label="Loan term" kind="months" value={t.termMonths} onChange={set("termMonths")} />
          <NumberField label="Interest rate" kind="percent" value={t.ratePct} onChange={set("ratePct")} />
        </>
      ) : null}
      <AgeField
        label="Age you'll sell it"
        hint="optional"
        value={t.sellAge}
        onChange={set("sellAge")}
        error={isBefore(t.sellAge, t.purchaseAge) ? ERRORS.sellBeforeBuy : undefined}
      />
      <NumberField
        label="Insurance"
        hint="per month, blank = average"
        kind="dollars"
        placeholder={String(Math.round(VEHICLE.insuranceMonthly))}
        value={t.insurance}
        onChange={set("insurance")}
      />
      <NumberField
        label="Maintenance"
        hint="per month, blank = average"
        kind="dollars"
        placeholder={String(Math.round(VEHICLE.maintenanceMonthly))}
        value={t.maintenance}
        onChange={set("maintenance")}
      />
    </EditEntityCard>
  );
}

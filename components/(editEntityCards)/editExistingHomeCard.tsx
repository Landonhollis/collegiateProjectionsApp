import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, ERRORS, NumberField, isBefore } from "../formFields";
import { existingHomeForm } from "./entityForms";

// Edit card for the existingHome entity type: a home you already own.
// The engine rebuilds the mortgage from these and works out property tax, insurance, upkeep and utilities itself.
export default function EditExistingHomeCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "existingHome", existingHomeForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Purchase price" hint="what you paid" kind="dollars" value={t.price} onChange={set("price")} />
      <NumberField label="Down payment" kind="percent" value={t.downPct} onChange={set("downPct")} />
      <NumberField label="Mortgage term" kind="years" value={t.termYears} onChange={set("termYears")} />
      <NumberField label="Interest rate" kind="percent" value={t.ratePct} onChange={set("ratePct")} />
      <NumberField label="Remaining balance" hint="0 = paid off" kind="dollars" value={t.remaining} onChange={set("remaining")} />
      <AgeField label="Age you bought it" hint="optional" value={t.purchaseAge} onChange={set("purchaseAge")} />
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

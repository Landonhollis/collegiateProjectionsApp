import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, NumberField } from "../formFields";
import { gasForm } from "./entityForms";
import { GAS } from "../../TypesAndVariables/presetVars";

// Edit card for the gas entity type. Cost per month = miles per week × 52 ÷ 12 ÷ mpg × price per gallon.
export default function EditGasCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "gas", gasForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Miles per week" kind="decimal" suffix="mi" value={t.milesPerWeek} onChange={set("milesPerWeek")} />
      <NumberField label="Miles per gallon" kind="positive" suffix="mpg" value={t.mpg} onChange={set("mpg")} />
      <NumberField
        label="Gas price"
        hint="per gallon, blank = average"
        kind="decimal"
        prefix="$"
        placeholder={GAS.pricePerGallon.toFixed(2)}
        value={t.gasPrice}
        onChange={set("gasPrice")}
      />
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </EditEntityCard>
  );
}

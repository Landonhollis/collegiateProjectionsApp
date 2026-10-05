import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, ChoiceDropdown, NumberField } from "../formFields";
import { healthInsuranceForm } from "./entityForms";
import { HEALTH_PLAN_LABELS } from "../../TypesAndVariables/entityTypeLabels";
import { HEALTH_PREMIUM_MONTHLY } from "../../TypesAndVariables/presetVars";
import type { HealthInsuranceType } from "../../TypesAndVariables/types";

const PLAN_OPTIONS = (Object.keys(HEALTH_PLAN_LABELS) as HealthInsuranceType[]).map((value) => ({
  value,
  label: HEALTH_PLAN_LABELS[value],
}));

// Edit card for the healthInsurance entity type. The plan picks the average premium;
// type your own premium to use that instead (e.g. a subsidized marketplace price).
export default function EditHealthInsuranceCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "healthInsurance", healthInsuranceForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <ChoiceDropdown label="Plan" options={PLAN_OPTIONS} value={t.type} onChange={set("type")} />
      <NumberField
        label="Premium"
        hint="per month, blank = average"
        kind="dollars"
        placeholder={String(Math.round(HEALTH_PREMIUM_MONTHLY[t.type]))}
        value={t.premium}
        onChange={set("premium")}
      />
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />
    </EditEntityCard>
  );
}

import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeWindowFields, Field, NumberField, SectionLabel, Segmented } from "../formFields";
import { incomeForm, type IncomeText } from "./entityForms";
import { INVESTING } from "../../TypesAndVariables/presetVars";
import type { FilingStatus } from "../../TypesAndVariables/types";

const FILING_OPTIONS: { value: FilingStatus; label: string }[] = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
];
const TAX_OPTIONS: { value: IncomeText["taxMode"]; label: string }[] = [
  { value: "calculated", label: "Work it out" },
  { value: "rate", label: "My own rate" },
];

// Edit card for the income entity type: a salary.
// Income tax: "Work it out" lets the engine calculate federal + state tax; "My own rate" shows a rate box instead.
// Social Security and Medicare are always worked out by the engine. The retirement account (3) is set by masterEngine.
export default function EditIncomeCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "income", incomeForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <NumberField label="Salary" hint="per year, before tax" kind="dollars" value={t.salary} onChange={set("salary")} />
      <NumberField label="Yearly raise" hint="after inflation" kind="signedPercent" value={t.raisePct} onChange={set("raisePct")} />
      <Field label="Filing status">
        <Segmented options={FILING_OPTIONS} value={t.filingStatus} onChange={set("filingStatus")} />
      </Field>
      <AgeWindowFields start={t.startAge} end={t.endAge} onStart={set("startAge")} onEnd={set("endAge")} />

      <SectionLabel>Giving and retirement</SectionLabel>
      <NumberField label="Charity and Tithing" hint="of pay, optional" kind="percent" value={t.charityPct} onChange={set("charityPct")} />
      <NumberField
        label="Retirement savings"
        hint="of pay, before tax, optional"
        kind="percent"
        value={t.retirementPct}
        onChange={set("retirementPct")}
      />
      <NumberField
        label="Retirement return"
        hint="yearly, blank = average"
        kind="signedPercent"
        placeholder={String(INVESTING.defaultRealReturnPct)}
        value={t.retirementReturnPct}
        onChange={set("retirementReturnPct")}
      />

      <SectionLabel>Income tax</SectionLabel>
      <Field label="Federal + state tax">
        <Segmented options={TAX_OPTIONS} value={t.taxMode} onChange={set("taxMode")} />
      </Field>
      {t.taxMode === "rate" ? (
        <NumberField label="Tax rate" hint="federal + state together" kind="percent" value={t.taxRatePct} onChange={set("taxRatePct")} />
      ) : null}
    </EditEntityCard>
  );
}

import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { AgeField, Field, Note, NumberField, Segmented } from "../formFields";
import { educationForm, type EducationText } from "./entityForms";

const PAYMENT_OPTIONS: { value: EducationText["paymentType"]; label: string }[] = [
  { value: "loan", label: "Student loan" },
  { value: "full", label: "Pay in full" },
];

// Edit card for the education entity type: school you'll pay for, one semester every 6 months.
// "Student loan" shows the loan rate and term; "Pay in full" hides them.
export default function EditEducationCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "education", educationForm);
  const { text: t, set } = card;
  return (
    <EditEntityCard {...card.frame}>
      <Field label="How you'll pay">
        <Segmented options={PAYMENT_OPTIONS} value={t.paymentType} onChange={set("paymentType")} />
      </Field>
      <NumberField label="Cost per semester" kind="dollars" value={t.costPerSemester} onChange={set("costPerSemester")} />
      <NumberField label="Semesters left" kind="whole" value={t.semesters} onChange={set("semesters")} />
      <AgeField label="Age you start" value={t.startAge} onChange={set("startAge")} />
      {t.paymentType === "loan" ? (
        <>
          <NumberField label="Loan rate" kind="percent" value={t.loanRatePct} onChange={set("loanRatePct")} />
          <NumberField label="Loan term" hint="10 = standard" kind="years" value={t.loanTermYears} onChange={set("loanTermYears")} />
          <Note>Payments start 6 months after your last semester ends.</Note>
        </>
      ) : null}
    </EditEntityCard>
  );
}

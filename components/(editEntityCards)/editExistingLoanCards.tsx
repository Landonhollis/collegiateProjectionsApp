import EditEntityCard from "../editEntityCard";
import { useEntityCard } from "./useEntityCard";
import type { EditEntityCardProps } from "../../TypesAndVariables/types";
import { LoanAny3Fields } from "../formFields";
import { existingLoanForm } from "./entityForms";

// Edit cards for the existingStudentLoans and otherExistingLoan entity types: a loan you already have.
// Both ask for the same four boxes, any three of which describe the loan (the engine works out the fourth).

export function EditExistingStudentLoansCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "existingStudentLoans", existingLoanForm);
  return (
    <EditEntityCard {...card.frame}>
      <LoanAny3Fields value={card.text} onChange={card.setText} />
    </EditEntityCard>
  );
}

export function EditOtherExistingLoanCard(props: EditEntityCardProps) {
  const card = useEntityCard(props, "otherExistingLoan", existingLoanForm);
  return (
    <EditEntityCard {...card.frame}>
      <LoanAny3Fields value={card.text} onChange={card.setText} />
    </EditEntityCard>
  );
}

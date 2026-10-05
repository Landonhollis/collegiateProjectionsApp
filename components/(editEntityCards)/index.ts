import type { ComponentType } from "react";
import EditExistingCashCard from "./editExistingCashCard";
import EditExistingHomeCard from "./editExistingHomeCard";
import EditExistingVehicleCard from "./editExistingVehicleCard";
import EditExistingCreditCardCard from "./editExistingCreditCardCard";
import { EditExistingStudentLoansCard, EditOtherExistingLoanCard } from "./editExistingLoanCards";
import EditExistingInvestmentCard from "./editExistingInvestmentCard";
import EditOtherExistingAssetCard from "./editOtherExistingAssetCard";
import EditIncomeCard from "./editIncomeCard";
import EditRentingCard from "./editRentingCard";
import EditBuyingHomeCard from "./editBuyingHomeCard";
import EditBuyingCarCard from "./editBuyingCarCard";
import EditGasCard from "./editGasCard";
import EditKidCard from "./editKidCard";
import EditEducationCard from "./editEducationCard";
import EditInvestingCard from "./editInvestingCard";
import EditFoodCard from "./editFoodCard";
import EditHealthInsuranceCard from "./editHealthInsuranceCard";
import EditPetCard from "./editPetCard";
import EditPersonalCard from "./editPersonalCard";
import { EditBirthdayChristmasCard, EditRecurringPaymentCard } from "./editAmountFrequencyCards";
import EditOneTimeExpenseCard from "./editOneTimeExpenseCard";
import type { EditEntityCardProps, EntityTypeKey } from "../../TypesAndVariables/types";

// Entity type → its edit card. Every type has one (a new entity type must add its card here, or this won't compile).
// Each card pairs its type with that type's form (entityForms.ts) through useEntityCard.
export const EDIT_ENTITY_CARDS: Record<EntityTypeKey, ComponentType<EditEntityCardProps>> = {
  openingCash: EditExistingCashCard,
  existingHome: EditExistingHomeCard,
  existingVehicle: EditExistingVehicleCard,
  existingCreditCard: EditExistingCreditCardCard,
  existingStudentLoans: EditExistingStudentLoansCard,
  existingInvestment: EditExistingInvestmentCard,
  otherExistingAsset: EditOtherExistingAssetCard,
  otherExistingLoan: EditOtherExistingLoanCard,
  income: EditIncomeCard,
  renting: EditRentingCard,
  buyingHome: EditBuyingHomeCard,
  buyingCar: EditBuyingCarCard,
  gas: EditGasCard,
  kid: EditKidCard,
  education: EditEducationCard,
  investing: EditInvestingCard,
  food: EditFoodCard,
  healthInsurance: EditHealthInsuranceCard,
  pet: EditPetCard,
  personal: EditPersonalCard,
  birthdayChristmas: EditBirthdayChristmasCard,
  oneTimeExpense: EditOneTimeExpenseCard,
  recurringPayment: EditRecurringPaymentCard,
};

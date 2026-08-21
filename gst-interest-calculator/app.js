// GST Interest Calculator - calculation logic reused verbatim from the
// original InfoBridgeIndia tool (js/interest-calculator.js). Only the
// surrounding page markup/design was rebuilt to match the current site.

const taxAmountInput = document.getElementById("taxAmount");
const dueDateInput = document.getElementById("dueDate");
const paymentDateInput = document.getElementById("paymentDate");
const interestRateSelect = document.getElementById("interestRate");

const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");
const errorMessage = document.getElementById("errorMessage");

const resultTaxAmount = document.getElementById("resultTaxAmount");
const resultRate = document.getElementById("resultRate");
const delayDaysElement = document.getElementById("delayDays");
const dailyInterestElement = document.getElementById("dailyInterest");
const totalInterestElement = document.getElementById("totalInterest");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = "block";
}

function hideError() {
  errorMessage.textContent = "";
  errorMessage.style.display = "none";
}

function getDateFromInput(dateValue) {
  const dateParts = dateValue.split("-");
  return new Date(Number(dateParts[0]), Number(dateParts[1]) - 1, Number(dateParts[2]));
}

function calculateInterest() {
  hideError();

  const taxAmount = Number(taxAmountInput.value);
  const interestRate = Number(interestRateSelect.value);

  if (!taxAmountInput.value || taxAmount <= 0) {
    showError("Please enter a valid delayed tax amount.");
    taxAmountInput.focus();
    return;
  }

  if (!dueDateInput.value) {
    showError("Please select the payment due date.");
    dueDateInput.focus();
    return;
  }

  if (!paymentDateInput.value) {
    showError("Please select the actual payment date.");
    paymentDateInput.focus();
    return;
  }

  const dueDate = getDateFromInput(dueDateInput.value);
  const paymentDate = getDateFromInput(paymentDateInput.value);

  if (paymentDate <= dueDate) {
    showError("Payment date must be after the due date.");
    paymentDateInput.focus();
    return;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const delayDays = Math.round((paymentDate.getTime() - dueDate.getTime()) / millisecondsPerDay);
  const dailyInterest = (taxAmount * interestRate) / (100 * 365);
  const totalInterest = (taxAmount * interestRate * delayDays) / (100 * 365);

  resultTaxAmount.textContent = formatCurrency(taxAmount);
  resultRate.textContent = `${interestRate}% per annum`;
  delayDaysElement.textContent = `${delayDays} ${delayDays === 1 ? "Day" : "Days"}`;

  dailyInterestElement.textContent = formatCurrency(dailyInterest);
  totalInterestElement.textContent = formatCurrency(totalInterest);
}

function resetCalculator() {
  taxAmountInput.value = "";
  dueDateInput.value = "";
  paymentDateInput.value = "";
  interestRateSelect.value = "18";

  resultTaxAmount.textContent = "₹0.00";
  resultRate.textContent = "0%";
  delayDaysElement.textContent = "0 Days";
  dailyInterestElement.textContent = "₹0.00";
  totalInterestElement.textContent = "₹0.00";

  hideError();
  taxAmountInput.focus();
}

calculateBtn.addEventListener("click", calculateInterest);
resetBtn.addEventListener("click", resetCalculator);

taxAmountInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    calculateInterest();
  }
});

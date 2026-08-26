// GST Late Fee Calculator - calculation logic reused verbatim from the
// original InfoBridgeIndia tool (js/late-fee-calculator.js). Only the
// surrounding page markup/design was rebuilt to match the current site.

const returnTypeSelect = document.getElementById("returnType");
const returnStatusSelect = document.getElementById("returnStatus");
const turnoverSlabSelect = document.getElementById("turnoverSlab");
const turnoverGroup = document.getElementById("turnoverGroup");

const dueDateInput = document.getElementById("dueDate");
const filingDateInput = document.getElementById("filingDate");

const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");
const errorMessage = document.getElementById("errorMessage");

const resultReturnType = document.getElementById("resultReturnType");
const delayDaysElement = document.getElementById("delayDays");
const feePerDayElement = document.getElementById("feePerDay");
const calculatedFeeElement = document.getElementById("calculatedFee");
const maximumFeeElement = document.getElementById("maximumFee");
const cgstFeeElement = document.getElementById("cgstFee");
const sgstFeeElement = document.getElementById("sgstFee");
const totalLateFeeElement = document.getElementById("totalLateFee");

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

function getLocalDate(dateValue) {
  const parts = dateValue.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function getMaximumLateFee(returnStatus, turnoverSlab) {
  if (returnStatus === "nil") {
    return 500;
  }
  if (turnoverSlab === "upto1_5") {
    return 2000;
  }
  if (turnoverSlab === "1_5to5") {
    return 5000;
  }
  return 10000;
}

function updateTurnoverVisibility() {
  if (returnStatusSelect.value === "nil") {
    turnoverGroup.style.display = "none";
  } else {
    turnoverGroup.style.display = "block";
  }
}

function calculateLateFee() {
  hideError();

  if (!dueDateInput.value) {
    showError("Please select the return due date.");
    dueDateInput.focus();
    return;
  }

  if (!filingDateInput.value) {
    showError("Please select the actual filing date.");
    filingDateInput.focus();
    return;
  }

  const dueDate = getLocalDate(dueDateInput.value);
  const filingDate = getLocalDate(filingDateInput.value);

  if (filingDate <= dueDate) {
    showError("No late fee applies when filing is on or before the due date.");
    filingDateInput.focus();
    return;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const delayDays = Math.round((filingDate.getTime() - dueDate.getTime()) / millisecondsPerDay);

  const returnType = returnTypeSelect.value;
  const returnStatus = returnStatusSelect.value;
  const turnoverSlab = turnoverSlabSelect.value;

  const feePerDay = returnStatus === "nil" ? 20 : 50;
  const calculatedFee = delayDays * feePerDay;
  const maximumFee = getMaximumLateFee(returnStatus, turnoverSlab);

  const totalLateFee = Math.min(calculatedFee, maximumFee);
  const cgstFee = totalLateFee / 2;
  const sgstFee = totalLateFee / 2;

  resultReturnType.textContent = returnType === "gstr1" ? "GSTR-1" : "GSTR-3B";
  delayDaysElement.textContent = `${delayDays} ${delayDays === 1 ? "Day" : "Days"}`;

  feePerDayElement.textContent = formatCurrency(feePerDay);
  calculatedFeeElement.textContent = formatCurrency(calculatedFee);
  maximumFeeElement.textContent = formatCurrency(maximumFee);
  cgstFeeElement.textContent = formatCurrency(cgstFee);
  sgstFeeElement.textContent = formatCurrency(sgstFee);
  totalLateFeeElement.textContent = formatCurrency(totalLateFee);
}

function resetCalculator() {
  returnTypeSelect.value = "gstr1";
  returnStatusSelect.value = "nil";
  turnoverSlabSelect.value = "upto1_5";

  dueDateInput.value = "";
  filingDateInput.value = "";

  resultReturnType.textContent = "—";
  delayDaysElement.textContent = "0 Days";
  feePerDayElement.textContent = "₹0.00";
  calculatedFeeElement.textContent = "₹0.00";
  maximumFeeElement.textContent = "₹0.00";
  cgstFeeElement.textContent = "₹0.00";
  sgstFeeElement.textContent = "₹0.00";
  totalLateFeeElement.textContent = "₹0.00";

  hideError();
  updateTurnoverVisibility();
}

returnStatusSelect.addEventListener("change", updateTurnoverVisibility);

calculateBtn.addEventListener("click", calculateLateFee);
resetBtn.addEventListener("click", resetCalculator);

updateTurnoverVisibility();

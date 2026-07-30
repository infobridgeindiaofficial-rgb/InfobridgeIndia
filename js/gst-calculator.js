const amountInput = document.getElementById("amount");
const gstRateSelect = document.getElementById("gstRate");
const calculateBtn = document.getElementById("calculateBtn");
const resetBtn = document.getElementById("resetBtn");
const errorMessage = document.getElementById("errorMessage");

const taxableValueElement = document.getElementById("taxableValue");
const gstAmountElement = document.getElementById("gstAmount");
const cgstAmountElement = document.getElementById("cgstAmount");
const sgstAmountElement = document.getElementById("sgstAmount");
const igstAmountElement = document.getElementById("igstAmount");
const finalAmountElement = document.getElementById("finalAmount");

const cgstLabel = document.getElementById("cgstLabel");
const sgstLabel = document.getElementById("sgstLabel");
const igstLabel = document.getElementById("igstLabel");

const sameStateResults = document.getElementById("sameStateResults");
const interstateResults = document.getElementById("interstateResults");

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
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

function calculateGST() {
  hideError();

  const amount = Number(amountInput.value);
  const gstRate = Number(gstRateSelect.value);

  const calculationType = document.querySelector(
    'input[name="calculationType"]:checked'
  ).value;

  const transactionType = document.querySelector(
    'input[name="transactionType"]:checked'
  ).value;

  if (!amountInput.value || amount <= 0) {
    showError("Please enter a valid amount.");
    amountInput.focus();
    return;
  }

  if (gstRateSelect.value === "") {
    showError("Please select the GST rate.");
    gstRateSelect.focus();
    return;
  }

  let taxableValue = 0;
  let gstAmount = 0;
  let finalAmount = 0;

  if (calculationType === "exclusive") {
    taxableValue = amount;
    gstAmount = taxableValue * (gstRate / 100);
    finalAmount = taxableValue + gstAmount;
  } else {
    finalAmount = amount;
    taxableValue = finalAmount / (1 + gstRate / 100);
    gstAmount = finalAmount - taxableValue;
  }

  taxableValueElement.textContent = formatCurrency(taxableValue);
  gstAmountElement.textContent = formatCurrency(gstAmount);
  finalAmountElement.textContent = formatCurrency(finalAmount);

  if (transactionType === "same") {
    const halfRate = gstRate / 2;
    const halfGST = gstAmount / 2;

    sameStateResults.classList.remove("hidden");
    interstateResults.classList.add("hidden");

    cgstLabel.textContent = `CGST (${halfRate}%)`;
    sgstLabel.textContent = `SGST (${halfRate}%)`;

    cgstAmountElement.textContent = formatCurrency(halfGST);
    sgstAmountElement.textContent = formatCurrency(halfGST);
  } else {
    sameStateResults.classList.add("hidden");
    interstateResults.classList.remove("hidden");

    igstLabel.textContent = `IGST (${gstRate}%)`;
    igstAmountElement.textContent = formatCurrency(gstAmount);
  }
}

function resetCalculator() {
  amountInput.value = "";
  gstRateSelect.value = "";

  document.querySelector(
    'input[name="calculationType"][value="exclusive"]'
  ).checked = true;

  document.querySelector(
    'input[name="transactionType"][value="same"]'
  ).checked = true;

  taxableValueElement.textContent = "₹0.00";
  gstAmountElement.textContent = "₹0.00";
  cgstAmountElement.textContent = "₹0.00";
  sgstAmountElement.textContent = "₹0.00";
  igstAmountElement.textContent = "₹0.00";
  finalAmountElement.textContent = "₹0.00";

  cgstLabel.textContent = "CGST";
  sgstLabel.textContent = "SGST";
  igstLabel.textContent = "IGST";

  sameStateResults.classList.remove("hidden");
  interstateResults.classList.add("hidden");

  hideError();
  amountInput.focus();
}

calculateBtn.addEventListener("click", calculateGST);
resetBtn.addEventListener("click", resetCalculator);

amountInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    calculateGST();
  }
});
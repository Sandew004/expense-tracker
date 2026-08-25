const form = document.getElementById("expenseForm");
const tableBody = document.getElementById("expenseTableBody");
const loadingState = document.getElementById("loadingState");
const emptyState = document.getElementById("emptyState");
const toast = document.getElementById("toast");
const submitButton = form.querySelector(".btn-submit");
const dateInput = document.getElementById("date");
const datePickerTrigger = document.getElementById("datePickerTrigger");
const calendarPopover = document.getElementById("calendarPopover");
const calendarDays = document.getElementById("calendarDays");
let expenses = [];
let toastTimer;
let calendarMonth = new Date();
let editingExpenseId = null;
let cameraStream = null;
let scannedItems = [];

const currencySymbols = { LKR: "Rs.", USD: "$", EUR: "€", GBP: "£", INR: "₹", AUD: "A$", CAD: "C$", SGD: "S$", JPY: "¥", CNY: "¥", AED: "د.إ" };

function formatLkr(value) {
    return `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatOriginal(expense) {
    const currency = expense.currency || "LKR";
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${Number(expense.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
}

function guessCategory(description) {
    const value = description.toLowerCase();
    if (/food|meal|lunch|dinner|breakfast|coffee|restaurant|grocery|market/.test(value)) return "Food";
    if (/taxi|uber|bus|fuel|transport|parking|petrol/.test(value)) return "Transport";
    if (/bill|electric|water|internet|phone|rent/.test(value)) return "Bills";
    if (/movie|cinema|game|music|entertainment/.test(value)) return "Entertainment";
    if (/shop|clothes|store|retail/.test(value)) return "Shopping";
    return "Other";
}

function normalizeReceiptCurrency(value) {
    const normalized = value.toUpperCase().replace(".", "");
    return ({ "RS": "LKR", "LKR": "LKR", "$": "USD", "USD": "USD", "€": "EUR", "EUR": "EUR", "£": "GBP", "GBP": "GBP", "₹": "INR", "INR": "INR", "¥": "JPY", "JPY": "JPY", "CNY": "CNY", "AUD": "AUD", "CAD": "CAD", "SGD": "SGD", "AED": "AED" })[normalized] || "LKR";
}

function findReceiptDate(text) {
    const match = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b|\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
    if (!match) return new Date().toISOString().slice(0, 10);
    const year = match[1] || match[6];
    const month = match[2] || match[5];
    const day = match[3] || match[4];
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseReceiptText(text) {
    const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
    const receiptDate = findReceiptDate(text);
    const currencyPattern = /(LKR|Rs\.?|USD|\$|EUR|€|GBP|£|INR|₹|AUD|CAD|SGD|JPY|¥|CNY|AED)/i;
    const items = [];
    lines.forEach((line, index) => {
        const amountMatch = line.match(/(?:^|\s)(\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{1,2})|\d+(?:[,.]\d{1,2}))(?:\s|$)/);
        if (!amountMatch || /total|subtotal|tax|change|cash|discount|vat|balance|receipt/i.test(line)) return;
        const rawAmount = amountMatch[1].replace(/,/g, "");
        const amount = Number(rawAmount.replace(/(\d)\.(\d{3})(?=\D|$)/, "$1$2"));
        if (!Number.isFinite(amount) || amount <= 0) return;
        const currencyMatch = line.match(currencyPattern);
        const currency = normalizeReceiptCurrency(currencyMatch?.[1] || "LKR");
        const description = line.replace(amountMatch[0], "").replace(currencyPattern, "").replace(/[|*_:=~-]+/g, " ").trim() || lines[index - 1] || "Scanned purchase";
        if (description.length < 2 || items.some(item => item.amount === amount && item.description === description)) return;
        items.push({ description: description.slice(0, 100), amount: amount.toFixed(2), currency, date: receiptDate, category: guessCategory(description) });
    });
    return items.slice(0, 20);
}

function renderScanReview() {
    const review = document.getElementById("scanReview");
    document.getElementById("reviewCount").textContent = scannedItems.length;
    document.getElementById("reviewList").innerHTML = scannedItems.map((item, index) => `<div class="review-item"><div><strong>${escapeHtml(item.description)}</strong><small>${escapeHtml(item.amount)} ${escapeHtml(item.currency)} · ${escapeHtml(item.category)} · ${escapeHtml(item.date)}</small></div><button type="button" data-review-index="${index}">Use this</button></div>`).join("");
    review.hidden = scannedItems.length === 0;
}

async function processBill(image) {
    if (!window.Tesseract) {
        showToast("OCR is still loading. Try again in a moment.", true);
        return;
    }
    document.getElementById("scanProgress").hidden = false;
    document.getElementById("scanStatus").textContent = "Reading bill...";
    try {
        const result = await Tesseract.recognize(image, "eng", { logger: message => { if (message.status === "recognizing text") document.getElementById("scanStatus").textContent = `Reading bill ${Math.round((message.progress || 0) * 100)}%`; } });
        scannedItems = parseReceiptText(result.data.text);
        renderScanReview();
        showToast(scannedItems.length ? `${scannedItems.length} possible item${scannedItems.length === 1 ? "" : "s"} found. Review each one.` : "No clear line items found. Try a sharper photo.", !scannedItems.length);
    } catch (error) {
        console.error(error);
        showToast("Could not read that bill. Try a clearer image.", true);
    } finally {
        document.getElementById("scanProgress").hidden = true;
    }
}

function stopCamera() {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    document.getElementById("cameraStage").hidden = true;
}

function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function pulse(element) {
    if (!element) return;
    element.classList.remove("pulse");
    void element.offsetWidth;
    element.classList.add("pulse");
}

function toDateKey(year, month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const todayKey = new Date().toISOString().slice(0, 10);
    const selectedKey = dateInput.value;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPreviousMonth = new Date(year, month, 0).getDate();
    const cells = [];

    document.getElementById("calendarMonth").textContent = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(calendarMonth);
    for (let index = firstDay - 1; index >= 0; index--) cells.push({ day: daysInPreviousMonth - index, monthOffset: -1 });
    for (let day = 1; day <= daysInMonth; day++) cells.push({ day, monthOffset: 0 });
    for (let day = 1; cells.length < 42; day++) cells.push({ day, monthOffset: 1 });

    calendarDays.innerHTML = cells.map(cell => {
        const cellDate = new Date(year, month + cell.monthOffset, cell.day);
        const cellKey = toDateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());
        const classes = ["calendar-day"];
        if (cell.monthOffset !== 0) classes.push("is-other-month");
        if (cellKey === todayKey) classes.push("is-today");
        if (cellKey === selectedKey) classes.push("is-selected");
        return `<button type="button" class="${classes.join(" ")}" data-date="${cellKey}" aria-label="${cellKey}"${cellKey === selectedKey ? " aria-current=\"date\"" : ""}>${cell.day}</button>`;
    }).join("");
}

function setSelectedDate(dateKey, close = true) {
    dateInput.value = dateKey;
    const date = new Date(`${dateKey}T00:00:00`);
    document.getElementById("datePickerLabel").textContent = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
    if (close) closeCalendar();
    renderCalendar();
    pulse(datePickerTrigger);
}

function openCalendar() {
    const selectedDate = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : new Date();
    calendarMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    renderCalendar();
    calendarPopover.hidden = false;
    datePickerTrigger.setAttribute("aria-expanded", "true");
    calendarDays.querySelector(".is-selected")?.focus();
}

function closeCalendar() {
    calendarPopover.hidden = true;
    datePickerTrigger.setAttribute("aria-expanded", "false");
}

function updateDashboard() {
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amountLkr ?? expense.amount ?? 0), 0);
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthly = expenses.filter(expense => String(expense.date || "").startsWith(monthPrefix)).reduce((sum, expense) => sum + Number(expense.amountLkr ?? expense.amount ?? 0), 0);
    const largest = expenses.reduce((max, expense) => Math.max(max, Number(expense.amountLkr ?? expense.amount ?? 0)), 0);

    document.getElementById("totalExpenses").textContent = formatLkr(total);
    document.getElementById("expenseCount").textContent = expenses.length;
    document.getElementById("monthlyExpenses").textContent = formatLkr(monthly);
    document.getElementById("largestExpense").textContent = formatLkr(largest);
}

function populateFilterOptions() {
    const categories = [...new Set(expenses.map(expense => expense.category).filter(Boolean))].sort();
    const currencies = [...new Set(expenses.map(expense => expense.currency || "LKR"))].sort();
    const categoryFilter = document.getElementById("categoryFilter");
    const currencyFilter = document.getElementById("currencyFilter");
    const selectedCategory = categoryFilter.value;
    const selectedCurrency = currencyFilter.value;

    categoryFilter.innerHTML = '<option value="">All categories</option>' + categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    currencyFilter.innerHTML = '<option value="">All currencies</option>' + currencies.map(currency => `<option value="${escapeHtml(currency)}">${escapeHtml(currency)}</option>`).join("");
    categoryFilter.value = selectedCategory;
    currencyFilter.value = selectedCurrency;
}

function getFilteredExpenses() {
    const search = document.getElementById("search").value.trim().toLowerCase();
    const category = document.getElementById("categoryFilter").value;
    const currency = document.getElementById("currencyFilter").value;
    const dateFrom = document.getElementById("dateFrom").value;
    const dateTo = document.getElementById("dateTo").value;

    return expenses.filter(expense => {
        const matchesSearch = !search || [expense.description, expense.category, expense.currency].some(value => String(value || "").toLowerCase().includes(search));
        return matchesSearch && (!category || expense.category === category) && (!currency || (expense.currency || "LKR") === currency) && (!dateFrom || expense.date >= dateFrom) && (!dateTo || expense.date <= dateTo);
    });
}

function renderExpenses() {
    const filteredExpenses = getFilteredExpenses();
    tableBody.innerHTML = filteredExpenses.map((expense, index) => `
        <tr style="animation-delay: ${index * 0.04}s">
            <td>${escapeHtml(expense.date)}</td><td>${escapeHtml(expense.description)}</td><td>${escapeHtml(expense.category)}</td>
            <td>${formatOriginal(expense)}</td><td>${Number(expense.exchangeRateToLkr ?? 1).toFixed(4)}</td><td>${formatLkr(expense.amountLkr ?? expense.amount)}</td>
            <td><div class="row-actions"><button type="button" class="row-action" data-action="edit" data-id="${expense.id}">Edit</button><button type="button" class="row-action delete" data-action="delete" data-id="${expense.id}">Delete</button></div></td>
        </tr>`).join("");
    document.getElementById("visibleCount").textContent = filteredExpenses.length;
    emptyState.hidden = filteredExpenses.length > 0;
}

async function loadExpenses() {
    loadingState.hidden = false;
    emptyState.hidden = true;
    try {
        const response = await fetch("/api/expenses");
        if (!response.ok) throw new Error("Could not load expenses");
        expenses = await response.json();
        populateFilterOptions();
        updateDashboard();
        renderExpenses();
    } catch (error) {
        console.error(error);
        showToast("Could not sync your ledger.", true);
        emptyState.hidden = false;
    } finally {
        loadingState.hidden = true;
    }
}

function resetExpenseForm() {
    editingExpenseId = null;
    form.reset();
    setSelectedDate(new Date().toISOString().slice(0, 10), false);
    document.getElementById("entry-heading").textContent = "Add an expense";
    document.getElementById("submitLabel").textContent = "Add expense";
    document.getElementById("cancelEdit").hidden = true;
    document.getElementById("formStatus").textContent = "";
}

function startEditing(expense) {
    editingExpenseId = expense.id;
    setSelectedDate(expense.date || new Date().toISOString().slice(0, 10), false);
    document.getElementById("description").value = expense.description || "";
    document.getElementById("amount").value = expense.amount || "";
    document.getElementById("currency").value = expense.currency || "LKR";
    document.getElementById("category").value = expense.category || "";
    document.getElementById("currencyHint").textContent = expense.currency && expense.currency !== "LKR" ? `${expense.currency} will be converted on save.` : "LKR is the reporting currency.";
    document.getElementById("entry-heading").textContent = "Edit expense";
    document.getElementById("submitLabel").textContent = "Save changes";
    document.getElementById("cancelEdit").hidden = false;
    document.querySelector(".entry-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("description").focus();
    showToast("Editing expense.");
}

async function deleteExpense(id) {
    const expense = expenses.find(item => String(item.id) === String(id));
    if (!expense || !window.confirm(`Delete "${expense.description}"? This cannot be undone.`)) return;
    try {
        const response = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete expense");
        showToast("Expense deleted.");
        await loadExpenses();
    } catch (error) {
        console.error(error);
        showToast("Could not delete expense.", true);
    }
}

tableBody.addEventListener("click", event => {
    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;
    const expense = expenses.find(item => String(item.id) === actionButton.dataset.id);
    if (actionButton.dataset.action === "edit" && expense) startEditing(expense);
    if (actionButton.dataset.action === "delete") deleteExpense(actionButton.dataset.id);
});

document.getElementById("cancelEdit").addEventListener("click", () => {
    resetExpenseForm();
    showToast("Edit cancelled.");
});

form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const expense = { date: dateInput.value, description: document.getElementById("description").value.trim(), category: document.getElementById("category").value, amount: Number(document.getElementById("amount").value), currency: document.getElementById("currency").value };
    submitButton.disabled = true;
    document.getElementById("formStatus").textContent = "SAVING...";
    try {
        const wasEditing = editingExpenseId !== null;
        const endpoint = editingExpenseId ? `/api/expenses/${editingExpenseId}` : "/api/expenses";
        const response = await fetch(endpoint, { method: editingExpenseId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(expense) });
        if (!response.ok) throw new Error(editingExpenseId ? "Could not update expense" : "Could not add expense");
        resetExpenseForm();
        document.getElementById("currencyHint").textContent = "LKR is the reporting currency.";
        document.getElementById("formStatus").textContent = "SAVED";
        showToast(wasEditing ? "Expense updated." : "Expense added to your ledger.");
        pulse(document.querySelector(".stat-card-primary"));
        await loadExpenses();
    } catch (error) {
        console.error(error);
        document.getElementById("formStatus").textContent = "RETRY NEEDED";
        showToast("Could not add expense. Please try again.", true);
    } finally { submitButton.disabled = false; }
});

datePickerTrigger.addEventListener("click", () => calendarPopover.hidden ? openCalendar() : closeCalendar());
calendarDays.addEventListener("click", event => { const button = event.target.closest("[data-date]"); if (button) setSelectedDate(button.dataset.date); });
document.getElementById("previousMonth").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() - 1); renderCalendar(); });
document.getElementById("nextMonth").addEventListener("click", () => { calendarMonth.setMonth(calendarMonth.getMonth() + 1); renderCalendar(); });
document.getElementById("calendarToday").addEventListener("click", () => setSelectedDate(new Date().toISOString().slice(0, 10)));
document.addEventListener("click", event => { if (!event.target.closest(".calendar-field")) closeCalendar(); });
document.addEventListener("keydown", event => { if (event.key === "Escape") closeCalendar(); });

document.getElementById("currency").addEventListener("change", event => { document.getElementById("currencyHint").textContent = event.target.value === "LKR" ? "LKR is the reporting currency." : `${event.target.value} will be converted on save.`; showToast(`${event.target.value} selected.`); });
["search", "categoryFilter", "currencyFilter", "dateFrom", "dateTo"].forEach(id => document.getElementById(id).addEventListener("input", event => { renderExpenses(); pulse(document.querySelector(".table-section")); if (event.target.value) showToast("Filters updated."); }));
document.getElementById("clearFilters").addEventListener("click", () => { ["search", "categoryFilter", "currencyFilter", "dateFrom", "dateTo"].forEach(id => { document.getElementById(id).value = ""; }); renderExpenses(); showToast("Filters cleared."); });

document.getElementById("openCamera").addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
        showToast("Camera access is not available here. Upload a bill instead.", true);
        return;
    }
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        document.getElementById("cameraPreview").srcObject = cameraStream;
        document.getElementById("cameraStage").hidden = false;
    } catch (error) {
        console.error(error);
        showToast("Camera permission was not granted. Upload a bill instead.", true);
    }
});

document.getElementById("closeCamera").addEventListener("click", stopCamera);
document.getElementById("captureBill").addEventListener("click", () => {
    const video = document.getElementById("cameraPreview");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    stopCamera();
    processBill(canvas);
});
document.getElementById("billUpload").addEventListener("change", event => {
    const file = event.target.files[0];
    if (file) processBill(file);
    event.target.value = "";
});
document.getElementById("reviewList").addEventListener("click", event => {
    const button = event.target.closest("[data-review-index]");
    if (!button) return;
    const item = scannedItems[Number(button.dataset.reviewIndex)];
    if (!item) return;
    editingExpenseId = null;
    setSelectedDate(item.date || new Date().toISOString().slice(0, 10), false);
    document.getElementById("description").value = item.description;
    document.getElementById("amount").value = item.amount;
    document.getElementById("currency").value = item.currency;
    document.getElementById("category").value = item.category;
    document.getElementById("currencyHint").textContent = item.currency === "LKR" ? "LKR is the reporting currency." : `${item.currency} will be converted on save.`;
    document.querySelector(".entry-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("description").focus();
    scannedItems.splice(Number(button.dataset.reviewIndex), 1);
    renderScanReview();
    showToast("Item added to the form. Check it, then save.");
});
document.getElementById("clearScan").addEventListener("click", () => { scannedItems = []; renderScanReview(); showToast("Scan cleared."); });

let authMode = "login";
const authShell = document.getElementById("authShell");
const appShell = document.getElementById("appShell");
const authForm = document.getElementById("authForm");

function showApp(username) {
    document.getElementById("accountName").textContent = `@${username}`;
    authShell.hidden = true;
    appShell.hidden = false;
    dateInput.value = new Date().toISOString().slice(0, 10);
    setSelectedDate(dateInput.value, false);
    loadExpenses();
}

function setAuthMode(mode) {
    authMode = mode;
    const isLogin = mode === "login";
    document.getElementById("loginTab").classList.toggle("is-active", isLogin);
    document.getElementById("registerTab").classList.toggle("is-active", !isLogin);
    document.getElementById("loginTab").setAttribute("aria-selected", isLogin);
    document.getElementById("registerTab").setAttribute("aria-selected", !isLogin);
    document.getElementById("authHeading").textContent = isLogin ? "Welcome back" : "Create your ledger";
    document.getElementById("authSubtitle").textContent = isLogin ? "Enter your details to open your ledger." : "Your expenses will stay private to this account.";
    document.getElementById("authSubmit").innerHTML = `${isLogin ? "Log in" : "Create account"} <span aria-hidden="true">-&gt;</span>`;
    document.getElementById("authPassword").value = "";
    document.getElementById("authError").textContent = "";
}

authForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authForm.reportValidity()) return;
    const authError = document.getElementById("authError");
    const authSubmit = document.getElementById("authSubmit");
    authSubmit.disabled = true;
    authError.textContent = "";
    try {
        const response = await fetch(`/api/auth/${authMode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: document.getElementById("authUsername").value, password: document.getElementById("authPassword").value }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Authentication failed.");
        showToast(authMode === "login" ? "Welcome back." : "Account created.");
        showApp(result.username);
    } catch (error) {
        authError.textContent = error.message;
    } finally { authSubmit.disabled = false; }
});

document.getElementById("loginTab").addEventListener("click", () => setAuthMode("login"));
document.getElementById("registerTab").addEventListener("click", () => setAuthMode("register"));
document.getElementById("logoutButton").addEventListener("click", async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    appShell.hidden = true;
    authShell.hidden = false;
    authForm.reset();
    setAuthMode("login");
    showToast("You have been logged out.");
});

async function checkSession() {
    try {
        const response = await fetch("/api/auth/me");
        if (response.ok) showApp((await response.json()).username);
    } catch (error) { console.error(error); }
}

checkSession();

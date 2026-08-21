const form = document.getElementById("expenseForm");
const tableBody = document.getElementById("expenseTableBody");

form.addEventListener("submit", async function (event) {

    event.preventDefault();

    const expense = {
        date: document.getElementById("date").value,
        description: document.getElementById("description").value,
        category: document.getElementById("category").value,
        amount: parseFloat(document.getElementById("amount").value)
    };

    try {

        const response = await fetch("/api/expenses", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(expense)
        });

        if (!response.ok) {
            throw new Error("Failed to add expense");
        }

        form.reset();

        loadExpenses();

    } catch (error) {

        console.error(error);
        alert("Could not add expense.");

    }

});


async function loadExpenses() {

    try {

        const response = await fetch("/api/expenses");

        const expenses = await response.json();

        tableBody.innerHTML = "";

        expenses.forEach(expense => {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${expense.date}</td>
                <td>${expense.description}</td>
                <td>${expense.category}</td>
                <td>Rs. ${expense.amount}</td>
            `;

            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(error);

    }

}


loadExpenses();
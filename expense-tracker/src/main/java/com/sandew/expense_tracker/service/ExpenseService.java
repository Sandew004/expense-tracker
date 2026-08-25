package com.sandew.expense_tracker.service;

import com.sandew.expense_tracker.Expense;
import com.sandew.expense_tracker.ExpenseRepository;
import com.sandew.expense_tracker.AppUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ExchangeRateService exchangeRateService;

    public ExpenseService(ExpenseRepository expenseRepository, ExchangeRateService exchangeRateService) {
        this.expenseRepository = expenseRepository;
        this.exchangeRateService = exchangeRateService;
    }

    @Transactional
    public Expense createExpense(Expense expense, AppUser user) {
        expense.setUser(user);
        calculateLkrValues(expense);
        return expenseRepository.save(expense);
    }

    @Transactional
    public Expense updateExpense(Long id, Expense updatedExpense, AppUser user) {
        Expense expense = expenseRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new RuntimeException("Expense not found"));

        expense.setDate(updatedExpense.getDate());
        expense.setDescription(updatedExpense.getDescription());
        expense.setCategory(updatedExpense.getCategory());
        expense.setAmount(updatedExpense.getAmount());
        expense.setCurrency(updatedExpense.getCurrency());
        calculateLkrValues(expense);

        return expenseRepository.save(expense);
    }

    @Transactional(readOnly = true)
    public java.util.List<Expense> getAllExpenses(AppUser user) {
        return expenseRepository.findAllByUserOrderByDateDescIdDesc(user);
    }

    @Transactional(readOnly = true)
    public Expense getExpense(Long id, AppUser user) {
        return expenseRepository.findByIdAndUser(id, user)
                .orElseThrow(() -> new RuntimeException("Expense not found"));
    }

    @Transactional
    public void deleteExpense(Long id, AppUser user) {
        if (!expenseRepository.findByIdAndUser(id, user).isPresent()) {
            throw new RuntimeException("Expense not found");
        }
        expenseRepository.deleteByIdAndUser(id, user);
    }

    private void calculateLkrValues(Expense expense) {
        if (expense.getAmount() == null || expense.getAmount().signum() < 0) {
            throw new IllegalArgumentException("Amount must be zero or greater");
        }

        String currency = expense.getCurrency();
        BigDecimal rate = exchangeRateService.getRateToLkr(currency);
        expense.setCurrency(currency.trim().toUpperCase());
        expense.setExchangeRateToLkr(rate);
        expense.setAmountLkr(expense.getAmount().multiply(rate));
    }
}
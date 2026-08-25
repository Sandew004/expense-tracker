package com.sandew.expense_tracker;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import com.sandew.expense_tracker.service.ExpenseService;

import java.util.List;

@RestController
@RequestMapping("/api/expenses")
public class ExpenseController {

    private final AppUserRepository userRepository;
    private final ExpenseService expenseService;

    public ExpenseController(AppUserRepository userRepository, ExpenseService expenseService) {
        this.userRepository = userRepository;
        this.expenseService = expenseService;
    }

    @GetMapping
    public List<Expense> getAllExpenses(HttpSession session) {
        return expenseService.getAllExpenses(currentUser(session));
    }

    @GetMapping("/{id}")
    public Expense getExpense(@PathVariable Long id, HttpSession session) {
        return expenseService.getExpense(id, currentUser(session));
    }

    @PostMapping
    public Expense createExpense(@RequestBody Expense expense, HttpSession session) {
        return expenseService.createExpense(expense, currentUser(session));
    }

    @PutMapping("/{id}")
    public Expense updateExpense(
            @PathVariable Long id,
            @RequestBody Expense updatedExpense,
            HttpSession session) {

        return expenseService.updateExpense(id, updatedExpense, currentUser(session));
    }

    @DeleteMapping("/{id}")
    public void deleteExpense(@PathVariable Long id, HttpSession session) {
        expenseService.deleteExpense(id, currentUser(session));
    }

    private AppUser currentUser(HttpSession session) {
        Object userId = session.getAttribute(AuthController.USER_ID);
        if (!(userId instanceof Long)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in to manage expenses.");
        }
        return userRepository.findById((Long) userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in again."));
    }
}
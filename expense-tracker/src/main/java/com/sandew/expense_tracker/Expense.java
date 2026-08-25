package com.sandew.expense_tracker;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
public class Expense {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonIgnore
    private AppUser user;

    private LocalDate date;

    private String description;

    private String category;

    // Amount entered by the user
    @Column(nullable = false, precision = 19, scale = 4)
    private BigDecimal amount;

    // Currency entered by the user
    @Column(nullable = false, length = 3)
    private String currency;

    // Exchange rate from the entered currency to LKR
    @Column(name = "exchange_rate_to_lkr", nullable = false, precision = 19, scale = 4)
    private BigDecimal exchangeRateToLkr;

    // Converted amount in LKR
    @Column(name = "amount_lkr", nullable = false, precision = 19, scale = 4)
    private BigDecimal amountLkr;

    public Expense() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public AppUser getUser() {
        return user;
    }

    public void setUser(AppUser user) {
        this.user = user;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public void setAmount(BigDecimal amount) {
        this.amount = amount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public BigDecimal getExchangeRateToLkr() {
        return exchangeRateToLkr;
    }

    public void setExchangeRateToLkr(BigDecimal exchangeRateToLkr) {
        this.exchangeRateToLkr = exchangeRateToLkr;
    }

    public BigDecimal getAmountLkr() {
        return amountLkr;
    }

    public void setAmountLkr(BigDecimal amountLkr) {
        this.amountLkr = amountLkr;
    }
}
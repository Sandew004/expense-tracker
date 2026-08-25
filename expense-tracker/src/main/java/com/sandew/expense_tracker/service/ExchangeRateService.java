package com.sandew.expense_tracker.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class ExchangeRateService {

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String exchangeRateApiUrl;

    public ExchangeRateService(
            ObjectMapper objectMapper,
            @Value("${exchange-rate.api-url:https://api.frankfurter.dev/v2}") String exchangeRateApiUrl) {

        this.objectMapper = objectMapper;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        this.exchangeRateApiUrl = exchangeRateApiUrl;
    }

    public BigDecimal getRateToLkr(String currency) {

    String normalizedCurrency = normalizeCurrency(currency);

    if ("LKR".equals(normalizedCurrency)) {
        return BigDecimal.ONE;
    }

    try {
        URI uri = URI.create(
                exchangeRateApiUrl
                        + "/rate/"
                        + normalizedCurrency
                        + "/LKR"
        );

        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();

        HttpResponse<String> response =
                httpClient.send(
                        request,
                        HttpResponse.BodyHandlers.ofString()
                );

        if (response.statusCode() < 200 ||
                response.statusCode() >= 300) {

            throw new IllegalStateException(
                    "Exchange-rate API returned status "
                            + response.statusCode()
            );
        }

        JsonNode rate = objectMapper
                .readTree(response.body())
                .path("rate");

        if (!rate.isNumber()) {
            throw new IllegalStateException(
                    "Exchange-rate API did not return a rate for "
                            + normalizedCurrency
            );
        }

        return rate.decimalValue();

    } catch (InterruptedException exception) {

        Thread.currentThread().interrupt();

        throw new IllegalStateException(
                "Exchange-rate lookup was interrupted",
                exception
        );

    } catch (Exception exception) {

        throw new IllegalStateException(
                "Unable to get exchange rate for "
                        + normalizedCurrency,
                exception
        );
    }
}

    private String normalizeCurrency(String currency) {

        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException(
                    "Currency is required"
            );
        }

        return currency.trim().toUpperCase();
    }
}
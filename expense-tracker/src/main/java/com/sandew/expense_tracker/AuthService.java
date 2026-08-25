package com.sandew.expense_tracker;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final AppUserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public AppUser register(String username, String password) {
        String normalizedUsername = normalizeUsername(username);
        validatePassword(password);
        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("Username is already registered.");
        }
        return userRepository.save(new AppUser(normalizedUsername, passwordEncoder.encode(password)));
    }

    public AppUser authenticate(String username, String password) {
        String normalizedUsername = normalizeUsername(username);
        AppUser user = userRepository.findByUsernameIgnoreCase(normalizedUsername)
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password."));
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password.");
        }
        return user;
    }

    private String normalizeUsername(String username) {
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("Username is required.");
        }
        String normalized = username.trim().toLowerCase();
        if (!normalized.matches("[a-z0-9._-]{3,80}")) {
            throw new IllegalArgumentException("Username must be 3-80 characters and use letters, numbers, '.', '_' or '-'.");
        }
        return normalized;
    }

    private void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 72) {
            throw new IllegalArgumentException("Password must be 8-72 characters.");
        }
    }
}

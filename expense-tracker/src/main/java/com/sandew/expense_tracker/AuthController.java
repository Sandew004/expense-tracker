package com.sandew.expense_tracker;

import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public static final String USER_ID = "AUTH_USER_ID";
    public static final String USERNAME = "AUTH_USERNAME";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody AuthRequest request, HttpSession session) {
        try {
            AppUser user = authService.register(request.username(), request.password());
            establishSession(session, user);
            return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("username", user.getUsername()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.badRequest().body(Map.of("message", exception.getMessage()));
        }
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody AuthRequest request, HttpSession session) {
        try {
            AppUser user = authService.authenticate(request.username(), request.password());
            establishSession(session, user);
            return ResponseEntity.ok(Map.of("username", user.getUsername()));
        } catch (IllegalArgumentException exception) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", exception.getMessage()));
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpSession session) {
        session.invalidate();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public ResponseEntity<?> currentUser(HttpSession session) {
        Object username = session.getAttribute(USERNAME);
        if (username == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Not logged in."));
        }
        return ResponseEntity.ok(Map.of("username", username));
    }

    private void establishSession(HttpSession session, AppUser user) {
        session.setAttribute(USER_ID, user.getId());
        session.setAttribute(USERNAME, user.getUsername());
    }

    public record AuthRequest(String username, String password) {
    }
}

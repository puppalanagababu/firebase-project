import {
    auth,
    googleProvider,
    signInWithPopup,
    sendPasswordResetEmail
} from "./firebase.js";


// ============================
// DYNAMIC API CONFIGURATION
// ============================
// Automatically connects to local FastAPI during development (localhost / 127.0.0.1).
// In production, uses window.__API_URL__ or current origin.
const isLocalhost = Boolean(
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "[::1]"
);

const API_URL = isLocalhost
    ? "http://127.0.0.1:8000"
    : (window.__API_URL__ || window.location.origin);

// Helper for displaying styled inline feedback messages
function setMessage(element, text, isError = true) {
    if (!element) return;
    element.textContent = text;
    element.classList.remove("message-error", "message-success");
    element.classList.add(isError ? "message-error" : "message-success");
}

// ============================
// SIGNUP
// ============================
const signupForm = document.getElementById("signupForm");
if (signupForm) {
    const signupBtn = signupForm.querySelector("button[type='submit']");
    const message = document.getElementById("message");

    signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const nameInput = document.getElementById("name");
        const emailInput = document.getElementById("email");
        const passwordInput = document.getElementById("password");

        const name = nameInput ? nameInput.value.trim() : "";
        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        // Client-side validation
        if (!name) {
            setMessage(message, "Please enter your name.");
            return;
        }

        if (!email || !email.includes("@")) {
            setMessage(message, "Please enter a valid email address.");
            return;
        }

        if (!password || password.length < 6) {
            setMessage(message, "Password must contain at least 6 characters.");
            return;
        }

        // Set loading state
        if (signupBtn) {
            signupBtn.disabled = true;
            signupBtn.textContent = "Creating Account...";
        }
        setMessage(message, "");

        try {
            const response = await fetch(`${API_URL}/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    email: email,
                    password: password
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Failed to create account. Please try again.");
            }

            setMessage(message, "Account created successfully! Redirecting to login...", false);
            signupForm.reset();

            setTimeout(() => {
                window.location.href = "login.html";
            }, 800);

        } catch (error) {
            const errorMsg = error.message.includes("Failed to fetch")
                ? "Unable to connect to server. Please check your connection."
                : error.message;
            setMessage(message, errorMsg);
        } finally {
            if (signupBtn) {
                signupBtn.disabled = false;
                signupBtn.textContent = "Create Account";
            }
        }
    });
}

// ============================
// LOGIN
// ============================
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    const loginBtn = loginForm.querySelector("button[type='submit']");
    const loginMessage = document.getElementById("loginMessage");

    loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const emailInput = document.getElementById("loginEmail");
        const passwordInput = document.getElementById("loginPassword");

        const email = emailInput ? emailInput.value.trim() : "";
        const password = passwordInput ? passwordInput.value : "";

        // Client-side validation
        if (!email || !email.includes("@")) {
            setMessage(loginMessage, "Please enter a valid email address.");
            return;
        }

        if (!password) {
            setMessage(loginMessage, "Please enter your password.");
            return;
        }

        // Set loading state
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = "Logging in...";
        }
        setMessage(loginMessage, "");

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: email,
                    password: password
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Invalid email or password.");
            }

            // Store authentication tokens
            localStorage.setItem("id_token", data.id_token);
            localStorage.setItem("uid", data.uid);
            localStorage.setItem("email", data.email);

            setMessage(loginMessage, "Login successful! Redirecting...", false);

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 600);

        } catch (error) {
            const errorMsg = error.message.includes("Failed to fetch")
                ? "Unable to connect to server. Please check your connection."
                : error.message;
            setMessage(loginMessage, errorMsg);
        } finally {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = "Login";
            }
        }
    });
}

// ============================
// GOOGLE SIGN-IN
// ============================
const googleLoginButton = document.getElementById("googleLoginButton");
if (googleLoginButton) {
    const loginMessage = document.getElementById("loginMessage");

    googleLoginButton.addEventListener("click", async function () {
        googleLoginButton.disabled = true;
        const originalText = googleLoginButton.textContent;
        googleLoginButton.textContent = "Signing in with Google...";
        setMessage(loginMessage, "");

        try {
            const result = await signInWithPopup(auth, googleProvider);

            // Obtain ID token from Firebase user
            const idToken = await result.user.getIdToken();

            // Send token to FastAPI for verification and profile initialization
            const response = await fetch(`${API_URL}/google-login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id_token: idToken
                })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Google authentication failed on server.");
            }

            // Save authentication details
            localStorage.setItem("id_token", idToken);
            localStorage.setItem("uid", data.uid);
            localStorage.setItem("email", data.email);

            setMessage(loginMessage, "Signed in successfully! Redirecting...", false);

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 600);

        } catch (error) {
            console.error("Google login error:", error);

            let friendlyMessage = "Google sign-in failed. Please try again.";
            if (error.code === "auth/popup-closed-by-user") {
                friendlyMessage = "Sign-in popup was closed before completing.";
            } else if (error.code === "auth/popup-blocked") {
                friendlyMessage = "Pop-up was blocked by your browser. Please allow pop-ups for this site.";
            } else if (error.code === "auth/unauthorized-domain") {
                friendlyMessage = "This domain is not authorized for Google Sign-In in Firebase.";
            } else if (error.code === "auth/network-request-failed" || error.message.includes("Failed to fetch")) {
                friendlyMessage = "Network error. Please check your connection.";
            } else if (error.message) {
                friendlyMessage = error.message;
            }

            setMessage(loginMessage, friendlyMessage);
        } finally {
            googleLoginButton.disabled = false;
            googleLoginButton.textContent = originalText;
        }
    });
}

// ============================
// DASHBOARD
// ============================
const profileElement = document.getElementById("profile");
if (profileElement) {
    const token = localStorage.getItem("id_token");

    // No token → redirect to login
    if (!token) {
        window.location.href = "login.html";
    } else {
        fetch(`${API_URL}/profile`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        })
        .then(async response => {
            const data = await response.json().catch(() => ({}));

            // If token is invalid/expired (401)
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = "login.html";
                return;
            }

            if (!response.ok) {
                throw new Error(data.detail || "Unable to load profile data.");
            }

            return data;
        })
        .then(data => {
            if (!data || !data.profile) return;

            const profile = data.profile;
            const welcomeMessage = document.getElementById("welcomeMessage");
            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${profile.name || "User"}!`;
            }

            profileElement.innerHTML = `
                <p><strong>Name:</strong> ${escapeHtml(profile.name || "N/A")}</p>
                <p><strong>Email:</strong> ${escapeHtml(profile.email || "N/A")}</p>
                <p><strong>Role:</strong> ${escapeHtml(profile.role || "user")}</p>
                <p><strong>Sign-in Method:</strong> ${profile.provider === "google.com" ? "Google Account" : "Email & Password"}</p>
            `;

            const changePasswordForm = document.getElementById("changePasswordForm");
            const changePasswordMsg = document.getElementById("changePasswordMsg");
            if (profile.provider === "google.com" && changePasswordForm) {
                changePasswordForm.innerHTML = `
                    <div style="padding: 12px; background: #f3f4f6; border-radius: 6px; color: #4b5563; font-size: 14px;">
                        🔑 <strong>Google Sign-In Account:</strong> You are signed in using Google OAuth. Password changes are managed directly in your Google Account.
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error("Profile error:", error);
            profileElement.textContent = error.message || "Unable to load your profile.";
        });
    }
}


// Helper to escape HTML and prevent XSS in profile data display
function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// ============================
// FORGOT PASSWORD
// ============================
const forgotPasswordForm = document.getElementById("forgotPasswordForm");
if (forgotPasswordForm) {
    const forgotSubmitBtn = document.getElementById("forgotSubmitBtn");
    const forgotMessage = document.getElementById("forgotMessage");

    forgotPasswordForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const emailInput = document.getElementById("forgotEmail");
        const email = emailInput ? emailInput.value.trim() : "";

        if (!email || !email.includes("@")) {
            setMessage(forgotMessage, "Please enter a valid email address.");
            return;
        }

        if (forgotSubmitBtn) {
            forgotSubmitBtn.disabled = true;
            forgotSubmitBtn.textContent = "Sending...";
        }
        setMessage(forgotMessage, "");

        try {
            // Call backend API to inspect account and dispatch email
            const response = await fetch(`${API_URL}/forgot-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Failed to send reset email.");
            }

            if (data.not_found) {
                setMessage(forgotMessage, data.message || "Account not found.", true);
                return;
            }

            if (data.is_google_account) {
                forgotMessage.className = "message-error";
                forgotMessage.innerHTML = `<strong>Google Sign-In Account:</strong> ${escapeHtml(data.message)} <br><br><a href="login.html" style="color:#2563eb;font-weight:600;">Go to Login</a>`;
                return;
            }

            // Also trigger Client SDK dispatch
            try {
                await sendPasswordResetEmail(auth, email);
            } catch (clientErr) {
                console.warn("Client SDK notice:", clientErr.message);
            }

            forgotMessage.className = "message-success";
            let successHtml = `
                <strong>Email Sent!</strong> Password reset instructions have been sent to <strong>${escapeHtml(email)}</strong>.<br><br>
                <em>Tip: Please check both your <strong>Inbox</strong> and <strong>Spam/Junk</strong> folder.</em>
            `;

            if (data.reset_link) {
                successHtml += `
                    <div style="margin-top: 15px; padding: 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; text-align: left;">
                        <span style="font-size: 13px; color: #1e40af; font-weight: 600;">Direct Test Link:</span><br>
                        <a href="${data.reset_link}" target="_blank" style="color: #2563eb; font-weight: 700; word-break: break-all; text-decoration: underline; font-size: 13px;">
                            Click here to reset your password now
                        </a>
                    </div>
                `;
            }

            forgotMessage.innerHTML = successHtml;
            forgotPasswordForm.reset();

        } catch (error) {
            console.error("Password reset error:", error);
            const errorMsg = error.message.includes("Failed to fetch")
                ? "Unable to connect to server. Check your connection."
                : error.message;
            setMessage(forgotMessage, errorMsg);
        } finally {
            if (forgotSubmitBtn) {
                forgotSubmitBtn.disabled = false;
                forgotSubmitBtn.textContent = "Send Reset Link";
            }
        }
    });
}



// ============================
// CHANGE PASSWORD
// ============================
const changePasswordForm = document.getElementById("changePasswordForm");
if (changePasswordForm) {
    const changePasswordBtn = document.getElementById("changePasswordBtn");
    const changePasswordMsg = document.getElementById("changePasswordMsg");
    const token = localStorage.getItem("id_token");

    changePasswordForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const newPasswordInput = document.getElementById("newPassword");
        const confirmPasswordInput = document.getElementById("confirmPassword");

        const newPassword = newPasswordInput ? newPasswordInput.value : "";
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";

        if (!newPassword || newPassword.length < 6) {
            setMessage(changePasswordMsg, "New password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage(changePasswordMsg, "Passwords do not match. Please re-enter.");
            return;
        }

        if (!token) {
            window.location.href = "login.html";
            return;
        }

        if (changePasswordBtn) {
            changePasswordBtn.disabled = true;
            changePasswordBtn.textContent = "Updating...";
        }
        setMessage(changePasswordMsg, "");

        try {
            const response = await fetch(`${API_URL}/change-password`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ new_password: newPassword })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Failed to update password.");
            }

            setMessage(changePasswordMsg, data.message || "Password changed successfully!", false);
            changePasswordForm.reset();

        } catch (error) {
            const errorMsg = error.message.includes("Failed to fetch")
                ? "Unable to connect to server."
                : error.message;
            setMessage(changePasswordMsg, errorMsg);
        } finally {
            if (changePasswordBtn) {
                changePasswordBtn.disabled = false;
                changePasswordBtn.textContent = "Update Password";
            }
        }
    });
}

// ============================
// DELETE ACCOUNT
// ============================
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
if (deleteAccountBtn) {
    const deleteAccountMsg = document.getElementById("deleteAccountMsg");

    deleteAccountBtn.addEventListener("click", async function () {
        const confirmed = window.confirm(
            "⚠️ Are you sure you want to permanently delete your account?\nThis will remove all your data and cannot be undone."
        );

        if (!confirmed) return;

        const token = localStorage.getItem("id_token");
        if (!token) {
            window.location.href = "login.html";
            return;
        }

        deleteAccountBtn.disabled = true;
        deleteAccountBtn.textContent = "Deleting account...";
        if (deleteAccountMsg) setMessage(deleteAccountMsg, "");

        try {
            const response = await fetch(`${API_URL}/delete-account`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(data.detail || "Failed to delete account.");
            }

            alert("Your account has been deleted successfully.");
            localStorage.clear();
            window.location.href = "signup.html";

        } catch (error) {
            console.error("Delete error:", error);
            if (deleteAccountMsg) {
                setMessage(deleteAccountMsg, error.message || "Unable to delete account.");
            }
            deleteAccountBtn.disabled = false;
            deleteAccountBtn.textContent = "Delete My Account";
        }
    });
}

// ============================
// LOGOUT
// ============================
const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        localStorage.clear();
        window.location.href = "login.html";
    });
}


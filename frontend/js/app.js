import {
    auth,
    googleProvider,
    signInWithPopup
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

            localStorage.setItem("unverified_email", email);
            if (data.verification_link) {
                localStorage.setItem("verification_link", data.verification_link);
            }

            setMessage(message, "Account created! Redirecting to email verification...", false);
            signupForm.reset();

            setTimeout(() => {
                window.location.href = "verify-email.html";
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
            localStorage.setItem("unverified_email", data.email);

            if (data.email_verified === false) {
                setMessage(loginMessage, "Email not verified. Redirecting...", false);
                setTimeout(() => {
                    window.location.href = "verify-email.html";
                }, 600);
            } else {
                setMessage(loginMessage, "Login successful! Redirecting...", false);
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 600);
            }

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
// VERIFY EMAIL PAGE
// ============================
const userEmailDisplay = document.getElementById("userEmailDisplay");
if (userEmailDisplay) {
    const email = localStorage.getItem("email") || localStorage.getItem("unverified_email") || "your email";
    userEmailDisplay.textContent = email;

    const resendBtn = document.getElementById("resendVerificationBtn");
    const checkBtn = document.getElementById("checkVerificationBtn");
    const statusText = document.getElementById("resendStatus");
    const token = localStorage.getItem("id_token");
    const verificationLink = localStorage.getItem("verification_link");

    // If local test link exists, show quick action
    if (verificationLink && statusText) {
        statusText.innerHTML = `Direct test link: <a href="${verificationLink}" target="_blank" style="color:#2563eb;font-weight:600;text-decoration:underline;">Click here to verify email</a>`;
    }

    if (checkBtn) {
        checkBtn.addEventListener("click", async function () {
            checkBtn.disabled = true;
            checkBtn.textContent = "Checking...";
            if (statusText) statusText.textContent = "";

            if (!token) {
                // If user registered but hasn't logged in, send to login
                window.location.href = "login.html";
                return;
            }

            try {
                const response = await fetch(`${API_URL}/profile`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${token}`
                    }
                });

                const data = await response.json().catch(() => ({}));

                if (response.status === 401) {
                    window.location.href = "login.html";
                    return;
                }

                if (data.profile && data.profile.email_verified) {
                    localStorage.removeItem("verification_link");
                    window.location.href = "dashboard.html";
                } else {
                    if (statusText) {
                        statusText.style.color = "#dc2626";
                        statusText.textContent = "Email is not verified yet. Please click the link in your email first.";
                    }
                }
            } catch (err) {
                if (statusText) {
                    statusText.style.color = "#dc2626";
                    statusText.textContent = "Unable to check verification status. Please try again.";
                }
            } finally {
                checkBtn.disabled = false;
                checkBtn.textContent = "I've Verified My Email (Continue)";
            }
        });
    }

    if (resendBtn) {
        resendBtn.addEventListener("click", async function () {
            resendBtn.disabled = true;
            resendBtn.textContent = "Sending...";
            if (statusText) statusText.textContent = "";

            try {
                const response = await fetch(`${API_URL}/send-verification-email`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(token ? { "Authorization": `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({
                        id_token: token || null
                    })
                });

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(data.detail || "Failed to resend verification email.");
                }

                if (statusText) {
                    statusText.style.color = "#15803d";
                    if (data.verification_link) {
                        statusText.innerHTML = `Verification link: <a href="${data.verification_link}" target="_blank" style="color:#2563eb;font-weight:600;text-decoration:underline;">Click to verify now</a>`;
                    } else {
                        statusText.textContent = "Verification email sent! Check your inbox.";
                    }
                }

                let countdown = 60;
                const timer = setInterval(() => {
                    countdown--;
                    if (countdown > 0) {
                        resendBtn.textContent = `Resend in ${countdown}s`;
                    } else {
                        clearInterval(timer);
                        resendBtn.disabled = false;
                        resendBtn.textContent = "Resend Verification Email";
                    }
                }, 1000);

            } catch (err) {
                if (statusText) {
                    statusText.style.color = "#dc2626";
                    statusText.textContent = err.message || "Failed to resend.";
                }
                resendBtn.disabled = false;
                resendBtn.textContent = "Resend Verification Email";
            }
        });
    }

    const logoutFromVerify = document.getElementById("logoutFromVerify");
    if (logoutFromVerify) {
        logoutFromVerify.addEventListener("click", function () {
            localStorage.clear();
        });
    }
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

            // If email is not verified, block dashboard and send to verify screen
            if (!profile.email_verified) {
                window.location.href = "verify-email.html";
                return;
            }

            const welcomeMessage = document.getElementById("welcomeMessage");
            if (welcomeMessage) {
                welcomeMessage.textContent = `Welcome, ${profile.name || "User"}!`;
            }

            profileElement.innerHTML = `
                <p><strong>Name:</strong> ${escapeHtml(profile.name || "N/A")}</p>
                <p><strong>Email:</strong> ${escapeHtml(profile.email || "N/A")} <span class="badge badge-verified">Verified &#10003;</span></p>
                <p><strong>Role:</strong> ${escapeHtml(profile.role || "user")}</p>
            `;
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
// LOGOUT
// ============================
const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
    logoutButton.addEventListener("click", function () {
        localStorage.clear();
        window.location.href = "login.html";
    });
}
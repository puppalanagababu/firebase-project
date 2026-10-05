from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from firebase_admin import auth
from firebase_config import db
from datetime import datetime, timezone
from dotenv import load_dotenv
import os
import requests

load_dotenv()

FIREBASE_WEB_API_KEY = os.getenv("FIREBASE_WEB_API_KEY")


# Allowed origins for CORS (local development + production frontend URL)
default_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:8000",
    "http://localhost:8000",
]

frontend_url_env = os.getenv("FRONTEND_URL", "")
if frontend_url_env:
    configured_origins = [origin.strip() for origin in frontend_url_env.split(",") if origin.strip()]
else:
    configured_origins = []

allowed_origins = list(set(default_origins + configured_origins))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()
class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    id_token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    token = credentials.credentials

    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

@app.get("/")
def home():
    return {
        "message": "Firebase Authentication API is running"
    }

@app.post("/signup")
def signup(user: SignupRequest):

    if len(user.password) < 6:
        raise HTTPException(
            status_code=400,
            detail="Password must contain at least 6 characters"
        )

    try:
        # Create Firebase Authentication user
        firebase_user = auth.create_user(
            email=user.email,
            password=user.password
        )
        uid = firebase_user.uid
        # Create Firestore user profile
        db.collection("users").document(uid).set({
            "name": user.name,
            "email": user.email,
            "role": "user",
            "created_at": datetime.now(timezone.utc)
        })

        return {
            "message": "User registered successfully",
            "uid": uid,
            "name": user.name,
            "email": user.email
        }

    except auth.EmailAlreadyExistsError:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    except Exception:
        raise HTTPException(
        status_code=500,
        detail="Something went wrong while creating the account"
    )

@app.post("/login")
def login(user: LoginRequest):

    if not FIREBASE_WEB_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="Firebase Web API key is not configured"
        )
    url = (
        "https://identitytoolkit.googleapis.com/v1/accounts:"
        f"signInWithPassword?key={FIREBASE_WEB_API_KEY}"
    )
    payload = {
        "email": user.email,
        "password": user.password,
        "returnSecureToken": True
    }

    response = requests.post(
        url,
        json=payload
    )

    if response.status_code != 200:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    data = response.json()

    return {
        "message": "Login successful",
        "id_token": data["idToken"],
        "refresh_token": data["refreshToken"],
        "uid": data["localId"],
        "email": data["email"]
    }

@app.get("/profile")
def get_profile(
    current_user=Depends(get_current_user)
):

    uid = current_user["uid"]

    user_document = (
        db.collection("users")
        .document(uid)
        .get()
    )
    if not user_document.exists:
        raise HTTPException(
            status_code=404,
            detail="User profile not found"
        )

    return {
        "message": "Profile retrieved successfully",
        "profile": user_document.to_dict()
    }
@app.post("/google-login")
def google_login(user: GoogleLoginRequest):

    try:
        # Verify Firebase ID token
        decoded_token = auth.verify_id_token(
            user.id_token
        )

        uid = decoded_token["uid"]
        email = decoded_token.get("email")
        name = decoded_token.get("name", "User")

        # Check Firestore profile
        user_ref = (
            db.collection("users")
            .document(uid)
        )

        user_document = user_ref.get()

        # Create profile if it doesn't exist
        if not user_document.exists:

            user_ref.set({
                "name": name,
                "email": email,
                "role": "user",
                "created_at": datetime.now(timezone.utc)
            })

        return {
            "message": "Google login successful",
            "uid": uid,
            "email": email
        }

    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google authentication"
        )


from fastapi.staticfiles import StaticFiles
from pathlib import Path

# Static files mount for unified serving (must be placed after all API route handlers)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


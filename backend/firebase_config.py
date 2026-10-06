import base64
import json
import logging
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("firebase_config")

# Initialize Firebase Admin SDK if not already initialized
if not firebase_admin._apps:
    cred_json_str = os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    cred_env_path = os.getenv("FIREBASE_CREDENTIALS_PATH") or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    
    # Candidate local paths
    local_paths = [
        Path(__file__).parent / "firebase-admin-key.json",
        Path(__file__).resolve().parent.parent / "firebase-admin-key.json",
    ]
    existing_local_key = next((p for p in local_paths if p.exists()), None)

    cred = None

    if cred_json_str and cred_json_str.strip():
        try:
            trimmed = cred_json_str.strip()
            if trimmed.startswith("{"):
                cred_dict = json.loads(trimmed)
            else:
                try:
                    decoded = base64.b64decode(trimmed).decode("utf-8")
                    cred_dict = json.loads(decoded)
                except Exception:
                    cred_dict = json.loads(trimmed)

            if "private_key" in cred_dict and isinstance(cred_dict["private_key"], str):
                # Ensure escaped newlines are properly converted
                cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")

            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin initialized from FIREBASE_ADMIN_CREDENTIALS environment variable.")
        except Exception as e:
            logger.error(f"Failed to load credentials from FIREBASE_ADMIN_CREDENTIALS: {e}")
            raise ValueError(
                "Invalid FIREBASE_ADMIN_CREDENTIALS environment variable. "
                "Ensure it is valid JSON of your Firebase service account key."
            ) from e

    elif cred_env_path and os.path.exists(cred_env_path):
        cred = credentials.Certificate(cred_env_path)
        firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin initialized from credentials file: {cred_env_path}")

    elif existing_local_key:
        cred = credentials.Certificate(str(existing_local_key))
        firebase_admin.initialize_app(cred)
        logger.info(f"Firebase Admin initialized from local key: {existing_local_key}")

    else:
        # Fallback to default credentials (for GCP environments)
        try:
            firebase_admin.initialize_app()
            logger.info("Firebase Admin initialized with default Google application credentials.")
        except Exception as e:
            raise RuntimeError(
                "Firebase Admin credentials could not be found! "
                "For production (e.g. Render), please add the 'FIREBASE_ADMIN_CREDENTIALS' "
                "environment variable with your service account JSON in your dashboard."
            ) from e

try:
    db = firestore.client()
except Exception as e:
    raise RuntimeError(
        "Could not connect to Firestore. Verify that your Firebase service account credentials "
        "have the required Firestore permissions and that FIREBASE_ADMIN_CREDENTIALS is set."
    ) from e




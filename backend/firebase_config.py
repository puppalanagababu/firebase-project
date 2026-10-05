import json
import os
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin SDK if not already initialized
if not firebase_admin._apps:
    cred_json_str = os.getenv("FIREBASE_ADMIN_CREDENTIALS")
    cred_env_path = os.getenv("FIREBASE_CREDENTIALS_PATH")
    default_key_path = Path(__file__).parent / "firebase-admin-key.json"

    if cred_json_str:
        cred_dict = json.loads(cred_json_str)
        cred = credentials.Certificate(cred_dict)
        firebase_admin.initialize_app(cred)
    elif cred_env_path and os.path.exists(cred_env_path):
        cred = credentials.Certificate(cred_env_path)
        firebase_admin.initialize_app(cred)
    elif default_key_path.exists():
        cred = credentials.Certificate(str(default_key_path))
        firebase_admin.initialize_app(cred)
    else:
        # Fallback to default credentials
        firebase_admin.initialize_app()

db = firestore.client()



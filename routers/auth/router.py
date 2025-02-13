from fastapi import APIRouter
from fastapi import Request
import requests
from dotenv import load_dotenv
from os import getenv

load_dotenv()

authRouter = APIRouter()

@authRouter.get("/google/callback")
async def google_callback(request: Request):
    params = dict(request.query_params)
    print("Google callback received:")
    print("Query parameters:", params)
    if "code" in params:
        token_url = "https://oauth2.googleapis.com/token"
        client_secret = getenv("GOOGLE_CLIENT_SECRET")
        client_id = getenv("GOOGLE_CLIENT_ID")
        data = {
            "code": params["code"],
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": "http://localhost:8000/auth/google/callback",
            "grant_type": "authorization_code"
        }
        response = requests.post(token_url, data=data)
        token_data = response.json()
        return token_data

@authRouter.get("/google/login")
async def google_login():
    client_id = getenv("GOOGLE_CLIENT_ID")
    redirect_uri = "http://localhost:8000/auth/google/callback"

    # Corrected scopes for limited access
    scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        # "https://www.googleapis.com/auth/drive.file",
    ]
    scope = " ".join(scopes)

    # Construct the redirect URL
    redirect_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope={scope}"
        f"&access_type=offline"
        f"&include_granted_scopes=true"
        f"&prompt=consent"
        f"&state=google"
    )

    return {"url": redirect_url}

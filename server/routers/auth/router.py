import uuid
from fastapi import APIRouter
from fastapi import Request
import requests
from dotenv import load_dotenv
from os import getenv

from db.models.user import User
from utils.db import new_session

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
        print(getenv("SERVER_URL") + "/auth/google/callback")
        data = {
            "code": params["code"],
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": getenv("SERVER_URL") + "/auth/google/callback",
            "grant_type": "authorization_code"
        }
        
        response = requests.post(token_url, data=data)
        token_data = response.json()
        
        if response.status_code != 200:
            return {"error": "Failed to get tokens", "status": response.status_code}
            
        if "access_token" not in token_data or "refresh_token" not in token_data:
            return {"error": "Missing required tokens in response"}
            
        try:
            
            db = new_session()
            
            # Try to get existing user or create new one
            user = User()
            user.id = params["state"]
            user.access_token = token_data["access_token"]
            user.refresh_token = token_data["refresh_token"]
            user.id_token = token_data["id_token"]
            db.add(user)
            db.commit()
        except Exception as e:
            return {"error": f"Database operation failed: {str(e)}"}
        
        return {"token_data": token_data, "userid": params["state"]}

@authRouter.get("/google/login")
async def google_login():
    client_id = getenv("GOOGLE_CLIENT_ID")
    redirect_uri = getenv("SERVER_URL") + "/auth/google/callback"
    
    userid = uuid.uuid4()

    # Corrected scopes for limited access
    scopes = [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/userinfo.profile"
    ]
    scope = "+".join(scopes)

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
        f"&state={userid}"
    )

    return {"url": redirect_url, "userid": userid}


@authRouter.get("/google/getinfo")
async def get_google_info(request: Request):
    params = dict(request.query_params)
    
    userid = params["userid"]
    
    if not userid:
        return {"error": "Missing userid"}
    
    db = new_session()
    
    user = db.query(User).filter(User.id == userid).first()
    
    if not user:
        return {"error": "User not found"}
    
    url = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=" + user.access_token
    
    response = requests.get(url)
    
    if response.status_code != 200:
        return {"error": "Failed to get user info", "status": response.status_code}
    
    data = response.json()
    
    user.google_id = data["id"]
    user.name = data["name"]
    user.picture = data["picture"]
    
    db.add(user)
    db.commit()
        
    return data
    
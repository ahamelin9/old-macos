from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
import requests
import os
import base64
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
REDIRECT_URI = "http://127.0.0.1:8000/callback"

@app.get("/login")
def login():
    # show_dialog=true forces the user to see the permission screen again
    # This ensures they approve the 'streaming' scope if they were already logged in.
    scope = "user-read-private user-read-email user-modify-playback-state user-read-playback-state streaming"
    url = f"https://accounts.spotify.com/authorize?response_type=code&client_id={CLIENT_ID}&scope={scope}&redirect_uri={REDIRECT_URI}&show_dialog=true"
    return RedirectResponse(url)

@app.get("/callback")
def callback(request: Request, code: str = None):
    # Log all params to see what Spotify is sending
    print(f"DEBUG: Callback params: {request.query_params}")
    
    error = request.query_params.get("error")
    if error:
        print(f"DEBUG: Spotify returned error: {error}")
        return RedirectResponse(f"http://127.0.0.1:5173/?error={error}")

    if not code:
        return RedirectResponse("http://127.0.0.1:5173")
        
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
        },
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to get token")
    
    tokens = response.json()
    # Redirect back to the frontend on the loopback address
    frontend_url = "http://127.0.0.1:5173/?access_token=" + tokens.get("access_token") + "&refresh_token=" + tokens.get("refresh_token")
    return RedirectResponse(frontend_url)

@app.get("/refresh")
def refresh(refresh_token: str):
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        },
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to refresh token")
    
    return response.json()

@app.get("/client_credentials")
def client_credentials():
    auth_header = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    response = requests.post(
        "https://accounts.spotify.com/api/token",
        data={"grant_type": "client_credentials"},
        headers={
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
    )
    
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to get client credentials")
    
    return response.json()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

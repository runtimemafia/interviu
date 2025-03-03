from fastapi import FastAPI
from routers.auth.router import authRouter

app = FastAPI()


@app.get("/")
async def root():
    return {"message": "Hello World"}

app.include_router(authRouter, prefix="/auth")
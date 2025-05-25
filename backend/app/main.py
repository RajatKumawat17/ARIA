# Placeholder - will implement later
from fastapi import FastAPI

app = FastAPI(title="AI Personal Assistant", version="0.1.0")

@app.get("/")
async def root():
    return {"message": "AI Assistant is running!"}
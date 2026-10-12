import json
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.schemas import RecommendationRequest, RecommendationResponse

app = FastAPI(title="Field Shift API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "healthy"}

@app.post("/api/v1/recommend-rotation", response_model=RecommendationResponse)
def recommend_rotation(request: RecommendationRequest):
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "default_response.json")
    with open(fixture_path, "r") as f:
        data = json.load(f)
    
    # Simple modification to show coordinates matching request if we want
    # but the instructions say "returning a deterministic RecommendationResponse fixture based on DATA_SCHEMA.md."
    return data

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict
import re

app = FastAPI(title="Prometheus Retention API")

# In-memory store for retention policies
retention_policies: Dict[str, str] = {}

# Regex to validate retention time format like '7d', '12h', '30m'
VALID_DURATION_REGEX = re.compile(r"^\d+[smhdw]$")

# Request model
class RetentionPolicy(BaseModel):
    metric: str
    retention: str  # e.g., "7d", "12h", "30m"

@app.get("/")
def read_root():
    return {"message": "Prometheus Retention API is up and running"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/retention-policy")
def list_policies():
    return retention_policies

@app.post("/retention-policy")
def add_or_update_policy(policy: RetentionPolicy):
    if not VALID_DURATION_REGEX.match(policy.retention):
        raise HTTPException(status_code=400, detail="Invalid retention format. Use formats like '7d', '12h', '30m'")
    
    retention_policies[policy.metric] = policy.retention
    return {"message": f"Policy for '{policy.metric}' set to {policy.retention}"}

@app.delete("/retention-policy/{metric}")
def delete_policy(metric: str):
    if metric not in retention_policies:
        raise HTTPException(status_code=404, detail="Policy not found")
    del retention_policies[metric]
    return {"message": f"Policy for '{metric}' removed"}
from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from typing import List
import uvicorn
import os

from database import get_db, engine
from models import RetentionPolicyCreate, RetentionPolicyResponse, RetentionPolicyUpdate
from retention_service import RetentionService
from scheduler import start_scheduler
from logger import setup_logger
import database

# Set up logging
logger = setup_logger()

# Create database tables
database.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Prometheus Retention Manager",
    description="API for managing custom retention policies for Prometheus metrics",
    version="1.0.0"
)

# Mount static files (CSS, JS, images)
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")

retention_service = RetentionService()

@app.on_event("startup")
async def startup_event():
    """Start the background scheduler when the app starts"""
    logger.info("Starting application...")
    start_scheduler(retention_service)
    logger.info("Background scheduler started successfully")

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    """Serve the web UI"""
    try:
        with open("index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    except FileNotFoundError:
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Prometheus Retention Manager</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; }
                .container { max-width: 600px; margin: 0 auto; }
                .api-link { background: #3b82f6; color: white; padding: 1rem 2rem; 
                           text-decoration: none; border-radius: 0.5rem; display: inline-block; margin: 0.5rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🗄️ Prometheus Retention Manager</h1>
                <p>API for managing custom retention policies for Prometheus metrics</p>
                
                <h2>Available Endpoints:</h2>
                <div>
                    <a href="/docs" class="api-link">📖 API Documentation</a>
                    <a href="/health" class="api-link">❤️ Health Check</a>
                    <a href="/retention-policies" class="api-link">📋 View Policies (JSON)</a>
                </div>
                
                <h3>Quick Start:</h3>
                <p>1. Create retention policies using the API</p>
                <p>2. Policies will execute automatically based on the configured schedule</p>
                <p>3. Monitor execution via the health endpoint</p>
                
                <p><small>To use the web UI, place the HTML, CSS, and JS files in the application directory.</small></p>
            </div>
        </body>
        </html>
        """)

@app.post("/retention-policies", response_model=RetentionPolicyResponse)
async def create_retention_policy(
    policy: RetentionPolicyCreate,
    db: Session = Depends(get_db)
):
    """Create a new retention policy"""
    try:
        return retention_service.create_policy(db, policy)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/retention-policies", response_model=List[RetentionPolicyResponse])
async def get_retention_policies(db: Session = Depends(get_db)):
    """Get all retention policies"""
    return retention_service.get_all_policies(db)

@app.get("/retention-policies/{policy_id}", response_model=RetentionPolicyResponse)
async def get_retention_policy(policy_id: int, db: Session = Depends(get_db)):
    """Get a specific retention policy by ID"""
    policy = retention_service.get_policy(db, policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Retention policy not found")
    return policy

@app.put("/retention-policies/{policy_id}", response_model=RetentionPolicyResponse)
async def update_retention_policy(
    policy_id: int,
    policy_update: RetentionPolicyUpdate,
    db: Session = Depends(get_db)
):
    """Update a retention policy"""
    try:
        updated_policy = retention_service.update_policy(db, policy_id, policy_update)
        if not updated_policy:
            raise HTTPException(status_code=404, detail="Retention policy not found")
        return updated_policy
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.delete("/retention-policies/{policy_id}")
async def delete_retention_policy(policy_id: int, db: Session = Depends(get_db)):
    """Delete a retention policy"""
    success = retention_service.delete_policy(db, policy_id)
    if not success:
        raise HTTPException(status_code=404, detail="Retention policy not found")
    return {"message": "Retention policy deleted successfully"}

@app.post("/retention-policies/{policy_id}/execute")
async def execute_retention_policy(policy_id: int, db: Session = Depends(get_db)):
    """Manually execute a specific retention policy"""
    try:
        result = await retention_service.execute_policy(db, policy_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/execute-all-policies")
async def execute_all_policies(db: Session = Depends(get_db)):
    """Manually execute all retention policies"""
    try:
        results = await retention_service.execute_all_policies(db)
        return {"message": "All policies executed", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Prometheus connection
        prometheus_status = await retention_service.check_prometheus_connection()
        return {
            "status": "healthy",
            "prometheus_connection": prometheus_status
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
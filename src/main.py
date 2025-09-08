from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, Response, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import uvicorn
import os
import httpx
import asyncio
from urllib.parse import urlencode
import json

from database import get_db, engine
from models import RetentionPolicyCreate, RetentionPolicyResponse, RetentionPolicyUpdate
from retention_service import RetentionService
from scheduler import start_scheduler
from logger import setup_logger
from ai_service import AIService
import database

# Set up logging
logger = setup_logger()

# Create database tables
database.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Prometheus Management Console",
    description="Unified interface for Prometheus monitoring and retention management",
    version="2.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files (CSS, JS, images)
# if os.path.exists("static"):
#     app.mount("/static", StaticFiles(directory="static"), name="static")

retention_service = RetentionService()
ai_service = AIService()

@app.on_event("startup")
async def startup_event():
    """Start the background scheduler when the app starts"""
    logger.info("Starting Prometheus Management Console...")
    start_scheduler(retention_service)
    logger.info("Background scheduler started successfully")

# @app.get("/", response_class=HTMLResponse)
# async def serve_ui():
#     """Serve the unified web UI"""
#     try:
#         with open("index.html", "r", encoding="utf-8") as f:
#             return HTMLResponse(content=f.read())
#     except FileNotFoundError:
#         return HTMLResponse(content="""
#         <!DOCTYPE html>
#         <html>
#         <head>
#             <title>Prometheus Management Console</title>
#             <style>
#                 body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; 
#                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
#                 .container { max-width: 600px; margin: 0 auto; }
#                 .logo { font-size: 4rem; margin-bottom: 1rem; }
#                 .api-link { background: rgba(255,255,255,0.2); color: white; padding: 1rem 2rem; 
#                            text-decoration: none; border-radius: 0.5rem; display: inline-block; margin: 0.5rem;
#                            border: 1px solid rgba(255,255,255,0.3); transition: all 0.3s; }
#                 .api-link:hover { background: rgba(255,255,255,0.3); transform: translateY(-2px); }
#             </style>
#         </head>
#         <body>
#             <div class="container">
#                 <div class="logo">🔥</div>
#                 <h1>Prometheus Management Console</h1>
#                 <p>Unified interface for Prometheus monitoring and retention management</p>
#                 
#                 <h2>Available Endpoints:</h2>
#                 <div>
#                     <a href="/docs" class="api-link">📖 API Documentation</a>
#                     <a href="/health" class="api-link">❤️ Health Check</a>
#                     <a href="/retention-policies" class="api-link">📋 Retention Policies</a>
#                     <a href="/debug/metrics-sample" class="api-link">🔍 Debug Metrics</a>
#                 </div>
#                 
#                 <p><small>To use the full web UI, place the HTML, CSS, and JS files in the application directory.</small></p>
#             </div>
#         </body>
#         </html>
#         """)

# FIXED: Prometheus Proxy Endpoints with proper streaming response
@app.get("/api/v1/{path:path}")
@app.post("/api/v1/{path:path}")
async def prometheus_proxy(path: str, request: Request):
    """Proxy requests to Prometheus API to avoid CORS issues"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        # Build the target URL
        target_url = f"{prometheus_url}/api/v1/{path}"
        
        # Get query parameters
        query_params = dict(request.query_params)
        if query_params:
            target_url += f"?{urlencode(query_params)}"
        
        # Get request body for POST requests
        body = None
        if request.method == "POST":
            body = await request.body()
        
        # Make the request to Prometheus
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                content=body
            )
            
            # Create a streaming response that doesn't declare content-length
            async def generate():
                async for chunk in response.aiter_bytes():
                    yield chunk
            
            # Get content type from response
            content_type = response.headers.get('content-type', 'application/json')
            
            return StreamingResponse(
                generate(),
                status_code=response.status_code,
                headers={
                    'content-type': content_type,
                    'access-control-allow-origin': '*',
                    'access-control-allow-methods': 'GET, POST, OPTIONS',
                    'access-control-allow-headers': '*'
                }
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Prometheus request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Proxy error: {e}")
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")

# Alternative simpler endpoints that work with JSON directly
@app.post("/prometheus-proxy/query")
async def prometheus_query_direct(request: Dict[str, Any]):
    """Execute a PromQL query - Direct JSON endpoint"""
    query = request.get("query", "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{prometheus_url}/api/v1/query",
                params={"query": query}
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            # Parse JSON and return directly - let FastAPI handle content-length
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Query timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Query error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/metrics")
async def get_prometheus_metrics_direct():
    """Get list of available metrics from Prometheus - Direct JSON endpoint"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/label/__name__/values")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Metrics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/targets")
async def get_prometheus_targets():
    """Get targets from Prometheus"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/targets")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Targets error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/alerts")
async def get_prometheus_alerts():
    """Get alerts from Prometheus"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/alerts")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Alerts error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/status/{info_type}")
async def get_prometheus_status(info_type: str):
    """Get status info from Prometheus"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/status/{info_type}")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Debug endpoints for troubleshooting
@app.get("/debug/metrics-sample")
async def get_metrics_sample():
    """Get a sample of available metrics for debugging"""
    try:
        metrics = await retention_service.get_available_metrics_sample(100)
        return {
            "total_metrics": len(metrics),
            "sample_metrics": metrics[:20],  # First 20 for display
            "all_metrics": metrics  # All requested metrics
        }
    except Exception as e:
        logger.error(f"Failed to get metrics sample: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/test-connection")
async def test_connection():
    """Test if the API connection is working"""
    try:
        return {"status": "ok", "message": "API connection is working"}
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/debug/test-prometheus")
async def test_prometheus():
    """Test Prometheus connectivity"""
    try:
        prometheus_url = retention_service.prometheus_url
        logger.info(f"Testing Prometheus connection to: {prometheus_url}")
        
        import aiohttp
        async with aiohttp.ClientSession(timeout=retention_service.timeout) as session:
            try:
                async with session.get(f"{prometheus_url}/api/v1/query?query=up") as response:
                    if response.status != 200:
                        raise Exception(f"Prometheus not accessible: HTTP {response.status}")
                    data = await response.json()
                    if data.get('status') != 'success':
                        raise Exception(f"Prometheus query failed: {data.get('error', 'Unknown error')}")
                    
                    return {
                        "status": "ok", 
                        "message": "Prometheus connection successful",
                        "prometheus_url": prometheus_url,
                        "query_result": data
                    }
            except aiohttp.ClientError as e:
                raise Exception(f"Cannot connect to Prometheus at {prometheus_url}: {str(e)}")
                
    except Exception as e:
        logger.error(f"Prometheus connection test failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/debug/test-pattern")
async def test_pattern(request: Dict[str, str]):
    """Test a metric pattern against available metrics"""
    pattern = request.get("pattern", "")
    logger.info(f"Testing pattern: '{pattern}'")
    
    if not pattern:
        raise HTTPException(status_code=400, detail="Pattern is required")
    
    try:
        # Get the regex pattern that would be used
        regex_pattern = retention_service._convert_pattern_to_regex(pattern)
        logger.info(f"Converted to regex: '{regex_pattern}'")
        
        # Get matching metrics
        matching_metrics = await retention_service._query_prometheus_metrics(pattern)
        logger.info(f"Found {len(matching_metrics)} matching metrics")
        
        # Get sample of all metrics for comparison
        all_metrics = await retention_service.get_available_metrics_sample(200)
        logger.info(f"Total available metrics sample: {len(all_metrics)}")
        
        result = {
            "input_pattern": pattern,
            "regex_pattern": regex_pattern,
            "matches_count": len(matching_metrics),
            "matching_metrics": matching_metrics[:10],  # First 10 matches
            "total_available_metrics": len(all_metrics),
            "sample_available_metrics": all_metrics[:10]  # First 10 available
        }
        
        logger.info(f"Test pattern result: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Failed to test pattern '{pattern}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to test pattern: {str(e)}")

@app.post("/retention-policies/{policy_id}/dry-run")
async def dry_run_policy(policy_id: int, db: Session = Depends(get_db)):
    """Test a policy without actually deleting data (dry run)"""
    try:
        result = await retention_service.test_policy_dry_run(db, policy_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to execute dry run for policy {policy_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Retention Policy Management Endpoints
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
        logger.error(f"Failed to create retention policy: {e}")
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
        logger.error(f"Failed to update retention policy {policy_id}: {e}")
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
        logger.error(f"Failed to execute retention policy {policy_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/execute-all-policies")
async def execute_all_policies(db: Session = Depends(get_db)):
    """Manually execute all retention policies"""
    try:
        results = await retention_service.execute_all_policies(db)
        return {"message": "All policies executed", "results": results}
    except Exception as e:
        logger.error(f"Failed to execute all policies: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# System Health and Status
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test Prometheus connection
        prometheus_status = await retention_service.check_prometheus_connection()
        
        # Get basic system stats
        try:
            import psutil
            system_stats = {
                "cpu_percent": psutil.cpu_percent(),
                "memory_percent": psutil.virtual_memory().percent,
                "disk_percent": psutil.disk_usage('/').percent
            }
        except ImportError:
            system_stats = {"status": "psutil not available"}
        
        return {
            "status": "healthy",
            "prometheus_connection": prometheus_status,
            "system": system_stats,
            "version": "2.0.0"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "version": "2.0.0"
        }

@app.get("/system-info")
async def get_system_info():
    """Get detailed system information"""
    try:
        import psutil
        import platform
        
        return {
            "platform": {
                "system": platform.system(),
                "release": platform.release(),
                "version": platform.version(),
                "machine": platform.machine(),
                "processor": platform.processor(),
            },
            "resources": {
                "cpu_count": psutil.cpu_count(),
                "memory_total": psutil.virtual_memory().total,
                "disk_total": psutil.disk_usage('/').total,
            },
            "prometheus_url": os.getenv("PROMETHEUS_URL", "http://localhost:9090"),
            "database_url": os.getenv("DATABASE_URL", "sqlite:///./data/prometheus_retention.db"),
        }
    except Exception as e:
        logger.error(f"Failed to get system info: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Configuration endpoints
@app.get("/config")
async def get_config():
    """Get current application configuration"""
    from config import Config
    
    return {
        "prometheus_url": Config.PROMETHEUS_URL,
        "retention_check_interval_hours": Config.RETENTION_CHECK_INTERVAL_HOURS,
        "prometheus_timeout": Config.PROMETHEUS_TIMEOUT,
        "api_host": Config.API_HOST,
        "api_port": Config.API_PORT,
        "log_level": Config.LOG_LEVEL,
    }

# Advanced Prometheus queries for dashboard widgets
@app.get("/dashboard/metrics-summary")
async def get_metrics_summary():
    """Get summary statistics about metrics for dashboard widgets"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get total number of series
            series_response = await client.get(
                f"{prometheus_url}/api/v1/query",
                params={"query": "prometheus_tsdb_symbol_table_size_bytes"}
            )
            
            # Get number of metrics
            metrics_response = await client.get(
                f"{prometheus_url}/api/v1/label/__name__/values"
            )
            
            metrics_data = metrics_response.json() if metrics_response.status_code == 200 else {"data": []}
            series_data = series_response.json() if series_response.status_code == 200 else {"data": {"result": []}}
            
            return {
                "total_metrics": len(metrics_data.get("data", [])),
                "total_series": len(series_data.get("data", {}).get("result", [])),
                "status": "success"
            }
            
    except Exception as e:
        logger.error(f"Failed to get metrics summary: {e}")
        return {
            "total_metrics": 0,
            "total_series": 0,
            "status": "error",
            "error": str(e)
        }

@app.post("/prometheus-proxy/query-range")
async def prometheus_query_range_direct(request: Dict[str, Any]):
    """Execute a PromQL range query for graphing - Direct JSON endpoint"""
    query = request.get("query", "").strip()
    start = request.get("start")
    end = request.get("end")
    step = request.get("step", "15s")  # Default to 15s with unit
    
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    if start is None or end is None:
        raise HTTPException(status_code=400, detail="Start and end timestamps are required")
    
    # Validate time range to prevent excessive data points
    try:
        start_ts = int(start)
        end_ts = int(end)
        duration = end_ts - start_ts
        
        # Warn about very large time ranges
        if duration > 30 * 24 * 3600:  # More than 30 days
            logger.warning(f"Large time range requested: {duration}s ({duration/(24*3600):.1f} days)")
            
        # Extract step value for validation
        step_seconds = _parse_step_to_seconds(step)
        estimated_points = duration // step_seconds
        
        if estimated_points > 10000:  # More than 10k data points
            logger.warning(f"Query may return many data points: ~{estimated_points}")
            
    except (ValueError, TypeError) as e:
        logger.warning(f"Could not validate time range: {e}")
    
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        # Increase timeout for potentially large queries
        timeout = 60.0 if duration > 7 * 24 * 3600 else 30.0  # 60s for queries > 1 week
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{prometheus_url}/api/v1/query_range",
                params={
                    "query": query,
                    "start": start,
                    "end": end,
                    "step": step
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Prometheus query failed: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            json_data = response.json()
            
            # Log result size for monitoring
            if json_data.get("data", {}).get("result"):
                result_count = len(json_data["data"]["result"])
                logger.info(f"Query returned {result_count} series")
                
            return json_data
            
    except httpx.TimeoutException:
        logger.error(f"Query timed out after {timeout}s: {query[:100]}...")
        raise HTTPException(status_code=504, detail="Query timed out - try reducing time range or using a larger step size")
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Query range error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def _parse_step_to_seconds(step: str) -> int:
    """Parse step string to seconds for validation purposes"""
    if not step:
        return 15
        
    step = step.strip().lower()
    
    # Handle numeric-only steps (assume seconds)
    if step.isdigit():
        return int(step)
    
    # Parse step with time units
    import re
    match = re.match(r'^(\d+)([smhd]?)$', step)
    if not match:
        return 15  # Default fallback
    
    value, unit = match.groups()
    value = int(value)
    
    unit_multipliers = {
        's': 1,
        'm': 60,
        'h': 3600,
        'd': 86400,
        '': 1  # Default to seconds if no unit
    }
    
    return value * unit_multipliers.get(unit, 1)

@app.get("/prometheus-proxy/query-range")
async def prometheus_query_range_get(
    query: str,
    start: str,
    end: str,
    step: str = "15s"  # Default to 15s with unit
):
    """Execute a PromQL range query for graphing - GET endpoint"""
    if not query:
        raise HTTPException(status_code=400, detail="Query is required")
    
    # Validate time range to prevent excessive data points
    try:
        start_ts = int(start)
        end_ts = int(end)
        duration = end_ts - start_ts
        
        # Warn about very large time ranges
        if duration > 30 * 24 * 3600:  # More than 30 days
            logger.warning(f"Large time range requested: {duration}s ({duration/(24*3600):.1f} days)")
            
        # Extract step value for validation
        step_seconds = _parse_step_to_seconds(step)
        estimated_points = duration // step_seconds
        
        if estimated_points > 10000:  # More than 10k data points
            logger.warning(f"Query may return many data points: ~{estimated_points}")
            
    except (ValueError, TypeError) as e:
        logger.warning(f"Could not validate time range: {e}")
    
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        # Increase timeout for potentially large queries
        timeout = 60.0 if duration > 7 * 24 * 3600 else 30.0  # 60s for queries > 1 week
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(
                f"{prometheus_url}/api/v1/query_range",
                params={
                    "query": query,
                    "start": start,
                    "end": end,
                    "step": step
                }
            )
            
            if response.status_code != 200:
                error_detail = response.text
                logger.error(f"Prometheus query failed: {error_detail}")
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            json_data = response.json()
            
            # Log result size for monitoring
            if json_data.get("data", {}).get("result"):
                result_count = len(json_data["data"]["result"])
                logger.info(f"Query returned {result_count} series")
                
            return json_data
            
    except httpx.TimeoutException:
        logger.error(f"Query timed out after {timeout}s: {query[:100]}...")
        raise HTTPException(status_code=504, detail="Query timed out - try reducing time range or using a larger step size")
    except httpx.RequestError as e:
        logger.error(f"Request error: {e}")
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Query range error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/labels")
async def get_prometheus_labels():
    """Get available labels from Prometheus"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/labels")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Labels error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/label/{label_name}/values")
async def get_prometheus_label_values(label_name: str):
    """Get values for a specific label from Prometheus"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/label/{label_name}/values")
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Label values error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/series")
async def get_prometheus_series(
    match: str = None,
    start: str = None,
    end: str = None
):
    """Get series from Prometheus with optional filtering"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        params = {}
        if match:
            params['match[]'] = match
        if start:
            params['start'] = start
        if end:
            params['end'] = end
            
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{prometheus_url}/api/v1/series", params=params)
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.text)
            
            json_data = response.json()
            return json_data
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timed out")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Failed to connect to Prometheus: {str(e)}")
    except Exception as e:
        logger.error(f"Series error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/prometheus-proxy/metric-count/{metric_name}")
async def get_metric_count(metric_name: str, hours: int = 24):
    """Get the count of data points for a specific metric over a time range"""
    prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get series count for the metric
            series_response = await client.get(
                f"{prometheus_url}/api/v1/series",
                params={'match[]': metric_name}
            )
            
            series_count = 0
            if series_response.status_code == 200:
                series_data = series_response.json()
                series_count = len(series_data.get('data', []))
            
            # Get data points count using count_over_time
            count_query = f"count_over_time({metric_name}[{hours}h])"
            count_response = await client.get(
                f"{prometheus_url}/api/v1/query",
                params={'query': count_query}
            )
            
            total_data_points = 0
            data_points_per_series = []
            
            if count_response.status_code == 200:
                count_data = count_response.json()
                results = count_data.get('data', {}).get('result', [])
                
                for result in results:
                    if result.get('value'):
                        points = int(float(result['value'][1]))
                        total_data_points += points
                        data_points_per_series.append({
                            'metric': result.get('metric', {}),
                            'data_points': points
                        })
            
            # Get current values count
            current_query = f"count by (__name__)({{{metric_name}}})"
            current_response = await client.get(
                f"{prometheus_url}/api/v1/query",
                params={'query': current_query}
            )
            
            current_series_count = 0
            if current_response.status_code == 200:
                current_data = current_response.json()
                results = current_data.get('data', {}).get('result', [])
                if results:
                    current_series_count = int(float(results[0]['value'][1]))
            
            return {
                "metric_name": metric_name,
                "time_range_hours": hours,
                "series_count": series_count,
                "current_series_count": current_series_count,
                "total_data_points": total_data_points,
                "data_points_per_series": data_points_per_series,
                "average_points_per_series": total_data_points / series_count if series_count > 0 else 0,
                "status": "success"
            }
            
    except Exception as e:
        logger.error(f"Failed to get metric count for {metric_name}: {e}")
        return {
            "metric_name": metric_name,
            "error": str(e),
            "status": "error"
        }

# AI Chatbot Endpoints
@app.post("/ai/translate")
async def translate_to_promql(request: Dict[str, Any]):
    """Translate natural language to PromQL using AI"""
    try:
        natural_query = request.get("query", "").strip()
        if not natural_query:
            raise HTTPException(status_code=400, detail="Query is required")
        
        # Get available metrics for context
        metrics_response = await get_prometheus_metrics_direct()
        available_metrics = metrics_response.get("data", [])
        
        # Translate using AI
        result = ai_service.translate_to_promql(natural_query, available_metrics)
        
        if result["success"]:
            return {
                "success": True,
                "promql": result["promql"],
                "explanation": result["explanation"],
                "metric_used": result["metric_used"]
            }
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI translation error: {e}")
        raise HTTPException(status_code=500, detail=f"AI translation failed: {str(e)}")

@app.post("/ai/suggestions")
async def get_ai_suggestions(request: Dict[str, Any]):
    """Get AI-powered query suggestions"""
    try:
        context = request.get("context", "").strip()
        result = ai_service.get_query_suggestions(context)
        
        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI suggestions error: {e}")
        raise HTTPException(status_code=500, detail=f"AI suggestions failed: {str(e)}")

@app.get("/ai/status")
async def get_ai_status():
    """Check AI service status"""
    return {
        "available": ai_service.is_available(),
        "configured": ai_service.api_key is not None
    }

if __name__ == "__main__":
    # Update requirements.txt to include httpx and psutil
    logger.info("Starting Prometheus Management Console on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
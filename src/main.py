import requests
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import json
from datetime import datetime
from pathlib import Path

app = FastAPI()

PROMETHEUS_URL = "http://localhost:9090"

@app.get("/metrics")
def get_all_metrics():
    try:
        response = requests.get(f"{PROMETHEUS_URL}/api/v1/label/__name__/values")
        response.raise_for_status()
        return {"metrics": response.json()["data"]}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
    


@app.get("/save-metrics")
def save_metric_data():
    try:
        # First get all metric names
        response = requests.get(f"{PROMETHEUS_URL}/api/v1/label/__name__/values")
        response.raise_for_status()
        metric_names = response.json()["data"]
        
        # Create a dictionary to store all metrics data
        all_metrics_data = {}
        
        # Get data for each metric
        for metric_name in metric_names:
            response = requests.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": metric_name})
            response.raise_for_status()
            all_metrics_data[metric_name] = response.json()

        # Save all data to a single file
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = Path(f"all_metrics_{timestamp}.json")
        with open(path, "w") as f:
            json.dump(all_metrics_data, f, indent=2)

        return {"message": f"Saved all metrics data to {path}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.delete("/delete-series/{metric_name}")
def delete_metric_series(metric_name: str):
    try:
        # restrict deletion to a job, like blackbox_mama_mta
        match = f'{metric_name}{{job="blackbox_mama_mta"}}'
        delete_resp = requests.post(
            f"{PROMETHEUS_URL}/api/v1/admin/tsdb/delete_series",
            params={"match[]": match}
        )
        delete_resp.raise_for_status()
        return {"message": f"Deleted series: {match}"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/cleanup")
def clean_tombstones():
    try:
        clean_resp = requests.post(f"{PROMETHEUS_URL}/api/v1/admin/tsdb/clean_tombstones")
        clean_resp.raise_for_status()
        return {"message": "Tombstones cleaned up successfully"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})


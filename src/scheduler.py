import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from datetime import datetime
from typing import Optional
import logging
import os

from database import SessionLocal
from retention_service import RetentionService
from config import Config

# Get logger
logger = logging.getLogger(__name__)

# Global scheduler instance
scheduler = None

async def execute_retention_policies():
    """Background task to execute all retention policies"""
    logger.info("Starting scheduled retention policy execution")
    
    db = SessionLocal()
    retention_service = RetentionService()
    
    try:
        # Execute all enabled policies
        results = await retention_service.execute_all_policies(db)
        
        # Log summary
        successful = sum(1 for r in results if r.success)
        failed = len(results) - successful
        total_deleted = sum(r.series_deleted for r in results if r.success)
        
        logger.info(
            f"Retention policy execution completed: "
            f"{successful} successful, {failed} failed, "
            f"{total_deleted} total series deleted"
        )
        
    except Exception as e:
        logger.error(f"Error during scheduled retention policy execution: {e}")
    finally:
        db.close()

def start_scheduler(retention_service: RetentionService):
    """Start the background scheduler"""
    global scheduler
    
    if scheduler is not None:
        logger.warning("Scheduler is already running")
        return
    
    # Get schedule interval from environment variable (default: 6 hours)
    interval_hours = int(os.getenv("RETENTION_CHECK_INTERVAL_HOURS", "6"))
    
    scheduler = AsyncIOScheduler()
    
    # Add the retention policy execution job
    scheduler.add_job(
        execute_retention_policies,
        trigger=IntervalTrigger(hours=interval_hours),
        id='retention_policy_execution',
        name='Execute Retention Policies',
        replace_existing=True,
        max_instances=1,  # Prevent overlapping executions
        coalesce=True,    # If multiple executions are queued, only run the latest
        next_run_time=datetime.now()  # Run immediately on startup
    )
    
    scheduler.start()
    logger.info(f"Retention policy scheduler started (interval: {interval_hours} hours)")

def stop_scheduler():
    """Stop the background scheduler"""
    global scheduler
    
    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        logger.info("Retention policy scheduler stopped")

def get_scheduler_status():
    """Get the current status of the scheduler"""
    global scheduler
    
    if scheduler is None:
        return {
            "status": "stopped",
            "jobs": []
        }
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run_time": job.next_run_time.isoformat() if job.next_run_time else None,
            "trigger": str(job.trigger)
        })
    
    return {
        "status": "running" if scheduler.running else "paused",
        "jobs": jobs
    }
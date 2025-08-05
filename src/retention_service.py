import aiohttp
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import logging
import re
import os

from database import RetentionPolicy, ExecutionLog
from models import RetentionPolicyCreate, RetentionPolicyUpdate, ExecutionResult

logger = logging.getLogger(__name__)

class RetentionService:
    def __init__(self):
        self.prometheus_url = os.getenv("PROMETHEUS_URL", "http://localhost:9090")
        self.timeout = aiohttp.ClientTimeout(total=30)

    def create_policy(self, db: Session, policy: RetentionPolicyCreate) -> RetentionPolicy:
        """Create a new retention policy"""
        # Check if a policy with the same pattern already exists
        existing = db.query(RetentionPolicy).filter(
            RetentionPolicy.metric_name_pattern == policy.metric_name_pattern
        ).first()
        
        if existing:
            raise ValueError(f"A policy with pattern '{policy.metric_name_pattern}' already exists")

        db_policy = RetentionPolicy(
            metric_name_pattern=policy.metric_name_pattern,
            retention_days=policy.retention_days,
            description=policy.description,
            enabled=policy.enabled
        )
        
        db.add(db_policy)
        db.commit()
        db.refresh(db_policy)
        
        logger.info(f"Created retention policy: {policy.metric_name_pattern} -> {policy.retention_days} days")
        return db_policy

    def get_all_policies(self, db: Session) -> List[RetentionPolicy]:
        """Get all retention policies"""
        return db.query(RetentionPolicy).order_by(RetentionPolicy.created_at.desc()).all()

    def get_policy(self, db: Session, policy_id: int) -> Optional[RetentionPolicy]:
        """Get a specific retention policy by ID"""
        return db.query(RetentionPolicy).filter(RetentionPolicy.id == policy_id).first()

    def update_policy(self, db: Session, policy_id: int, policy_update: RetentionPolicyUpdate) -> Optional[RetentionPolicy]:
        """Update a retention policy"""
        db_policy = db.query(RetentionPolicy).filter(RetentionPolicy.id == policy_id).first()
        
        if not db_policy:
            return None

        # Check for duplicate pattern if updating pattern
        if policy_update.metric_name_pattern and policy_update.metric_name_pattern != db_policy.metric_name_pattern:
            existing = db.query(RetentionPolicy).filter(
                RetentionPolicy.metric_name_pattern == policy_update.metric_name_pattern,
                RetentionPolicy.id != policy_id
            ).first()
            
            if existing:
                raise ValueError(f"A policy with pattern '{policy_update.metric_name_pattern}' already exists")

        # Update fields
        for field, value in policy_update.dict(exclude_unset=True).items():
            setattr(db_policy, field, value)
        
        db_policy.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(db_policy)
        
        logger.info(f"Updated retention policy ID {policy_id}")
        return db_policy

    def delete_policy(self, db: Session, policy_id: int) -> bool:
        """Delete a retention policy"""
        db_policy = db.query(RetentionPolicy).filter(RetentionPolicy.id == policy_id).first()
        
        if not db_policy:
            return False

        db.delete(db_policy)
        db.commit()
        
        logger.info(f"Deleted retention policy ID {policy_id}")
        return True

    async def check_prometheus_connection(self) -> Dict[str, Any]:
        """Check if Prometheus is accessible"""
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(f"{self.prometheus_url}/api/v1/query?query=up") as response:
                    if response.status == 200:
                        return {"status": "connected", "url": self.prometheus_url}
                    else:
                        return {"status": "error", "code": response.status}
        except Exception as e:
            logger.error(f"Failed to connect to Prometheus: {e}")
            return {"status": "error", "message": str(e)}

    def _convert_pattern_to_regex(self, pattern: str) -> str:
        """Convert wildcard pattern to regex"""
        if '*' in pattern or '?' in pattern:
            # Escape special regex characters except * and ?
            escaped = re.escape(pattern)
            # Convert escaped wildcards back to regex equivalents
            regex_pattern = escaped.replace(r'\*', '.*').replace(r'\?', '.')
            return regex_pattern
        return pattern

    async def _query_prometheus_metrics(self, pattern: str) -> List[str]:
        """Query Prometheus to find metrics matching the pattern"""
        try:
            regex_pattern = self._convert_pattern_to_regex(pattern)
            
            # Use label_values API to get all metric names
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                async with session.get(f"{self.prometheus_url}/api/v1/label/__name__/values") as response:
                    if response.status != 200:
                        raise Exception(f"Failed to query metrics: HTTP {response.status}")
                    
                    data = await response.json()
                    if data.get('status') != 'success':
                        raise Exception(f"Prometheus query failed: {data.get('error', 'Unknown error')}")
                    
                    all_metrics = data['data']
                    
                    # Filter metrics using regex
                    compiled_pattern = re.compile(regex_pattern)
                    matching_metrics = [metric for metric in all_metrics if compiled_pattern.match(metric)]
                    
                    logger.info(f"Found {len(matching_metrics)} metrics matching pattern '{pattern}'")
                    return matching_metrics
                    
        except Exception as e:
            logger.error(f"Error querying Prometheus metrics: {e}")
            raise

    async def _delete_metric_data(self, metric_names: List[str], cutoff_timestamp: int) -> int:
        """Delete old data for specified metrics"""
        if not metric_names:
            return 0

        total_deleted = 0
        
        try:
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                for metric_name in metric_names:
                    # Create deletion request for each metric
                    delete_url = f"{self.prometheus_url}/api/v1/admin/tsdb/delete_series"
                    
                    # FIXED: Use form data instead of URL parameters
                    data = aiohttp.FormData()
                    data.add_field('match[]', f'{{__name__="{metric_name}"}}')
                    data.add_field('start', '0')
                    data.add_field('end', str(cutoff_timestamp))
                    
                    logger.debug(f"Using match selector: {{__name__=\"{metric_name}\"}}")
                    
                    async with session.post(delete_url, data=data) as response:
                        response_text = await response.text()
                        
                        if response.status == 204:  # Success (No Content)
                            total_deleted += 1
                            logger.info(f"Successfully deleted old data for metric: {metric_name}")
                        elif response.status == 400:
                            try:
                                response_json = await response.json()
                                logger.warning(f"Bad request for metric {metric_name}: {response_json}")
                            except:
                                logger.warning(f"Bad request for metric {metric_name}: {response_text}")
                        else:
                            logger.error(f"Failed to delete data for metric {metric_name}: HTTP {response.status} - {response_text}")
                    
                    # Small delay between requests to avoid overwhelming Prometheus
                    await asyncio.sleep(0.1)

        except Exception as e:
            logger.error(f"Error during metric data deletion: {e}")
            raise

        return total_deleted

    async def _validate_metric_selector(self, metric_name: str) -> bool:
        """Validate that the metric selector is properly formatted"""
        try:
            # Test query to validate the selector format
            selector = f'{{__name__="{metric_name}"}}'
            query_url = f"{self.prometheus_url}/api/v1/query"
            
            async with aiohttp.ClientSession(timeout=self.timeout) as session:
                params = {
                    'query': f'count({selector})',
                    'time': str(int(datetime.utcnow().timestamp()))
                }
                
                async with session.get(query_url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()
                        return data.get('status') == 'success'
                    return False
                    
        except Exception as e:
            logger.error(f"Error validating metric selector for {metric_name}: {e}")
            return False

    async def execute_policy(self, db: Session, policy_id: int) -> ExecutionResult:
        """Execute a specific retention policy"""
        policy = self.get_policy(db, policy_id)
        if not policy:
            raise ValueError(f"Policy with ID {policy_id} not found")

        if not policy.enabled:
            raise ValueError(f"Policy with ID {policy_id} is disabled")

        execution_time = datetime.utcnow()
        
        try:
            # Calculate cutoff timestamp (Unix timestamp in milliseconds)
            cutoff_date = execution_time - timedelta(days=policy.retention_days)
            cutoff_timestamp = int(cutoff_date.timestamp() * 1000)
            
            logger.info(f"Executing policy {policy_id}: {policy.metric_name_pattern} (retention: {policy.retention_days} days)")
            logger.info(f"Cutoff date: {cutoff_date.isoformat()}, Cutoff timestamp: {cutoff_timestamp}")
            
            # Find matching metrics
            matching_metrics = await self._query_prometheus_metrics(policy.metric_name_pattern)
            
            if not matching_metrics:
                logger.warning(f"No metrics found matching pattern: {policy.metric_name_pattern}")
            
            # Delete old data
            series_deleted = await self._delete_metric_data(matching_metrics, cutoff_timestamp)
            
            # Update policy last_executed timestamp
            policy.last_executed = execution_time
            db.commit()
            
            # Log execution
            execution_log = ExecutionLog(
                policy_id=policy.id,
                metric_name_pattern=policy.metric_name_pattern,
                metrics_found=len(matching_metrics),
                series_deleted=series_deleted,
                execution_time=execution_time,
                success=True
            )
            db.add(execution_log)
            db.commit()
            
            result = ExecutionResult(
                policy_id=policy.id,
                metric_name_pattern=policy.metric_name_pattern,
                metrics_found=len(matching_metrics),
                series_deleted=series_deleted,
                execution_time=execution_time,
                success=True
            )
            
            logger.info(f"Policy {policy_id} executed successfully: {series_deleted} series deleted from {len(matching_metrics)} metrics")
            return result
            
        except Exception as e:
            logger.error(f"Error executing policy {policy_id}: {e}")
            
            # Log failed execution
            execution_log = ExecutionLog(
                policy_id=policy.id,
                metric_name_pattern=policy.metric_name_pattern,
                metrics_found=0,
                series_deleted=0,
                execution_time=execution_time,
                success=False,
                error_message=str(e)
            )
            db.add(execution_log)
            db.commit()
            
            return ExecutionResult(
                policy_id=policy.id,
                metric_name_pattern=policy.metric_name_pattern,
                metrics_found=0,
                series_deleted=0,
                execution_time=execution_time,
                success=False,
                error_message=str(e)
            )

    async def execute_all_policies(self, db: Session) -> List[ExecutionResult]:
        """Execute all enabled retention policies"""
        policies = db.query(RetentionPolicy).filter(RetentionPolicy.enabled == True).all()
        results = []
        
        logger.info(f"Executing {len(policies)} enabled retention policies")
        
        for policy in policies:
            try:
                result = await self.execute_policy(db, policy.id)
                results.append(result)
                
                # Small delay between policy executions to avoid overwhelming Prometheus
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Failed to execute policy {policy.id}: {e}")
                # Continue with other policies
                continue
        
        logger.info(f"Completed execution of {len(results)} policies")
        return results

    async def get_execution_logs(self, db: Session, policy_id: Optional[int] = None, limit: int = 100) -> List[ExecutionLog]:
        """Get execution logs, optionally filtered by policy ID"""
        query = db.query(ExecutionLog)
        
        if policy_id:
            query = query.filter(ExecutionLog.policy_id == policy_id)
        
        return query.order_by(ExecutionLog.execution_time.desc()).limit(limit).all()

    async def test_policy_dry_run(self, db: Session, policy_id: int) -> Dict[str, Any]:
        """Test a policy without actually deleting data (dry run)"""
        policy = self.get_policy(db, policy_id)
        if not policy:
            raise ValueError(f"Policy with ID {policy_id} not found")

        try:
            # Find matching metrics
            matching_metrics = await self._query_prometheus_metrics(policy.metric_name_pattern)
            
            # Calculate what would be deleted
            cutoff_date = datetime.utcnow() - timedelta(days=policy.retention_days)
            
            return {
                "policy_id": policy.id,
                "metric_pattern": policy.metric_name_pattern,
                "retention_days": policy.retention_days,
                "cutoff_date": cutoff_date.isoformat(),
                "matching_metrics": matching_metrics,
                "metrics_count": len(matching_metrics),
                "would_delete_data_older_than": cutoff_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Error during dry run for policy {policy_id}: {e}")
            raise
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional
import re

class RetentionPolicyBase(BaseModel):
    metric_name_pattern: str = Field(
        ..., 
        description="Metric name pattern (supports regex)",
        example="cpu_usage_*"
    )
    retention_days: float = Field(
        ..., 
        gt=0, 
        description="Number of days to retain the metric data (supports fractional days)",
        example=30.0
    )
    description: Optional[str] = Field(
        None, 
        description="Optional description of the retention policy",
        example="CPU usage metrics retention policy"
    )
    enabled: bool = Field(
        True, 
        description="Whether the policy is enabled"
    )

    @validator('metric_name_pattern')
    def validate_metric_name_pattern(cls, v):
        if not v or not v.strip():
            raise ValueError('Metric name pattern cannot be empty')
        
        # Check if it's a valid regex pattern
        try:
            # Convert wildcard pattern to regex if needed
            if '*' in v or '?' in v:
                # Simple wildcard to regex conversion
                regex_pattern = v.replace('*', '.*').replace('?', '.')
                re.compile(regex_pattern)
            else:
                # Try to compile as is
                re.compile(v)
        except re.error:
            raise ValueError('Invalid metric name pattern (regex compilation failed)')
        
        return v.strip()

    @validator('retention_days')
    def validate_retention_days(cls, v):
        if v < 0.0007:  # Minimum 1 minute (1/1440 days)
            raise ValueError('Retention days must be at least 0.0007 (1 minute)')
        if v > 3650:  # ~10 years max
            raise ValueError('Retention days cannot exceed 3650 (10 years)')
        return v

class RetentionPolicyCreate(RetentionPolicyBase):
    pass

class RetentionPolicyUpdate(BaseModel):
    metric_name_pattern: Optional[str] = Field(None, description="Metric name pattern")
    retention_days: Optional[float] = Field(None, gt=0, description="Number of days to retain (supports fractional days)")
    description: Optional[str] = Field(None, description="Policy description")
    enabled: Optional[bool] = Field(None, description="Whether the policy is enabled")

    @validator('metric_name_pattern')
    def validate_metric_name_pattern(cls, v):
        if v is not None:
            if not v or not v.strip():
                raise ValueError('Metric name pattern cannot be empty')
            
            try:
                if '*' in v or '?' in v:
                    regex_pattern = v.replace('*', '.*').replace('?', '.')
                    re.compile(regex_pattern)
                else:
                    re.compile(v)
            except re.error:
                raise ValueError('Invalid metric name pattern (regex compilation failed)')
            
            return v.strip()
        return v

    @validator('retention_days')
    def validate_retention_days(cls, v):
        if v is not None:
            if v < 0.0007:  # Minimum 1 minute (1/1440 days)
                raise ValueError('Retention days must be at least 0.0007 (1 minute)')
            if v > 3650:
                raise ValueError('Retention days cannot exceed 3650 (10 years)')
        return v

class RetentionPolicyResponse(RetentionPolicyBase):
    id: int
    created_at: datetime
    updated_at: datetime
    last_executed: Optional[datetime] = Field(
        None, 
        description="Last time this policy was executed"
    )

    class Config:
        from_attributes = True

class ExecutionResult(BaseModel):
    policy_id: int
    metric_name_pattern: str
    metrics_found: int = Field(description="Number of metrics that matched the pattern")
    series_deleted: int = Field(description="Number of series deleted")
    execution_time: datetime
    success: bool
    error_message: Optional[str] = None

class ExecutionSummary(BaseModel):
    total_policies: int
    successful_executions: int
    failed_executions: int
    total_series_deleted: int
    execution_time: datetime

# Helper constants for common time conversions
TIME_CONVERSIONS = {
    "1_minute": 1/1440,      # 0.0007 days
    "5_minutes": 5/1440,     # 0.0035 days  
    "10_minutes": 10/1440,   # 0.0069 days
    "30_minutes": 30/1440,   # 0.0208 days
    "1_hour": 1/24,          # 0.0417 days
    "6_hours": 6/24,         # 0.25 days
    "12_hours": 12/24,       # 0.5 days
    "1_day": 1,
    "1_week": 7,
    "1_month": 30
}
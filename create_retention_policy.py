#!/usr/bin/env python3
"""
CLI script to create retention policies without using the UI.
Usage: python create_retention_policy.py --pattern "cpu_usage_*" --days 30 --description "CPU metrics policy"
"""

import argparse
import sys
import os
from pathlib import Path

# Add src directory to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent / "src"))

from database import SessionLocal, engine, Base
from retention_service import RetentionService
from models import RetentionPolicyCreate

def create_tables():
    """Create database tables if they don't exist"""
    Base.metadata.create_all(bind=engine)

def main():
    parser = argparse.ArgumentParser(
        description="Create retention policies programmatically",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python create_retention_policy.py --pattern "cpu_usage_*" --days 30
  python create_retention_policy.py --pattern "memory_.*" --days 7.5 --description "Memory metrics"
  python create_retention_policy.py --pattern "disk_io_.*" --days 90 --enabled false
        """
    )
    
    parser.add_argument(
        "--pattern", 
        required=True,
        help="Metric name pattern (supports wildcards * and ? or regex)"
    )
    
    parser.add_argument(
        "--days", 
        type=float, 
        required=True,
        help="Number of days to retain the metric data (supports fractional days)"
    )
    
    parser.add_argument(
        "--description", 
        help="Optional description of the retention policy"
    )
    
    parser.add_argument(
        "--enabled", 
        type=lambda x: x.lower() == 'true',
        default=True,
        help="Whether the policy is enabled (true/false, default: true)"
    )
    
    parser.add_argument(
        "--list", 
        action="store_true",
        help="List all existing retention policies"
    )

    args = parser.parse_args()

    # Create database tables if they don't exist
    create_tables()
    
    # Create database session
    db = SessionLocal()
    retention_service = RetentionService()

    try:
        if args.list:
            # List existing policies
            policies = retention_service.get_all_policies(db)
            if not policies:
                print("No retention policies found.")
                return
            
            print(f"Found {len(policies)} retention policies:")
            print("-" * 80)
            print(f"{'ID':<4} {'Pattern':<25} {'Days':<8} {'Enabled':<8} {'Description'}")
            print("-" * 80)
            
            for policy in policies:
                description = policy.description or ""
                if len(description) > 30:
                    description = description[:27] + "..."
                print(f"{policy.id:<4} {policy.metric_name_pattern:<25} {policy.retention_days:<8} {policy.enabled:<8} {description}")
            
            return

        # Validate retention days
        if args.days < 0.0007:  # Minimum 1 minute
            print("Error: Retention days must be at least 0.0007 (1 minute)")
            sys.exit(1)
        
        if args.days > 3650:  # ~10 years max
            print("Error: Retention days cannot exceed 3650 (10 years)")
            sys.exit(1)

        # Create the policy
        policy_data = RetentionPolicyCreate(
            metric_name_pattern=args.pattern,
            retention_days=args.days,
            description=args.description,
            enabled=args.enabled
        )

        # Create the policy using the service
        created_policy = retention_service.create_policy(db, policy_data)
        
        print("✅ Retention policy created successfully!")
        print(f"   ID: {created_policy.id}")
        print(f"   Pattern: {created_policy.metric_name_pattern}")
        print(f"   Retention Days: {created_policy.retention_days}")
        print(f"   Description: {created_policy.description or 'None'}")
        print(f"   Enabled: {created_policy.enabled}")
        print(f"   Created: {created_policy.created_at}")

    except ValueError as e:
        print(f"❌ Validation Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error creating retention policy: {e}")
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    main() 
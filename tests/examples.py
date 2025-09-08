#!/usr/bin/env python3
"""
Examples of common test usage patterns for the Prometric test suite.
This script demonstrates how to use the organized test structure.
"""

import subprocess
import sys
import os
from pathlib import Path

def print_section(title):
    """Print a formatted section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)

def run_example(description, command):
    """Run an example command with description"""
    print(f"\n📋 Example: {description}")
    print(f"💻 Command: {command}")
    print("-" * 40)
    
    # For demonstration, we'll just print what would be run
    # In practice, you'd uncomment the subprocess.run line
    print(f"[Would execute: {command}]")
    # subprocess.run(command.split(), cwd=Path(__file__).parent)

def main():
    """Demonstrate common usage patterns"""
    
    print("🚀 Prometric Test Suite - Usage Examples")
    print("This script demonstrates common testing scenarios.")
    
    print_section("1. QUICK HEALTH CHECKS")
    
    run_example(
        "Check if all services are running",
        "python3 run_tests.py quick health"
    )
    
    run_example(
        "Test Prometheus connectivity",
        "python3 run_tests.py quick connection"
    )
    
    print_section("2. COMPREHENSIVE TESTING")
    
    run_example(
        "Run all integration tests",
        "python3 run_tests.py integration"
    )
    
    run_example(
        "Run only connection tests",
        "python3 run_tests.py integration --type connection"
    )
    
    print_section("3. METRIC ANALYSIS")
    
    run_example(
        "Analyze all CPU-related metrics", 
        "python3 run_tests.py integration --type analysis --pattern cpu"
    )
    
    run_example(
        "Deep dive into a specific metric",
        "python3 run_tests.py integration --type analysis --metric probe_http_ssl"
    )
    
    run_example(
        "Analyze probe metrics",
        "python3 run_tests.py integration --type analysis --pattern probe"
    )
    
    print_section("4. UTILITY SCRIPTS")
    
    run_example(
        "Count data points for a metric",
        "python3 run_tests.py utility --name count_timestamps --metric probe_http_ssl"
    )
    
    run_example(
        "Count data points for last 48 hours",
        "python3 run_tests.py utility --name count_timestamps --metric up --hours 48"
    )
    
    print_section("5. DIRECT SCRIPT EXECUTION")
    
    run_example(
        "Run metric analysis directly",
        "python3 integration/test_metric_analysis.py --pattern memory"
    )
    
    run_example(
        "Run connection test directly",
        "python3 integration/test_connection.py"
    )
    
    run_example(
        "Run timestamp counter directly",
        "python3 utilities/count_metric_timestamps.py --metric prometheus_tsdb_head_series"
    )
    
    print_section("6. DEBUGGING SCENARIOS")
    
    run_example(
        "Test API endpoints when having issues",
        "python3 run_tests.py integration --type endpoints"
    )
    
    run_example(
        "Check retention policy effectiveness",
        "python3 run_tests.py integration --type analysis --pattern prometheus"
    )
    
    run_example(
        "Verify metric deletion is working",
        "python3 run_tests.py utility --name count_timestamps --metric <deleted_metric>"
    )
    
    print_section("7. MONITORING WORKFLOWS")
    
    print(f"""
📊 Common monitoring workflows:

1. **Daily Health Check**:
   python3 run_tests.py quick health
   python3 run_tests.py integration --type analysis

2. **Post-Deployment Verification**:
   python3 run_tests.py integration
   python3 run_tests.py utility --name count_timestamps --metric <key_metric>

3. **Retention Policy Review**:
   python3 run_tests.py integration --type analysis --pattern <metric_family>
   
4. **Performance Investigation**:
   python3 run_tests.py quick connection
   python3 run_tests.py integration --type analysis --metric <problematic_metric>

5. **Before/After Deletion Verification**:
   # Before deletion
   python3 run_tests.py utility --name count_timestamps --metric <target_metric>
   
   # Run retention policy...
   
   # After deletion  
   python3 run_tests.py utility --name count_timestamps --metric <target_metric>
""")
    
    print_section("CONFIGURATION")
    
    print(f"""
🔧 Environment Variables:

You can customize test behavior using environment variables:

export PROMETRIC_API_URL="http://localhost:8000"
export PROMETHEUS_URL="http://localhost:9090"  
export PROMETRIC_DB_PATH="./data/prometheus_retention.db"
export TEST_VERBOSE="true"
export TEST_COLORED="true"

Then run any test command and it will use your custom configuration.
""")
    
    print("\n✨ Ready to test! Choose an example above to get started.")

if __name__ == "__main__":
    main() 
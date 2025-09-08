#!/usr/bin/env python3
"""
Main test runner for Prometric system tests.
This script provides a unified interface to run different types of tests.
"""

import argparse
import asyncio
import subprocess
import sys
import os
from pathlib import Path

def run_integration_tests(test_type: str = "all", **kwargs):
    """Run integration tests"""
    test_dir = Path(__file__).parent / "integration"
    
    if test_type == "all":
        print("🚀 Running all integration tests...")
        tests = ["test_connection.py", "test_endpoints.py", "test_metric_analysis.py"]
    elif test_type == "connection":
        tests = ["test_connection.py"]
    elif test_type == "endpoints":
        tests = ["test_endpoints.py"]
    elif test_type == "analysis":
        tests = ["test_metric_analysis.py"]
    else:
        print(f"❌ Unknown integration test type: {test_type}")
        return False
    
    success = True
    for test in tests:
        test_path = test_dir / test
        print(f"\n📋 Running {test}...")
        print("=" * 50)
        
        cmd = [sys.executable, str(test_path)]
        
        # Add arguments for metric analysis
        if test == "test_metric_analysis.py" and kwargs:
            if kwargs.get('pattern'):
                cmd.extend(['--pattern', kwargs['pattern']])
            if kwargs.get('metric'):
                cmd.extend(['--metric', kwargs['metric']])
            if kwargs.get('api_port'):
                cmd.extend(['--api-port', str(kwargs['api_port'])])
        
        try:
            result = subprocess.run(cmd, capture_output=False, text=True)
            if result.returncode != 0:
                success = False
                print(f"❌ {test} failed with exit code {result.returncode}")
        except Exception as e:
            success = False
            print(f"❌ Error running {test}: {e}")
    
    return success

def run_utilities(utility: str, **kwargs):
    """Run utility scripts"""
    util_dir = Path(__file__).parent / "utilities"
    
    if utility == "count_timestamps":
        test_path = util_dir / "count_metric_timestamps.py"
        cmd = [sys.executable, str(test_path)]
        
        if kwargs.get('metric'):
            cmd.extend(['--metric', kwargs['metric']])
        if kwargs.get('hours'):
            cmd.extend(['--hours', str(kwargs['hours'])])
        
        print(f"🔧 Running timestamp counter utility...")
        try:
            subprocess.run(cmd, capture_output=False, text=True)
            return True
        except Exception as e:
            print(f"❌ Error running utility: {e}")
            return False
    else:
        print(f"❌ Unknown utility: {utility}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Prometric Test Runner")
    subparsers = parser.add_subparsers(dest='command', help='Test commands')
    
    # Integration tests
    integration_parser = subparsers.add_parser('integration', help='Run integration tests')
    integration_parser.add_argument('--type', choices=['all', 'connection', 'endpoints', 'analysis'], 
                                   default='all', help='Type of integration test to run')
    integration_parser.add_argument('--pattern', help='Pattern for metric analysis')
    integration_parser.add_argument('--metric', help='Specific metric for analysis')
    integration_parser.add_argument('--api-port', type=int, default=8000, help='API port')
    
    # Utilities
    util_parser = subparsers.add_parser('utility', help='Run utility scripts')
    util_parser.add_argument('--name', choices=['count_timestamps'], required=True,
                            help='Utility to run')
    util_parser.add_argument('--metric', help='Metric name for timestamp counting')
    util_parser.add_argument('--hours', type=int, default=24, help='Hours to analyze')
    
    # Quick commands
    quick_parser = subparsers.add_parser('quick', help='Quick test commands')
    quick_parser.add_argument('action', choices=['health', 'connection', 'metrics'],
                             help='Quick test action')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    if args.command == 'integration':
        success = run_integration_tests(
            test_type=args.type,
            pattern=args.pattern,
            metric=args.metric,
            api_port=args.api_port
        )
        sys.exit(0 if success else 1)
    
    elif args.command == 'utility':
        success = run_utilities(
            utility=args.name,
            metric=args.metric,
            hours=args.hours
        )
        sys.exit(0 if success else 1)
    
    elif args.command == 'quick':
        if args.action == 'health':
            success = run_integration_tests('endpoints')
        elif args.action == 'connection':
            success = run_integration_tests('connection')
        elif args.action == 'metrics':
            success = run_integration_tests('analysis')
        
        sys.exit(0 if success else 1)

if __name__ == "__main__":
    main() 
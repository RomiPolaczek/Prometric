#!/usr/bin/env python3
"""
Test script to analyze metric information in the database and Prometheus
This script checks:
1. Retention policies for specific metrics
2. Execution logs and history
3. Current Prometheus data for metrics
4. Storage statistics and retention analysis
"""

import asyncio
import aiohttp
import sqlite3
import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import sys

# Configuration
API_BASE = "http://localhost:8000"  # Backend API port
PROMETHEUS_URL = "http://localhost:9090"
DATABASE_PATH = "./data/prometheus_retention.db"

class MetricAnalyzer:
    def __init__(self):
        self.api_base = API_BASE
        self.prometheus_url = PROMETHEUS_URL
        self.database_path = DATABASE_PATH
        
    async def test_api_connection(self) -> bool:
        """Test if the API is accessible"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.api_base}/health") as response:
                    if response.status == 200:
                        data = await response.json()
                        print(f"✅ API Health: {data.get('status', 'unknown')}")
                        if data.get('prometheus_connection', {}).get('status') == 'connected':
                            print(f"✅ Prometheus Connection: {data['prometheus_connection']['url']}")
                        return True
                    else:
                        print(f"❌ API Health Check Failed: {response.status}")
                        return False
        except Exception as e:
            print(f"❌ API Connection Error: {e}")
            return False

    def analyze_database_retention_policies(self, metric_pattern: str = None) -> Dict[str, Any]:
        """Analyze retention policies in the database"""
        print("\n🔍 Analyzing Database Retention Policies")
        print("=" * 50)
        
        if not os.path.exists(self.database_path):
            print(f"❌ Database not found at: {self.database_path}")
            return {}
        
        try:
            conn = sqlite3.connect(self.database_path)
            cursor = conn.cursor()
            
            # Get retention policies
            if metric_pattern:
                cursor.execute("""
                    SELECT id, metric_name_pattern, retention_days, description, 
                           enabled, created_at, updated_at, last_executed
                    FROM retention_policies 
                    WHERE metric_name_pattern LIKE ?
                    ORDER BY created_at DESC
                """, (f'%{metric_pattern}%',))
            else:
                cursor.execute("""
                    SELECT id, metric_name_pattern, retention_days, description, 
                           enabled, created_at, updated_at, last_executed
                    FROM retention_policies 
                    ORDER BY created_at DESC
                """)
            
            policies = cursor.fetchall()
            
            print(f"📊 Found {len(policies)} retention policies:")
            for policy in policies:
                (policy_id, pattern, days, desc, enabled, created, updated, last_exec) = policy
                status = "✅ Enabled" if enabled else "❌ Disabled"
                last_exec_str = last_exec if last_exec else "Never"
                print(f"  ID {policy_id}: {pattern} -> {days} days ({status})")
                print(f"    Description: {desc or 'No description'}")
                print(f"    Created: {created}")
                print(f"    Last Executed: {last_exec_str}")
                print()
            
            # Get execution logs
            if metric_pattern:
                cursor.execute("""
                    SELECT el.id, el.policy_id, el.metric_name_pattern, el.metrics_found,
                           el.series_deleted, el.execution_time, el.success, el.error_message,
                           rp.metric_name_pattern as policy_pattern
                    FROM execution_logs el
                    LEFT JOIN retention_policies rp ON el.policy_id = rp.id
                    WHERE el.metric_name_pattern LIKE ?
                    ORDER BY el.execution_time DESC
                    LIMIT 20
                """, (f'%{metric_pattern}%',))
            else:
                cursor.execute("""
                    SELECT el.id, el.policy_id, el.metric_name_pattern, el.metrics_found,
                           el.series_deleted, el.execution_time, el.success, el.error_message,
                           rp.metric_name_pattern as policy_pattern
                    FROM execution_logs el
                    LEFT JOIN retention_policies rp ON el.policy_id = rp.id
                    ORDER BY el.execution_time DESC
                    LIMIT 20
                """)
            
            logs = cursor.fetchall()
            
            print(f"📋 Found {len(logs)} execution logs:")
            for log in logs:
                (log_id, policy_id, metric_pattern, metrics_found, series_deleted, 
                 exec_time, success, error_msg, policy_pattern) = log
                status = "✅ Success" if success else "❌ Failed"
                print(f"  Log {log_id}: {metric_pattern} -> {status}")
                print(f"    Policy ID: {policy_id} ({policy_pattern})")
                print(f"    Metrics Found: {metrics_found}, Series Deleted: {series_deleted}")
                print(f"    Execution Time: {exec_time}")
                if error_msg:
                    print(f"    Error: {error_msg}")
                print()
            
            # Get summary statistics
            cursor.execute("""
                SELECT 
                    COUNT(*) as total_policies,
                    COUNT(CASE WHEN enabled = 1 THEN 1 END) as enabled_policies,
                    COUNT(CASE WHEN enabled = 0 THEN 1 END) as disabled_policies,
                    AVG(retention_days) as avg_retention_days,
                    MIN(retention_days) as min_retention_days,
                    MAX(retention_days) as max_retention_days
                FROM retention_policies
            """)
            
            stats = cursor.fetchone()
            if stats:
                total, enabled, disabled, avg_days, min_days, max_days = stats
                print(f"📈 Retention Policy Statistics:")
                print(f"  Total Policies: {total}")
                print(f"  Enabled: {enabled}, Disabled: {disabled}")
                print(f"  Retention Range: {min_days:.2f} - {max_days:.2f} days")
                print(f"  Average Retention: {avg_days:.2f} days")
                print()
            
            conn.close()
            return {"policies": policies, "logs": logs, "stats": stats}
            
        except Exception as e:
            print(f"❌ Database Analysis Error: {e}")
            return {}

    async def analyze_prometheus_metrics(self, metric_pattern: str = None) -> Dict[str, Any]:
        """Analyze metrics data in Prometheus"""
        print("\n🔍 Analyzing Prometheus Metrics")
        print("=" * 50)
        
        try:
            async with aiohttp.ClientSession() as session:
                # Get all available metrics
                async with session.get(f"{self.prometheus_url}/api/v1/label/__name__/values") as response:
                    if response.status != 200:
                        print(f"❌ Failed to get metrics: {response.status}")
                        return {}
                    
                    metrics_data = await response.json()
                    all_metrics = metrics_data.get('data', [])
                    
                    if metric_pattern:
                        # Filter metrics by pattern
                        filtered_metrics = [m for m in all_metrics if metric_pattern.lower() in m.lower()]
                        print(f"📊 Found {len(filtered_metrics)} metrics matching pattern '{metric_pattern}':")
                        for metric in filtered_metrics[:10]:  # Show first 10
                            print(f"  - {metric}")
                        if len(filtered_metrics) > 10:
                            print(f"  ... and {len(filtered_metrics) - 10} more")
                    else:
                        print(f"📊 Total metrics in Prometheus: {len(all_metrics)}")
                        print("Sample metrics:")
                        for metric in all_metrics[:10]:
                            print(f"  - {metric}")
                        if len(all_metrics) > 10:
                            print(f"  ... and {len(all_metrics) - 10} more")
                    
                    # Get series count for specific metrics if pattern provided
                    if metric_pattern and filtered_metrics:
                        print(f"\n📈 Series Analysis for matching metrics:")
                        total_series = 0
                        for metric in filtered_metrics[:5]:  # Analyze first 5 matching metrics
                            try:
                                # Get series count
                                series_response = await session.get(
                                    f"{self.prometheus_url}/api/v1/series",
                                    params={'match[]': metric}
                                )
                                if series_response.status == 200:
                                    series_data = await series_response.json()
                                    series_count = len(series_data.get('data', []))
                                    total_series += series_count
                                    print(f"  {metric}: {series_count} series")
                                    
                                    # Get sample data
                                    query_response = await session.get(
                                        f"{self.prometheus_url}/api/v1/query",
                                        params={'query': metric}
                                    )
                                    if query_response.status == 200:
                                        query_data = await query_response.json()
                                        result_count = len(query_data.get('data', {}).get('result', []))
                                        print(f"    Sample result count: {result_count}")
                                        
                                        if result_count > 0:
                                            # Get time range
                                            sample_result = query_data['data']['result'][0]
                                            if 'value' in sample_result:
                                                timestamp = sample_result['value'][0]
                                                sample_time = datetime.fromtimestamp(timestamp)
                                                print(f"    Sample timestamp: {sample_time}")
                                
                            except Exception as e:
                                print(f"    Error analyzing {metric}: {e}")
                        
                        print(f"  Total series for matching metrics: {total_series}")
                    
                    return {"total_metrics": len(all_metrics), "filtered_metrics": filtered_metrics if metric_pattern else []}
                    
        except Exception as e:
            print(f"❌ Prometheus Analysis Error: {e}")
            return {}

    async def analyze_metric_storage(self, metric_name: str) -> Dict[str, Any]:
        """Analyze storage information for a specific metric"""
        print(f"\n🔍 Analyzing Storage for Metric: {metric_name}")
        print("=" * 50)
        
        try:
            async with aiohttp.ClientSession() as session:
                # Get TSDB stats
                tsdb_response = await session.get(f"{self.prometheus_url}/api/v1/status/tsdb")
                if tsdb_response.status == 200:
                    tsdb_data = await tsdb_response.json()
                    print("📊 TSDB Storage Statistics:")
                    print(f"  Head Series: {tsdb_data.get('data', {}).get('headSeries', 'N/A')}")
                    print(f"  Head Chunks: {tsdb_data.get('data', {}).get('headChunks', 'N/A')}")
                    print(f"  Head Min Time: {tsdb_data.get('data', {}).get('headMinTime', 'N/A')}")
                    print(f"  Head Max Time: {tsdb_data.get('data', {}).get('headMaxTime', 'N/A')}")
                
                # Get specific metric series
                series_response = await session.get(
                    f"{self.prometheus_url}/api/v1/series",
                    params={'match[]': metric_name}
                )
                
                if series_response.status == 200:
                    series_data = await series_response.json()
                    series_list = series_data.get('data', [])
                    
                    print(f"\n📈 Series Analysis for '{metric_name}':")
                    print(f"  Total Series: {len(series_list)}")
                    
                    if series_list:
                        # Analyze first few series
                        for i, series in enumerate(series_list[:3]):
                            print(f"  Series {i+1}:")
                            for key, value in series.items():
                                print(f"    {key}: {value}")
                        
                        # Get time range for the metric
                        time_query = f"max({metric_name}) - min({metric_name})"
                        time_response = await session.get(
                            f"{self.prometheus_url}/api/v1/query",
                            params={'query': time_query}
                        )
                        
                        if time_response.status == 200:
                            time_data = await time_response.json()
                            result = time_data.get('data', {}).get('result', [])
                            if result:
                                time_diff = result[0].get('value', [0, 0])[1]
                                print(f"  Time Range: {float(time_diff):.2f} seconds")
                                print(f"  Time Range: {float(time_diff)/3600:.2f} hours")
                                print(f"  Time Range: {float(time_diff)/86400:.2f} days")
                
                return {"series_count": len(series_list) if 'series_list' in locals() else 0}
                
        except Exception as e:
            print(f"❌ Storage Analysis Error: {e}")
            return {}

    async def run_comprehensive_analysis(self, metric_pattern: str = None, specific_metric: str = None):
        """Run comprehensive analysis of metrics"""
        print("🚀 Starting Comprehensive Metric Analysis")
        print("=" * 60)
        print(f"API Base: {self.api_base}")
        print(f"Prometheus URL: {self.prometheus_url}")
        print(f"Database Path: {self.database_path}")
        print(f"Metric Pattern: {metric_pattern or 'All metrics'}")
        print(f"Specific Metric: {specific_metric or 'None'}")
        print("=" * 60)
        
        # Test API connection
        api_ok = await self.test_api_connection()
        if not api_ok:
            print("❌ Cannot proceed without API connection")
            return
        
        # Analyze database retention policies
        db_analysis = self.analyze_database_retention_policies(metric_pattern)
        
        # Analyze Prometheus metrics
        prometheus_analysis = await self.analyze_prometheus_metrics(metric_pattern)
        
        # Analyze specific metric storage if provided
        if specific_metric:
            storage_analysis = await self.analyze_metric_storage(specific_metric)
        else:
            storage_analysis = {}
        
        # Summary
        print("\n" + "=" * 60)
        print("📋 ANALYSIS SUMMARY")
        print("=" * 60)
        
        if db_analysis:
            policies = db_analysis.get('policies', [])
            logs = db_analysis.get('logs', [])
            stats = db_analysis.get('stats', [])
            
            print(f"📊 Database Analysis:")
            print(f"  - Retention Policies: {len(policies)}")
            print(f"  - Execution Logs: {len(logs)}")
            if stats:
                print(f"  - Average Retention: {stats[3]:.2f} days")
        
        if prometheus_analysis:
            total_metrics = prometheus_analysis.get('total_metrics', 0)
            filtered_metrics = prometheus_analysis.get('filtered_metrics', [])
            
            print(f"📊 Prometheus Analysis:")
            print(f"  - Total Metrics: {total_metrics}")
            if metric_pattern:
                print(f"  - Matching Metrics: {len(filtered_metrics)}")
        
        if storage_analysis:
            series_count = storage_analysis.get('series_count', 0)
            print(f"📊 Storage Analysis:")
            print(f"  - Series Count: {series_count}")
        
        print("\n✅ Analysis completed!")

async def main():
    """Main function to run the analysis"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Analyze metric information in the database and Prometheus')
    parser.add_argument('--pattern', '-p', help='Metric name pattern to filter by (e.g., "cpu", "memory")')
    parser.add_argument('--metric', '-m', help='Specific metric name to analyze in detail')
    parser.add_argument('--api-port', default='8000', help='API port (default: 8000)')
    
    args = parser.parse_args()
    
    # Update API base if port is specified
    api_base = f"http://localhost:{args.api_port}"
    
    analyzer = MetricAnalyzer()
    analyzer.api_base = api_base
    
    try:
        await analyzer.run_comprehensive_analysis(
            metric_pattern=args.pattern,
            specific_metric=args.metric
        )
    except KeyboardInterrupt:
        print("\n\n⏹️ Analysis interrupted by user")
    except Exception as e:
        print(f"\n❌ Analysis failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 
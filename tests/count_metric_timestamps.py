#!/usr/bin/env python3
"""
Test script to count timestamps/data points for a specific metric in Prometheus.
Useful for verifying that metric deletion is working correctly.

Usage:
    python3 tests/count_metric_timestamps.py --metric "your_metric_name"
    python3 tests/count_metric_timestamps.py --metric "probe_http_ssl" --hours 24
"""

import asyncio
import aiohttp
import argparse
import sys
from datetime import datetime, timedelta
import json

class MetricTimestampCounter:
    def __init__(self, prometheus_url="http://localhost:9090"):
        self.prometheus_url = prometheus_url.rstrip('/')
    
    async def count_metric_timestamps(self, metric_name: str, hours: int = 24) -> dict:
        """Count timestamps/data points for a specific metric"""
        
        results = {
            'metric_name': metric_name,
            'time_range_hours': hours,
            'series_count': 0,
            'total_data_points': 0,
            'data_points_per_series': [],
            'timestamp': datetime.now().isoformat()
        }
        
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30)) as session:
                
                print(f"🔍 Analyzing metric: {metric_name}")
                print(f"📅 Time range: {hours} hours")
                print(f"🌐 Prometheus URL: {self.prometheus_url}")
                print("-" * 50)
                
                # 1. Get series count for the metric
                print("📊 Getting series information...")
                series_url = f"{self.prometheus_url}/api/v1/series"
                async with session.get(series_url, params={'match[]': metric_name}) as response:
                    if response.status == 200:
                        series_data = await response.json()
                        series_list = series_data.get('data', [])
                        results['series_count'] = len(series_list)
                        print(f"   Found {len(series_list)} series for metric '{metric_name}'")
                        
                        # Show first few series labels
                        for i, series in enumerate(series_list[:3]):
                            labels = ", ".join([f"{k}={v}" for k, v in series.items()])
                            print(f"   Series {i+1}: {{{labels}}}")
                        
                        if len(series_list) > 3:
                            print(f"   ... and {len(series_list) - 3} more series")
                    else:
                        print(f"   ❌ Failed to get series: HTTP {response.status}")
                        return results
                
                # 2. Count data points using count_over_time
                print(f"\n📈 Counting data points over last {hours} hours...")
                count_query = f"count_over_time({metric_name}[{hours}h])"
                query_url = f"{self.prometheus_url}/api/v1/query"
                
                async with session.get(query_url, params={'query': count_query}) as response:
                    if response.status == 200:
                        count_data = await response.json()
                        query_results = count_data.get('data', {}).get('result', [])
                        
                        total_points = 0
                        for result in query_results:
                            if result.get('value'):
                                points = int(float(result['value'][1]))
                                total_points += points
                                
                                # Format metric labels for display
                                metric_labels = result.get('metric', {})
                                label_str = ", ".join([f"{k}={v}" for k, v in metric_labels.items() if k != '__name__'])
                                display_name = f"{metric_name}{{{label_str}}}" if label_str else metric_name
                                
                                results['data_points_per_series'].append({
                                    'series': display_name,
                                    'data_points': points
                                })
                                
                                print(f"   {display_name}: {points} data points")
                        
                        results['total_data_points'] = total_points
                        print(f"\n📊 Total data points: {total_points}")
                        
                        if results['series_count'] > 0:
                            avg_points = total_points / results['series_count']
                            results['average_points_per_series'] = avg_points
                            print(f"📊 Average points per series: {avg_points:.1f}")
                    else:
                        print(f"   ❌ Failed to count data points: HTTP {response.status}")
                        error_text = await response.text()
                        print(f"   Error: {error_text}")
                
                # 3. Get time range information
                print(f"\n🕐 Getting time range information...")
                
                # Use range query to get actual time span
                end_time = datetime.now()
                start_time = end_time - timedelta(hours=hours)
                
                range_query_url = f"{self.prometheus_url}/api/v1/query_range"
                params = {
                    'query': metric_name,
                    'start': start_time.timestamp(),
                    'end': end_time.timestamp(),
                    'step': '300'  # 5 minute step
                }
                
                async with session.get(range_query_url, params=params) as response:
                    if response.status == 200:
                        range_data = await response.json()
                        range_results = range_data.get('data', {}).get('result', [])
                        
                        all_timestamps = []
                        for result in range_results:
                            values = result.get('values', [])
                            for timestamp, _ in values:
                                all_timestamps.append(float(timestamp))
                        
                        if all_timestamps:
                            earliest = min(all_timestamps)
                            latest = max(all_timestamps)
                            earliest_dt = datetime.fromtimestamp(earliest)
                            latest_dt = datetime.fromtimestamp(latest)
                            
                            print(f"   Earliest data: {earliest_dt}")
                            print(f"   Latest data: {latest_dt}")
                            print(f"   Data span: {latest_dt - earliest_dt}")
                            print(f"   Total unique timestamps: {len(set(all_timestamps))}")
                            
                            results['earliest_timestamp'] = earliest_dt.isoformat()
                            results['latest_timestamp'] = latest_dt.isoformat()
                            results['unique_timestamps'] = len(set(all_timestamps))
                        else:
                            print(f"   No data found in the last {hours} hours")
                    else:
                        print(f"   ❌ Failed to get time range: HTTP {response.status}")
                        error_text = await response.text()
                        print(f"   Error: {error_text}")
                
                return results
                
        except Exception as e:
            print(f"❌ Error: {e}")
            results['error'] = str(e)
            return results
    
    async def compare_before_after(self, metric_name: str, hours: int = 24, delay: int = 5):
        """Count timestamps before and after, useful for testing deletion"""
        
        print("🔄 BEFORE/AFTER COMPARISON MODE")
        print("=" * 60)
        
        # Count before
        print("📊 BEFORE - Counting timestamps...")
        before_results = await self.count_metric_timestamps(metric_name, hours)
        
        print(f"\n⏳ Waiting {delay} seconds for you to trigger deletion...")
        print("   (Run your deletion process now)")
        await asyncio.sleep(delay)
        
        # Count after
        print("\n📊 AFTER - Counting timestamps...")
        after_results = await self.count_metric_timestamps(metric_name, hours)
        
        # Compare results
        print("\n📈 COMPARISON RESULTS")
        print("=" * 60)
        
        before_total = before_results.get('total_data_points', 0)
        after_total = after_results.get('total_data_points', 0)
        before_series = before_results.get('series_count', 0)
        after_series = after_results.get('series_count', 0)
        
        print(f"Series count:     {before_series} → {after_series} (Δ {after_series - before_series})")
        print(f"Total data points: {before_total} → {after_total} (Δ {after_total - before_total})")
        
        if before_total > after_total:
            deleted_points = before_total - after_total
            percentage = (deleted_points / before_total) * 100 if before_total > 0 else 0
            print(f"✅ Deletion successful: {deleted_points} data points removed ({percentage:.1f}%)")
        elif before_total == after_total:
            print("⚠️  No change detected - deletion may not have occurred")
        else:
            print("⚠️  Data points increased - unexpected behavior")
        
        return {
            'before': before_results,
            'after': after_results,
            'deleted_points': before_total - after_total,
            'deleted_series': before_series - after_series
        }

async def main():
    parser = argparse.ArgumentParser(description='Count timestamps/data points for a Prometheus metric')
    parser.add_argument('--metric', '-m', required=True, help='Metric name to analyze')
    parser.add_argument('--hours', type=int, default=24, help='Time range in hours (default: 24)')
    parser.add_argument('--prometheus-url', default='http://localhost:9090', help='Prometheus URL')
    parser.add_argument('--compare', action='store_true', help='Compare before/after for deletion testing')
    parser.add_argument('--delay', type=int, default=10, help='Delay between before/after counts (seconds)')
    parser.add_argument('--output', help='Save results to JSON file')
    
    args = parser.parse_args()
    
    counter = MetricTimestampCounter(args.prometheus_url)
    
    if args.compare:
        results = await counter.compare_before_after(args.metric, args.hours, args.delay)
    else:
        results = await counter.count_metric_timestamps(args.metric, args.hours)
    
    if args.output:
        with open(args.output, 'w') as f:
            json.dump(results, f, indent=2)
        print(f"\n💾 Results saved to {args.output}")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 Interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        sys.exit(1) 
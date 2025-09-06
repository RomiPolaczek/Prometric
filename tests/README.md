# Metric Analysis Tests

This directory contains test scripts for analyzing metric information in the Prometheus retention system.

## Test Scripts

### 1. `test_metric_analysis.py` - Comprehensive Metric Analysis

This script provides detailed analysis of metrics in both the database and Prometheus, including:

- **Database Analysis**: Retention policies, execution logs, and statistics
- **Prometheus Analysis**: Available metrics, series counts, and sample data
- **Storage Analysis**: TSDB statistics and specific metric details

#### Usage

```bash
# Analyze all metrics
python3 tests/test_metric_analysis.py

# Analyze metrics matching a pattern
python3 tests/test_metric_analysis.py --pattern "cpu"
python3 tests/test_metric_analysis.py --pattern "probe"
python3 tests/test_metric_analysis.py --pattern "prometheus"

# Analyze a specific metric in detail
python3 tests/test_metric_analysis.py --metric "probe_http_ssl"

# Use custom API port
python3 tests/test_metric_analysis.py --api-port 8000
```

#### Command Line Options

- `--pattern, -p`: Filter metrics by name pattern (e.g., "cpu", "memory", "probe")
- `--metric, -m`: Analyze a specific metric name in detail
- `--api-port`: Specify the backend API port (default: 8000)

#### What It Analyzes

1. **Database Retention Policies**
   - Total policies and their status
   - Retention periods and descriptions
   - Last execution times
   - Policy statistics (averages, ranges)

2. **Execution Logs**
   - Success/failure history
   - Metrics found and series deleted
   - Execution timestamps
   - Error messages (if any)

3. **Prometheus Metrics**
   - Total available metrics
   - Metrics matching patterns
   - Series counts per metric
   - Sample data and timestamps

4. **Storage Information**
   - TSDB statistics
   - Series details and labels
   - Time ranges for metrics

### 2. `test_endpoints.py` - API Endpoint Testing

Tests the Prometheus proxy endpoints to ensure they're working correctly.

### 3. `test_connection.py` - Connection Testing

Tests connections to Prometheus and other services.

## Prerequisites

Install required Python packages:

```bash
pip3 install aiohttp
```

## Example Output

The script provides comprehensive output showing:

- ✅ API health and Prometheus connection status
- 📊 Database retention policies and execution logs
- 📈 Prometheus metrics analysis
- 🔍 Detailed storage information for specific metrics
- 📋 Summary of all findings

## Use Cases

This test script is useful for:

- **Monitoring**: Check how much data is being retained for different metrics
- **Debugging**: Identify issues with retention policies or data collection
- **Capacity Planning**: Understand storage usage and metric growth
- **Policy Management**: Review and optimize retention policies
- **Performance Analysis**: Monitor execution times and success rates

## Troubleshooting

- **API Connection Issues**: Ensure the backend API is running on the specified port
- **Database Access**: Verify the database file exists at `./data/prometheus_retention.db`
- **Prometheus Connection**: Check that Prometheus is accessible at the configured URL
- **Missing Dependencies**: Install required packages with `pip3 install aiohttp` 


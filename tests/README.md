# Prometric Test Suite

This directory contains organized test scripts and utilities for the Prometheus retention system.

## Directory Structure

```
tests/
├── run_tests.py              # Main test runner script
├── integration/              # Integration tests
│   ├── test_connection.py    # Connection testing
│   ├── test_endpoints.py     # API endpoint testing
│   └── test_metric_analysis.py # Comprehensive metric analysis
├── unit/                     # Unit tests (for future use)
└── utilities/                # Test utilities and helper scripts
    └── count_metric_timestamps.py # Metric timestamp counter
```

## Quick Start

### Examples and Common Patterns

For detailed examples and common usage patterns, run:

```bash
python3 tests/examples.py
```

This will show you practical examples of how to use the test suite for different scenarios like health checks, debugging, and monitoring.

### Using the Test Runner (Recommended)

The `run_tests.py` script provides a unified interface to run all tests:

```bash
# Run all integration tests
python3 tests/run_tests.py integration

# Run specific integration test types
python3 tests/run_tests.py integration --type connection
python3 tests/run_tests.py integration --type endpoints
python3 tests/run_tests.py integration --type analysis

# Run metric analysis with filters
python3 tests/run_tests.py integration --type analysis --pattern "cpu"
python3 tests/run_tests.py integration --type analysis --metric "probe_http_ssl"

# Run utilities
python3 tests/run_tests.py utility --name count_timestamps --metric "probe_http_ssl" --hours 24

# Quick test commands
python3 tests/run_tests.py quick health      # Test API health
python3 tests/run_tests.py quick connection  # Test connections
python3 tests/run_tests.py quick metrics     # Test metric analysis
```

### Running Tests Individually

You can also run tests directly from their subdirectories:

```bash
# Integration tests
python3 tests/integration/test_connection.py
python3 tests/integration/test_endpoints.py
python3 tests/integration/test_metric_analysis.py --pattern "cpu"

# Utilities
python3 tests/utilities/count_metric_timestamps.py --metric "probe_http_ssl"
```

## Test Categories

### Integration Tests (`integration/`)

#### 1. `test_connection.py` - Connection Testing
Tests direct connections to Prometheus and related services.

**Features:**
- Direct Prometheus API connectivity
- Target endpoint verification
- Service health checks
- Network connectivity diagnostics

**Usage:**
```bash
python3 tests/integration/test_connection.py
```

#### 2. `test_endpoints.py` - API Endpoint Testing
Tests the Prometheus proxy endpoints to ensure they're working correctly.

**Features:**
- Health check endpoint testing
- Prometheus proxy endpoint verification
- API response validation
- Error handling verification

**Usage:**
```bash
python3 tests/integration/test_endpoints.py
```

#### 3. `test_metric_analysis.py` - Comprehensive Metric Analysis
Provides detailed analysis of metrics in both the database and Prometheus.

**Features:**
- **Database Analysis**: Retention policies, execution logs, and statistics
- **Prometheus Analysis**: Available metrics, series counts, and sample data
- **Storage Analysis**: TSDB statistics and specific metric details
- **Pattern Filtering**: Analyze metrics matching specific patterns
- **Detailed Reporting**: Comprehensive output with statistics and summaries

**Usage:**
```bash
# Analyze all metrics
python3 tests/integration/test_metric_analysis.py

# Analyze metrics matching a pattern
python3 tests/integration/test_metric_analysis.py --pattern "cpu"
python3 tests/integration/test_metric_analysis.py --pattern "probe"
python3 tests/integration/test_metric_analysis.py --pattern "prometheus"

# Analyze a specific metric in detail
python3 tests/integration/test_metric_analysis.py --metric "probe_http_ssl"

# Use custom API port
python3 tests/integration/test_metric_analysis.py --api-port 8000
```

**Command Line Options:**
- `--pattern, -p`: Filter metrics by name pattern (e.g., "cpu", "memory", "probe")
- `--metric, -m`: Analyze a specific metric name in detail
- `--api-port`: Specify the backend API port (default: 8000)

### Utilities (`utilities/`)

#### 1. `count_metric_timestamps.py` - Metric Timestamp Counter
Counts timestamps/data points for specific metrics in Prometheus. Useful for verifying that metric deletion is working correctly.

**Features:**
- Count data points for specific metrics
- Analyze time ranges
- Series-level analysis
- Before/after deletion verification

**Usage:**
```bash
# Count timestamps for a specific metric
python3 tests/utilities/count_metric_timestamps.py --metric "probe_http_ssl"

# Analyze last 48 hours
python3 tests/utilities/count_metric_timestamps.py --metric "probe_http_ssl" --hours 48

# Quick analysis
python3 tests/utilities/count_metric_timestamps.py --metric "up" --hours 1
```

**Command Line Options:**
- `--metric, -m`: Metric name to analyze (required)
- `--hours`: Number of hours to analyze (default: 24)

## Test Analysis Output

The metric analysis tests provide comprehensive output including:

- ✅ **API Health**: Connection status and service availability
- 📊 **Database Analysis**: Retention policies and execution logs  
- 📈 **Prometheus Metrics**: Available metrics and series counts
- 🔍 **Storage Information**: TSDB statistics and metric details
- 📋 **Summary Reports**: Aggregated findings and recommendations

## Prerequisites

Install required Python packages:

```bash
pip3 install aiohttp
```

## Configuration

Tests use the following default configurations:
- **API Base URL**: `http://localhost:8000`
- **Prometheus URL**: `http://localhost:9090`
- **Database Path**: `./data/prometheus_retention.db`

These can be customized through command-line arguments or environment variables.

## Use Cases

This test suite is useful for:

- **System Monitoring**: Verify system health and connectivity
- **Retention Verification**: Check that retention policies are working correctly
- **Performance Analysis**: Monitor execution times and success rates
- **Debugging**: Identify issues with data collection or retention
- **Capacity Planning**: Understand storage usage and metric growth
- **Policy Management**: Review and optimize retention configurations

## Troubleshooting

### Common Issues

- **API Connection Issues**: Ensure the backend API is running on the specified port
- **Database Access**: Verify the database file exists at `./data/prometheus_retention.db`
- **Prometheus Connection**: Check that Prometheus is accessible at the configured URL
- **Missing Dependencies**: Install required packages with `pip3 install aiohttp`
- **Permission Issues**: Ensure test files have execute permissions

### Getting Help

1. **Check System Status**: Run `python3 tests/run_tests.py quick health`
2. **Test Connections**: Run `python3 tests/run_tests.py quick connection`
3. **Verify Configuration**: Check API and Prometheus URLs in test scripts
4. **Review Logs**: Check application logs for detailed error messages

## Future Enhancements

The `unit/` directory is prepared for future unit tests that will test individual components in isolation. This will complement the current integration testing approach with more focused, faster-running tests. 


# Prometric

A modern web-based management interface for Prometheus that extends its capabilities with metric-specific retention policies and AI-powered query generation.

## Overview

Prometric addresses key limitations in Prometheus monitoring by providing:
- **Granular Retention Control**: Set different retention periods per metric instead of global retention
- **Natural Language Queries**: Convert plain English questions into PromQL using AI
- **Unified Management Interface**: Complete web dashboard for all Prometheus operations

## Features

### Core Features
- **Unified Dashboard**: Complete web interface for Prometheus monitoring
- **Metric-Specific Retention**: Configure different retention periods per metric
- **AI-Powered Query Assistant**: Natural language to PromQL translation
- **Advanced Graphing**: Interactive charts and visualizations  
- **Target Management**: Monitor scrape targets and their status
- **Alert Management**: View and manage Prometheus alerts
- **Query Interface**: Execute PromQL queries with syntax highlighting
- **System Status**: Real-time system health and performance metrics

### AI Assistant Features
- **Natural Language Processing**: Ask questions like "What is my memory usage?"
- **Smart Metric Selection**: Automatically selects appropriate metrics from your Prometheus instance
- **Interactive Chat Interface**: Chat with the AI directly in the Query tab
- **Query Suggestions**: Get AI-powered PromQL query recommendations
- **Seamless Integration**: Generated queries can be directly used in the PromQL input

### Retention Management
- **Flexible Retention Policies**: Set retention periods per metric pattern (supports fractional days)
- **Regex Pattern Matching**: Use wildcards and regex for metric selection
- **Automated Execution**: Background scheduler runs retention policies automatically
- **Dry Run Testing**: Test policies without actually deleting data
- **Execution Logging**: Track policy execution history and results
- **Real-time Monitoring**: Monitor retention policy effectiveness

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend       │    │   Prometheus    │
│   (Next.js)     │◄──►│   (FastAPI)      │◄──►│    Server       │
│                 │    │                  │    │                 │
│ • Query Tab     │    │ • API Proxy      │    │ • Metrics       │
│ • Graph Tab     │    │ • AI Service     │    │ • Alerts        │
│ • Alerts Tab    │    │ • Retention      │    │ • Targets       │
│ • Targets Tab   │    │ • Scheduler      │    │ • TSDB          │
│ • Retention Tab │    │                  │    │                 │
│ • Status Tab    │    │                  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                       ┌──────────────────┐
                       │    Database      │
                       │   (SQLite)       │
                       │                  │
                       │ • Policies       │
                       │ • Execution Logs │
                       └──────────────────┘
```

## Installation

### Prerequisites
- Python 3.8+
- Node.js 18+
- Running Prometheus instance
- OpenAI API key (optional, for AI features)

### Backend Setup

1. **Install dependencies**
   ```bash
   cd src
   pip install -r requirements.txt
   ```

2. **Configure environment**
   ```bash
   export PROMETHEUS_URL="http://localhost:9090"
   export OPENAI_API_KEY="sk-your-key-here"  # Optional
   export DATABASE_URL="sqlite:///./data/prometheus_retention.db"
   ```

3. **Start backend server**
   ```bash
   python main.py
   ```

### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start development server**
   ```bash
   npm run dev
   ```

3. **Access application**
   - Web interface: `http://localhost:3000`
   - API documentation: `http://localhost:8000/docs`

## AI Assistant Setup

For detailed instructions on configuring and using the AI-powered features, please see [AI_SETUP.md](./AI_SETUP.md).

## Usage Guide

### Query Tab

#### Traditional PromQL Mode
- Enter PromQL queries directly
- View results in table or JSON format  
- Copy queries to clipboard
- Query history and suggestions

#### AI Assistant Mode
1. Click the **AI Assistant** button
2. Ask natural language questions:
   - "What is my memory usage?"
   - "Show me CPU utilization"
   - "How much disk space is available?"
   - "What's the network traffic like?"
   - "Is my system running properly?"

The AI will:
- Translate your question to PromQL
- Explain why it chose specific metrics
- Show which metrics were used
- Provide buttons to use or copy the query

### Graph Tab
- Execute PromQL queries with time-series visualization
- Interactive charts with zoom and pan
- Multiple time range options
- Export graph data

### Alerts Tab  
- View active and firing alerts
- Alert status and labels
- Alert history and annotations

### Targets Tab
- Monitor scrape targets
- Target health and last scrape time
- Endpoint status and error messages

### Retention Tab
- Create and manage retention policies
- Test policies with dry runs
- View execution history and logs
- Monitor policy effectiveness

### Status Tab
- System health monitoring
- Prometheus configuration
- TSDB statistics
- Runtime information

## Retention Management

### Creating Retention Policies

1. **Navigate to Retention Tab**
2. **Click "Create New Policy"**
3. **Configure the policy:**
   - **Metric Pattern**: Use wildcards (`cpu_*`) or regex (`^node_.*`)
   - **Retention Period**: Days to keep data (supports fractional days)
   - **Description**: Optional description
   - **Enabled**: Enable/disable the policy

### Policy Examples

```javascript
// Keep memory metrics for 7 days  
Pattern: "node_memory_*"
Retention: 7.0 days

// Keep probe metrics for 1 hour
Pattern: "probe_*"
Retention: 0.042 days  // 1 hour = 1/24 days

// Keep all Go runtime metrics for 1 week
Pattern: "go_*"
Retention: 7.0 days
```

### Time Conversions

| Duration | Days Value | Example Usage |
|----------|------------|---------------|
| 1 minute | 0.0007 | `0.0007` |
| 5 minutes | 0.0035 | `0.0035` |
| 1 hour | 0.0417 | `0.0417` |
| 6 hours | 0.25 | `0.25` |
| 1 day | 1.0 | `1.0` |
| 1 week | 7.0 | `7.0` |
| 1 month | 30.0 | `30.0` |

### Testing Policies

Use **Dry Run** to test policies without deleting data:
- Shows metrics that would be affected
- Displays time ranges for deletion
- Validates policy configuration
- Safe testing environment

### Automated Execution

Policies are executed automatically every 6 hours (configurable via `RETENTION_CHECK_INTERVAL_HOURS`).

Manual execution is also available:
- Execute individual policies
- Execute all policies at once
- View execution logs and results

### Docker Deployment

### Using Docker Compose
Make sure you have Docker and Docker Compose installed.

```bash
docker-compose up -d


## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus server URL |
| `OPENAI_API_KEY` | - | OpenAI API key for AI features |
| `DATABASE_URL` | `sqlite:///./data/prometheus_retention.db` | Database connection string |
| `RETENTION_CHECK_INTERVAL_HOURS` | `6` | Retention policy execution interval |
| `API_HOST` | `0.0.0.0` | Backend API host |
| `API_PORT` | `8000` | Backend API port |
| `LOG_LEVEL` | `INFO` | Logging level |
| `LOG_FILE` | `./logs/app.log` | Log file path |

### Database Configuration

The application uses SQLite by default, but supports PostgreSQL and MySQL:

```bash
# PostgreSQL
export DATABASE_URL="postgresql://user:password@localhost/prometheus_retention"

# MySQL  
export DATABASE_URL="mysql://user:password@localhost/prometheus_retention"

# SQLite (default)
export DATABASE_URL="sqlite:///./data/prometheus_retention.db"
```

### Key Components

**Retention Service**: Manages metric lifecycle policies
- Pattern matching for metric selection
- Automated data cleanup based on age
- Execution logging and monitoring

**AI Service**: Provides natural language processing
- OpenAI GPT integration for query translation
- Context-aware metric selection
- Query suggestion generation

**Scheduler**: Handles background operations
- Periodic retention policy execution
- Configurable execution intervals
- Error handling and recovery


## Testing

### Running Tests

```bash
# Backend tests
cd src
python -m pytest tests/

# Frontend tests  
cd frontend
npm test
```
For more details about the available test utilities and usage, see the tests/README.md


## API Reference

### Key Endpoints

#### Prometheus Proxy
- `GET/POST /api/v1/*` - Proxy to Prometheus API
- `POST /prometheus-proxy/query` - Execute PromQL queries
- `GET /prometheus-proxy/metrics` - Get available metrics
- `GET /prometheus-proxy/targets` - Get scrape targets
- `GET /prometheus-proxy/alerts` - Get alerts

#### Retention Management
- `GET /retention-policies` - List all policies
- `POST /retention-policies` - Create policy
- `PUT /retention-policies/{id}` - Update policy
- `DELETE /retention-policies/{id}` - Delete policy
- `POST /retention-policies/{id}/execute` - Execute policy
- `POST /retention-policies/{id}/dry-run` - Test policy

#### AI Assistant
- `POST /ai/translate` - Translate natural language to PromQL
- `POST /ai/suggestions` - Get AI-powered suggestions
- `GET /ai/status` - Check AI service status

#### System
- `GET /health` - Health check
- `GET /system-info` - System information
- `GET /config` - Current configuration

Full API documentation available at `/docs` when running the backend.

## Troubleshooting

### Common Issues

#### AI Assistant Not Working
- **Problem**: "OpenAI API not configured" message
- **Solution**: 
  1. Verify `OPENAI_API_KEY` environment variable is set
  2. Check API key validity at OpenAI platform
  3. Restart the backend server
  4. Check backend logs for detailed errors

#### Prometheus Connection Failed
- **Problem**: Cannot connect to Prometheus
- **Solution**:
  1. Verify `PROMETHEUS_URL` is correct
  2. Check Prometheus is running and accessible
  3. Ensure admin API is enabled: `--web.enable-admin-api`
  4. Check firewall and network connectivity

#### Retention Policies Not Executing
- **Problem**: Policies created but data not being deleted
- **Solution**:
  1. Check policy is enabled
  2. Use dry run to test policy
  3. Verify metric patterns match existing metrics
  4. Check execution logs for errors
  5. Ensure Prometheus admin API is enabled

#### Frontend Build Errors
- **Problem**: npm build failures
- **Solution**:
  1. Clear node_modules: `rm -rf node_modules && npm install`
  2. Clear Next.js cache: `rm -rf .next`
  3. Check Node.js version compatibility
  4. Review console errors for specific issues

### Performance Issues

#### High Memory Usage
- Monitor retention policy frequency
- Adjust `RETENTION_CHECK_INTERVAL_HOURS`
- Consider using PostgreSQL for large deployments
- Monitor Prometheus TSDB size

#### Slow Query Performance
- Use more specific metric patterns
- Reduce query time ranges
- Consider Prometheus query optimization
- Monitor system resources

### Security Considerations

- **API Keys**: Never commit API keys to version control
- **Database**: Use proper database security in production
- **Network**: Configure appropriate firewall rules
- **Authentication**: Consider adding authentication for production use

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

1. Set up both frontend and backend development environments
2. Use the testing utilities in `tests/` for validation
3. Follow the existing code style and patterns
4. Add tests for new features
5. Update documentation as needed

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Prometheus](https://prometheus.io/) - The monitoring system that powers this project
- [OpenAI](https://openai.com/) - For AI-powered query translation
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Next.js](https://nextjs.org/) - React framework for the frontend
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

---

**Prometric** provides enterprise-grade retention management and AI-enhanced query capabilities for Prometheus monitoring infrastructure.

Project Specification- https://docs.google.com/document/d/10NjgoF0igdcuzyo_auq6zg1NrObEWZvweCbSV-8CZhQ/edit?usp=sharing

# AI Chatbot Integration Setup

This project now includes an AI-powered chatbot that can translate natural language questions into PromQL queries using OpenAI's GPT models.

## Features

- **Natural Language to PromQL**: Ask questions like "What is my memory usage?" and get translated PromQL queries
- **Smart Metric Selection**: AI automatically selects the most appropriate metrics from your available Prometheus metrics
- **Interactive Chat Interface**: Chat with the AI assistant directly in the Query tab
- **Query Suggestions**: Get AI-powered PromQL query suggestions
- **Seamless Integration**: Generated queries can be directly used in the PromQL input

## Setup Instructions

### 1. Get OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Create a new API key
4. Copy the API key (it starts with `sk-`)

### 2. Configure Environment Variable

Set the `OPENAI_API_KEY` environment variable:

**Linux/macOS:**
```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

**Windows:**
```cmd
set OPENAI_API_KEY=sk-your-api-key-here
```

**Docker:**
```bash
docker run -e OPENAI_API_KEY="sk-your-api-key-here" your-image
```

**Docker Compose:**
```yaml
environment:
  - OPENAI_API_KEY=sk-your-api-key-here
```

### 3. Install Dependencies

The OpenAI package has been added to `requirements.txt`. Install it:

```bash
pip install -r requirements.txt
```

### 4. Restart the Application

Restart your FastAPI backend for the changes to take effect.

## Usage

### In the Query Tab

1. Navigate to the **Query** tab
2. Click the **AI Assistant** button to switch to AI mode
3. Ask questions like:
   - "What is my memory usage?"
   - "Show me CPU utilization"
   - "How much disk space is available?"
   - "What's the network traffic like?"
   - "Is my system running properly?"

### AI Response

The AI will:
1. Translate your question to PromQL
2. Explain why it chose specific metrics
3. Show which metrics were used
4. Provide buttons to:
   - **Use Query**: Copy the generated PromQL to the input field
   - **Copy**: Copy the PromQL to clipboard

### Switching Between Modes

- **AI Mode**: Chat with the AI assistant
- **PromQL Mode**: Direct PromQL query input (default)

## Example Translations

| Natural Language | Generated PromQL | Explanation |
|------------------|------------------|-------------|
| "What is my memory usage?" | `go_memstats_alloc_bytes` | Shows current memory allocation |
| "Show me CPU utilization" | `rate(node_cpu_seconds_total[5m])` | CPU usage rate over 5 minutes |
| "How much disk space is available?" | `node_filesystem_avail_bytes` | Available disk space in bytes |
| "What's the network traffic like?" | `rate(node_network_receive_bytes_total[5m])` | Network receive rate over 5 minutes |

## Troubleshooting

### AI Not Available

If you see "OpenAI API not configured":
1. Check that `OPENAI_API_KEY` is set correctly
2. Verify the API key is valid
3. Ensure the backend has been restarted

### Translation Errors

If queries fail to translate:
1. Check your internet connection
2. Verify OpenAI API quota/credits
3. Try rephrasing your question
4. Check the backend logs for detailed error messages

### Performance Issues

- The AI translation takes a few seconds depending on your question complexity
- Consider using more specific questions for better results
- The AI uses available metrics from your Prometheus instance for context

## Security Notes

- Never commit your API key to version control
- Use environment variables or secure secret management
- Monitor your OpenAI API usage and costs
- Consider rate limiting for production use

## Cost Considerations

- OpenAI charges per API call (typically $0.002 per 1K tokens)
- Each translation uses approximately 100-200 tokens
- Monitor usage at [OpenAI Usage Dashboard](https://platform.openai.com/usage)

## Support

For issues with the AI integration:
1. Check the backend logs for error messages
2. Verify your OpenAI API key and quota
3. Ensure all dependencies are installed
4. Check that the backend is running and accessible 
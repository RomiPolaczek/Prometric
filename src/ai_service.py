import os
import openai
from typing import Dict, Any, Optional
from logger import setup_logger

logger = setup_logger()

class AIService:
    def __init__(self):
        self.client = None
        self.api_key = os.getenv("OPENAI_API_KEY")
        if self.api_key:
            openai.api_key = self.api_key
            self.client = openai.OpenAI(api_key=self.api_key)
        else:
            logger.warning("OPENAI_API_KEY not found. AI features will be disabled.")
    
    def is_available(self) -> bool:
        """Check if OpenAI API is available"""
        return self.client is not None and self.api_key is not None
    
    def translate_to_promql(self, natural_query: str, available_metrics: list[str]) -> Dict[str, Any]:
        """
        Translate natural language query to PromQL using OpenAI
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "OpenAI API not configured. Please set OPENAI_API_KEY environment variable."
            }
        
        try:
            # Create a comprehensive prompt for the AI
            system_prompt = f"""You are a PromQL expert. Your task is to translate natural language queries into valid PromQL queries.

Available metrics in the system:
{', '.join(available_metrics[:100])}  # Showing first 100 metrics

Rules:
1. Always return a valid PromQL query
2. Use the most appropriate metric from the available list
3. If the query asks about memory usage, use metrics like 'go_memstats_alloc_bytes', 'node_memory_MemTotal_bytes', etc.
4. If the query asks about CPU usage, use metrics like 'rate(node_cpu_seconds_total[5m])', 'go_cpu_usage'
5. If the query asks about disk usage, use metrics like 'node_filesystem_avail_bytes', 'node_filesystem_size_bytes'
6. If the query asks about network usage, use metrics like 'rate(node_network_receive_bytes_total[5m])'
7. If the query asks about uptime, use metrics like 'up', 'node_boot_time_seconds'
8. For rate-based queries, use appropriate time windows like [5m], [1m]
9. Always explain your reasoning briefly

Return your response in this exact JSON format:
{{
    "promql": "your_promql_query_here",
    "explanation": "brief explanation of why you chose this query",
    "metric_used": "the main metric you used"
}}"""

            user_prompt = f"Translate this query to PromQL: {natural_query}"

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                max_tokens=500
            )
            
            content = response.choices[0].message.content
            
            # Try to parse the JSON response
            try:
                import json
                result = json.loads(content)
                
                # Validate the response structure
                if "promql" in result and "explanation" in result:
                    return {
                        "success": True,
                        "promql": result["promql"],
                        "explanation": result["explanation"],
                        "metric_used": result.get("metric_used", "Unknown")
                    }
                else:
                    raise ValueError("Invalid response structure")
                    
            except json.JSONDecodeError:
                # If JSON parsing fails, try to extract PromQL from the response
                logger.warning(f"Failed to parse JSON response: {content}")
                
                # Fallback: try to extract PromQL from the response
                lines = content.split('\n')
                promql = None
                explanation = content
                
                for line in lines:
                    if '=' in line and ('{' in line or '[' in line):
                        promql = line.strip()
                        break
                
                if promql:
                    return {
                        "success": True,
                        "promql": promql,
                        "explanation": explanation,
                        "metric_used": "Extracted from response"
                    }
                else:
                    return {
                        "success": False,
                        "error": f"Failed to extract PromQL from response: {content}"
                    }
                    
        except Exception as e:
            logger.error(f"Error in AI translation: {str(e)}")
            return {
                "success": False,
                "error": f"AI translation failed: {str(e)}"
            }
    
    def get_query_suggestions(self, context: str = "") -> Dict[str, Any]:
        """
        Get AI-powered query suggestions based on context
        """
        if not self.is_available():
            return {
                "success": False,
                "error": "OpenAI API not configured"
            }
        
        try:
            system_prompt = """You are a PromQL expert. Provide 5 useful PromQL query suggestions for monitoring systems.
            Focus on common monitoring scenarios like memory, CPU, disk, network, and application metrics.
            Return as JSON array with objects containing 'query', 'description', and 'category'."""
            
            user_prompt = f"Suggest PromQL queries{f' related to: {context}' if context else ''}"
            
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=600
            )
            
            content = response.choices[0].message.content
            
            try:
                import json
                suggestions = json.loads(content)
                return {
                    "success": True,
                    "suggestions": suggestions
                }
            except json.JSONDecodeError:
                return {
                    "success": False,
                    "error": "Failed to parse suggestions response"
                }
                
        except Exception as e:
            logger.error(f"Error getting suggestions: {str(e)}")
            return {
                "success": False,
                "error": f"Failed to get suggestions: {str(e)}"
            } 
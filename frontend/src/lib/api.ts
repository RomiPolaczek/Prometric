import axios from 'axios'
import {
  RetentionPolicy,
  RetentionPolicyCreate,
  RetentionPolicyUpdate,
  ExecutionResult,
  PrometheusTarget,
  PrometheusAlert,
  PrometheusResponse,
  QueryResult,
  SystemInfo,
  BuildInfo,
  RuntimeInfo,
  TSDBStats
} from '@/types'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
  timeout: 60000, // Increased from 30s to 60s for large queries
})

// Retention Policies API
export const retentionPoliciesApi = {
  getAll: async (): Promise<RetentionPolicy[]> => {
    const response = await api.get('/retention-policies')
    return response.data
  },

  getById: async (id: number): Promise<RetentionPolicy> => {
    const response = await api.get(`/retention-policies/${id}`)
    return response.data
  },

  create: async (policy: RetentionPolicyCreate): Promise<RetentionPolicy> => {
    const response = await api.post('/retention-policies', policy)
    return response.data
  },

  update: async (id: number, policy: RetentionPolicyUpdate): Promise<RetentionPolicy> => {
    const response = await api.put(`/retention-policies/${id}`, policy)
    return response.data
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/retention-policies/${id}`)
  },

  execute: async (id: number): Promise<ExecutionResult> => {
    const response = await api.post(`/retention-policies/${id}/execute`)
    return response.data
  },

  dryRun: async (id: number): Promise<any> => {
    const response = await api.post(`/retention-policies/${id}/dry-run`)
    return response.data
  },

  executeAll: async (): Promise<{ message: string; results: ExecutionResult[] }> => {
    const response = await api.post('/execute-all-policies')
    return response.data
  }
}

// Prometheus Query API
export const prometheusApi = {
  query: async (query: string, time?: string): Promise<PrometheusResponse<{ result: QueryResult[] }>> => {
    const response = await api.post('/prometheus-proxy/query', { query, time })
    return response.data
  },

  queryRange: async (
    query: string,
    start: string,
    end: string,
    step?: string
  ): Promise<PrometheusResponse<{ result: QueryResult[] }>> => {
    const response = await api.post('/prometheus-proxy/query-range', {
      query,
      start,
      end,
      step: step || '15s'
    })
    return response.data
  },

  getMetrics: async (): Promise<PrometheusResponse<string[]>> => {
    const response = await api.get('/prometheus-proxy/metrics')
    return response.data
  },

  getTargets: async (): Promise<PrometheusResponse<{ activeTargets: PrometheusTarget[] }>> => {
    const response = await api.get('/prometheus-proxy/targets')
    return response.data
  },

  getAlerts: async (): Promise<PrometheusResponse<{ alerts: PrometheusAlert[] }>> => {
    const response = await api.get('/prometheus-proxy/alerts')
    return response.data
  },

  getBuildInfo: async (): Promise<PrometheusResponse<BuildInfo>> => {
    const response = await api.get('/prometheus-proxy/status/buildinfo')
    return response.data
  },

  getRuntimeInfo: async (): Promise<PrometheusResponse<RuntimeInfo>> => {
    const response = await api.get('/prometheus-proxy/status/runtimeinfo')
    return response.data
  },

  getFlags: async (): Promise<PrometheusResponse<Record<string, string>>> => {
    const response = await api.get('/prometheus-proxy/status/flags')
    return response.data
  },

  getTSDBStats: async (): Promise<PrometheusResponse<TSDBStats>> => {
    const response = await api.get('/prometheus-proxy/status/tsdb')
    return response.data
  },

  getMetricCount: async (metricName: string, hours: number = 24): Promise<{
    metric_name: string
    time_range_hours: number
    series_count: number
    current_series_count: number
    total_data_points: number
    data_points_per_series: Array<{
      metric: Record<string, string>
      data_points: number
    }>
    average_points_per_series: number
    status: string
    error?: string
  }> => {
    const response = await api.get(`/prometheus-proxy/metric-count/${metricName}`, {
      params: { hours }
    })
    return response.data
  }
}

// System API
export const systemApi = {
  getHealth: async (): Promise<SystemInfo> => {
    const response = await api.get('/health')
    return response.data
  },

  getSystemInfo: async (): Promise<any> => {
    const response = await api.get('/system-info')
    return response.data
  },

  getConfig: async (): Promise<any> => {
    const response = await api.get('/config')
    return response.data
  },

  getMetricsSample: async (): Promise<any> => {
    const response = await api.get('/debug/metrics-sample')
    return response.data
  },

  testConnection: async (): Promise<any> => {
    const response = await api.get('/debug/test-connection')
    return response.data
  },

  testPrometheus: async (): Promise<any> => {
    const response = await api.get('/debug/test-prometheus')
    return response.data
  },

  testPattern: async (pattern: string): Promise<any> => {
    const response = await api.post('/debug/test-pattern', { pattern })
    return response.data
  }
}

// AI Chatbot API
export const aiApi = {
  translateToPromql: async (query: string): Promise<{
    success: boolean
    promql?: string
    explanation?: string
    metric_used?: string
    error?: string
  }> => {
    const response = await api.post('/ai/translate', { query })
    return response.data
  },

  getSuggestions: async (context?: string): Promise<{
    success: boolean
    suggestions?: Array<{
      query: string
      description: string
      category: string
    }>
    error?: string
  }> => {
    const response = await api.post('/ai/suggestions', { context })
    return response.data
  },

  getStatus: async (): Promise<{
    available: boolean
    configured: boolean
  }> => {
    const response = await api.get('/ai/status')
    return response.data
  }
}

export default api
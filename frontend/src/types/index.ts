export interface RetentionPolicy {
    id: number
    metric_name_pattern: string
    retention_days: number
    description?: string
    enabled: boolean
    created_at: string
    updated_at: string
    last_executed?: string
  }
  
  export interface RetentionPolicyCreate {
    metric_name_pattern: string
    retention_days: number
    description?: string
    enabled?: boolean
  }
  
  export interface RetentionPolicyUpdate {
    metric_name_pattern?: string
    retention_days?: number
    description?: string
    enabled?: boolean
  }
  
  export interface ExecutionResult {
    policy_id: number
    metric_name_pattern: string
    metrics_found: number
    series_deleted: number
    execution_time: string
    success: boolean
    error_message?: string
  }
  
  export interface PrometheusTarget {
    discoveredLabels: Record<string, string>
    labels: Record<string, string>
    scrapePool: string
    scrapeUrl: string
    globalUrl: string
    lastError: string
    lastScrape: string
    lastScrapeDuration: number
    health: 'up' | 'down' | 'unknown'
  }
  
  export interface PrometheusAlert {
    labels: Record<string, string>
    annotations: Record<string, string>
    state: 'inactive' | 'pending' | 'firing'
    activeAt?: string
    value?: string
  }
  
  export interface QueryResult {
    metric: Record<string, string>
    value?: [number, string]
    values?: [number, string][]
  }
  
  export interface PrometheusResponse<T> {
    status: 'success' | 'error'
    data: T
    error?: string
    errorType?: string
    warnings?: string[]
  }
  
  export interface SystemInfo {
    status: string
    prometheus_connection: {
      status: string
      url?: string
    }
    system?: {
      cpu_percent: number
      memory_percent: number
      disk_percent: number
    }
    version: string
  }
  
  export interface BuildInfo {
    version: string
    revision: string
    branch: string
    buildUser: string
    buildDate: string
    goVersion: string
  }
  
  export interface RuntimeInfo {
    startTime: string
    CWD: string
    reloadConfigSuccess: boolean
    lastConfigTime: string
    corruptionCount: number
    goroutineCount: number
    GOMAXPROCS: number
    GOGC: string
    GODEBUG: string
    storageRetention: string
  }
  
  export interface TSDBStats {
    seriesCountByMetricName: Array<{
      name: string
      value: number
    }>
    labelValueCountByLabelName: Array<{
      name: string
      value: number
    }>
    memoryInBytesByLabelName: Array<{
      name: string
      value: number
    }>
    seriesCountByLabelValuePair: Array<{
      name: string
      value: number
    }>
  }
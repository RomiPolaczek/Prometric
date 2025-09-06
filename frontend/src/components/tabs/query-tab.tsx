'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, Trash2, Copy, AlertCircle, Bot, Sparkles, Clock, TrendingUp, TrendingDown } from 'lucide-react'
import { prometheusApi } from '@/lib/api'
import { toast } from 'sonner'
import { AIChat } from '@/components/ai-chat'

export function QueryTab() {
  const [query, setQuery] = useState('')
  const [queryResults, setQueryResults] = useState<any>(null)
  const [isAIMode, setIsAIMode] = useState(false)

  const queryMutation = useMutation({
    mutationFn: (query: string) => prometheusApi.query(query),
    onSuccess: (data) => {
      setQueryResults(data)
      toast.success(`Query executed successfully. Found ${data.data.result.length} series`)
    },
    onError: (error: any) => {
      toast.error('Query failed', {
        description: error.response?.data?.error || error.message,
      })
    },
  })

  const { data: metrics } = useQuery({
    queryKey: ['metrics'],
    queryFn: prometheusApi.getMetrics,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  const handleExecute = () => {
    if (!query.trim()) {
      toast.error('Query required', {
        description: 'Please enter a PromQL query',
      })
      return
    }
    queryMutation.mutate(query.trim())
  }

  const handleClear = () => {
    setQuery('')
    setQueryResults(null)
  }

  const handleCopyQuery = () => {
    navigator.clipboard.writeText(query)
    toast.success('Query copied to clipboard')
  }

  const handleAIQueryGenerated = (generatedQuery: string) => {
    setQuery(generatedQuery)
    setIsAIMode(false) // Switch back to PromQL mode
  }

  // Helper function to extract metric name from labels
  const getMetricName = (metric: Record<string, string>) => {
    return metric.__name__ || 'unknown_metric'
  }

  // Helper function to format labels (excluding __name__)
  const formatLabels = (metric: Record<string, string>) => {
    const filteredLabels = Object.entries(metric).filter(([key]) => key !== '__name__')
    if (filteredLabels.length === 0) {
      return '{}'
    }
    return `{${filteredLabels.map(([key, value]) => `${key}="${value}"`).join(', ')}}`
  }

  // Helper function to format timestamp with more precision
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return {
      full: date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZoneName: 'short'
      }),
      relative: getRelativeTime(date),
      iso: date.toISOString()
    }
  }

  // Helper function to get relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  // Helper function to format numeric values
  const formatValue = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return value
    
    // Format large numbers with appropriate suffixes
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`
    if (Math.abs(num) < 1 && num !== 0) return num.toExponential(3)
    return num.toFixed(3)
  }

  // Helper function to get time range information for all results
  const getTimeRangeInfo = (results: any[]) => {
    let allTimestamps: number[] = []
    
    results.forEach(result => {
      if (result.values && Array.isArray(result.values)) {
        // Range query - has multiple timestamp-value pairs
        result.values.forEach(([timestamp]: [number, string]) => {
          allTimestamps.push(timestamp)
        })
      } else if (result.value && Array.isArray(result.value)) {
        // Instant query - has single timestamp-value pair
        allTimestamps.push(result.value[0])
      }
    })

    if (allTimestamps.length === 0) return null

    const earliest = Math.min(...allTimestamps)
    const latest = Math.max(...allTimestamps)
    
    return {
      earliest: formatTimestamp(earliest),
      latest: formatTimestamp(latest),
      count: allTimestamps.length,
      duration: latest - earliest
    }
  }

  // Helper function to format duration in human readable format
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`
  }

  // Check if this is a range query result
  const isRangeQuery = (results: any[]) => {
    return results.some(result => result.values && Array.isArray(result.values) && result.values.length > 0)
  }

  const exampleQueries = [
    'up',
    'prometheus_tsdb_head_samples_appended_total',
    'prometheus_tsdb_head_samples_appended_total[15m]',
    'rate(prometheus_http_requests_total[5m])',
    'go_memstats_alloc_bytes',
    'probe_success',
  ]

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Query Input</span>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.preventDefault()
                setIsAIMode(!isAIMode)
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white border-0 hover:from-blue-600 hover:to-purple-600"
            >
              {isAIMode ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Back to PromQL
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4" />
                  AI Assistant
                </>
              )}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 transition-all duration-300 ease-in-out min-h-[200px]">
          {isAIMode ? (
            <AIChat onQueryGenerated={handleAIQueryGenerated} />
          ) : (
            <>
              <div className="space-y-2">
                <Textarea
                  placeholder="Enter your PromQL query here..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  rows={4}
                  className="font-mono"
                />
                <div className="flex items-center gap-2">
                  <Button 
                    onClick={handleExecute}
                    disabled={queryMutation.isPending}
                  >
                    {queryMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    Execute
                  </Button>
                  <Button variant="outline" onClick={handleClear}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button variant="outline" onClick={handleCopyQuery}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </Button>
                </div>
              </div>

              {/* Example Queries */}
              <div className="space-y-2">
                <div className="text-sm font-medium">Example queries:</div>
                <div className="flex flex-wrap gap-2">
                  {exampleQueries.map((example) => (
                    <Badge
                      key={example}
                      variant="secondary"
                      className="cursor-pointer hover:bg-secondary/80"
                      onClick={() => setQuery(example)}
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Query Results */}
      {queryResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Query Results</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {queryResults.data.result.length} series
                </Badge>
                {queryResults.data.result.length > 0 && (
                  <Badge variant="secondary">
                    {queryResults.data.resultType}
                  </Badge>
                )}
                {isRangeQuery(queryResults.data.result) && (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Range Query
                  </Badge>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Time Range Information */}
            {queryResults.data.result.length > 0 && (() => {
              const timeInfo = getTimeRangeInfo(queryResults.data.result)
              return timeInfo && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-semibold text-blue-800 dark:text-blue-200">Time Range Information</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-3 w-3 text-green-600" />
                        <span className="font-medium">Earliest:</span>
                        <span className="font-mono">{timeInfo.earliest.full}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-red-600" />
                        <span className="font-medium">Latest:</span>
                        <span className="font-mono">{timeInfo.latest.full}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div>
                        <span className="font-medium">Duration:</span>
                        <span className="ml-2 font-mono">{formatDuration(timeInfo.duration)}</span>
                      </div>
                      <div>
                        <span className="font-medium">Total Data Points:</span>
                        <span className="ml-2 font-mono">{timeInfo.count}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            <Tabs defaultValue="table">
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table" className="mt-4">
                {queryResults.data.result.length > 0 ? (
                  <div className="rounded-md border">
                    <div className="overflow-auto max-h-[600px]">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50 sticky top-0">
                          <tr>
                            <th className="p-3 text-left font-medium min-w-[120px]">Metric</th>
                            <th className="p-3 text-left font-medium min-w-[200px]">Labels</th>
                            {isRangeQuery(queryResults.data.result) ? (
                              <>
                                <th className="p-3 text-left font-medium min-w-[150px]">Timestamp</th>
                                <th className="p-3 text-left font-medium w-[100px]">Value</th>
                                <th className="p-3 text-left font-medium w-[80px]">Age</th>
                              </>
                            ) : (
                              <>
                                <th className="p-3 text-left font-medium w-[100px]">Value</th>
                                <th className="p-3 text-left font-medium min-w-[150px]">Timestamp</th>
                                <th className="p-3 text-left font-medium w-[80px]">Age</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.data.result.map((result: any, index: number) => {
                            const metricName = getMetricName(result.metric)
                            const labels = formatLabels(result.metric)
                            
                            // Handle both instant and range queries
                            if (result.values && Array.isArray(result.values)) {
                              // Range query - multiple timestamp-value pairs
                              return result.values.map(([timestamp, value]: [number, string], valueIndex: number) => {
                                const timestampInfo = formatTimestamp(timestamp)
                                
                                return (
                                  <tr key={`${index}-${valueIndex}`} className="border-b hover:bg-muted/50 transition-colors">
                                    {valueIndex === 0 ? (
                                      <>
                                        <td className="p-3" rowSpan={result.values.length}>
                                          <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                            {metricName}
                                          </div>
                                          {result.values.length > 1 && (
                                            <Badge variant="outline" className="mt-1 text-xs">
                                              {result.values.length} points
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="p-3" rowSpan={result.values.length}>
                                          <div className="font-mono text-xs text-muted-foreground break-all">
                                            {labels}
                                          </div>
                                        </td>
                                      </>
                                    ) : null}
                                    <td className="p-3">
                                      <div className="text-xs">
                                        <div className="font-medium">{timestampInfo.full}</div>
                                        <div className="text-muted-foreground mt-1">
                                          Unix: {timestamp}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <div className="font-mono font-medium">
                                        <span className="text-green-600 dark:text-green-400">
                                          {formatValue(value)}
                                        </span>
                                      </div>
                                      <div className="font-mono text-xs text-muted-foreground mt-1">
                                        {value}
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <Badge variant="outline" className="text-xs">
                                        {timestampInfo.relative}
                                      </Badge>
                                    </td>
                                  </tr>
                                )
                              })
                            } else {
                              // Instant query - single timestamp-value pair
                              const timestamp = result.value ? formatTimestamp(result.value[0]) : null
                              const value = result.value ? result.value[1] : 'N/A'
                              
                              return (
                                <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                                  <td className="p-3">
                                    <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                                      {metricName}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-mono text-xs text-muted-foreground break-all">
                                      {labels}
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="font-mono font-medium">
                                      {value !== 'N/A' ? (
                                        <span className="text-green-600 dark:text-green-400">
                                          {formatValue(value)}
                                        </span>
                                      ) : (
                                        <span className="text-muted-foreground">N/A</span>
                                      )}
                                    </div>
                                    {value !== 'N/A' && (
                                      <div className="font-mono text-xs text-muted-foreground mt-1">
                                        {value}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {timestamp ? (
                                      <div className="text-xs">
                                        <div className="font-medium">{timestamp.full}</div>
                                        <div className="text-muted-foreground mt-1">
                                          Unix: {result.value[0]}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">N/A</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {timestamp ? (
                                      <Badge variant="outline" className="text-xs">
                                        {timestamp.relative}
                                      </Badge>
                                    ) : (
                                      <span className="text-muted-foreground text-xs">N/A</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            }
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Summary Information */}
                    <div className="border-t bg-muted/25 p-3">
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span>
                          <strong>Total Series:</strong> {queryResults.data.result.length}
                        </span>
                        <span>
                          <strong>Result Type:</strong> {queryResults.data.resultType || 'vector'}
                        </span>
                        {(() => {
                          const timeInfo = getTimeRangeInfo(queryResults.data.result)
                          return timeInfo && (
                            <span>
                              <strong>Data Points:</strong> {timeInfo.count}
                            </span>
                          )
                        })()}
                        {queryResults.warnings && queryResults.warnings.length > 0 && (
                          <span>
                            <strong>Warnings:</strong> {queryResults.warnings.length}
                          </span>
                        )}
                      </div>
                      
                      {queryResults.warnings && queryResults.warnings.length > 0 && (
                        <div className="mt-2">
                          <Alert className="bg-yellow-50 border-yellow-200">
                            <AlertCircle className="h-4 w-4 text-yellow-600" />
                            <AlertDescription className="text-yellow-800">
                              <strong>Warnings:</strong>
                              <ul className="mt-1 list-disc list-inside">
                                {queryResults.warnings.map((warning: string, idx: number) => (
                                  <li key={idx} className="text-xs">{warning}</li>
                                ))}
                              </ul>
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No data found for this query
                    </AlertDescription>
                  </Alert>
                )}
              </TabsContent>
              
              <TabsContent value="json" className="mt-4">
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                  {JSON.stringify(queryResults, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Available Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Available Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics ? (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {metrics.data.length} metrics available
              </div>
              <div className="max-h-40 overflow-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 text-xs">
                  {metrics.data.slice(0, 100).map((metric: string) => (
                    <Badge
                      key={metric}
                      variant="outline"
                      className="justify-start cursor-pointer hover:bg-secondary/80 text-xs"
                      onClick={() => setQuery(metric)}
                    >
                      {metric}
                    </Badge>
                  ))}
                </div>
                {metrics.data.length > 100 && (
                  <div className="text-xs text-muted-foreground mt-2">
                    ... and {metrics.data.length - 100} more metrics
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading metrics...</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
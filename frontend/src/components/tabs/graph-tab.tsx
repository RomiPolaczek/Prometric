'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'
import { 
  Play, 
  Trash2, 
  Download, 
  Loader2, 
  AlertCircle,
  TrendingUp 
} from 'lucide-react'
import { prometheusApi } from '@/lib/api'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface GraphData {
  timestamp: number
  [key: string]: number
}

export function GraphTab() {
  const [query, setQuery] = useState('')
  const [timeRange, setTimeRange] = useState('1d')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState('30')
  const [graphData, setGraphData] = useState<GraphData[]>([])
  const [seriesNames, setSeriesNames] = useState<string[]>([])

  const queryMutation = useMutation({
    mutationFn: ({ query, start, end }: { query: string; start: string; end: string }) =>
      prometheusApi.queryRange(query, start, end),
    onSuccess: (data) => {
      if (data.data.result.length === 0) {
        setGraphData([])
        setSeriesNames([])
        toast.error('No data found', {
          description: 'The query returned no results for the selected time range',
        })
        return
      }

      // Process the results into chart data
      const processedData = processPrometheusData(data.data.result)
      setGraphData(processedData.data)
      setSeriesNames(processedData.series)
      
      toast.success(`Graph updated: Loaded ${data.data.result.length} series`)
    },
    onError: (error: any) => {
      toast.error('Query failed', {
        description: error.response?.data?.error || error.message,
      })
    },
  })

  const processPrometheusData = (results: any[]) => {
    const timestampMap = new Map<number, any>()
    const series: string[] = []

    results.forEach((result, index) => {
      // Create a series name from labels
      const labels = result.metric
      let seriesName = `series_${index}`
      
      if (labels.__name__) {
        seriesName = labels.__name__
        // Add other significant labels
        const otherLabels = Object.entries(labels)
          .filter(([key]) => key !== '__name__')
          .slice(0, 2) // Limit to avoid very long names
          .map(([key, value]) => `${key}="${value}"`)
        
        if (otherLabels.length > 0) {
          seriesName += `{${otherLabels.join(',')}}`
        }
      }
      
      series.push(seriesName)

      // Process values
      if (result.values) {
        result.values.forEach(([timestamp, value]: [number, string]) => {
          const ts = timestamp * 1000 // Convert to milliseconds
          if (!timestampMap.has(ts)) {
            timestampMap.set(ts, { timestamp: ts })
          }
          timestampMap.get(ts)![seriesName] = parseFloat(value)
        })
      }
    })

    // Convert to array and sort by timestamp
    const data = Array.from(timestampMap.values()).sort((a, b) => a.timestamp - b.timestamp)
    
    return { data, series }
  }

  const getTimeRange = () => {
    const now = new Date()
    const nowTs = Math.floor(now.getTime() / 1000)

    if (timeRange === 'custom') {
      const start = customStart ? Math.floor(new Date(customStart).getTime() / 1000) : nowTs - 3600
      const end = customEnd ? Math.floor(new Date(customEnd).getTime() / 1000) : nowTs
      return { start: start.toString(), end: end.toString() }
    }

    const ranges = {
      '1h': 3600,
      '6h': 6 * 3600,
      '12h': 12 * 3600,
      '1d': 24 * 3600,
      '3d': 3 * 24 * 3600,
      '1w': 7 * 24 * 3600,
      '1M': 30 * 24 * 3600,
    }

    const duration = ranges[timeRange as keyof typeof ranges] || 3600
    const start = nowTs - duration
    
    return { start: start.toString(), end: nowTs.toString() }
  }

  const handleExecute = () => {
    if (!query.trim()) {
      toast.error('Query required', {
        description: 'Please enter a PromQL query',
      })
      return
    }

    const { start, end } = getTimeRange()
    queryMutation.mutate({ query: query.trim(), start, end })
  }

  const handleClear = () => {
    setQuery('')
    setGraphData([])
    setSeriesNames([])
  }

  const handleExport = () => {
    if (graphData.length === 0) {
      toast.error('No data to export', {
        description: 'Please execute a query first',
      })
      return
    }

    const csvContent = [
      ['timestamp', 'datetime', ...seriesNames].join(','),
      ...graphData.map(row => [
        row.timestamp,
        new Date(row.timestamp).toISOString(),
        ...seriesNames.map(series => row[series] || '')
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prometheus-graph-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Graph data has been exported to CSV')
  }

  // Auto-refresh logic
  useEffect(() => {
    if (!autoRefresh || !query) return

    const interval = setInterval(() => {
      const { start, end } = getTimeRange()
      queryMutation.mutate({ query: query.trim(), start, end })
    }, parseInt(refreshInterval) * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, query])

  const formatTooltipValue = (value: any, name: string) => {
    if (typeof value === 'number') {
      return [value.toFixed(6), name]
    }
    return [value, name]
  }

  const formatXAxisTick = (timestamp: number) => {
    return format(new Date(timestamp), 'HH:mm')
  }

  const getRandomColor = (index: number) => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
      '#ff00ff', '#00ffff', '#ff0000', '#0000ff', '#ffff00'
    ]
    return colors[index % colors.length]
  }

  const exampleQueries = [
    'up',
    'rate(prometheus_http_requests_total[5m])',
    'go_memstats_alloc_bytes',
    'prometheus_tsdb_head_samples_appended_total',
    'probe_duration_seconds',
  ]

  return (
    <div className="space-y-6">
      {/* Query Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Graph Query</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Enter PromQL query for graphing..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={3}
              className="font-mono"
            />
            
            {/* Example Queries */}
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example) => (
                <button
                  key={example}
                  onClick={() => setQuery(example)}
                  className="text-xs px-2 py-1 bg-secondary rounded hover:bg-secondary/80"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {/* Time Range Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last 1 hour</SelectItem>
                  <SelectItem value="6h">Last 6 hours</SelectItem>
                  <SelectItem value="12h">Last 12 hours</SelectItem>
                  <SelectItem value="1d">Last 1 day</SelectItem>
                  <SelectItem value="3d">Last 3 days</SelectItem>
                  <SelectItem value="1w">Last 1 week</SelectItem>
                  <SelectItem value="1M">Last 1 month</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {timeRange === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="datetime-local"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="datetime-local"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Auto-refresh</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={autoRefresh}
                  onCheckedChange={(checked) => setAutoRefresh(checked === true)}
                />
                <Select 
                  value={refreshInterval} 
                  onValueChange={setRefreshInterval}
                  disabled={!autoRefresh}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15s</SelectItem>
                    <SelectItem value="30">30s</SelectItem>
                    <SelectItem value="60">1m</SelectItem>
                    <SelectItem value="300">5m</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleExecute}
              disabled={queryMutation.isPending}
            >
              {queryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <TrendingUp className="h-4 w-4 mr-2" />
              )}
              Graph
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            {graphData.length > 0 && (
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Graph */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Metrics Graph</span>
            {seriesNames.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {seriesNames.length} series
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {graphData.length > 0 ? (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="timestamp"
                    tickFormatter={formatXAxisTick}
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss')}
                    formatter={formatTooltipValue}
                  />
                  <Legend />
                  {seriesNames.map((series, index) => (
                    <Line
                      key={series}
                      type="monotone"
                      dataKey={series}
                      stroke={getRandomColor(index)}
                      strokeWidth={2}
                      dot={false}
                      connectNulls={false}
                      name={series.length > 50 ? `${series.substring(0, 47)}...` : series}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-96 flex items-center justify-center">
              <div className="text-center">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No graph data</h3>
                <p className="text-muted-foreground">
                  Enter a query and click Graph to visualize metrics
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Series Info */}
      {seriesNames.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Series Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {seriesNames.map((series, index) => (
                <div key={series} className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: getRandomColor(index) }}
                  />
                  <span className="font-mono text-sm">{series}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
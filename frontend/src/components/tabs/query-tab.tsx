'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Play, Trash2, Copy, AlertCircle, Bot, Sparkles } from 'lucide-react'
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

  const exampleQueries = [
    'up',
    'prometheus_tsdb_head_samples_appended_total',
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
              <Badge variant="outline">
                {queryResults.data.result.length} series
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="table">
              <TabsList>
                <TabsTrigger value="table">Table</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>
              
              <TabsContent value="table" className="mt-4">
                {queryResults.data.result.length > 0 ? (
                  <div className="rounded-md border">
                    <div className="overflow-auto max-h-96">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/50">
                          <tr>
                            <th className="p-2 text-left font-medium">Labels</th>
                            <th className="p-2 text-left font-medium">Value</th>
                            <th className="p-2 text-left font-medium">Timestamp</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.data.result.map((result: any, index: number) => (
                            <tr key={index} className="border-b hover:bg-muted/50">
                              <td className="p-2 font-mono text-xs">
                                {Object.entries(result.metric).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="text-muted-foreground">{key}=</span>
                                    <span>"{String(value)}"</span>
                                  </div>
                                ))}
                              </td>
                              <td className="p-2 font-mono">
                                {result.value ? result.value[1] : 'N/A'}
                              </td>
                              <td className="p-2 font-mono text-xs">
                                {result.value ? 
                                  new Date(result.value[0] * 1000).toLocaleString() : 
                                  'N/A'
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
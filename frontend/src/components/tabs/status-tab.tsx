'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Server, Info, Flag, BarChart3 } from 'lucide-react'
import { prometheusApi, systemApi } from '@/lib/api'
import { formatBytes } from '@/lib/utils'

export function StatusTab() {
  const { data: buildInfo, isLoading: buildLoading } = useQuery({
    queryKey: ['buildinfo'],
    queryFn: prometheusApi.getBuildInfo,
  })

  const { data: runtimeInfo, isLoading: runtimeLoading } = useQuery({
    queryKey: ['runtimeinfo'],
    queryFn: prometheusApi.getRuntimeInfo,
  })

  const { data: flags, isLoading: flagsLoading } = useQuery({
    queryKey: ['flags'],
    queryFn: prometheusApi.getFlags,
  })

  const { data: tsdbStats, isLoading: tsdbLoading } = useQuery({
    queryKey: ['tsdb'],
    queryFn: prometheusApi.getTSDBStats,
  })

  const { data: systemInfo } = useQuery({
    queryKey: ['system-info'],
    queryFn: systemApi.getSystemInfo,
  })

  return (
    <div className="space-y-6">
      {/* Build Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Build Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {buildLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : buildInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Version:</strong> {buildInfo.data.version}</div>
              <div><strong>Revision:</strong> {buildInfo.data.revision}</div>
              <div><strong>Branch:</strong> {buildInfo.data.branch}</div>
              <div><strong>Build User:</strong> {buildInfo.data.buildUser}</div>
              <div><strong>Build Date:</strong> {buildInfo.data.buildDate}</div>
              <div><strong>Go Version:</strong> {buildInfo.data.goVersion}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">Failed to load build information</div>
          )}
        </CardContent>
      </Card>

      {/* Runtime Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Runtime Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {runtimeLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : runtimeInfo ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Start Time:</strong> {new Date(runtimeInfo.data.startTime).toLocaleString()}</div>
              <div><strong>Working Directory:</strong> {runtimeInfo.data.CWD}</div>
              <div><strong>Config Reload:</strong> 
                <Badge variant={runtimeInfo.data.reloadConfigSuccess ? "outline" : "destructive"} className="ml-2">
                  {runtimeInfo.data.reloadConfigSuccess ? 'Success' : 'Failed'}
                </Badge>
              </div>
              <div><strong>Last Config Time:</strong> {new Date(runtimeInfo.data.lastConfigTime).toLocaleString()}</div>
              <div><strong>Goroutines:</strong> {runtimeInfo.data.goroutineCount}</div>
              <div><strong>GOMAXPROCS:</strong> {runtimeInfo.data.GOMAXPROCS}</div>
              <div><strong>Storage Retention:</strong> {runtimeInfo.data.storageRetention}</div>
              <div><strong>Corruption Count:</strong> {runtimeInfo.data.corruptionCount}</div>
            </div>
          ) : (
            <div className="text-muted-foreground">Failed to load runtime information</div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Flags */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5" />
            Configuration Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {flagsLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : flags ? (
            <div className="space-y-2 max-h-60 overflow-auto">
              {Object.entries(flags.data).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="font-mono text-muted-foreground min-w-0 flex-1">{key}:</span>
                  <span className="font-mono break-all">{value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground">Failed to load configuration flags</div>
          )}
        </CardContent>
      </Card>

      {/* TSDB Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            TSDB Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tsdbLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading...</span>
            </div>
          ) : tsdbStats ? (
            <div className="space-y-4">
              {/* Top Series by Metric Name */}
              <div>
                <h4 className="font-medium mb-2">Top Series by Metric Name</h4>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tsdbStats.data.seriesCountByMetricName?.slice(0, 10).map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="font-mono truncate">{item.name}</span>
                      <span>{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memory Usage by Label Name */}
              <div>
                <h4 className="font-medium mb-2">Memory Usage by Label Name</h4>
                <div className="space-y-1 max-h-40 overflow-auto">
                  {tsdbStats.data.memoryInBytesByLabelName?.slice(0, 10).map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="font-mono truncate">{item.name}</span>
                      <span>{formatBytes(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Failed to load TSDB statistics</div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      {systemInfo && (
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Platform:</strong> {systemInfo.platform?.system} {systemInfo.platform?.release}</div>
              <div><strong>Architecture:</strong> {systemInfo.platform?.machine}</div>
              <div><strong>CPU Cores:</strong> {systemInfo.resources?.cpu_count}</div>
              <div><strong>Total Memory:</strong> {formatBytes(systemInfo.resources?.memory_total || 0)}</div>
              <div><strong>Total Disk:</strong> {formatBytes(systemInfo.resources?.disk_total || 0)}</div>
              <div><strong>Prometheus URL:</strong> {systemInfo.prometheus_url}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
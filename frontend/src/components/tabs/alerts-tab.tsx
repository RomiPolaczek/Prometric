'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react'
import { prometheusApi } from '@/lib/api'
import { format } from 'date-fns'

export function AlertsTab() {
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: prometheusApi.getAlerts,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const alerts = alertsData?.data?.alerts || []
  const firingAlerts = alerts.filter(alert => alert.state === 'firing')
  const pendingAlerts = alerts.filter(alert => alert.state === 'pending')
  const inactiveAlerts = alerts.filter(alert => alert.state === 'inactive')

  const getAlertIcon = (state: string) => {
    switch (state) {
      case 'firing':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'inactive':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getAlertBadge = (state: string) => {
    switch (state) {
      case 'firing':
        return <Badge variant="destructive">Firing</Badge>
      case 'pending':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>
      case 'inactive':
        return <Badge variant="outline" className="border-green-500 text-green-600">Inactive</Badge>
      default:
        return <Badge variant="outline">{state}</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{firingAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Firing</div>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-yellow-600">{pendingAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{inactiveAlerts.length}</div>
                <div className="text-sm text-muted-foreground">Inactive</div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <CardTitle>Alert Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading alerts...</span>
            </div>
          ) : alerts.length > 0 ? (
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div key={index} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getAlertIcon(alert.state)}
                      <span className="font-medium">
                        {alert.labels.alertname || 'Unknown Alert'}
                      </span>
                    </div>
                    {getAlertBadge(alert.state)}
                  </div>

                  {alert.annotations.summary && (
                    <div className="text-sm text-muted-foreground">
                      {alert.annotations.summary}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="font-medium mb-1">Labels:</div>
                      <div className="space-y-1">
                        {Object.entries(alert.labels).map(([key, value]) => (
                          <div key={key} className="font-mono text-xs">
                            <span className="text-muted-foreground">{key}:</span> {value}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="font-medium mb-1">Annotations:</div>
                      <div className="space-y-1">
                        {Object.entries(alert.annotations).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground">{key}:</span> {value}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {alert.activeAt && (
                    <div className="text-xs text-muted-foreground">
                      Active since: {format(new Date(alert.activeAt), 'yyyy-MM-dd HH:mm:ss')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No alerts found. Your system is running smoothly!
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

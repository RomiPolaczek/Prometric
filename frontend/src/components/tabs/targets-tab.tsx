'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Loader2, CheckCircle, XCircle, Target } from 'lucide-react'
import { prometheusApi } from '@/lib/api'
import { format } from 'date-fns'

export function TargetsTab() {
  const { data: targetsData, isLoading } = useQuery({
    queryKey: ['targets'],
    queryFn: prometheusApi.getTargets,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const targets = targetsData?.data?.activeTargets || []
  const upTargets = targets.filter(target => target.health === 'up')
  const downTargets = targets.filter(target => target.health === 'down')

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'up':
        return <Badge variant="outline" className="border-green-500 text-green-600">Up</Badge>
      case 'down':
        return <Badge variant="destructive">Down</Badge>
      default:
        return <Badge variant="outline">{health}</Badge>
    }
  }

  const getHealthIcon = (health: string) => {
    return health === 'up' ? 
      <CheckCircle className="h-4 w-4 text-green-500" /> : 
      <XCircle className="h-4 w-4 text-red-500" />
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-600">{upTargets.length}</div>
                <div className="text-sm text-muted-foreground">Up</div>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-red-600">{downTargets.length}</div>
                <div className="text-sm text-muted-foreground">Down</div>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">{targets.length}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Targets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Target Details</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading targets...</span>
            </div>
          ) : targets.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Job</TableHead>
                    <TableHead>Instance</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Last Scrape</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map((target, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getHealthIcon(target.health)}
                          {getHealthBadge(target.health)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {target.labels.job || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {target.labels.instance || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {target.scrapeUrl}
                      </TableCell>
                      <TableCell className="text-sm">
                        {target.lastScrape ? 
                          format(new Date(target.lastScrape), 'HH:mm:ss') : 
                          'Never'
                        }
                      </TableCell>
                      <TableCell className="text-sm">
                        {target.lastScrapeDuration ? 
                          `${(target.lastScrapeDuration * 1000).toFixed(1)}ms` : 
                          '-'
                        }
                      </TableCell>
                      <TableCell className="text-sm max-w-xs truncate">
                        {target.lastError || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Alert>
              <Target className="h-4 w-4" />
              <AlertDescription>
                No targets configured
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
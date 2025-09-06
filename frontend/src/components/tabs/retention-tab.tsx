'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from '@/components/ui/badge'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Play, 
  RefreshCw, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  TestTube,
  CheckCircle,
  XCircle,
  Clock,
  Loader2
} from 'lucide-react'
import { retentionPoliciesApi } from '@/lib/api'
import { toast } from 'sonner'
import { formatRetentionDays } from '@/lib/utils'
import { RetentionPolicyForm } from '@/components/forms/retention-policy-form'
import { RetentionPolicy } from '@/types'
import { format } from 'date-fns'

export function RetentionTab() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()

  const { data: policies, isLoading, error, refetch } = useQuery({
    queryKey: ['retention-policies'],
    queryFn: retentionPoliciesApi.getAll,
  })

  const executeAllMutation = useMutation({
    mutationFn: retentionPoliciesApi.executeAll,
    onSuccess: (data) => {
      const successful = data.results.filter(r => r.success).length
      const failed = data.results.length - successful
      toast.success(`Policies executed: ${successful} successful, ${failed} failed`)
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
    },
    onError: (error: any) => {
      toast.error('Execution failed', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const executePolicyMutation = useMutation({
    mutationFn: retentionPoliciesApi.execute,
    onSuccess: (data) => {
      toast.success(`Policy executed: Deleted ${data.series_deleted} series from ${data.metrics_found} metrics`)
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
    },
    onError: (error: any) => {
      toast.error('Execution failed', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const deletePolicyMutation = useMutation({
    mutationFn: retentionPoliciesApi.delete,
    onSuccess: () => {
      toast.success('Retention policy has been deleted')
      queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
    },
    onError: (error: any) => {
      toast.error('Delete failed', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const dryRunMutation = useMutation({
    mutationFn: retentionPoliciesApi.dryRun,
    onSuccess: (data) => {
      toast.success(`Dry run completed: Would affect ${data.metrics_count} metrics`)
    },
    onError: (error: any) => {
      toast.error('Dry run failed', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const handleCreateSuccess = () => {
    setIsCreateDialogOpen(false)
    queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
    toast.success('Retention policy has been created successfully')
  }

  const handleEditSuccess = () => {
    setEditingPolicy(null)
    queryClient.invalidateQueries({ queryKey: ['retention-policies'] })
    toast.success('Retention policy has been updated successfully')
  }

  const getStatusBadge = (policy: RetentionPolicy) => {
    if (!policy.enabled) {
      return <Badge variant="secondary">Disabled</Badge>
    }
    
    if (!policy.last_executed) {
      return <Badge variant="outline">Never executed</Badge>
    }

    const lastExecuted = new Date(policy.last_executed)
    const now = new Date()
    const hoursSinceExecution = (now.getTime() - lastExecuted.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceExecution < 24) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>
    } else if (hoursSinceExecution < 168) { // 1 week
      return <Badge variant="outline">Recent</Badge>
    } else {
      return <Badge variant="destructive">Stale</Badge>
    }
  }

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create New Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>Create New Retention Policy</DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                <RetentionPolicyForm onSuccess={handleCreateSuccess} />
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="outline" 
            onClick={() => executeAllMutation.mutate()}
            disabled={executeAllMutation.isPending}
          >
            {executeAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Execute All Policies
          </Button>

          <Button 
            variant="outline"
            onClick={async () => {
              setIsRefreshing(true)
              try {
                await refetch()
                toast.success('Retention policies refreshed successfully')
              } catch (error: any) {
                toast.error('Failed to refresh policies', {
                  description: error.message || 'Unknown error occurred'
                })
              } finally {
                setIsRefreshing(false)
              }
            }}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {policies && (
          <div className="text-sm text-muted-foreground">
            {policies.length} policies configured
          </div>
        )}
      </div>

      {/* Policies Table */}
      <Card>
        <CardHeader>
          <CardTitle>Retention Policies</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Loading policies...</span>
            </div>
          ) : policies && policies.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Metric Pattern</TableHead>
                    <TableHead>Retention</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Executed</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {policies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell className="font-mono">{policy.id}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {policy.metric_name_pattern}
                      </TableCell>
                      <TableCell>
                        {formatRetentionDays(policy.retention_days)}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {policy.description || '-'}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(policy)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {policy.last_executed ? (
                          <div>
                            <div>{format(new Date(policy.last_executed), 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(policy.last_executed), 'HH:mm:ss')}
                            </div>
                          </div>
                        ) : (
                          'Never'
                        )}
                      </TableCell>
                      <TableCell className="flex gap-0.75">
                        <div className="relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => executePolicyMutation.mutate(policy.id)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                            Execute
                          </div>
                        </div>

                        <div className="relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => dryRunMutation.mutate(policy.id)}
                          >
                            <TestTube className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                            Dry Run
                          </div>
                        </div>

                        <div className="relative group">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setEditingPolicy(policy)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                            Edit
                          </div>
                        </div>

                        <div className="relative group">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deletePolicyMutation.mutate(policy.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-black rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                            Delete
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No retention policies found</h3>
              <p className="text-muted-foreground mb-4">
                Create your first retention policy to get started
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Policy
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingPolicy} onOpenChange={(open) => !open && setEditingPolicy(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Retention Policy</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {editingPolicy && (
              <RetentionPolicyForm 
                policy={editingPolicy}
                onSuccess={handleEditSuccess}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
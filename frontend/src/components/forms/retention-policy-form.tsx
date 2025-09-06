'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, TestTube, Save } from 'lucide-react'
import { retentionPoliciesApi, systemApi } from '@/lib/api'
import { toast } from 'sonner'
import { convertRetentionToDays, convertDaysToUnit } from '@/lib/utils'
import { RetentionPolicy } from '@/types'

const formSchema = z.object({
  metric_name_pattern: z.string().min(1, 'Metric name pattern is required'),
  retention_value: z.number().min(0.001, 'Retention value must be positive'),
  retention_unit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months', 'years']),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
})

type FormData = z.infer<typeof formSchema>

interface RetentionPolicyFormProps {
  policy?: RetentionPolicy
  onSuccess: () => void
}

export function RetentionPolicyForm({ policy, onSuccess }: RetentionPolicyFormProps) {
  const [testResults, setTestResults] = useState<any>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      metric_name_pattern: '',
      retention_value: 30,
      retention_unit: 'days',
      description: '',
      enabled: true,
    },
  })

  // Populate form when editing
  useEffect(() => {
    if (policy) {
      const { value, unit } = convertDaysToUnit(policy.retention_days)
      form.reset({
        metric_name_pattern: policy.metric_name_pattern,
        retention_value: value,
        retention_unit: unit as any,
        description: policy.description || '',
        enabled: policy.enabled,
      })
    }
  }, [policy, form])

  const createMutation = useMutation({
    mutationFn: retentionPoliciesApi.create,
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: any) => {
      toast.error('Failed to create policy', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      retentionPoliciesApi.update(id, data),
    onSuccess: () => {
      onSuccess()
    },
    onError: (error: any) => {
      toast.error('Failed to update policy', {
        description: error.response?.data?.detail || error.message,
      })
    },
  })

  const testPatternMutation = useMutation({
    mutationFn: systemApi.testPattern,
    onSuccess: (data) => {
      console.log('Test pattern success:', data)
      setTestResults(data)
      toast.success('Pattern tested', {
        description: `Found ${data.matches_count} matching metrics`,
      })
    },
    onError: (error: any) => {
      console.error('Test pattern error:', error)
      toast.error('Test failed', {
        description: error.response?.data?.detail || error.message || 'Unknown error occurred',
      })
    },
  })

  const onSubmit = (data: FormData) => {
    const retention_days = convertRetentionToDays(data.retention_value, data.retention_unit)
    
    const policyData = {
      metric_name_pattern: data.metric_name_pattern,
      retention_days,
      description: data.description,
      enabled: data.enabled,
    }

    if (policy) {
      updateMutation.mutate({ id: policy.id, data: policyData })
    } else {
      createMutation.mutate(policyData)
    }
  }

  const handleTestPattern = () => {
    const pattern = form.getValues('metric_name_pattern')
    if (!pattern || pattern.trim() === '') {
      toast.error('Pattern required', {
        description: 'Please enter a metric pattern to test',
      })
      return
    }
    console.log('Testing pattern:', pattern)
    testPatternMutation.mutate(pattern.trim())
  }

  const examplePatterns = [
    { pattern: 'up', description: 'Instance up/down status' },
    { pattern: 'prometheus_*', description: 'All Prometheus internal metrics' },
    { pattern: 'go_*', description: 'Go runtime metrics' },
    { pattern: 'process_*', description: 'Process metrics (CPU, memory)' },
    { pattern: 'scrape_*', description: 'Scraping metrics' },
    { pattern: 'promhttp_*', description: 'Prometheus HTTP metrics' },
  ]

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Metric Pattern */}
        <FormField
          control={form.control}
          name="metric_name_pattern"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Metric Name Pattern</FormLabel>
              <FormControl>
                <div className="space-y-2">
                  <Input 
                    placeholder="e.g., up, prometheus_*, go_*, process_*"
                    {...field}
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleTestPattern}
                      disabled={testPatternMutation.isPending || !field.value}
                    >
                      {testPatternMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <TestTube className="h-4 w-4 mr-2" />
                      )}
                      Test Pattern
                    </Button>

                  </div>
                </div>
              </FormControl>
              <FormDescription>
                Use wildcards (*,?) or regex patterns to match metrics
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Example Patterns */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Example patterns:</Label>
          <div className="flex flex-wrap gap-2">
            {examplePatterns.map((example) => (
              <Badge
                key={example.pattern}
                variant="outline"
                className="cursor-pointer hover:bg-secondary/80"
                onClick={() => form.setValue('metric_name_pattern', example.pattern)}
              >
                {example.pattern}
              </Badge>
            ))}
          </div>
        </div>

        {/* Test Results */}
        {testResults && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Pattern Test Results</h4>
                  <Badge variant="outline">
                    {testResults.matches_count} matches
                  </Badge>
                </div>
                
                <div className="text-xs space-y-1">
                  <div><strong>Pattern:</strong> {testResults.input_pattern}</div>
                  <div><strong>Regex:</strong> <code>{testResults.regex_pattern}</code></div>
                </div>

                {testResults.matching_metrics.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-xs font-medium">Sample matches:</div>
                    <div className="text-xs space-y-0.5">
                      {testResults.matching_metrics.map((metric: string, index: number) => (
                        <div key={index} className="font-mono bg-muted/50 px-2 py-1 rounded">
                          {metric}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Retention Period */}
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="retention_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Retention Value</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    {...field}
                    onChange={(e) => field.onChange(parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="retention_unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                    <SelectItem value="months">Months</SelectItem>
                    <SelectItem value="years">Years</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Optional description for this retention policy"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Describe the purpose of this retention policy
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Enabled */}
        <FormField
          control={form.control}
          name="enabled"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Enable this policy</FormLabel>
                <FormDescription>
                  Disabled policies will not be executed automatically
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* Submit */}
        <div className="flex justify-end gap-2">
          <Button
            type="submit"
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {(createMutation.isPending || updateMutation.isPending) ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {policy ? 'Update Policy' : 'Create Policy'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
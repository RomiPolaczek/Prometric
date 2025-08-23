'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Menu, Wifi, WifiOff } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { systemApi } from '@/lib/api'

interface HeaderProps {
  activeTab: string
  onMenuClick: () => void
}

const tabTitles = {
  query: 'Query Console',
  graph: 'Graph',
  alerts: 'Alerts',
  targets: 'Targets',
  retention: 'Retention Management',
  status: 'System Status'
}

const tabDescriptions = {
  query: 'Execute PromQL queries against your Prometheus instance',
  graph: 'Visualize metrics over time',
  alerts: 'Monitor active alerts and their status',
  targets: 'Monitor scrape targets and their health',
  retention: 'Configure custom retention policies for your metrics',
  status: 'Prometheus configuration and runtime information'
}

export function Header({ activeTab, onMenuClick }: HeaderProps) {
  const { data: health } = useQuery({
    queryKey: ['health'],
    queryFn: systemApi.getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  const isConnected = health?.prometheus_connection?.status === 'connected'

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold">
              {tabTitles[activeTab as keyof typeof tabTitles]}
            </h1>
            <p className="text-sm text-muted-foreground">
              {tabDescriptions[activeTab as keyof typeof tabDescriptions]}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <Badge 
            variant={isConnected ? 'default' : 'destructive'}
            className="flex items-center gap-1"
          >
            {isConnected ? (
              <Wifi className="h-3 w-3" />
            ) : (
              <WifiOff className="h-3 w-3" />
            )}
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>

          {/* System Status */}
          {health?.system && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <span>CPU: {health.system.cpu_percent?.toFixed(1)}%</span>
              <span>•</span>
              <span>RAM: {health.system.memory_percent?.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
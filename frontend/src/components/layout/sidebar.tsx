'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Search,
  TrendingUp,
  AlertTriangle,
  Target,
  Database,
  Settings,
  X
} from 'lucide-react'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}

const navigation = [
  {
    id: 'query',
    name: 'Query',
    icon: Search,
    description: 'Execute PromQL queries'
  },
  {
    id: 'graph',
    name: 'Graph',
    icon: TrendingUp,
    description: 'Visualize metrics over time'
  },
  {
    id: 'alerts',
    name: 'Alerts',
    icon: AlertTriangle,
    description: 'Monitor active alerts'
  },
  {
    id: 'targets',
    name: 'Targets',
    icon: Target,
    description: 'Scrape targets status'
  },
  {
    id: 'retention',
    name: 'Retention',
    icon: Database,
    description: 'Manage retention policies'
  },
  {
    id: 'status',
    name: 'Status',
    icon: Settings,
    description: 'System status and configuration'
  }
]

function SidebarContent({ activeTab, setActiveTab, onClose }: {
  activeTab: string
  setActiveTab: (tab: string) => void
  onClose?: () => void
}) {
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  
  // Ensure component is mounted before showing theme-dependent content
  useEffect(() => {
    setMounted(true)
  }, [])
  
  // Use dark theme logo as default until theme is resolved
  const logoSrc = mounted && resolvedTheme === 'light' 
    ? '/prometric-logo.png' 
    : '/prometric-logo-darktheme.png'

  return (
    <div className="flex flex-col h-full">
      {/* Header with Large Logo */}
      <div className="relative p-6 border-b">
        <div className="flex items-center justify-center">
          <div className="relative w-60 h-20">
            <Image
              src={logoSrc}
              alt="Prometric Logo"
              fill
              className="object-contain"
              priority
              key={logoSrc} // Force re-render when logo changes
            />
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="absolute top-4 right-4">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              variant={activeTab === item.id ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start text-left h-auto p-3',
                activeTab === item.id && 'bg-primary text-primary-foreground'
              )}
              onClick={() => {
                setActiveTab(item.id)
                onClose?.()
              }}
            >
              <div className="flex items-start gap-3">
                <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs opacity-75 mt-0.5">
                    {item.description}
                  </div>
                </div>
              </div>
            </Button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground text-center">
          <div>Prometheus Management Console</div>
          <div>Version 2.0.0</div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }: SidebarProps) {
  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-80 lg:border-r lg:bg-card dark:bg-black">
        <SidebarContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="left" className="w-80 p-0 dark:bg-black">
          <SidebarContent 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            onClose={() => setIsOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  )
}
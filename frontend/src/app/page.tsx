'use client'

import { useState } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { QueryTab } from '@/components/tabs/query-tab'
import { GraphTab } from '@/components/tabs/graph-tab'
import { AlertsTab } from '@/components/tabs/alerts-tab'
import { TargetsTab } from '@/components/tabs/targets-tab'
import { RetentionTab } from '@/components/tabs/retention-tab'
import { StatusTab } from '@/components/tabs/status-tab'

export default function Home() {
  const [activeTab, setActiveTab] = useState('query')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'query':
        return <QueryTab />
      case 'graph':
        return <GraphTab />
      case 'alerts':
        return <AlertsTab />
      case 'targets':
        return <TargetsTab />
      case 'retention':
        return <RetentionTab />
      case 'status':
        return <StatusTab />
      default:
        return <QueryTab />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        setIsOpen={setSidebarOpen}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          activeTab={activeTab}
          onMenuClick={() => setSidebarOpen(!sidebarOpen)}
        />
        
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {renderActiveTab()}
          </div>
        </main>
      </div>
    </div>
  )
}
'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Send, Bot, User, Copy, AlertCircle, Sparkles } from 'lucide-react'
import { aiApi } from '@/lib/api'
import { toast } from 'sonner'

interface ChatMessage {
  id: string
  type: 'user' | 'ai'
  content: string
  promql?: string
  explanation?: string
  metric_used?: string
  timestamp: Date
}

interface AIChatProps {
  onQueryGenerated: (query: string) => void
}

export function AIChat({ onQueryGenerated }: AIChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<{ available: boolean; configured: boolean } | null>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Load messages from localStorage on component mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('ai-chat-messages')
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages)
        // Convert timestamp strings back to Date objects
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(messagesWithDates)
      } catch (error) {
        console.error('Failed to parse saved messages:', error)
      }
    }
  }, [])

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai-chat-messages', JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    checkAIStatus()
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom()
    }
  }, [messages])

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      }
    }, 150)
  }

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
      const isScrolledUp = scrollTop + clientHeight < scrollHeight - 10
      setShowScrollButton(isScrolledUp)
    }
  }

  const checkAIStatus = async () => {
    try {
      const status = await aiApi.getStatus()
      setAiStatus(status)
    } catch (error) {
      console.error('Failed to check AI status:', error)
      setAiStatus({ available: false, configured: false })
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await aiApi.translateToPromql(inputValue.trim())
      
      if (response.success && response.promql) {
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'ai',
          content: `I've translated your question to PromQL:`,
          promql: response.promql,
          explanation: response.explanation || 'No explanation provided',
          metric_used: response.metric_used || 'Unknown metric',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, aiMessage])
      } else {
        throw new Error(response.error || 'Translation failed')
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: `Sorry, I couldn't translate your question. ${error.message || 'Please try again.'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
      toast.error('AI translation failed', {
        description: error.message || 'Please try again'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseQuery = (promql: string) => {
    onQueryGenerated(promql)
    toast.success('Query copied to PromQL input')
  }

  const handleCopyQuery = (promql: string) => {
    navigator.clipboard.writeText(promql)
    toast.success('PromQL query copied to clipboard')
  }

  const handleClearChat = () => {
    setMessages([])
    localStorage.removeItem('ai-chat-messages')
    toast.success('Chat history cleared')
  }

  const exampleQuestions = [
    "What is my memory usage?",
    "Show me CPU utilization",
    "How much disk space is available?",
    "What's the network traffic like?",
    "Is my system running properly?"
  ]

  if (!aiStatus?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Chat Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              OpenAI API is not configured. Please set the OPENAI_API_KEY environment variable to use AI features.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          AI Chat Assistant
          <Badge variant="secondary" className="ml-auto">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
          {messages.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              className="ml-2 h-6 px-2 text-xs"
            >
              Clear Chat
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col space-y-4 min-h-0">
        {/* Chat Messages */}
        <div 
          className="flex-1 overflow-y-auto space-y-4 min-h-0 max-h-[400px] pr-2 chat-messages-container relative"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgb(209 213 219) transparent'
          }}
          onScroll={handleScroll}
          ref={messagesContainerRef}
        >
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Ask me anything about your metrics!</p>
              <p className="text-xs mt-2">I'll translate your questions to PromQL queries.</p>
              
              {/* Example Questions */}
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {exampleQuestions.map((question, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary/80 text-xs"
                      onClick={() => setInputValue(question)}
                    >
                      {question}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.type === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.type === 'ai' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] space-y-2 ${
                    message.type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2'
                      : 'border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 border rounded-lg px-3 py-2'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {message.promql && (
                    <div className="space-y-2">
                      <div className="bg-background/50 rounded p-2">
                        <p className="text-xs font-medium mb-1">Generated PromQL:</p>
                        <code className="text-xs break-all">{message.promql}</code>
                      </div>
                      
                      {message.explanation && (
                        <div className="text-xs opacity-80">
                          <strong>Why:</strong> {message.explanation}
                        </div>
                      )}
                      
                      {message.metric_used && (
                        <div className="text-xs opacity-80">
                          <strong>Metric:</strong> {message.metric_used}
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUseQuery(message.promql!)}
                          className="h-6 text-xs"
                        >
                          Use Query
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyQuery(message.promql!)}
                          className="h-6 text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  <p className="text-xs opacity-60">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 border rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Scroll to bottom button */}
          {showScrollButton && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-8 h-8 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all duration-200 flex items-center justify-center z-10"
              title="Scroll to bottom"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask me about your metrics..."
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
} 
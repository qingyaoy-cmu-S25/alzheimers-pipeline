import { useState, useEffect, useRef } from 'react';
import { PipelineStep, OutputItem, ChatMessage } from '../types';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { 
  Sparkles, 
  Send, 
  FlaskConical, 
  FileText, 
  Bug, 
  Code,
  Lightbulb,
  Bot,
  Wifi,
  WifiOff
} from 'lucide-react';
import { cn } from './ui/utils';
import { ChatWebSocket, ChatMessage as WSChatMessage } from '../lib/chat-websocket';

interface AIAssistantProps {
  currentStep: PipelineStep | null; // Changed to PipelineStep
  outputs: OutputItem[];
  code: string;
  messages: ChatMessage[]; // Use existing messages from App
  onSendMessage: (content: string, role?: 'user' | 'assistant') => void; // Callback to update messages
  currentCode?: string; // Current code from code editor
}

const quickActions = [
  { id: 'qc', label: 'Generate QC Report', icon: FlaskConical },
  { id: 'viz', label: 'Recommend Visualizations', icon: Lightbulb },
  { id: 'error', label: 'Explain Error', icon: Bug },
  { id: 'caption', label: 'Generate Caption', icon: FileText },
  { id: 'script', label: 'Generate Script', icon: Code },
];

export function AIAssistant({
  currentStep,
  outputs,
  code,
  messages,
  onSendMessage,
  currentCode,
}: AIAssistantProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentMessage, setCurrentMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<ChatWebSocket | null>(null);
  const accumulatedMessageRef = useRef<string>('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, currentMessage]);

  // Initialize WebSocket connection
  useEffect(() => {
    const wsEndpoint = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws/chat';
    wsRef.current = new ChatWebSocket(wsEndpoint);
    
    wsRef.current.connect({
      onConnect: () => {
        console.log('Connected to chat WebSocket');
        setIsConnected(true);
      },
      onDisconnect: () => {
        console.log('Disconnected from chat WebSocket');
        setIsConnected(false);
      },
      onError: (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      },
    });

    return () => {
      wsRef.current?.disconnect();
    };
  }, []);

  // Handle error messages from NotebookView
  useEffect(() => {
    const handleErrorMessage = (event: any) => {
      const { message } = event.detail;
      if (message) {
        sendMessageToAI(message, false);
      }
    };

    window.addEventListener('sendErrorMessage', handleErrorMessage);
    
    return () => {
      window.removeEventListener('sendErrorMessage', handleErrorMessage);
    };
  }, [messages]);

  const sendMessageToAI = (messageText: string, addToMessages: boolean = true) => {
    if (!wsRef.current || !wsRef.current.isConnected) {
      console.error('WebSocket not connected');
      return;
    }

    if (addToMessages) {
      onSendMessage(messageText, 'user');
    }

    setIsTyping(true);
    setCurrentMessage('');
    // Reset accumulated message ref
    accumulatedMessageRef.current = '';

    // Prepare chat history for context
    const history: WSChatMessage[] = messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .slice(-10) // Last 10 messages for context
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
      }));

    // Add current code context if available
    const contextMessage = currentCode 
      ? `${messageText}\n\nCurrent code:\n\`\`\`python\n${currentCode}\n\`\`\``
      : messageText;

    wsRef.current.sendMessage(contextMessage, history, {
      onProgress: (chunk: string) => {
        accumulatedMessageRef.current += chunk;
        setCurrentMessage(accumulatedMessageRef.current);
      },
      onEnd: () => {
        const finalMessage = accumulatedMessageRef.current;
        if (finalMessage && finalMessage.trim()) {
          onSendMessage(finalMessage, 'assistant');
        }
        setCurrentMessage('');
        accumulatedMessageRef.current = '';
        setIsTyping(false);
      },
      onError: (error) => {
        console.error('Error sending message:', error);
        onSendMessage(`Error: ${error || 'Failed to get response'}`, 'assistant');
        setIsTyping(false);
        setCurrentMessage('');
        accumulatedMessageRef.current = '';
      },
    });
  };

  const handleQuickAction = (actionId: string) => {
    let question = '';

    switch (actionId) {
      case 'qc':
        question = 'Please interpret the latest QC report';
        break;
      case 'viz':
        question = 'Recommend suitable visualizations for my data';
        break;
      case 'error':
        const errorOutput = outputs.find(o => o.type === 'error');
        if (errorOutput) {
          question = `Please explain this error: ${errorOutput.title}`;
        } else {
          question = 'Please explain any errors in the code execution';
        }
        break;
      case 'caption':
        question = 'Generate a caption for the latest chart';
        break;
      case 'script':
        question = 'Generate a training script draft based on the current code';
        break;
    }

    if (question) {
      sendMessageToAI(question);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessageToAI(input);
    setInput('');
  };

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Header */}
      <div className="h-14 border-b flex items-center px-4 gap-2">
        <Bot className="w-5 h-5 text-blue-500" />
        <div className="flex-1">
          <h3 className="text-sm font-medium">AI Assistant</h3>
          <p className="text-xs text-muted-foreground">Context-aware • RAG-enhanced</p>
        </div>
        <Badge variant="outline" className="text-xs">
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3 mr-1" />
              Online
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 mr-1" />
              Offline
            </>
          )}
        </Badge>
      </div>

      {/* Context info */}
      {currentStep && (
        <div className="border-b p-3 bg-muted/50">
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Current step:</span>
              <Badge variant="secondary" className="text-xs">
                {currentStep.title}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Outputs:</span>
              <span>{outputs.length}</span>
            </div>
            {code && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Code lines:</span>
                <span>{code.split('\n').length}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="border-b p-3">
        <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          {quickActions.slice(0, 4).map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.id}
                variant="outline"
                size="sm"
                className="justify-start text-xs h-auto py-2"
                onClick={() => handleQuickAction(action.id)}
                disabled={!isConnected}
              >
                <Icon className="w-3 h-3 mr-1.5" />
                {action.label}
              </Button>
            );
          })}
        </div>
        {quickActions.length > 4 && (
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs h-auto py-2 w-full mt-2"
            onClick={() => handleQuickAction(quickActions[4].id)}
            disabled={!isConnected}
          >
            <Code className="w-3 h-3 mr-1.5" />
            {quickActions[4].label}
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                message.role === 'user' && 'flex-row-reverse'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  message.role === 'assistant'
                    ? 'bg-blue-500 text-white'
                    : 'bg-muted'
                )}
              >
                {message.role === 'assistant' ? (
                  <Bot className="w-4 h-4" />
                ) : (
                  <span className="text-xs">You</span>
                )}
              </div>
              <div className={cn('flex-1', message.role === 'user' && 'text-right')}>
                <Card
                  className={cn(
                    'p-3 inline-block text-sm max-w-full',
                    message.role === 'user' && 'bg-blue-500 text-white'
                  )}
                >
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </Card>
                <p className="text-xs text-muted-foreground mt-1">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {/* Streaming message */}
          {isTyping && currentMessage && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500 text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <Card className="p-3 inline-block text-sm max-w-full">
                  <div className="whitespace-pre-wrap">{currentMessage}</div>
                  <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse">|</span>
                </Card>
              </div>
            </div>
          )}
          
          {/* Typing indicator */}
          {isTyping && !currentMessage && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-500 text-white">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <Card className="p-3 inline-block">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </Card>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? "Ask the AI assistant..." : "Connecting..."}
            className="min-h-[60px] resize-none"
            disabled={!isConnected}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button 
            size="icon" 
            onClick={handleSend} 
            disabled={!input.trim() || !isConnected || isTyping}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

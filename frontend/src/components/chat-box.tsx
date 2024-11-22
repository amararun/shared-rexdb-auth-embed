import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FLOWISE_API_ENDPOINT } from '../App';

type Message = {
  role: 'assistant' | 'user';
  content: string;
};

interface ChatBoxProps {
  sessionId: string;
  isExpanded: boolean;
  messages: Message[];
  onMessageUpdate: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Add type for markdown components
type MarkdownComponentProps = {
  node?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

export function ChatBox({ sessionId, isExpanded, messages, onMessageUpdate }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isExpanded && messages.length > 0) {
      requestAnimationFrame(() => {
        const messagesContainer = messagesEndRef.current?.closest('.messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      });
    }
  }, [messages, isExpanded]);

  async function query(question: string) {
    try {
      console.log('Using sessionId in query:', sessionId);
      const response = await fetch(FLOWISE_API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          question,
          overrideConfig: {
            sessionId: sessionId
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Full Chat Response:', JSON.stringify(result, null, 2));
        return result;
      } else {
        const errorText = await response.text();
        console.error('Error response from chat query:', errorText);
        throw new Error(errorText);
      }
    } catch (error) {
      console.error('Chat query error:', error);
      throw error;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    console.log('ChatBox using sessionId:', sessionId);
    const userMessage = input;
    setInput('');
    
    const textarea = document.querySelector('textarea');
    if (textarea) {
        textarea.style.height = '40px';
    }
    
    try {
      onMessageUpdate(prev => [...prev, {
        role: 'user' as const,
        content: userMessage
      }]);
      setIsLoading(true);

      const response = await query(userMessage);
      
      // Check for artifacts in chat response
      let messageContent = response.text || response.message || response.toString();
      
      if (response.artifacts && response.artifacts.length > 0) {
        const imageArtifact = response.artifacts.find((artifact: any) => 
          artifact.type === 'png' || artifact.type === 'gif'
        );
        
        if (imageArtifact && typeof imageArtifact.data === 'string') {
          if (imageArtifact.data.startsWith('FILE-STORAGE::')) {
            const fileName = imageArtifact.data.replace('FILE-STORAGE::', '');
            const imageUrl = `https://flowise.tigzig.com/api/v1/get-upload-file?chatflowId=ef7c4c91-dec7-42a6-9ab6-add8dc6a4475&chatId=${response.chatId}&fileName=${fileName}`;
            
            try {
              console.log('Downloading image from URL:', imageUrl);
              const imgResponse = await fetch(imageUrl);
              if (!imgResponse.ok) {
                throw new Error('Failed to download image');
              }
              const blob = await imgResponse.blob();
              const localUrl = URL.createObjectURL(blob);
              console.log('Created local URL for image:', localUrl);
              
              // Dispatch event with local URL
              const chartEvent = new CustomEvent('newChart', { 
                detail: { url: localUrl, timestamp: Date.now() }
              });
              window.dispatchEvent(chartEvent);
              console.log('Dispatched chart event with local URL');
            } catch (imgError) {
              console.error('Error downloading chart:', imgError);
            }
          }
        }
      }
      
      onMessageUpdate(prev => [...prev, {
        role: 'assistant' as const,
        content: messageContent
      }]);

    } catch (error) {
      console.error('Chat error:', error);
      try {
        onMessageUpdate(prev => [...prev, {
          role: 'assistant' as const,
          content: 'Sorry, I encountered an error. Please try again.'
        }]);
      } catch (stateError) {
        console.error('Error setting error message:', stateError);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {isExpanded && (
        <>
          <div className="messages-container flex-1 overflow-y-auto p-2 space-y-2 bg-gradient-to-b from-white to-indigo-50/30">
            {messages.length === 0 ? (
              <div className="text-center text-indigo-400 mt-4 text-sm">
                Start a conversation by typing a message below.
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-1.5 ${
                      message.role === 'user'
                        ? 'bg-indigo-50 text-indigo-900'
                        : 'text-gray-900'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <span className="text-base text-gray-800">{message.content}</span>
                    ) : (
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeRaw]}
                          components={{
                            // Main title (H1)
                            h1: ({ children, ...props }: MarkdownComponentProps) => (
                              <h1 
                                className="text-3xl font-bold pb-2 mb-4"
                                style={{ color: '#1e3a8a' }}
                                {...props}
                              >
                                {children}
                              </h1>
                            ),
                            // Section headers (H2)
                            h2: ({ children, ...props }: MarkdownComponentProps) => (
                              <h2 
                                className="text-2xl font-semibold mb-3 mt-6"
                                style={{ color: '#1e40af' }}
                                {...props}
                              >
                                {children}
                              </h2>
                            ),
                            // H3
                            h3: ({ children, ...props }: MarkdownComponentProps) => (
                              <h3 
                                className="text-xl font-medium mb-2 mt-4"
                                style={{ color: '#3730a3' }}
                                {...props}
                              >
                                {children}
                              </h3>
                            ),
                            // H4
                            h4: ({ children, ...props }: MarkdownComponentProps) => (
                              <h4 
                                className="text-lg font-medium mb-2 mt-3"
                                style={{ color: '#4f46e5' }}
                                {...props}
                              >
                                {children}
                              </h4>
                            ),
                            // Paragraphs
                            p: ({ children, ...props }: MarkdownComponentProps) => (
                              <p className="text-base mb-2 last:mb-0 text-gray-800" {...props}>
                                {children}
                              </p>
                            ),
                            // Lists
                            ul: ({ children, ...props }: MarkdownComponentProps) => (
                              <ul className="list-disc pl-4 mb-2 space-y-1" {...props}>
                                {children}
                              </ul>
                            ),
                            ol: ({ children, ...props }: MarkdownComponentProps) => (
                              <ol className="list-decimal pl-4 mb-2 space-y-1" {...props}>
                                {children}
                              </ol>
                            ),
                            li: ({ children, ...props }: MarkdownComponentProps) => (
                              <li className="text-base text-gray-800" {...props}>
                                {children}
                              </li>
                            ),
                            // Code blocks
                            code: ({ children, className, ...props }: MarkdownComponentProps & { className?: string }) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-gray-100 px-1 rounded" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className="block bg-gray-100 p-2 rounded" {...props}>
                                  {children}
                                </code>
                              );
                            },
                            // Tables
                            table: ({ children, ...props }: MarkdownComponentProps) => (
                              <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200 border" {...props}>
                                  {children}
                                </table>
                              </div>
                            ),
                            thead: ({ children, ...props }: MarkdownComponentProps) => (
                              <thead className="bg-gray-50" {...props}>
                                {children}
                              </thead>
                            ),
                            th: ({ children, ...props }: MarkdownComponentProps) => (
                              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" {...props}>
                                {children}
                              </th>
                            ),
                            td: ({ children, ...props }: MarkdownComponentProps) => (
                              <td className="px-3 py-2 text-sm text-gray-500 border-t" {...props}>
                                {children}
                              </td>
                            ),
                            // Links
                            a: ({ children, ...props }: MarkdownComponentProps) => (
                              <a 
                                {...props} 
                                className="text-blue-600 hover:text-blue-800" 
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="px-3 py-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-0" />
          </div>
          <form onSubmit={handleSubmit} className="p-2 border-t border-indigo-100 bg-white mt-auto">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={isLoading}
                rows={1}
                className="flex-1 min-h-[40px] max-h-[120px] px-3 py-2 text-sm border border-indigo-100 rounded-md focus:ring-indigo-200 focus:border-indigo-300 resize-none overflow-y-auto"
                style={{
                  lineHeight: '1.5',
                  height: 'auto'
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <Button 
                type="submit" 
                disabled={isLoading} 
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
} 
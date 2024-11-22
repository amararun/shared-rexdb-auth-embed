import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnalysisDisplay } from "./analysis-display"
import { QuickAnalysisDisplay } from "./quick-analysis-display"
import { ChatBox } from "./chat-box"
import { Maximize2, Minimize2, FileDown } from "lucide-react"

type Message = {
  role: 'assistant' | 'user';
  content: string;
};

interface AnalysisTabsProps {
  analysisContent: string;
  quickAnalysisContent: string;
  sessionId: string;
  onGeneratePdf: () => void;
  onGenerateQuickPdf: () => void;
  isPdfGenerating: boolean;
  isQuickPdfGenerating: boolean;
  sharedMessages: Message[];
  setSharedMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

export function AnalysisTabs({
  analysisContent,
  quickAnalysisContent,
  sessionId,
  onGeneratePdf,
  onGenerateQuickPdf,
  isPdfGenerating,
  isQuickPdfGenerating,
  sharedMessages,
  setSharedMessages,
}: AnalysisTabsProps) {
  const [maximizedTab, setMaximizedTab] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('structure');

  const toggleMaximize = (tab: string) => {
    setMaximizedTab(maximizedTab === tab ? null : tab);
  };

  return (
    <Tabs 
      value={activeTab}
      onValueChange={setActiveTab}
      className={`w-full ${
        maximizedTab 
          ? 'fixed left-4 right-6 top-4 bottom-4 z-50 bg-white shadow-2xl rounded-lg max-w-[calc(100vw-3rem)]' 
          : ''
      }`}
    >
      <TabsList className="grid w-full grid-cols-3 bg-indigo-100 p-1">
        <TabsTrigger 
          value="structure" 
          className="data-[state=active]:bg-indigo-200 data-[state=active]:text-indigo-900 text-indigo-700 text-[16px] font-medium"
        >
          AI Data Structure Analysis
        </TabsTrigger>
        <TabsTrigger 
          value="quick"
          className="data-[state=active]:bg-indigo-200 data-[state=active]:text-indigo-900 text-indigo-700 text-[16px] font-medium"
        >
          AI Quick Insights
        </TabsTrigger>
        <TabsTrigger 
          value="chat"
          className="data-[state=active]:bg-indigo-200 data-[state=active]:text-indigo-900 text-indigo-700 text-[16px] font-medium"
        >
          AI Chat [Text-to-SQL/Python]
        </TabsTrigger>
      </TabsList>

      <TabsContent value="structure" className={`relative ${maximizedTab === 'structure' ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-12rem)]'}`}>
        <div className="flex justify-between items-center px-3 py-1 border-b bg-white">
          <button
            onClick={onGeneratePdf}
            disabled={isPdfGenerating}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
          >
            {isPdfGenerating ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                <span>Generate PDF</span>
              </>
            )}
          </button>
          <button
            onClick={() => toggleMaximize('structure')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            {maximizedTab === 'structure' ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
        <AnalysisDisplay
          content={analysisContent}
          onGeneratePdf={onGeneratePdf}
          isPdfGenerating={isPdfGenerating}
          hideTopButtons={true}
        />
      </TabsContent>

      <TabsContent value="quick" className={`relative ${maximizedTab === 'quick' ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-12rem)]'}`}>
        <div className="flex justify-between items-center px-3 py-1 border-b bg-white">
          <button
            onClick={onGenerateQuickPdf}
            disabled={isQuickPdfGenerating}
            className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1"
          >
            {isQuickPdfGenerating ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                <span>Generate PDF</span>
              </>
            )}
          </button>
          <button
            onClick={() => toggleMaximize('quick')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            {maximizedTab === 'quick' ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
        <QuickAnalysisDisplay
          content={quickAnalysisContent}
          onGeneratePdf={onGenerateQuickPdf}
          isPdfGenerating={isQuickPdfGenerating}
          hideTopButtons={true}
        />
      </TabsContent>

      <TabsContent 
        value="chat" 
        data-value="chat"
        className={`relative ${maximizedTab === 'chat' ? 'h-[calc(100vh-8rem)]' : 'h-[calc(100vh-12rem)]'}`}
      >
        <div className="flex justify-end items-center px-3 py-1 border-b bg-white">
          <button
            onClick={() => toggleMaximize('chat')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            {maximizedTab === 'chat' ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
        <ChatBox
          sessionId={sessionId}
          isExpanded={true}
          messages={sharedMessages}
          onMessageUpdate={setSharedMessages}
        />
      </TabsContent>
    </Tabs>
  )
} 
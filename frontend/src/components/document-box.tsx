import { useState, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Maximize2, ChevronUp, ChevronDown, RefreshCw, X } from "lucide-react"
import { cn } from "@/lib/utils"

const DOCUMENT_URLS = {
  excel: {
    view: 'https://harolikar-my.sharepoint.com/personal/amar_harolikar_com/_layouts/15/Doc.aspx?sourcedoc={371a2aba-3da4-4966-8d5a-e02eb2038845}&action=embedview&wdAllowInteractivity=False&wdHideGridlines=True&wdHideHeaders=True&wdDownloadButton=True&wdInConfigurator=True&wdInConfigurator=True',
    edit: 'https://harolikar-my.sharepoint.com/personal/amar_harolikar_com/_layouts/15/Doc.aspx?sourcedoc={371a2aba-3da4-4966-8d5a-e02eb2038845}&action=edit'
  },
  google: {
    view: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT-ASVIfFJ4HdqIjq-2fSar4taGxlUutrZCeH1dFgfT6o-baBFQHLtJcGwgretrT2NmqtbQe7FbmxiS/pubhtml?widget=true&headers=false',
    edit: 'https://docs.google.com/spreadsheets/d/YOUR-SHEET-ID/edit?usp=sharing'
  },
  docs: {
    view: 'https://docs.google.com/document/d/e/2PACX-1vQ2z_n6-egJOrvFLMXsIBWvhxoPg01fS2XMchIJ-993uqD9YbaNbw9H1ZTD09CzeZ-VetsRNML2p3qF/pub?embedded=true',
    edit: 'https://docs.google.com/document/d/1v8BQURR8F6yoVlxGMmjPE9hEJAsLyx7cjtjiNLiXkhk/edit?usp=sharing'
  }
};

interface DocumentBoxProps {
  isMaximized?: boolean;
  onExpand?: () => void;
  onDocumentSelect?: (type: 'google' | 'excel' | 'docs') => void;
}

export function DocumentBox({ onDocumentSelect }: DocumentBoxProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeType, setActiveType] = useState<'google' | 'excel' | 'docs'>('excel');
  const [isLoading, setIsLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleTypeChange = (type: 'google' | 'excel' | 'docs') => {
    setActiveType(type);
    onDocumentSelect?.(type);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <>
      <div className="flex flex-col">
        <div 
          className="flex items-center justify-between px-3 py-1 bg-indigo-300 text-indigo-900 cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="font-medium text-base">Docs</span>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-violet-600 p-0.5 rounded">
              {(['google', 'excel', 'docs'] as const).map((type) => (
                <Button
                  key={type}
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTypeChange(type);
                  }}
                  className={cn(
                    "h-7 px-2 text-xs hover:bg-blue-700 text-white",
                    activeType === type && "bg-blue-700"
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Button>
              ))}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleRefresh();
              }}
              disabled={isLoading}
              className="h-7 w-7 p-0 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowEditModal(true);
              }}
              className="h-7 w-7 p-0 hover:bg-blue-700"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
              className="h-7 w-7 p-0 hover:bg-blue-700"
            >
              {isCollapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        <Card className={cn(
          "w-full border-blue-100 bg-white/50 shadow-sm rounded-t-none transition-all duration-300 overflow-hidden",
          isCollapsed ? "h-0" : "h-[300px]"
        )}>
          <CardContent className="p-0 h-full relative">
            {isLoading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-sm">Refreshing...</div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={DOCUMENT_URLS[activeType].view}
              className="w-full h-full"
              frameBorder="0"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </CardContent>
        </Card>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-[90vw] h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <h3 className="font-medium">
                {activeType.charAt(0).toUpperCase() + activeType.slice(1)} - Edit Mode
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowEditModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 p-4">
              <iframe
                src={DOCUMENT_URLS[activeType].edit}
                className="w-full h-full"
                frameBorder="0"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
} 
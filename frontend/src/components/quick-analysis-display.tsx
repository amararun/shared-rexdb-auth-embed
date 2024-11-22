import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { FileDown } from 'lucide-react';
import { Button } from "@/components/ui/button";

type MarkdownComponentProps = {
  node?: any;
  children?: React.ReactNode;
  [key: string]: any;
}

interface QuickAnalysisDisplayProps {
  content: string;
  onGeneratePdf?: () => void;
  isPdfGenerating?: boolean;
  hideTopButtons?: boolean;
}

export function QuickAnalysisDisplay({ content, onGeneratePdf, isPdfGenerating, hideTopButtons }: QuickAnalysisDisplayProps) {
  return (
    <div className="flex flex-col h-full">
      {!hideTopButtons && content && onGeneratePdf && (
        <div className="flex justify-end p-2 bg-white border-b">
          <Button
            onClick={onGeneratePdf}
            disabled={isPdfGenerating}
            variant="outline"
            size="sm"
            className="text-blue-600 hover:text-blue-700"
          >
            {isPdfGenerating ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                Generate PDF
              </>
            )}
          </Button>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gradient-to-b from-white to-blue-50/30">
        {content ? (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
              components={{
                h1: ({ children, ...props }: MarkdownComponentProps) => (
                  <h1 
                    className="text-3xl font-bold pb-2 mb-4"
                    style={{ color: '#1e3a8a' }}
                    {...props}
                  >
                    {children}
                  </h1>
                ),
                // Section headers (H2) - Reduced from text-4xl to text-3xl
                h2: ({ children, ...props }: MarkdownComponentProps) => (
                  <h2 
                    className="text-2xl font-semibold mb-3 mt-6"
                    style={{ color: '#1e40af' }}
                    {...props}
                  >
                    {children}
                  </h2>
                ),
                // H3 - Reduced from text-3xl to text-2xl
                h3: ({ children, ...props }: MarkdownComponentProps) => (
                  <h3 
                    className="text-xl font-medium mb-2 mt-4"
                    style={{ color: '#3730a3' }}
                    {...props}
                  >
                    {children}
                  </h3>
                ),
                // H4 - Reduced from text-2xl to text-xl
                h4: ({ children, ...props }: MarkdownComponentProps) => (
                  <h4 
                    className="text-lg font-medium mb-2 mt-3"
                    style={{ color: '#4f46e5' }}
                    {...props}
                  >
                    {children}
                  </h4>
                ),
                // Simplify table styling
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
                // Simplify paragraph and list styling
                p: ({ children, ...props }: MarkdownComponentProps) => (
                  <p className="text-base mb-2 last:mb-0 text-gray-800" {...props}>
                    {children}
                  </p>
                ),
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
                // Simplify code styling
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
                // Update link styling
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
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="text-center text-blue-400 mt-4 text-sm">
            No quick analysis available yet. Click "AI Quick Analysis" to analyze the data.
          </div>
        )}
      </div>
    </div>
  );
} 
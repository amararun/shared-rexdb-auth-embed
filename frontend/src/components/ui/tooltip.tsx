import * as React from "react"
import { cn } from "@/lib/utils"

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const TooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "z-50 overflow-hidden rounded-md bg-slate-900 px-3 py-1.5 text-xs text-slate-50",
      className
    )}
    {...props}
  />
))
TooltipContent.displayName = "TooltipContent"

export function Tooltip({ content, children, className }: TooltipProps) {
  const [show, setShow] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
      >
        {children}
      </div>
      {show && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2"
          ref={tooltipRef}
        >
          <TooltipContent className={className}>
            {content}
          </TooltipContent>
        </div>
      )}
    </div>
  )
} 
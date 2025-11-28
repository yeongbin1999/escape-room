"use client";
import React, { useRef, useState, useEffect } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface TruncatedTextWithTooltipProps {
  text: string;
  maxWidthClass?: string; // e.g., "max-w-[200px]"
  className?: string;
}

export default function TruncatedTextWithTooltip({
  text,
  maxWidthClass = "max-w-xs",
  className,
}: TruncatedTextWithTooltipProps) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (textRef.current) {
      // Check if text is overflowing
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  }, [text]); // Re-check if text changes

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            ref={textRef}
            className={cn("truncate", maxWidthClass, className)}
            style={{ display: 'inline-block' }} // Ensure div behaves like inline-block for truncation
          >
            {text}
          </div>
        </TooltipTrigger>
        {isTruncated && (
          <TooltipContent className="bg-gray-700 text-white border-gray-600 z-50" sideOffset={5}>
            <p>{text}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

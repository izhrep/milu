import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ExpandableTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxCollapsedRows?: number;
}

const ExpandableTextarea = React.forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  ({ className, disabled, value, maxCollapsedRows = 6, onChange, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isOverflowing, setIsOverflowing] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref]
    );

    const lineHeight = 20; // approx line-height in px
    const maxCollapsedHeight = maxCollapsedRows * lineHeight + 16; // +padding

    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      // Reset to measure natural height
      el.style.height = "auto";
      const naturalHeight = el.scrollHeight;

      if (!isExpanded && naturalHeight > maxCollapsedHeight) {
        setIsOverflowing(true);
        el.style.height = `${maxCollapsedHeight}px`;
      } else {
        setIsOverflowing(!isExpanded ? false : naturalHeight > maxCollapsedHeight);
        el.style.height = `${naturalHeight}px`;
      }
    }, [value, isExpanded, maxCollapsedHeight, props.defaultValue]);

    return (
      <div className="relative">
        <textarea
          ref={setRefs}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70 resize-none overflow-hidden transition-[height] duration-200",
            !isExpanded && isOverflowing && "mask-fade",
            className
          )}
          disabled={disabled}
          value={value}
          onChange={onChange}
          {...props}
        />
        {isOverflowing && !isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
            Показать полностью
          </button>
        )}
        {isExpanded && isOverflowing && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
          >
            <ChevronUp className="h-3 w-3" />
            Свернуть
          </button>
        )}
      </div>
    );
  }
);

ExpandableTextarea.displayName = "ExpandableTextarea";

export { ExpandableTextarea };

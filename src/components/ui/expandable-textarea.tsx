import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ExpandableTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxCollapsedRows?: number;
  maxExpandedRows?: number;
}

const ExpandableTextarea = React.forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  ({ className, disabled, value, maxCollapsedRows = 6, maxExpandedRows = 20, onChange, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isOverflowing, setIsOverflowing] = React.useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
    const wrapperRef = React.useRef<HTMLDivElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref]
    );

    const lineHeight = 20;
    const maxCollapsedHeight = maxCollapsedRows * lineHeight + 16;
    const maxExpandedHeight = maxExpandedRows * lineHeight + 16;

    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const naturalHeight = el.scrollHeight;

      if (!isExpanded && naturalHeight > maxCollapsedHeight) {
        setIsOverflowing(true);
        el.style.height = `${maxCollapsedHeight}px`;
      } else if (isExpanded) {
        setIsOverflowing(naturalHeight > maxCollapsedHeight);
        if (naturalHeight > maxExpandedHeight) {
          el.style.height = `${maxExpandedHeight}px`;
        } else {
          el.style.height = `${naturalHeight}px`;
        }
      } else {
        setIsOverflowing(false);
        el.style.height = `${naturalHeight}px`;
      }
    }, [value, isExpanded, maxCollapsedHeight, maxExpandedHeight, props.defaultValue]);

    const handleCollapse = () => {
      setIsExpanded(false);
      // Scroll the wrapper into view after collapse
      requestAnimationFrame(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };

    return (
      <div className="relative" ref={wrapperRef}>
        <textarea
          ref={setRefs}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground/40 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70 resize-none transition-[height] duration-200",
            !isExpanded && isOverflowing && "overflow-hidden mask-fade",
            isExpanded ? "overflow-y-auto" : "overflow-hidden",
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
            onClick={handleCollapse}
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

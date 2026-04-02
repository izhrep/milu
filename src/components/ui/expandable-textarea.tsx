import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ExpandableTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxCollapsedRows?: number;
  maxExpandedRows?: number;
}

const ExpandableTextarea = React.forwardRef<HTMLTextAreaElement, ExpandableTextareaProps>(
  ({ className, disabled, value, maxCollapsedRows = 6, maxExpandedRows = 20, onChange, onFocus, onBlur, ...props }, ref) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isFocused, setIsFocused] = React.useState(false);
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

    // Auto-expand when focused and content overflows collapsed height
    const effectiveExpanded = isExpanded || (isFocused && isOverflowing);

    React.useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      const naturalHeight = el.scrollHeight;

      if (!effectiveExpanded && naturalHeight > maxCollapsedHeight) {
        setIsOverflowing(true);
        el.style.height = `${maxCollapsedHeight}px`;
      } else if (effectiveExpanded) {
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
    }, [value, effectiveExpanded, maxCollapsedHeight, maxExpandedHeight, props.defaultValue]);

    const handleCollapse = () => {
      setIsExpanded(false);
      requestAnimationFrame(() => {
        wrapperRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    };

    const handleFocus = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      // After paste, scroll textarea to cursor position
      requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (el) {
          const pos = el.selectionStart;
          el.scrollTop = el.scrollHeight;
          // Restore cursor visibility
          el.setSelectionRange(pos, pos);
          el.scrollTop = el.scrollHeight;
        }
      });
      props.onPaste?.(e);
    };

    return (
      <div className="relative" ref={wrapperRef}>
        <textarea
          ref={setRefs}
          className={cn(
            "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground/40 placeholder:italic focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70 resize-none transition-[height] duration-200",
            !effectiveExpanded && isOverflowing && "overflow-hidden mask-fade",
            effectiveExpanded ? "overflow-y-auto" : "overflow-hidden",
            className
          )}
          disabled={disabled}
          value={value}
          onChange={onChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          {...props}
        />
        {isOverflowing && !effectiveExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1 transition-colors"
          >
            <ChevronDown className="h-3 w-3" />
            Показать полностью
          </button>
        )}
        {isExpanded && isOverflowing && !isFocused && (
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

import * as React from "react";
import { cn } from "@/lib/utils";
import { Clock, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TimePickerProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  SLOTS.push(`${String(h).padStart(2, "0")}:00`);
  SLOTS.push(`${String(h).padStart(2, "0")}:30`);
}

export function TimePicker({ value, onChange, disabled, className, placeholder }: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const displayValue = value ? value.slice(0, 5) : "";
  const selectedIndex = SLOTS.indexOf(displayValue);

  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      listRef.current?.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "center" });
    }, 30);
    return () => clearTimeout(t);
  }, [open, displayValue]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  React.useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  const commitDraft = () => {
    const cleaned = draft.replace(/[^\d:]/g, "");
    const match = cleaned.match(/^(\d{1,2}):?(\d{2})$/);
    if (match) {
      const h = Math.min(23, Math.max(0, parseInt(match[1])));
      const m = Math.min(59, Math.max(0, parseInt(match[2])));
      onChange(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
    setEditing(false);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraft(displayValue);
    setEditing(true);
  };

  const shiftByWheel = React.useCallback(
    (direction: "up" | "down") => {
      if (disabled) return;
      const fallbackIndex = SLOTS.indexOf("10:00");
      const baseIndex = selectedIndex >= 0 ? selectedIndex : fallbackIndex;
      const delta = direction === "down" ? 1 : -1;
      const nextIndex = Math.min(SLOTS.length - 1, Math.max(0, baseIndex + delta));
      onChange(SLOTS[nextIndex]);
    },
    [disabled, onChange, selectedIndex],
  );

  return (
    <Popover open={open} onOpenChange={(v) => { if (!disabled) setOpen(v); }}>
      <PopoverTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 h-10 w-[110px] rounded-md border border-input bg-background px-2.5 text-sm",
            "transition-colors hover:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
            "cursor-pointer select-none",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none",
            open && "ring-2 ring-primary/20 border-primary",
            className,
          )}
          onWheel={(e) => {
            if (disabled || editing) return;
            e.preventDefault();
            e.stopPropagation();
            shiftByWheel(e.deltaY > 0 ? "down" : "up");
          }}
        >
          <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              placeholder="ЧЧ:ММ"
              maxLength={5}
              disabled={disabled}
              className="w-full bg-transparent outline-none tabular-nums tracking-wider text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter") { commitDraft(); setOpen(false); }
                if (e.key === "Escape") { setEditing(false); }
                e.stopPropagation();
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={cn(
                "tabular-nums flex-1 text-left",
                !displayValue && "text-muted-foreground",
              )}
              onDoubleClick={startEditing}
            >
              {displayValue || (placeholder ?? "Время")}
            </span>
          )}
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )} />
        </div>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-1 pointer-events-auto" align="start" sideOffset={4}>
        <div
          ref={listRef}
          className="h-[240px] overflow-y-auto overscroll-contain touch-pan-y"
          style={{ scrollbarWidth: "thin" }}
          onWheelCapture={(e) => e.stopPropagation()}
        >
          {SLOTS.map((slot) => {
            const isSelected = slot === displayValue;
            return (
              <button
                key={slot}
                type="button"
                data-selected={isSelected}
                onClick={() => { onChange(slot); setOpen(false); }}
                className={cn(
                  "block w-full rounded px-3 py-1.5 text-sm tabular-nums text-left transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground",
                )}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

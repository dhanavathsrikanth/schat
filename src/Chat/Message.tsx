import { cn } from "@/lib/utils";
import { Id } from "../../convex/_generated/dataModel";
import { ReactNode, useState, useRef, useEffect } from "react";
import { EmojiPicker, QUICK_REACTIONS } from "@/components/EmojiPicker";
import { Pencil1Icon, TrashIcon, PaperPlaneIcon, CopyIcon, MagnifyingGlassIcon, CheckIcon } from "@radix-ui/react-icons";

export function Message({
  author,
  authorName,
  viewer,
  createdAt,
  status,
  reactions = [],
  onReact,
  onReply,
  onDelete,
  onEdit,
  onForward,
  deleted,
  isVoiceNote,
  replyPreview,
  replyAuthor,
  edited,
  isGroupChat,
  showAuthor,
  children,
}: {
  author: Id<"users">;
  authorName: string;
  viewer: Id<"users">;
  createdAt: number;
  status?: "Sent" | "Delivered" | "Read";
  reactions?: { userId: Id<"users">; emoji: string }[];
  onReact?: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onForward?: () => void;
  deleted?: boolean;
  isVoiceNote?: boolean;
  replyPreview?: string | null;
  replyAuthor?: string;
  edited?: boolean;
  isGroupChat?: boolean;
  showAuthor?: boolean;
  children: ReactNode;
}) {
  const isOwn = author === viewer;
  const [, setHovering] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showActions]);

  const handleCopy = async () => {
    const text = (children as any)?.toString?.() ?? "";
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reactionCounts = reactions.reduce<Record<string, { count: number; hasOwn: boolean }>>(
    (all, r) => ({
      ...all,
      [r.emoji]: {
        count: (all[r.emoji]?.count ?? 0) + 1,
        hasOwn: all[r.emoji]?.hasOwn || r.userId === viewer,
      },
    }),
    {},
  );

  return (
    <li
      className={cn(
        "group flex flex-col text-sm",
        isOwn ? "items-end self-end" : "items-start self-start",
        "mb-0.5",
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); if (!showActions) setShowActions(false); }}
    >
      {isGroupChat && showAuthor && !isOwn && (
        <div className="mb-0.5 px-1 text-xs font-medium text-primary">{authorName}</div>
      )}

      {replyPreview && (
        <div className={cn(
          "mb-1 flex items-center gap-2 rounded-lg border-l-2 bg-muted/50 px-2 py-1 text-xs max-w-[280px]",
          isOwn ? "border-l-primary/50" : "border-l-muted-foreground/50"
        )}>
          <div className="min-w-0">
            {replyAuthor && <div className="font-medium text-primary text-[11px]">{replyAuthor}</div>}
            <div className="truncate text-muted-foreground">{replyPreview}</div>
          </div>
        </div>
      )}

      <div className="relative">
        <div
          className={cn(
            "rounded-2xl px-3 py-1.5 max-w-[85vw] sm:max-w-[420px]",
            isOwn
              ? "bg-emerald-600 text-white rounded-br-md"
              : "bg-muted rounded-bl-md",
          )}
        >
          {deleted ? (
            <span className="italic opacity-70">This message was deleted</span>
          ) : (
            <>
              {isVoiceNote && (
                <div className="mb-1 text-[11px] opacity-70">🎙️ Voice Note</div>
              )}
              {children}
            </>
          )}
        </div>

        {showActions && !deleted && (
          <div
            ref={actionsRef}
            className={cn(
              "absolute z-20 mt-1 flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-lg",
              isOwn ? "right-0" : "left-0",
            )}
          >
            {Object.keys(reactionCounts).length < 8 && (
              <EmojiPicker onSelect={(emoji) => { onReact?.(emoji); setShowActions(false); }}>
                <button className="rounded p-1.5 text-xs hover:bg-muted">😀</button>
              </EmojiPicker>
            )}
            <button onClick={handleCopy} className="rounded p-1.5 hover:bg-muted" title="Copy">
              {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => { onReply?.(); setShowActions(false); }} className="rounded p-1.5 hover:bg-muted" title="Reply">
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => { onForward?.(); setShowActions(false); }} className="rounded p-1.5 hover:bg-muted" title="Forward">
              <PaperPlaneIcon className="h-3.5 w-3.5" />
            </button>
            {isOwn && onEdit && (
              <button onClick={() => { onEdit(); setShowActions(false); }} className="rounded p-1.5 hover:bg-muted" title="Edit">
                <Pencil1Icon className="h-3.5 w-3.5" />
              </button>
            )}
            {isOwn && onDelete && (
              <button onClick={() => { onDelete(); setShowActions(false); }} className="rounded p-1.5 hover:bg-destructive/10 text-destructive" title="Delete">
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {Object.keys(reactionCounts).length > 0 && (
        <div className={cn("mt-0.5 flex flex-wrap gap-0.5 px-1", isOwn ? "justify-end" : "justify-start")}>
          {Object.entries(reactionCounts).map(([emoji, { count, hasOwn }]) => (
            <button
              key={emoji}
              onClick={() => onReact?.(emoji)}
              className={cn(
                "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors hover:bg-muted",
                hasOwn && "border-primary/30 bg-primary/5",
              )}
            >
              {emoji} {count > 1 && <span>{count}</span>}
            </button>
          ))}
        </div>
      )}

      <div className={cn("flex items-center gap-1 px-1 text-[10px] text-muted-foreground mt-0.5", isOwn ? "justify-end" : "justify-start")}>
        <time dateTime={new Date(createdAt).toISOString()}>
          {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </time>
        {edited && <span className="italic">(edited)</span>}
        {status && (
          <span aria-label={`Message ${status.toLowerCase()}`} className={cn(
            status === "Read" ? "text-blue-500" : ""
          )}>
            {status === "Read" ? "✓✓" : status === "Delivered" ? "✓✓" : "✓"}
          </span>
        )}
      </div>
    </li>
  );
}

export { QUICK_REACTIONS };

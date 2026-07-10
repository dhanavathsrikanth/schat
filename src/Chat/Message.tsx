import { cn } from "@/lib/utils";
import { Id } from "../../convex/_generated/dataModel";
import { ReactNode } from "react";

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
  deleted,
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
  deleted?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      className={cn(
        "flex flex-col text-sm",
        author === viewer ? "items-end self-end" : "items-start self-start",
      )}
    >
      <div className="mb-1 text-sm font-medium">{authorName}</div>
      <div
        className={cn(
          "rounded-xl bg-muted px-3 py-2",
          author === viewer ? "rounded-tr-none" : "rounded-tl-none",
        )}
      >
        {deleted ? <span className="italic text-muted-foreground">This message was deleted</span> : children}
        {!deleted && <div className="mt-2 flex gap-1 border-t pt-2 text-xs">
          {"👍 ❤️ 😂".split(" ").map((emoji) => <button key={emoji} type="button" onClick={() => onReact?.(emoji)} className="rounded px-1 hover:bg-background">{emoji}</button>)}
          <button type="button" onClick={onReply} className="ml-1 text-muted-foreground hover:text-foreground">Reply</button>
          {author === viewer && <button type="button" onClick={onDelete} className="text-muted-foreground hover:text-destructive">Delete</button>}
        </div>}
        {reactions.length > 0 && <div className="mt-1 text-xs">{Object.entries(reactions.reduce<Record<string, number>>((all, reaction) => ({ ...all, [reaction.emoji]: (all[reaction.emoji] ?? 0) + 1 }), {})).map(([emoji, count]) => <span key={emoji} className="mr-1 rounded bg-background px-1">{emoji} {count}</span>)}</div>}
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          <time dateTime={new Date(createdAt).toISOString()}>
            {new Date(createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </time>
          {status && <span aria-label={`Message ${status.toLowerCase()}`}>{status === "Read" ? "✓✓" : "✓"}</span>}
        </div>
      </div>
    </li>
  );
}

import { cn } from "@/lib/utils";
import { Id } from "../../convex/_generated/dataModel";
import { ReactNode } from "react";

export function Message({
  author,
  authorName,
  viewer,
  createdAt,
  status,
  children,
}: {
  author: Id<"users">;
  authorName: string;
  viewer: Id<"users">;
  createdAt: number;
  status?: "Sent" | "Delivered" | "Read";
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
        {children}
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

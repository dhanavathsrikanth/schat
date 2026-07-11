import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Input } from "@/components/ui/input";
import { MagnifyingGlassIcon } from "@radix-ui/react-icons";

export function MessageSearch({ viewer }: { viewer: Id<"users"> }) {
  const [query, setQuery] = useState("");
  const results = useQuery(
    api.messages.search,
    query.trim().length >= 2 ? { query: query.trim() } : "skip"
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages…"
          className="pl-9"
        />
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto">
        {query.trim().length < 2 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Type at least 2 characters to search
          </p>
        )}
        {query.trim().length >= 2 && results === undefined && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">Searching…</p>
        )}
        {results && results.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">No results found</p>
        )}
        {results?.map((message) => (
          <div
            key={message._id}
            className="rounded-lg border bg-background p-3 text-sm"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-medium text-xs">{message.author}</span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(message._creationTime).toLocaleDateString()}
              </span>
            </div>
            <p className="line-clamp-2 text-muted-foreground">{message.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

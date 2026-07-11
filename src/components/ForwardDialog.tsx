import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonIcon, GroupIcon } from "@radix-ui/react-icons";

export function ForwardDialog({
  messageId,
  open,
  onClose,
}: {
  messageId: Id<"messages"> | null;
  open: boolean;
  onClose: () => void;
}) {
  const users = useQuery(api.users.list);
  const groups = useQuery(api.groups.list);
  const forwardMessage = useMutation(api.messages.forward);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filteredUsers = users?.filter((u) =>
    u._id !== undefined &&
    `${u.name ?? ""} ${u.email ?? ""} ${u.handle ?? ""}`.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleForward = async (recipientId: Id<"users">) => {
    if (!messageId) return;
    setLoading(true);
    try {
      await forwardMessage({ messageId, recipient: recipientId });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Forward to</DialogTitle>
          <DialogDescription>Select a chat to forward this message to.</DialogDescription>
        </DialogHeader>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or @handle…"
          className="mb-2"
        />
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user._id}
              onClick={() => handleForward(user._id)}
              disabled={loading}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <PersonIcon className="h-4 w-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate">{user.name ?? user.email}</div>
                {user.handle && <div className="text-xs text-muted-foreground">@{user.handle}</div>}
              </div>
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No users found</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

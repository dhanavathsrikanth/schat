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
  DialogTrigger,
} from "@/components/ui/dialog";
import { PersonIcon, CheckIcon } from "@radix-ui/react-icons";

export function CreateGroupDialog({ children }: { children: React.ReactNode }) {
  const users = useQuery(api.users.list);
  const createGroup = useMutation(api.groups.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<Id<"users">>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleMember = (userId: Id<"users">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.size === 0) return;
    setLoading(true);
    setError(null);
    try {
      await createGroup({ name: name.trim(), memberIds: Array.from(selected) });
      setOpen(false);
      setName("");
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
          <DialogDescription>Add members to your new group chat.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Group Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Team"
              maxLength={50}
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Members</label>
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border p-2">
              {users?.filter((u) => u._id !== /* viewer */ undefined).map((user) => (
                <button
                  key={user._id}
                  type="button"
                  onClick={() => toggleMember(user._id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    selected.has(user._id) ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                  }`}
                >
                  <PersonIcon className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{user.name ?? user.email}</div>
                    {user.handle && <div className="truncate text-xs opacity-70">@{user.handle}</div>}
                  </div>
                  {selected.has(user._id) && <CheckIcon className="h-4 w-4" />}
                </button>
              ))}
              {users && users.length <= 1 && (
                <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No other users found. They need to sign up first.
                </p>
              )}
            </div>
            {selected.size > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">{selected.size} member(s) selected</p>
            )}
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            onClick={handleCreate}
            disabled={loading || !name.trim() || selected.size === 0}
          >
            {loading ? "Creating…" : "Create Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

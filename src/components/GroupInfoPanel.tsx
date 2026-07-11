import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PersonIcon, PlusIcon, Cross2Icon, ExitIcon } from "@radix-ui/react-icons";

export function GroupInfoPanel({
  groupId,
  viewer,
  children,
}: {
  groupId: Id<"groups">;
  viewer: Id<"users">;
  children: React.ReactNode;
}) {
  const members = useQuery(api.groups.getMembers, { groupId });
  const groups = useQuery(api.groups.list);
  const addMember = useMutation(api.groups.addMember);
  const removeMember = useMutation(api.groups.removeMember);
  const leaveGroup = useMutation(api.groups.leaveGroup);
  const deleteGroup = useMutation(api.groups.deleteGroup);
  const users = useQuery(api.users.list);
  const [open, setOpen] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const group = groups?.find((g: any) => g._id === groupId) ?? null;
  const myRole = group?.role;
  const isAdmin = myRole === "admin";

  const currentMemberIds = new Set(members?.map((m) => m.userId) ?? []);
  const availableUsers = users?.filter(
    (u) => !currentMemberIds.has(u._id) &&
    `${u.name ?? ""} ${u.email ?? ""} ${u.handle ?? ""}`.toLowerCase().includes(memberSearch.toLowerCase())
  ) ?? [];

  const handleAddMember = async (userId: Id<"users">) => {
    setLoading(true);
    try {
      await addMember({ groupId, userId });
      setShowAddMember(false);
      setMemberSearch("");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (userId: Id<"users">) => {
    setLoading(true);
    try {
      await removeMember({ groupId, userId });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    await leaveGroup({ groupId });
    setOpen(false);
  };

  const handleDelete = async () => {
    await deleteGroup({ groupId });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{group?.name ?? "Group Info"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Members ({members?.length ?? 0})</h3>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                  <PlusIcon className="mr-1 h-3 w-3" /> Add
                </Button>
              )}
            </div>

            {showAddMember && (
              <div className="mb-3 space-y-2">
                <Input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search users…"
                  className="h-8 text-sm"
                />
                <div className="max-h-32 space-y-1 overflow-y-auto rounded border p-1">
                  {availableUsers.map((user) => (
                    <button
                      key={user._id}
                      onClick={() => handleAddMember(user._id)}
                      disabled={loading}
                      className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-muted disabled:opacity-50"
                    >
                      <PersonIcon className="h-3 w-3" />
                      <span className="truncate">{user.name ?? user.email}</span>
                      {user.handle && <span className="text-muted-foreground">@{user.handle}</span>}
                    </button>
                  ))}
                  {availableUsers.length === 0 && (
                    <p className="py-2 text-center text-xs text-muted-foreground">No users available</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1">
              {members?.map((member) => (
                <div key={member.userId} className="flex items-center gap-2 rounded-md px-2 py-1.5">
                  <PersonIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{member.name ?? member.email}</span>
                      {member.role === "admin" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Admin</span>
                      )}
                      {member.userId === viewer && (
                        <span className="text-[10px] text-muted-foreground">(You)</span>
                      )}
                    </div>
                    {member.handle && (
                      <div className="text-xs text-muted-foreground">@{member.handle}</div>
                    )}
                  </div>
                  {isAdmin && member.userId !== viewer && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      onClick={() => handleRemoveMember(member.userId)}
                      disabled={loading}
                    >
                      <Cross2Icon className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" onClick={handleLeave} className="flex-1">
              <ExitIcon className="mr-1 h-3 w-3" /> Leave Group
            </Button>
            {isAdmin && (
              <Button variant="destructive" onClick={handleDelete} className="flex-1">
                Delete Group
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

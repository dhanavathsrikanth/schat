import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function ChatIntro() {
  const user = useQuery(api.users.viewer);
  const users = useQuery(api.users.list);

  return (
    <div className="flex items-start justify-between border-b py-4">
      <div className="container flex flex-col gap-2">
        <h1 className="text-lg font-semibold md:text-2xl">
          {user?.handle ? `Welcome, @${user.handle}` : "s.chat"}
        </h1>
        <p className="hidden sm:block text-sm text-muted-foreground">
          {users && users.length <= 1
            ? "You're the first one here! Share your @username with friends to start chatting."
            : "Select a user or search by @username to start a conversation."
          }
        </p>
      </div>
    </div>
  );
}

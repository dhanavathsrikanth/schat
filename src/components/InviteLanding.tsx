import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { PersonIcon, CheckIcon } from "@radix-ui/react-icons";

export function InviteLanding({ code }: { code: string }) {
  const invite = useQuery(api.invitations.getByCode, { code });
  const claimInvite = useMutation(api.invitations.claim);
  const user = useQuery(api.users.viewer);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!invite) {
    return (
      <div className="container my-auto max-w-md text-center">
        <div className="animate-pulse text-muted-foreground">Loading invite…</div>
      </div>
    );
  }

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);
    try {
      await claimInvite({ code });
      setClaimed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite");
    } finally {
      setClaiming(false);
    }
  };

  if (claimed) {
    return (
      <div className="container my-auto max-w-md text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckIcon className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h2 className="text-xl font-semibold mb-2">You're connected!</h2>
        <p className="text-muted-foreground mb-4">
          You and <strong>@{invite.inviterHandle ?? invite.inviterName}</strong> can now chat privately.
        </p>
        <Button onClick={() => window.location.href = "/"}>
          Start Chatting
        </Button>
      </div>
    );
  }

  return (
    <div className="container my-auto max-w-md text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
        <PersonIcon className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-semibold mb-2">
        {invite.inviterHandle
          ? `@${invite.inviterHandle} invited you`
          : `${invite.inviterName} invited you`}
      </h2>
      <p className="text-muted-foreground mb-6">
        Join s.chat for end-to-end encrypted messaging. Pick your own username and start chatting privately.
      </p>

      {!user && (
        <p className="text-sm text-muted-foreground mb-4">
          Sign in first to accept this invite.
        </p>
      )}

      {user && (
        <>
          <Button onClick={handleClaim} disabled={claiming} size="lg" className="w-full mb-3">
            {claiming ? "Accepting…" : "Accept Invite & Start Chatting"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthActions } from "@convex-dev/auth/react";
import { PersonIcon, CheckIcon } from "@radix-ui/react-icons";

export function InviteLanding({ code }: { code: string }) {
  const invite = useQuery(api.invitations.getByCode, { code });
  const claimInvite = useMutation(api.invitations.claim);
  const user = useQuery(api.users.viewer);
  const { signIn } = useAuthActions();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authFlow, setAuthFlow] = useState<"signIn" | "signUp">("signIn");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
      const msg = err instanceof Error ? err.message : "Failed to accept invite";
      if (msg.includes("own invite")) {
        setError("This is your own invite link! Share it with others to connect.");
      } else {
        setError(msg);
      }
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
        <div className="space-y-3">
          <Button
            onClick={() => void signIn("google", { redirectTo: window.location.href })}
            className="w-full"
            variant="outline"
            size="lg"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim() || !password.trim()) return;
              setAuthLoading(true);
              setAuthError(null);
              const formData = new FormData();
              formData.set("email", email.trim());
              formData.set("password", password.trim());
              formData.set("flow", authFlow);
              formData.set("redirectTo", window.location.href);
              void signIn("password", formData)
                .catch((err) => { setAuthError(err instanceof Error ? err.message : "Failed"); })
                .finally(() => { setAuthLoading(false); });
            }}
            className="flex flex-col gap-3"
          >
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setAuthError(null); }}
              autoComplete="email"
              required
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={authFlow === "signIn" ? "current-password" : "new-password"}
              required
            />
            {authError && <p className="text-xs text-destructive">{authError}</p>}
            <Button type="submit" disabled={authLoading || !email.trim() || !password.trim()} className="w-full">
              {authLoading ? "Please wait…" : authFlow === "signIn" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <Button
            className="p-0 self-start mx-auto"
            variant="link"
            size="sm"
            onClick={() => { setAuthFlow(authFlow === "signIn" ? "signUp" : "signIn"); setAuthError(null); }}
          >
            {authFlow === "signIn" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </Button>
        </div>
      )}

      {user && (
        <>
          <Button onClick={handleClaim} disabled={claiming} size="lg" className="w-full mb-3">
            {claiming ? "Accepting…" : "Accept Invite & Start Chatting"}
          </Button>
          {error && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{error}</p>
              {error.includes("your own invite") && (
                <Button onClick={() => window.location.href = "/"} variant="outline" className="w-full">
                  Go to Chat
                </Button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

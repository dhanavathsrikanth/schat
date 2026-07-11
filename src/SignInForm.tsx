import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("email", email.trim());
      formData.set("password", password.trim());
      formData.set("flow", flow);
      await signIn("password", formData);
      setVerifyEmail(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("code", code.trim());
      formData.set("flow", "email-verification");
      formData.set("email", verifyEmail!);
      await signIn("password", formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  if (verifyEmail) {
    return (
      <div className="container my-auto">
        <div className="max-w-[384px] mx-auto flex flex-col my-auto gap-4 pb-8">
          <h2 className="font-semibold text-2xl tracking-tight">
            Check your email
          </h2>
          <p className="text-sm text-muted-foreground">
            We sent a verification code to <strong>{verifyEmail}</strong>.
          </p>
          <form onSubmit={handleVerifySubmit} className="flex flex-col gap-3">
            <Input
              type="text"
              name="code"
              placeholder="Enter 8-digit code"
              value={code}
              onChange={(e) => { setCode(e.target.value); setError(null); }}
              autoFocus
              required
              maxLength={8}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" disabled={loading || !code.trim()}>
              {loading ? "Verifying…" : "Verify"}
            </Button>
          </form>
          <Button
            className="p-0 self-start"
            variant="link"
            onClick={() => { setVerifyEmail(null); setCode(""); setError(null); }}
          >
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container my-auto">
      <div className="max-w-[384px] mx-auto flex flex-col my-auto gap-4 pb-8">
        <h2 className="font-semibold text-2xl tracking-tight">
          Sign in or create an account
        </h2>
        <p className="text-sm text-muted-foreground">
          End-to-end encrypted messaging. Choose how to sign in.
        </p>

        <Button
          className="flex-1"
          variant="outline"
          type="button"
          onClick={() => void signIn("google")}
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

        <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
          <Input
            type="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null); }}
            autoComplete="email"
            autoFocus
            required
          />
          <Input
            type="password"
            name="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={flow === "signIn" ? "current-password" : "new-password"}
            required
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" disabled={loading || !email.trim() || !password.trim()}>
            {loading ? "Please wait…" : flow === "signIn" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button
          className="p-0 self-start"
          variant="link"
          onClick={() => { setFlow(flow === "signIn" ? "signUp" : "signIn"); setError(null); }}
        >
          {flow === "signIn" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
}

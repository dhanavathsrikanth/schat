import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
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

export function OnboardingDialog() {
  const hasProfile = useQuery(api.users.hasProfile);
  const setHandle = useMutation(api.users.setHandle);
  const [handle, setHandleInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (hasProfile === undefined || hasProfile === true) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await setHandle({ handle: handle.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set username");
    } finally {
      setLoading(false);
    }
  };

  const previewHandle = handle.trim().toLowerCase().replace(/^@/, "");

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Welcome to s.chat!</DialogTitle>
          <DialogDescription>
            Choose your unique @username. Others will use this to find and message you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="onboard-handle" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-lg">@</span>
              <Input
                id="onboard-handle"
                value={handle}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  setError(null);
                }}
                placeholder="yourname"
                maxLength={24}
                autoFocus
              />
            </div>
            {previewHandle && (
              <p className="mt-1 text-xs text-muted-foreground">
                Your username will be: <strong>@{previewHandle}</strong>
              </p>
            )}
            {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading || !handle.trim()}>
              {loading ? "Setting…" : "Get Started"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

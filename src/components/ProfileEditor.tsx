import { useState, useRef } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { PersonIcon } from "@radix-ui/react-icons";

export function ProfileEditor({ children }: { children: React.ReactNode }) {
  const profile = useQuery(api.users.myProfile);
  const updateProfile = useMutation(api.users.updateProfile);
  const setHandle = useMutation(api.users.setHandle);
  const generateUploadUrl = useMutation(api.files.generateAvatarUploadUrl);
  const [open, setOpen] = useState(false);
  const [about, setAbout] = useState("");
  const [handle, setHandleInput] = useState("");
  const [handleError, setHandleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && profile && !initialized) {
      setAbout(profile.about ?? "");
      setHandleInput(profile.handle ?? "");
      setInitialized(true);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setHandleError("Avatar must be under 5 MB");
      return;
    }
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHandleError(null);
    try {
      if (handle.trim() !== profile?.handle) {
        await setHandle({ handle: handle.trim() });
      }
      let avatarUrl = profile?.avatarUrl ?? undefined;
      if (fileInputRef.current?.files?.[0]) {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": fileInputRef.current.files[0].type },
          body: fileInputRef.current.files[0],
        });
        if (response.ok) {
          const { storageId } = await response.json();
          avatarUrl = storageId as string;
        }
      }
      await updateProfile({ about: about.trim() || undefined, avatarUrl });
      setOpen(false);
    } catch (err) {
      setHandleError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>Update your username, avatar, and about info.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-2xl cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
              ) : profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="Avatar" className="h-20 w-20 rounded-full object-cover" />
              ) : (
                <PersonIcon className="h-10 w-10 text-muted-foreground" />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Change Photo
            </Button>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Username</label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">@</span>
              <Input
                value={handle}
                onChange={(e) => {
                  setHandleInput(e.target.value);
                  setHandleError(null);
                }}
                placeholder="yourname"
                maxLength={24}
              />
            </div>
            {handleError && <p className="mt-1 text-xs text-destructive">{handleError}</p>}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">About</label>
            <Input
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Tell us about yourself"
              maxLength={200}
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

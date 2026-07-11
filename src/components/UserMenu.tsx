import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthActions } from "@convex-dev/auth/react";
import { PersonIcon, BellIcon, Share1Icon } from "@radix-ui/react-icons";
import { ReactNode, useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { ProfileEditor } from "@/components/ProfileEditor";
import { ShareDialog } from "@/components/ShareDialog";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export function UserMenu({ children }: { children: ReactNode }) {
  const { subscribe, unsubscribe } = usePushNotifications();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const createInvite = useMutation(api.invitations.create);

  const handleShare = async () => {
    const code = await createInvite({});
    setInviteCode(code?.code ?? null);
    setShareOpen(true);
  };

  return (
    <div className="flex items-center gap-2 text-sm font-medium">
      {children}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full">
            <PersonIcon className="h-5 w-5" />
            <span className="sr-only">Toggle user menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{children}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ProfileEditor>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit Profile
            </DropdownMenuItem>
          </ProfileEditor>
          <DropdownMenuItem onClick={() => void handleShare()}>
            <Share1Icon className="mr-2 h-4 w-4" /> Invite Friends
          </DropdownMenuItem>
          <DropdownMenuItem onClick={async () => {
            if (pushEnabled) { await unsubscribe(); setPushEnabled(false); }
            else { await subscribe(); setPushEnabled(true); }
          }}>
            <BellIcon className="mr-2 h-4 w-4" />
            {pushEnabled ? "Disable Notifications" : "Enable Notifications"}
          </DropdownMenuItem>
          <DropdownMenuLabel className="flex items-center gap-2 py-0 font-normal">
            Theme
            <ThemeToggle />
          </DropdownMenuLabel>
          <SignOutButton />
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareDialog
        open={shareOpen}
        onClose={() => { setShareOpen(false); setInviteCode(null); }}
        inviteCode={inviteCode}
        inviterHandle={null}
      />
    </div>
  );
}

function SignOutButton() {
  const { signOut } = useAuthActions();
  return <DropdownMenuItem onClick={() => void signOut()}>Sign out</DropdownMenuItem>;
}

import { MultiChat } from "@/Chat/Chat";
import { ChatIntro } from "@/Chat/ChatIntro";
import { Layout } from "@/Layout";
import { SignInForm } from "@/SignInForm";
import { UserMenu } from "@/components/UserMenu";
import { OnboardingDialog } from "@/Onboarding/OnboardingDialog";
import { InviteLanding } from "@/components/InviteLanding";
import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";

export default function App() {
  const user = useQuery(api.users.viewer);
  const [initialHandle, setInitialHandle] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handle = params.get("handle");
    const invite = params.get("invite");
    if (invite) {
      setInviteCode(invite);
      window.history.replaceState({}, "", window.location.pathname);
    } else if (handle) {
      setInitialHandle(handle);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <Layout
      menu={
        <Authenticated>
          <UserMenu>{user?.handle ? `@${user.handle}` : user?.name ?? user?.email}</UserMenu>
        </Authenticated>
      }
    >
      <>
        {inviteCode ? (
          <InviteLanding code={inviteCode} />
        ) : (
          <>
            <Authenticated>
              <OnboardingDialog />
              <ChatIntro />
              {user ? <MultiChat viewer={user._id} initialHandle={initialHandle} /> : null}
            </Authenticated>
            <Unauthenticated>
              <SignInForm />
            </Unauthenticated>
          </>
        )}
      </>
    </Layout>
  );
}

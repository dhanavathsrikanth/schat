import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ExternalLinkIcon,
  PersonIcon,
  LockClosedIcon,
  ChatBubbleIcon,
} from "@radix-ui/react-icons";
import { ReactNode } from "react";

export function GetStartedDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[calc(100vh-8rem)] grid-rows-[1fr_auto]">
        <DialogHeader>
          <DialogTitle>Welcome to s.chat</DialogTitle>
        </DialogHeader>
        <GetStartedContent />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Got it</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GetStartedContent() {
  return (
    <div className="overflow-y-auto">
      <p className="text-muted-foreground mb-4">
        End-to-end encrypted messaging. Only you and the recipient can read your messages.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 text-base">
              <PersonIcon /> Choose a Username
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            On your first login, pick a unique @username. Others will use it to find and message you.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 text-base">
              <ChatBubbleIcon /> Start a Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Search for someone by their @username in the sidebar, then start messaging them directly.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 text-base">
              <LockClosedIcon /> E2E Encryption
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every message is encrypted with a unique key. Not even s.chat can read your messages.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex gap-2 text-base">
              🎙️ Voice Notes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Tap the microphone icon to record and send encrypted voice notes.
          </CardContent>
        </Card>
      </div>
      <div>
        <h2 className="mt-6 mb-3 font-semibold">Tips</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Messages can be set to auto-expire (1 day or 7 days)</li>
          <li>• Create group chats with multiple people</li>
          <li>• Add contacts to find people faster</li>
          <li>• Share your profile link: your app URL + /u/yourhandle</li>
          <li>• Enable push notifications to never miss a message</li>
        </ul>
      </div>
    </div>
  );
}

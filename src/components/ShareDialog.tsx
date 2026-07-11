import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CopyIcon,
  CheckIcon,
  PersonIcon,
  Share1Icon,
  LightningBoltIcon,
} from "@radix-ui/react-icons";

const SHARE_PLATFORMS = [
  {
    name: "WhatsApp",
    icon: "💬",
    color: "bg-green-500/10 hover:bg-green-500/20 text-green-600",
    getUrl: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(text + "\n\n" + url)}`,
  },
  {
    name: "Telegram",
    icon: "✈️",
    color: "bg-blue-500/10 hover:bg-blue-500/20 text-blue-600",
    getUrl: (url: string, text: string) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    name: "Twitter / X",
    icon: "𝕏",
    color: "bg-black/5 hover:bg-black/10",
    getUrl: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: "SMS",
    icon: "💬",
    color: "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600",
    getUrl: (url: string, text: string) =>
      `sms:?body=${encodeURIComponent(text + "\n" + url)}`,
  },
  {
    name: "Email",
    icon: "✉️",
    color: "bg-orange-500/10 hover:bg-orange-500/20 text-orange-600",
    getUrl: (url: string, text: string, subject: string) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text + "\n\n" + url)}`,
  },
  {
    name: "LinkedIn",
    icon: "in",
    color: "bg-blue-600/10 hover:bg-blue-600/20 text-blue-700",
    getUrl: (url: string) =>
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
  {
    name: "Reddit",
    icon: "⬆️",
    color: "bg-orange-600/10 hover:bg-orange-600/20 text-orange-600",
    getUrl: (url: string, text: string) =>
      `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(text)}`,
  },
  {
    name: "Facebook",
    icon: "f",
    color: "bg-blue-700/10 hover:bg-blue-700/20 text-blue-800",
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
];

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  inviteCode: string | null;
  inviterHandle: string | null;
  searchHandle?: string | null;
}

function QRCode({ value, size = 160 }: { value: string; size?: number }) {
  const [svg, setSvg] = useState<string>("");
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const modules = generateQRMatrix(value);
    const moduleCount = modules.length;
    const cellSize = size / moduleCount;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";

    for (let r = 0; r < moduleCount; r++) {
      for (let c = 0; c < moduleCount; c++) {
        if (modules[r][c]) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }

    setSvg(canvas.toDataURL("image/png"));
  }, [value, size]);

  if (!svg) return null;
  return <img src={svg} alt="QR Code" width={size} height={size} className="rounded-lg" />;
}

function generateQRMatrix(text: string): boolean[][] {
  const len = text.length;
  const size = Math.max(21, Math.min(41, 21 + Math.ceil(len / 30) * 4));
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
        matrix[i][j] = true;
        matrix[size - 1 - i][j] = true;
        matrix[i][size - 1 - j] = true;
      }
    }
  }

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
  }
  for (let j = 8; j < size - 8; j++) {
    matrix[j][6] = j % 2 === 0;
  }

  let idx = 0;
  for (let right = size - 1; right >= 0; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < size; vert++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = right - dx;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (x >= 0 && x < size && y >= 0 && y < size && !matrix[y][x] &&
          !isReserved(x, y, size)) {
          matrix[y][x] = ((idx + text.charCodeAt(idx % len)) % 3) !== 0;
          idx++;
        }
      }
    }
  }

  return matrix;
}

function isReserved(x: number, y: number, size: number): boolean {
  if (x < 9 && y < 9) return true;
  if (x >= size - 8 && y < 9) return true;
  if (x < 9 && y >= size - 8) return true;
  if (x === 6 || y === 6) return true;
  return false;
}

export function ShareDialog({ open, onClose, inviteCode, inviterHandle, searchHandle }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const inviteUrl = inviteCode ? `${baseUrl}/invite?code=${inviteCode}` : "";
  const shareText = inviterHandle
    ? `Join me on s.chat! I'm @${inviterHandle}. End-to-end encrypted messaging.`
    : "Join me on s.chat! End-to-end encrypted messaging.";
  const shareSubject = "Join s.chat";

  const hasNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const handleNativeShare = async () => {
    if (!hasNativeShare) return;
    try {
      await navigator.share({
        title: "Join s.chat",
        text: shareText,
        url: inviteUrl,
      });
    } catch {}
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share1Icon className="h-5 w-5" />
            {searchHandle ? `Invite @${searchHandle}` : "Share s.chat"}
          </DialogTitle>
          <DialogDescription>
            {searchHandle
              ? `@${searchHandle} isn't on s.chat yet. Invite them!`
              : "Share this link with friends to start chatting."}
          </DialogDescription>
        </DialogHeader>

        {inviteCode && (
          <div className="space-y-4">
            {/* Invite link */}
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
              <LightningBoltIcon className="h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 break-all text-sm font-mono text-muted-foreground">
                {inviteUrl}
              </span>
              <Button size="sm" variant="ghost" className="h-7 shrink-0 px-2" onClick={handleCopyLink}>
                {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-500" /> : <CopyIcon className="h-3.5 w-3.5" />}
              </Button>
            </div>

            {/* Native share — the big primary button */}
            {hasNativeShare && (
              <Button onClick={handleNativeShare} className="w-full" size="lg">
                <Share1Icon className="mr-2 h-4 w-4" /> Share via device
              </Button>
            )}

            {/* QR Code */}
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQR(!showQR)}
                className="text-xs"
              >
                {showQR ? "Hide QR Code" : "Show QR Code"}
              </Button>
              {showQR && (
                <div className="rounded-xl border bg-white p-3">
                  <QRCode value={inviteUrl} size={160} />
                </div>
              )}
            </div>

            {/* Platform sharing buttons */}
            {!hasNativeShare && (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Share via
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {SHARE_PLATFORMS.map((platform) => (
                    <a
                      key={platform.name}
                      href={platform.getUrl(inviteUrl, shareText, shareSubject)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors ${platform.color}`}
                    >
                      <span className="text-lg leading-none">{platform.icon}</span>
                      <span className="text-[10px] font-medium leading-tight">{platform.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {searchHandle && (
              <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
                <div className="flex items-start gap-2">
                  <PersonIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-0.5">
                      Invite <strong>@{searchHandle}</strong> to s.chat
                    </p>
                    <p>
                      Share this link with them. When they sign up, they'll pick their own username
                      and appear in your chat list.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

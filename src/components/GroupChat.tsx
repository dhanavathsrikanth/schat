"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useRef, useState, useEffect } from "react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useKeyPair } from "@/Chat/keyExchange";
import { MessageList, formatDateSeparator, getDateKey } from "@/Chat/MessageList";
import { Message } from "@/Chat/Message";
import { GroupInfoPanel } from "@/components/GroupInfoPanel";
import { PersonIcon, ArrowLeftIcon, DotsVerticalIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { ForwardDialog } from "@/components/ForwardDialog";
import { EmojiPicker } from "@/components/EmojiPicker";

export function GroupChat({
  groupId, viewer, onBack,
}: {
  groupId: Id<"groups">; viewer: Id<"users">; onBack?: () => void;
}) {
  const group = useQuery(api.groups.list)?.find((g) => g._id === groupId);
  const messages = useQuery(api.groups.listMessages, { groupId });
  const sendMessage = useMutation(api.groups.sendMessage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const toggleReaction = useMutation(api.groups.toggleReaction);
  const deleteMessage = useMutation(api.groups.deleteMessage);
  const markGroupRead = useMutation(api.groups.markGroupRead);
  const { keyPair, deriveSharedSecret } = useKeyPair();
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: Id<"groupMessages">; body: string; author: string } | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (group) void markGroupRead({ groupId });
  }, [group, markGroupRead, groupId]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  useEffect(() => {
    if (!group || !deriveSharedSecret || !keyPair) return;
    const otherMember = group.members?.find((m) => m.userId !== viewer);
    if (!otherMember) return;
    void (async () => {
      try {
        const key = await deriveSharedSecret((otherMember as any).key ?? "");
        if (key) setAesKey(key);
      } catch {}
    })();
  }, [group, deriveSharedSecret, keyPair, viewer]);

  const mentionMembers = group?.members?.filter(
    (m) => m.userId !== viewer && `${m.handle ?? ""} ${m.name ?? ""}`.toLowerCase().includes(mentionSearch.toLowerCase())
  ) ?? [];

  const filteredMessages = messages?.filter((m) => {
    if (!searchQuery.trim()) return true;
    return m.body.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleMention = (member: any) => {
    setNewMessage((t) => t + `@${member.handle ?? member.name} `);
    setShowMentions(false);
    setMentionSearch("");
    inputRef.current?.focus();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = () => {
        setAudioBlob(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      setIsRecording(true);
    } catch {
      setSendError("Microphone access denied");
    }
  };

  const sendVoiceNote = async () => {
    if (!audioBlob) return;
    setIsSending(true);
    try {
      const data = await audioBlob.arrayBuffer();
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "audio/webm" }, body: audioBlob });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = await response.json();
      await sendMessage({ groupId, body: "[Voice Note]", attachment: { storageId, name: "voice.webm", contentType: "audio/webm", size: audioBlob.size }, isVoiceNote: true });
      setAudioBlob(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;
    setIsSending(true);
    setSendError(null);
    try {
      let uploadedAttachment;
      if (attachment) {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": attachment.type }, body: attachment });
        if (!response.ok) throw new Error("Upload failed");
        const { storageId } = await response.json();
        uploadedAttachment = { storageId, name: attachment.name, contentType: attachment.type || "application/octet-stream", size: attachment.size };
      }
      await sendMessage({
        groupId, body: newMessage, attachment: uploadedAttachment,
        replyTo: replyTo?.id, expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
      });
      setNewMessage(""); setAttachment(null); setReplyTo(null);
      void markGroupRead({ groupId });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "@" && !e.shiftKey) {
      setShowMentions(true);
      setMentionSearch("");
    }
    if (e.key === "Escape") setShowMentions(false);
  };

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 sm:px-5 py-2 bg-background">
        <div className="flex items-center gap-2 min-w-0">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:hidden" onClick={onBack}>
              <ArrowLeftIcon className="h-4 w-4" />
            </Button>
          )}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
            <span className="text-sm">👥</span>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{group?.name ?? "Loading…"}</div>
            <div className="text-[11px] text-muted-foreground">{group?.memberCount ?? 0} members</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowSearch(!showSearch)}>
            <MagnifyingGlassIcon className="h-4 w-4" />
          </Button>
          <div className="relative" ref={menuRef}>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMenu(!showMenu)}>
              <DotsVerticalIcon className="h-4 w-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border bg-background p-1 shadow-lg">
                <select
                  value={expiresIn}
                  onChange={(e) => { setExpiresIn(Number(e.target.value)); setShowMenu(false); }}
                  className="w-full rounded-md px-2 py-1.5 text-sm hover:bg-muted cursor-pointer"
                >
                  <option value={0}>Keep messages</option>
                  <option value={86400000}>Disappear in 1 day</option>
                  <option value={604800000}>Disappear in 7 days</option>
                </select>
              </div>
            )}
          </div>
          <GroupInfoPanel groupId={groupId} viewer={viewer}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <PersonIcon className="h-4 w-4" />
            </Button>
          </GroupInfoPanel>
        </div>
      </div>

      {showSearch && (
        <div className="border-b px-4 py-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search in group…" className="h-8 pl-9 text-sm" autoFocus />
          </div>
        </div>
      )}

      <MessageList>
        {filteredMessages?.map((message, i) => {
          const prevMsg = filteredMessages[i - 1];
          const showDate = !prevMsg || getDateKey(prevMsg._creationTime) !== getDateKey(message._creationTime);
          const showAuthor = !prevMsg || prevMsg.userId !== message.userId;
          return (
            <div key={message._id}>
              {showDate && (
                <li className="flex justify-center py-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">{formatDateSeparator(message._creationTime)}</span>
                </li>
              )}
              <GroupMessageItem
                message={message}
                viewer={viewer}
                onReact={(emoji) => void toggleReaction({ messageId: message._id, emoji })}
                onDelete={() => void deleteMessage({ messageId: message._id })}
                onReply={() => { setReplyTo({ id: message._id, body: message.body, author: message.author }); inputRef.current?.focus(); }}
                showAuthor={showAuthor}
              />
            </div>
          );
        })}
      </MessageList>

      {replyTo && (
        <div className="flex items-center gap-2 border-t bg-muted/50 px-4 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <div className="text-[11px] font-medium text-primary">{replyTo.author}</div>
            <div className="truncate text-xs text-muted-foreground">{replyTo.body || "[encrypted]"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      )}

      {/* @mention dropdown */}
      {showMentions && mentionMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 z-20 mb-1 max-h-40 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {mentionMembers.map((m) => (
            <button key={m.userId} onClick={() => handleMention(m)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <PersonIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{m.name ?? m.email}</span>
              {m.handle && <span className="text-xs text-muted-foreground">@{m.handle}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="border-t bg-background">
        {sendError && <div className="px-4 pt-2 text-xs text-destructive">{sendError}</div>}
        {audioBlob ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-8" />
            <Button size="sm" onClick={sendVoiceNote} disabled={isSending} className="h-8">{isSending ? "Sending…" : "Send"}</Button>
            <Button size="sm" variant="ghost" onClick={() => setAudioBlob(null)} className="h-8">Cancel</Button>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-destructive"><span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording…</span>
            <Button size="sm" variant="outline" onClick={() => { mediaRecorderRef.current?.stop(); setIsRecording(false); }} className="h-8">Stop</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 px-2 sm:px-4 py-2">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0]; if (!file) return;
                const max = file.type.startsWith("video/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
                if (file.size > max) { setSendError("File too large"); return; }
                setAttachment(file);
              }}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()}>📎</Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={startRecording}>🎙️</Button>
            <EmojiPicker onSelect={(emoji) => setNewMessage((t) => t + emoji)}>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">😀</Button>
            </EmojiPicker>
            <Input ref={inputRef} value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachment ? `📎 ${attachment.name}` : "Type a message… (@ for mentions)"}
              className="h-9 text-sm"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isSending || (!newMessage.trim() && !attachment)}>
              {isSending ? "…" : "➤"}
            </Button>
          </form>
        )}
      </div>
    </>
  );
}

function GroupMessageItem({
  message, viewer, onReact, onDelete, onReply, showAuthor,
}: {
  message: any; viewer: Id<"users">;
  onReact: (emoji: string) => void; onDelete: () => void; onReply: () => void;
  showAuthor: boolean;
}) {
  const isOwn = message.userId === viewer;
  const [hovering, setHovering] = useState(false);
  const [showActions, setShowActions] = useState(false);

  return (
    <li
      className={`group flex flex-col text-sm mb-0.5 ${isOwn ? "items-end self-end" : "items-start self-start"}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setShowActions(false); }}
    >
      {showAuthor && !isOwn && (
        <div className="mb-0.5 px-1 text-xs font-medium text-primary">{message.author}</div>
      )}
      {message.replyTo && (
        <div className={`mb-1 flex items-center gap-2 rounded-lg border-l-2 bg-muted/50 px-2 py-1 text-xs max-w-[280px] ${isOwn ? "border-l-primary/50" : "border-l-muted-foreground/50"}`}>
          <div className="min-w-0">
            <div className="truncate text-muted-foreground">{message.replyPreview || "[encrypted]"}</div>
          </div>
        </div>
      )}
      <div className={`rounded-2xl px-3 py-1.5 max-w-[85vw] sm:max-w-[420px] ${isOwn ? "bg-emerald-600 text-white rounded-br-md" : "bg-muted rounded-bl-md"}`}>
        {message.deletedAt ? (
          <span className="italic opacity-70">This message was deleted</span>
        ) : (
          <>
            {message.isVoiceNote && <div className="mb-1 text-[11px] opacity-70">🎙️ Voice Note</div>}
            <span className="whitespace-pre-wrap break-words">{message.body}</span>
            {message.attachment && message.attachmentUrl && (
              <div className="mt-1">
                {message.attachment.contentType.startsWith("audio/") || message.isVoiceNote ? (
                  <audio src={message.attachmentUrl} controls className="w-full max-w-[200px] h-8" />
                ) : message.attachment.contentType.startsWith("image/") ? (
                  <img src={message.attachmentUrl} alt={message.attachment.name} className="max-h-48 max-w-full rounded-lg object-cover" />
                ) : (
                  <a href={message.attachmentUrl} download={message.attachment.name} className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1 text-xs no-underline hover:bg-white/10">
                    📄 {message.attachment.name}
                  </a>
                )}
              </div>
            )}
          </>
        )}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-60">
          <time>{new Date(message._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
        </div>
      </div>
      {message.reactions?.length > 0 && (
        <div className={`mt-0.5 flex flex-wrap gap-0.5 px-1 ${isOwn ? "justify-end" : "justify-start"}`}>
          {Object.entries(message.reactions.reduce<Record<string, number>>((a, r: any) => ({ ...a, [r.emoji]: (a[r.emoji] ?? 0) + 1 }), {})).map(([emoji, count]) => (
            <span key={emoji} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{emoji} {count > 1 && count}</span>
          ))}
        </div>
      )}
      <div className={`flex items-center gap-1 px-1 text-[10px] text-muted-foreground mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
        {hovering && (
          <div className="flex gap-0.5">
            {["👍", "❤️", "😂"].map((emoji) => (
              <button key={emoji} onClick={() => onReact(emoji)} className="rounded px-0.5 text-xs hover:bg-muted">{emoji}</button>
            ))}
            <button onClick={onReply} className="rounded px-1 text-xs hover:bg-muted">↩</button>
            {isOwn && <button onClick={onDelete} className="rounded px-1 text-xs hover:bg-destructive/10 text-destructive">🗑</button>}
          </div>
        )}
      </div>
    </li>
  );
}

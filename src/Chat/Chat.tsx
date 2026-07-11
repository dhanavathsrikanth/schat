"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { MessageList, formatDateSeparator, getDateKey } from "@/Chat/MessageList";
import { Message } from "@/Chat/Message";
import { Id } from "../../convex/_generated/dataModel";
import { useKeyPair } from "./keyExchange";
import { ProfileEditor } from "@/components/ProfileEditor";
import { PersonIcon, GroupIcon, MagnifyingGlassIcon, ArrowLeftIcon, DotsVerticalIcon, Share1Icon, Pencil1Icon } from "@radix-ui/react-icons";
import { CreateGroupDialog } from "@/components/CreateGroupDialog";
import { GroupChat } from "@/components/GroupChat";

import { MessageSearch } from "@/components/MessageSearch";
import { ForwardDialog } from "@/components/ForwardDialog";
import { EmojiPicker } from "@/components/EmojiPicker";
import { ShareDialog } from "@/components/ShareDialog";

type ViewMode = "chats" | "groups" | "search";

export function MultiChat({ viewer, initialHandle }: { viewer: Id<"users">; initialHandle?: string | null }) {
  const [recipient, setRecipient] = useState<Id<"users">>(viewer);
  const [viewMode, setViewMode] = useState<ViewMode>("chats");
  const [search, setSearch] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const conversations = useQuery(api.messages.conversations);
  const groupConversations = useQuery(api.groups.conversations);
  const searchResults = useQuery(
    api.users.searchByHandle,
    search.length >= 2 ? { query: search } : "skip"
  );
  const linkedUser = useQuery(
    api.users.getByHandle,
    initialHandle ? { handle: initialHandle } : "skip"
  );
  const heartbeat = useMutation(api.users.heartbeat);
  const createInvite = useMutation(api.invitations.create);
  const [selectedGroup, setSelectedGroup] = useState<Id<"groups"> | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [inviteHandle, setInviteHandle] = useState<string | null>(null);

  useEffect(() => {
    void heartbeat({ isOnline: true });
    const interval = window.setInterval(() => void heartbeat({ isOnline: true }), 5 * 60_000);
    const offline = () => void heartbeat({ isOnline: false });
    window.addEventListener("beforeunload", offline);
    return () => { window.clearInterval(interval); window.removeEventListener("beforeunload", offline); };
  }, [heartbeat]);

  useEffect(() => {
    if (linkedUser) {
      setRecipient(linkedUser._id);
      setSelectedGroup(null);
      setViewMode("chats");
      setMobileShowChat(true);
    }
  }, [linkedUser]);

  const handleSelectUser = (userId: Id<"users">) => {
    setRecipient(userId);
    setSelectedGroup(null);
    setViewMode("chats");
    setSearch("");
    setMobileShowChat(true);
  };

  const handleSelectGroup = (groupId: Id<"groups">) => {
    setSelectedGroup(groupId);
    setMobileShowChat(true);
  };

  const allChats = [
    ...(conversations ?? []).map((c) => ({
      type: "dm" as const,
      id: c.userId,
      name: c.name,
      handle: c.handle,
      avatarUrl: c.avatarUrl,
      isOnline: c.isOnline,
      lastMessage: c.lastMessage,
      lastMessageTime: c.lastMessageTime,
      unreadCount: c.unreadCount,
    })),
    ...(groupConversations ?? []).map((g) => ({
      type: "group" as const,
      id: g.groupId,
      name: g.name,
      handle: null,
      avatarUrl: null,
      isOnline: false,
      lastMessage: g.lastMessage,
      lastMessageTime: g.lastMessageTime,
      unreadCount: g.unreadCount,
    })),
  ].sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  const displayChats = search.trim().length >= 2 && searchResults
    ? searchResults.map((u) => ({
        type: "dm" as const,
        id: u._id,
        name: u.name ?? u.email ?? "Unknown",
        handle: u.handle,
        avatarUrl: u.avatarUrl,
        isOnline: u.isOnline,
        lastMessage: "",
        lastMessageTime: 0,
        unreadCount: 0,
      }))
    : allChats;

  return (
    <div className="flex flex-row flex-grow overflow-hidden h-full">
      {/* Sidebar */}
      <aside className={`
        flex w-full sm:w-80 shrink-0 flex-col border-r bg-muted/10
        ${mobileShowChat ? "hidden sm:flex" : "flex"}
      `}>
        <div className="flex items-center justify-between border-b p-3">
          <h2 className="font-semibold text-base">s.chat</h2>
          <div className="flex items-center gap-1">
            <ProfileEditor>
              <Button size="icon" variant="ghost" className="rounded-full h-8 w-8">
                <PersonIcon className="h-4 w-4" />
              </Button>
            </ProfileEditor>
          </div>
        </div>

        <div className="flex border-b">
          {(["chats", "groups", "search"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => { setViewMode(mode); setSelectedGroup(null); }}
              className={`flex-1 px-3 py-2.5 text-xs font-medium capitalize transition-colors ${
                viewMode === mode ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {viewMode !== "search" && (
          <div className="p-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-9"
            />
          </div>
        )}

        {viewMode === "groups" && (
          <div className="px-2 pb-2">
            <CreateGroupDialog>
              <Button size="sm" variant="outline" className="w-full h-9">
                <span className="mr-1">+</span> New Group
              </Button>
            </CreateGroupDialog>
          </div>
        )}

        <div className="flex flex-col overflow-y-auto">
          {viewMode === "search" ? (
            <div className="p-3"><MessageSearch viewer={viewer} /></div>
          ) : (
            <>
              {displayChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => chat.type === "group" ? handleSelectGroup(chat.id) : handleSelectUser(chat.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-border/50 ${
                    (chat.type === "dm" && chat.id === recipient && !selectedGroup && viewMode === "chats") ||
                    (chat.type === "group" && chat.id === selectedGroup)
                      ? "bg-primary/10"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="relative h-10 w-10 shrink-0">
                    {chat.avatarUrl ? (
                      <img src={chat.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        {chat.type === "group" ? (
                          <GroupIcon className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <PersonIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    {chat.type === "dm" && chat.isOnline && (
                      <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-emerald-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate font-medium text-sm">
                        {chat.name}
                      </span>
                      {chat.lastMessageTime > 0 && (
                        <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                          {formatTime(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs text-muted-foreground max-w-[180px]">
                        {chat.handle && viewMode === "chats" && search.length < 2 ? `@${chat.handle}` : ""}
                        {!chat.handle && chat.lastMessage ? decryptPreview(chat.lastMessage) : ""}
                        {!chat.handle && !chat.lastMessage && chat.type === "dm" && (
                          <span className="text-muted-foreground/50">Start a conversation</span>
                        )}
                      </span>
                      {chat.unreadCount > 0 && (
                        <span className="ml-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                          {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}

              {/* Invite card when searching and no results */}
              {search.trim().length >= 2 && searchResults && searchResults.length === 0 && (
                <div className="border-b border-border/50 p-3">
                  <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-center">
                    <PersonIcon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium mb-1">
                      @{search.trim().replace(/^@/, "")} isn't on s.chat
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Send them an invite to get started
                    </p>
                    <Button
                      size="sm"
                      onClick={async () => {
                        const handle = search.trim().replace(/^@/, "");
                        const code = await createInvite({});
                        setInviteCode(code?.code ?? null);
                        setInviteHandle(handle);
                        setShareOpen(true);
                      }}
                    >
                      <Share1Icon className="mr-1.5 h-3.5 w-3.5" /> Invite @{search.trim().replace(/^@/, "")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div className={`flex flex-col flex-grow ${!mobileShowChat ? "hidden sm:flex" : "flex"}`}>
        {selectedGroup ? (
          <GroupChat groupId={selectedGroup} viewer={viewer} onBack={() => setMobileShowChat(false)} />
        ) : (
          <Chat key={recipient} viewer={viewer} recipient={recipient} onBack={() => setMobileShowChat(false)} />
        )}
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => { setShareOpen(false); setInviteCode(null); setInviteHandle(null); }}
        inviteCode={inviteCode}
        inviterHandle={conversations?.[0]?.handle ?? null}
        searchHandle={inviteHandle}
      />
    </div>
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function decryptPreview(body: string): string {
  try {
    atob(body);
    return "📎 Attachment";
  } catch {
    return body.length > 40 ? body.slice(0, 40) + "…" : body;
  }
}

export function Chat({
  viewer,
  recipient,
  onBack,
}: {
  viewer: Id<"users">;
  recipient: Id<"users">;
  onBack?: () => void;
}) {
  const recipientUser = useQuery(api.users.list)?.find((u) => u._id === recipient);
  const recipientKey = useQuery(api.users.getPublicKey, { userId: recipient });
  const { deriveSharedSecret } = useKeyPair();
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);

  useEffect(() => {
    void (async () => {
      if (deriveSharedSecret && recipientKey) {
        const key = await deriveSharedSecret(recipientKey);
        if (key) setAesKey(key);
      }
    })();
  }, [deriveSharedSecret, recipientKey]);

  if (!aesKey) {
    return <div className="flex items-center justify-center flex-grow text-muted-foreground">Generating encryption key…</div>;
  }

  return (
    <EncryptedChat
      viewer={viewer}
      recipient={recipient}
      aesKey={aesKey}
      recipientUser={recipientUser}
      onBack={onBack}
    />
  );
}

export function EncryptedChat({
  viewer,
  recipient,
  aesKey,
  recipientUser,
  onBack,
}: {
  viewer: Id<"users">;
  recipient: Id<"users">;
  aesKey: CryptoKey;
  recipientUser?: { name?: string | null; email?: string | null; handle?: string | null; avatarUrl?: string | null; isOnline?: boolean };
  onBack?: () => void;
}) {
  const [newMessageText, setNewMessageText] = useState("");
  const messages = useQuery(api.messages.list, { recipient });
  const sendMessage = useMutation(api.messages.send);
  const editMessage = useMutation(api.messages.edit);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const markRead = useMutation(api.messages.markRead);
  const setTyping = useMutation(api.users.setTyping);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const deleteMessage = useMutation(api.messages.remove);
  const toggleBlock = useMutation(api.users.toggleBlock);
  const blocked = useQuery(api.users.blocked, { userId: recipient });
  const isTyping = useQuery(api.users.isTyping, { userId: recipient });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(0);
  const [replyTo, setReplyTo] = useState<{ id: Id<"messages">; body: string; author: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<Id<"messages"> | null>(null);
  const [editText, setEditText] = useState("");
  const [forwardMessageId, setForwardMessageId] = useState<Id<"messages"> | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages && recipient !== viewer) void markRead({ sender: recipient });
  }, [messages, markRead, recipient, viewer]);

  useEffect(() => {
    const newest = messages?.at(-1);
    if (!newest || newest.userId === viewer) return;
    if (document.visibilityState !== "visible" && Notification.permission === "granted") {
      new Notification("New message", { body: "You received an encrypted message" });
    }
  }, [messages, viewer]);

  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMenu]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        setAudioBlob(new Blob(audioChunksRef.current, { type: "audio/webm" }));
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      setSendError("Microphone access denied");
    }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); setIsRecording(false); };

  const sendVoiceNote = async () => {
    if (!audioBlob) return;
    setIsSending(true);
    try {
      const encryptedFile = await encryptFile(new File([audioBlob], "voice.webm", { type: "audio/webm" }), aesKey);
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: encryptedFile });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = await response.json();
      await sendMessage({ body: await encryptString("[Voice Note]", aesKey), recipient, attachment: { storageId, name: "voice.webm", contentType: "audio/webm", size: audioBlob.size }, isVoiceNote: true });
      setAudioBlob(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed");
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void (async () => {
      if (!newMessageText.trim() && !attachment) return;
      setIsSending(true);
      setSendError(null);
      try {
        const encryptedBody = await encryptString(newMessageText, aesKey);
        let uploadedAttachment;
        if (attachment) {
          const uploadUrl = await generateUploadUrl({});
          const encryptedFile = await encryptFile(attachment, aesKey);
          const response = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "application/octet-stream" }, body: encryptedFile });
          if (!response.ok) throw new Error("Upload failed");
          const { storageId } = await response.json();
          uploadedAttachment = { storageId, name: attachment.name, contentType: attachment.type || "application/octet-stream", size: attachment.size };
        }
        await sendMessage({
          body: encryptedBody, recipient, attachment: uploadedAttachment,
          replyTo: replyTo?.id, expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
        });
        void setTyping({ recipient, isTyping: false });
        setNewMessageText(""); setAttachment(null); setReplyTo(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (err) {
        setSendError(err instanceof Error ? err.message : "Failed to send");
      } finally {
        setIsSending(false);
      }
    })();
  };

  const handleEdit = async () => {
    if (!editingMessage || !editText.trim()) return;
    await editMessage({ messageId: editingMessage, body: await encryptString(editText, aesKey) });
    setEditingMessage(null); setEditText("");
  };

  const handleReply = (msg: any) => {
    setReplyTo({ id: msg._id, body: msg.body, author: msg.author });
    inputRef.current?.focus();
  };

  const filteredMessages = messages?.filter((m) => {
    if (!searchQuery.trim()) return true;
    return m.body.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const displayName = recipientUser?.handle ? `@${recipientUser.handle}` : recipientUser?.name ?? recipientUser?.email ?? "Chat";

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
          <div className="relative h-8 w-8 shrink-0">
            {recipientUser?.avatarUrl ? (
              <img src={recipientUser.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <PersonIcon className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {recipientUser?.isOnline && (
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{displayName}</div>
            <div className="text-[11px] text-muted-foreground">
              {isTyping ? "typing…" : recipientUser?.isOnline ? "online" : ""}
            </div>
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
                <button
                  onClick={() => { void toggleBlock({ userId: recipient }); setShowMenu(false); }}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted text-destructive"
                >
                  {blocked ? "Unblock user" : "Block user"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="border-b px-4 py-2">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in chat…"
              className="h-8 pl-9 text-sm"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Messages */}
      <MessageList>
        {filteredMessages?.map((message, i) => {
          const prevMsg = filteredMessages[i - 1];
          const showDate = !prevMsg || getDateKey(prevMsg._creationTime) !== getDateKey(message._creationTime);
          const showAuthor = !prevMsg || prevMsg.userId !== message.userId;
          return (
            <div key={message._id}>
              {showDate && (
                <li className="flex justify-center py-2">
                  <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
                    {formatDateSeparator(message._creationTime)}
                  </span>
                </li>
              )}
              {editingMessage === message._id ? (
                <li className="flex items-center gap-2 self-center py-2">
                  <Input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleEdit(); if (e.key === "Escape") setEditingMessage(null); }}
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleEdit}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingMessage(null)}>Cancel</Button>
                </li>
              ) : (
                <Message
                  author={message.userId}
                  authorName={message.author}
                  viewer={viewer}
                  createdAt={message._creationTime}
                  status={message.userId === viewer ? (message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent") : undefined}
                  reactions={message.reactions}
                  deleted={!!message.deletedAt}
                  isVoiceNote={message.isVoiceNote}
                  edited={!!message.editedAt}
                  showAuthor={showAuthor}
                  isGroupChat={false}
                  onReact={(emoji) => void toggleReaction({ messageId: message._id, emoji })}
                  onReply={() => handleReply(message)}
                  onDelete={() => void deleteMessage({ messageId: message._id })}
                  onEdit={() => { setEditingMessage(message._id); setEditText(message.body); }}
                  onForward={() => setForwardMessageId(message._id)}
                >
                  <DecryptedMessage encryptedBody={message.body} aesKey={aesKey} />
                  {message.attachment && (
                    <EncryptedAttachment
                      attachment={{ ...message.attachment, url: message.attachmentUrl }}
                      aesKey={aesKey}
                      isVoiceNote={message.isVoiceNote}
                    />
                  )}
                </Message>
              )}
            </div>
          );
        })}
      </MessageList>

      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 border-t bg-muted/50 px-4 py-2">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <div className="text-[11px] font-medium text-primary">{replyTo.author}</div>
            <div className="truncate text-xs text-muted-foreground">{replyTo.body || "[encrypted]"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
        </div>
      )}

      {/* Edit bar */}
      {editingMessage && !replyTo && (
        <div className="flex items-center gap-2 border-t bg-muted/50 px-4 py-2">
          <Pencil1Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Editing message</span>
          <button onClick={() => setEditingMessage(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">✕</button>
        </div>
      )}

      {/* Input */}
      <div className="border-t bg-background">
        {sendError && <div className="px-4 pt-2 text-xs text-destructive">{sendError}</div>}
        {audioBlob ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <audio src={URL.createObjectURL(audioBlob)} controls className="flex-1 h-8" />
            <Button size="sm" onClick={sendVoiceNote} disabled={isSending} className="h-8">
              {isSending ? "Sending…" : "Send"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAudioBlob(null)} className="h-8">Cancel</Button>
          </div>
        ) : isRecording ? (
          <div className="flex items-center gap-2 px-4 py-3">
            <span className="flex items-center gap-2 text-sm text-destructive">
              <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" /> Recording…
            </span>
            <Button size="sm" variant="outline" onClick={stopRecording} className="h-8">Stop</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex items-center gap-1.5 px-2 sm:px-4 py-2">
            <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,audio/*,application/pdf"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0] ?? null;
                if (!file) return;
                const max = file.type.startsWith("video/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
                if (file.size > max) { setSendError("File too large"); return; }
                setAttachment(file);
              }}
            />
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => fileInputRef.current?.click()}>📎</Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={startRecording}>🎙️</Button>
            <EmojiPicker onSelect={(emoji) => setNewMessageText((t) => t + emoji)}>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">😀</Button>
            </EmojiPicker>
            <Input
              ref={inputRef}
              value={newMessageText}
              onChange={(e) => {
                setNewMessageText(e.target.value);
                if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
                if (e.target.value.length > 0) {
                  void setTyping({ recipient, isTyping: true });
                  typingTimeoutRef.current = window.setTimeout(() => void setTyping({ recipient, isTyping: false }), 3000);
                } else void setTyping({ recipient, isTyping: false });
              }}
              placeholder={attachment ? `📎 ${attachment.name}` : "Type a message…"}
              disabled={blocked}
              className="h-9 text-sm"
            />
            <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isSending || (!newMessageText.trim() && !attachment)}>
              {isSending ? "…" : "➤"}
            </Button>
          </form>
        )}
      </div>

      <ForwardDialog messageId={forwardMessageId} open={!!forwardMessageId} onClose={() => setForwardMessageId(null)} />
    </>
  );
}

export function DecryptedMessage({ encryptedBody, aesKey }: { encryptedBody: string; aesKey: CryptoKey }) {
  const [decryptedBody, setDecryptedBody] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        setDecryptedBody(await decryptString(encryptedBody, aesKey));
      } catch (err: any) {
        setError(err.message || "Decryption failed");
      }
    })();
  }, [encryptedBody, aesKey]);
  if (error) return <span className="text-destructive">{error}</span>;
  if (decryptedBody === null) return <span className="opacity-50">Decrypting…</span>;
  if (decryptedBody === "") return null;
  return <span className="whitespace-pre-wrap break-words">{decryptedBody}</span>;
}

function EncryptedAttachment({
  attachment, aesKey, isVoiceNote,
}: {
  attachment: { url: string | null; name: string; contentType: string; size: number };
  aesKey: CryptoKey;
  isVoiceNote?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    void (async () => {
      try {
        if (!attachment.url) throw new Error("Attachment unavailable");
        const encryptedBytes = new Uint8Array(await (await fetch(attachment.url)).arrayBuffer());
        const decryptedBytes = await decryptBytes(encryptedBytes, aesKey);
        const data = new ArrayBuffer(decryptedBytes.byteLength);
        new Uint8Array(data).set(decryptedBytes);
        objectUrl = URL.createObjectURL(new Blob([data], { type: attachment.contentType }));
        setUrl(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Decryption failed");
      }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [aesKey, attachment]);

  if (error) return <p className="mt-1 text-xs text-destructive">{error}</p>;
  if (!url) return <p className="mt-1 text-xs opacity-50">Loading…</p>;

  if (isVoiceNote) return <audio src={url} controls className="mt-1 w-full max-w-[240px] h-8" />;
  if (attachment.contentType.startsWith("image/"))
    return <img src={url} alt={attachment.name} className="mt-1 max-h-60 max-w-full rounded-lg object-cover cursor-pointer" onClick={() => window.open(url, "_blank")} />;
  return (
    <a href={url} download={attachment.name} className="mt-1 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs no-underline hover:bg-white/10">
      <span>📄</span>
      <span className="truncate">{attachment.name}</span>
      <span className="shrink-0 opacity-60">{formatSize(attachment.size)}</span>
    </a>
  );
}

async function encryptString(plaintext: string, aesKey: CryptoKey): Promise<string> {
  const data = new TextEncoder().encode(plaintext);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, data);
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv); result.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...result));
}

async function encryptFile(file: File, aesKey: CryptoKey): Promise<Blob> {
  const data = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, data);
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv); result.set(new Uint8Array(encrypted), iv.length);
  return new Blob([result]);
}

async function decryptBytes(arr: Uint8Array, aesKey: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: arr.slice(0, 12) }, aesKey, arr.slice(12)));
}

async function decryptString(ciphertext: string, aesKey: CryptoKey): Promise<string> {
  const arr = new Uint8Array(atob(ciphertext).split("").map((c) => c.charCodeAt(0)));
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: arr.slice(0, 12) }, aesKey, arr.slice(12)));
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

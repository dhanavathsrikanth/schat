"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { MessageList } from "@/Chat/MessageList";
import { Message } from "@/Chat/Message";
import { Id } from "../../convex/_generated/dataModel";
import { useKeyPair } from "./keyExchange";


export function MultiChat({ viewer }: { viewer: Id<"users"> }) {
  const [recipient, setRecipient] = useState<Id<"users">>(viewer);
  const [search, setSearch] = useState("");
  const users = useQuery(api.users.list);
  const heartbeat = useMutation(api.users.heartbeat);

  useEffect(() => {
    void heartbeat({ isOnline: true });
    const interval = window.setInterval(() => void heartbeat({ isOnline: true }), 30_000);
    const offline = () => void heartbeat({ isOnline: false });
    window.addEventListener("beforeunload", offline);
    return () => { window.clearInterval(interval); window.removeEventListener("beforeunload", offline); };
  }, [heartbeat]);

  return <div className="flex flex-row flex-grow overflow-hidden">
    <aside className="flex w-72 shrink-0 flex-col border-r bg-muted/20 p-3">
      <h2 className="mb-3 font-semibold">Chats</h2>
      <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" className="mb-3" />
      <div className="flex flex-col gap-1 overflow-y-auto">
      {users?.filter((user) => `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(search.toLowerCase())).map((user) => (
        <Button
          key={user._id}
          onClick={() => setRecipient(user._id)}
          className={`justify-start ${recipient === user._id ? "bg-primary" : ""}`}
          disabled={recipient === user._id}
        >
          <span className={`mr-2 h-2 w-2 rounded-full ${user.isOnline ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
          {user.name ?? user.email}
        </Button>
      ))}
      </div>
    </aside>
    <div className="flex flex-col flex-grow">
      <Chat key={recipient} viewer={viewer} recipient={recipient} />
    </div>
  </div>
}

export function Chat(
{
  viewer,
  recipient,
}: {
  viewer: Id<"users">,
  recipient: Id<"users">,
}) {
  const recipientKey = useQuery(api.users.getPublicKey, { userId: recipient });
  const { deriveSharedSecret } = useKeyPair();
  const [ aesKey, setAesKey ] = useState<CryptoKey | null>(null);
  useEffect(() => {
    void (async () => {
      if (deriveSharedSecret && recipientKey) {
        const key = await deriveSharedSecret(recipientKey);
        if (key) {
          setAesKey(key);
        }
      }
    })();
  }, [deriveSharedSecret, recipientKey]);

  if (!aesKey) {
    return <div className="text-gray-500 p-4">Generating AES key…</div>;
  }
  return <EncryptedChat
    viewer={viewer}
    recipient={recipient}
    aesKey={aesKey}
  />;
}

export function EncryptedChat(
  {
    viewer,
    recipient,
    aesKey,
  }: {
    viewer: Id<"users">,
    recipient: Id<"users">,
    aesKey: CryptoKey,
  }) {
  const [newMessageText, setNewMessageText] = useState("");
  const messages = useQuery(api.messages.list, { recipient });
  const sendMessage = useMutation(api.messages.send);
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
  const [replyTo, setReplyTo] = useState<Id<"messages"> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (messages && recipient !== viewer) void markRead({ sender: recipient });
  }, [messages, markRead, recipient, viewer]);

  useEffect(() => {
    const newest = messages?.at(-1);
    if (!newest || newest._id === latestMessageRef.current) return;
    const previous = latestMessageRef.current;
    latestMessageRef.current = newest._id;
    if (previous && newest.userId !== viewer && document.visibilityState !== "visible" && Notification.permission === "granted") {
      new Notification("New message", { body: "You received an encrypted message" });
    }
  }, [messages, viewer]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": "application/octet-stream" },
            body: encryptedFile,
          });
          if (!response.ok) throw new Error("Could not upload the attachment");
          const { storageId } = await response.json();
          uploadedAttachment = {
            storageId,
            name: attachment.name,
            contentType: attachment.type || "application/octet-stream",
            size: attachment.size,
          };
        }
        await sendMessage({ body: encryptedBody, recipient, attachment: uploadedAttachment, replyTo: replyTo ?? undefined, expiresAt: expiresIn ? Date.now() + expiresIn : undefined });
        setNewMessageText("");
        setAttachment(null);
        setReplyTo(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } catch (error) {
        setSendError(error instanceof Error ? error.message : "Message could not be sent. Please try again.");
      } finally {
        setIsSending(false);
      }
    })();
  };

  return (
    <>
      <div className="flex items-center justify-between border-b px-5 py-2 text-sm">
        <span>{isTyping ? "typing…" : "End-to-end encrypted chat"}</span>
        <div className="flex gap-2"><select value={expiresIn} onChange={(event) => setExpiresIn(Number(event.target.value))} className="rounded border bg-background px-2 py-1"><option value={0}>Keep messages</option><option value={86400000}>Disappear in 1 day</option><option value={604800000}>Disappear in 7 days</option></select><Button variant="outline" size="sm" onClick={() => void toggleBlock({ userId: recipient })}>{blocked ? "Unblock" : "Block"}</Button></div>
      </div>
      <MessageList>
        {messages?.map((message) => (
          <Message
            key={message._id}
            author={message.userId}
            authorName={message.author}
            viewer={viewer}
            createdAt={message._creationTime}
            status={message.userId === viewer ? (message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent") : undefined}
            reactions={message.reactions}
            deleted={!!message.deletedAt}
            onReact={(emoji) => void toggleReaction({ messageId: message._id, emoji })}
            onReply={() => setReplyTo(message._id)}
            onDelete={() => void deleteMessage({ messageId: message._id })}
          >
            <DecryptedMessage encryptedBody={message.body} aesKey={aesKey} />
            {message.attachment && <EncryptedAttachment attachment={{ ...message.attachment, url: message.attachmentUrl }} aesKey={aesKey} />}
          </Message>
        ))}
      </MessageList>
      <div className="border-t bg-background">
        {sendError && <div className="container pt-2 text-sm text-destructive">{sendError}</div>}
        <form onSubmit={handleSubmit} className="container flex gap-2 py-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const file = event.target.files?.[0] ?? null;
              const maxSize = file?.type.startsWith("video/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
              if (file && file.size > maxSize) {
                setSendError(file.type.startsWith("video/") ? "Videos are limited to 10 MB." : "Images and PDFs are limited to 25 MB.");
                event.target.value = "";
                return;
              }
              setSendError(null);
              setAttachment(file);
            }}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file">
            📎
          </Button>
          {"Notification" in window && Notification.permission !== "granted" && <Button type="button" variant="outline" onClick={() => void Notification.requestPermission()} aria-label="Enable notifications">🔔</Button>}
          <Input
            value={newMessageText}
            onChange={(event) => { setNewMessageText(event.target.value); void setTyping({ recipient, isTyping: event.target.value.length > 0 }); }}
            placeholder={replyTo ? "Replying to a message…" : attachment ? `Attached: ${attachment.name}` : "Write a message…"}
            disabled={blocked}
          />
          <Button type="submit" disabled={isSending || (!newMessageText.trim() && !attachment)}>
            {isSending ? "Sending…" : "Send"}
          </Button>
        </form>
      </div>
    </>
  );
}

/*
async function logKey(aesKey: CryptoKey) {
  try {
    const exported = await crypto.subtle.exportKey("raw", aesKey);
    const exportedKeyBuffer = new Uint8Array(exported);
    const base64Key = btoa(String.fromCharCode.apply(null, exportedKeyBuffer as any));
    console.log("Exported key (base64):", base64Key);
  } catch (error) {
    console.error("Failed to export key:", error);
  }
}
  */

export function DecryptedMessage({ encryptedBody, aesKey }: { encryptedBody: string, aesKey: CryptoKey }) {
  const [decryptedBody, setDecryptedBody] = useState<string | null>(null);
  const [decryptionError, setDecryptionError] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const decryptedBody = await decryptString(encryptedBody, aesKey);
        setDecryptedBody(decryptedBody);
      } catch (error: any) {
        console.error(`decrypting ${encryptedBody} failed`, error);
        setDecryptionError(error.message || "Decryption failed");
      }
    })();
  }, [encryptedBody, aesKey]);
  if (decryptionError !== null) {
    return <span className="text-error">{decryptionError}</span>;
  }
  return <>{decryptedBody ? <span className="whitespace-pre-wrap">{decryptedBody}</span> : decryptedBody === "" ? null : "Decrypting…"}</>;
}

function EncryptedAttachment({ attachment, aesKey }: { attachment: { url: string | null; name: string; contentType: string; size: number }, aesKey: CryptoKey }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    void (async () => {
      try {
        if (!attachment.url) throw new Error("Attachment is unavailable");
        const encryptedBytes = new Uint8Array(await (await fetch(attachment.url)).arrayBuffer());
        const decryptedBytes = await decryptBytes(encryptedBytes, aesKey);
        const fileData = new ArrayBuffer(decryptedBytes.byteLength);
        new Uint8Array(fileData).set(decryptedBytes);
        objectUrl = URL.createObjectURL(new Blob([fileData], { type: attachment.contentType }));
        setUrl(objectUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not decrypt attachment");
      }
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [aesKey, attachment]);

  if (error) return <p className="mt-2 text-destructive">{error}</p>;
  if (!url) return <p className="mt-2 text-muted-foreground">Decrypting attachment…</p>;
  if (attachment.contentType.startsWith("image/")) {
    return <img src={url} alt={attachment.name} className="mt-2 max-h-72 max-w-full rounded-lg object-cover" />;
  }
  return <a href={url} download={attachment.name} className="mt-2 block rounded-lg border bg-background px-3 py-2 text-primary underline">📄 {attachment.name} ({formatFileSize(attachment.size)})</a>;
}

async function encryptString(plaintext: string, aesKey: CryptoKey): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  const encryptedArray = new Uint8Array(iv.length + encryptedData.byteLength);
  encryptedArray.set(iv);
  encryptedArray.set(new Uint8Array(encryptedData), iv.length);

  return btoa(String.fromCharCode(...encryptedArray));
}

async function encryptFile(file: File, aesKey: CryptoKey): Promise<Blob> {
  const data = await file.arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, data);
  const output = new Uint8Array(iv.length + encryptedData.byteLength);
  output.set(iv);
  output.set(new Uint8Array(encryptedData), iv.length);
  return new Blob([output]);
}

async function decryptBytes(encryptedArray: Uint8Array, aesKey: CryptoKey): Promise<Uint8Array> {
  const iv = encryptedArray.slice(0, 12);
  const encryptedData = encryptedArray.slice(12);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, encryptedData));
}

function formatFileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function decryptString(ciphertext: string, aesKey: CryptoKey): Promise<string> {
  const encryptedArray = new Uint8Array(atob(ciphertext).split('').map(char => char.charCodeAt(0)));
  const iv = encryptedArray.slice(0, 12);
  const encryptedData = encryptedArray.slice(12);

  const decryptedData = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedData
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedData);
}

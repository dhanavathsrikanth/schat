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
  const users = useQuery(api.users.list);

  return <div className="flex flex-row flex-grow overflow-hidden">
    <div className="flex flex-col gap-2 overflow-y-auto scroll-smooth p-1">
      {users?.map((user) => (
        <Button
          key={user._id}
          onClick={() => setRecipient(user._id)}
          className={recipient === user._id ? "bg-primary" : ""}
          disabled={recipient === user._id}
        >
          {user.name ?? user.email}
        </Button>
      ))}
    </div>
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages && recipient !== viewer) void markRead({ sender: recipient });
  }, [messages, markRead, recipient, viewer]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void (async () => {
      if (!newMessageText.trim() && !attachment) return;
      setIsSending(true);
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
        await sendMessage({ body: encryptedBody, recipient, attachment: uploadedAttachment });
        setNewMessageText("");
        setAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsSending(false);
      }
    })();
  };

  return (
    <>
      <MessageList>
        {messages?.map((message) => (
          <Message
            key={message._id}
            author={message.userId}
            authorName={message.author}
            viewer={viewer}
            createdAt={message._creationTime}
            status={message.userId === viewer ? (message.readAt ? "Read" : message.deliveredAt ? "Delivered" : "Sent") : undefined}
          >
            <DecryptedMessage encryptedBody={message.body} aesKey={aesKey} />
            {message.attachment && <EncryptedAttachment attachment={{ ...message.attachment, url: message.attachmentUrl }} aesKey={aesKey} />}
          </Message>
        ))}
      </MessageList>
      <div className="border-t bg-background">
        <form onSubmit={handleSubmit} className="container flex gap-2 py-4">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setAttachment(event.target.files?.[0] ?? null)}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} aria-label="Attach a file">
            📎
          </Button>
          <Input
            value={newMessageText}
            onChange={(event) => setNewMessageText(event.target.value)}
            placeholder={attachment ? `Attached: ${attachment.name}` : "Write a message…"}
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

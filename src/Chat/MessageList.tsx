import { ReactNode, useEffect, useRef } from "react";

function formatDateSeparator(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDate.getTime() === today.getTime()) return "Today";
  if (msgDate.getTime() === yesterday.getTime()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function getDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function MessageList({ children }: { children: ReactNode }) {
  const messageListRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [children]);

  return (
    <ol
      ref={messageListRef}
      className="container flex grow flex-col gap-1 overflow-y-auto scroll-smooth px-4 sm:px-8 py-4"
    >
      {children}
    </ol>
  );
}

export { formatDateSeparator, getDateKey };

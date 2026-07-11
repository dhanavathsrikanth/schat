import { useEffect, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

const VAPID_PUBLIC_KEY = "";

export function usePushNotifications() {
  const subscribePush = useMutation(api.users.subscribePush);
  const unsubscribePush = useMutation(api.users.unsubscribePush);

  const subscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_PUBLIC_KEY) return;
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      });
      const sub = subscription.toJSON();
      if (sub.endpoint && sub.keys) {
        await subscribePush({
          endpoint: sub.endpoint,
          p256dh: sub.keys.p256dh ?? "",
          auth: sub.keys.auth ?? "",
        });
      }
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [subscribePush]);

  const unsubscribe = useCallback(async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await unsubscribePush({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [unsubscribePush]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  return { subscribe, unsubscribe };
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n/client";

interface Props {
  novelId: string;
  initialSubscribed: boolean;
}

export function SubscribeButton({ novelId, initialSubscribed }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const [subscribed, setSubscribed] = useState(initialSubscribed);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch(`/api/library/${novelId}/subscribe`, {
        method: subscribed ? "DELETE" : "POST",
      });

      if (res.ok) {
        setSubscribed(!subscribed);
        router.refresh();
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={
        subscribed
          ? "btn-pill btn-secondary text-sm"
          : "btn-pill btn-primary text-sm"
      }
    >
      {loading
        ? "..."
        : subscribed
          ? t("subscribe.subscribed")
          : t("subscribe.subscribe")}
    </button>
  );
}

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
          ? "btn-pill btn-secondary text-sm min-w-[7rem]"
          : "btn-pill btn-primary text-sm min-w-[7rem]"
      }
    >
      {loading ? (
        <svg className="mx-auto h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : subscribed ? (
        t("subscribe.subscribed")
      ) : (
        t("subscribe.subscribe")
      )}
    </button>
  );
}

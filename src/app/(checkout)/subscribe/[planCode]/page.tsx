import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { startLinePaySubscriptionCheckout } from "@/lib/payments/subscription-checkout";

export default async function SubscribePage({
  params,
}: {
  params: Promise<{ planCode: string }>;
}) {
  const { planCode } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/subscribe/${planCode}`)}`);
  }

  const { paymentUrl } = await startLinePaySubscriptionCheckout({
    userId: session.user.id,
    planCode,
  });

  redirect(paymentUrl);
}

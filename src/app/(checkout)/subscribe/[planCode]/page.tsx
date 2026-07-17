import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NewebPayRedirectForm } from "@/components/payments/newebpay-redirect-form";
import { startSubscriptionCheckout } from "@/lib/subscriptions/create-subscription";

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

  const { gatewayUrl, fields } = await startSubscriptionCheckout({
    userId: session.user.id,
    planCode,
  });

  return <NewebPayRedirectForm gatewayUrl={gatewayUrl} fields={fields} />;
}

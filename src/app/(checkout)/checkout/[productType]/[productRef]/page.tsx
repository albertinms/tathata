import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NewebPayRedirectForm } from "@/components/payments/newebpay-redirect-form";
import { startCheckout } from "@/lib/payments/checkout";

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ productType: string; productRef: string }>;
}) {
  const { productType, productRef } = await params;

  if (productType !== "book_package" && productType !== "course") {
    redirect("/checkout/failed");
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/checkout/${productType}/${productRef}`)}`);
  }

  const { gatewayUrl, fields } = await startCheckout({
    userId: session.user.id,
    productType,
    productRef,
  });

  return <NewebPayRedirectForm gatewayUrl={gatewayUrl} fields={fields} />;
}

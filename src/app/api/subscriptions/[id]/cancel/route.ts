import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  SubscriptionNotCancelableError,
  SubscriptionNotFoundError,
  cancelSubscription,
} from "@/lib/subscriptions/cancel-subscription";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登入" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const subscription = await cancelSubscription({ subscriptionId: id, userId: session.user.id });
    return NextResponse.json(subscription);
  } catch (error) {
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SubscriptionNotCancelableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

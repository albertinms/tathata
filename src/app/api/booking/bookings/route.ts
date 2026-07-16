import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { BookingCapacityFullError, BookingSlotTakenError } from "@/lib/booking/create-booking";
import { startOneToOneBookingCheckout, startWorkshopBookingCheckout } from "@/lib/booking/initiate-payment";
import { getBookingServiceById } from "@/lib/booking/services";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登入" }, { status: 401 });
  }

  const body = (await request.json()) as {
    serviceId?: string;
    startAt?: string;
    sessionId?: string;
    customerNote?: string;
  };
  if (!body.serviceId) {
    return NextResponse.json({ error: "缺少 serviceId" }, { status: 400 });
  }

  const service = await getBookingServiceById(body.serviceId);
  if (!service) {
    return NextResponse.json({ error: "找不到服务" }, { status: 404 });
  }

  try {
    if (service.type === "one_to_one") {
      if (!body.startAt) {
        return NextResponse.json({ error: "one_to_one 预约须带 startAt" }, { status: 400 });
      }
      const result = await startOneToOneBookingCheckout({
        serviceId: body.serviceId,
        userId: session.user.id,
        startAt: new Date(body.startAt),
        customerNote: body.customerNote,
      });
      return NextResponse.json(result);
    }

    if (!body.sessionId) {
      return NextResponse.json({ error: "workshop 预约须带 sessionId" }, { status: 400 });
    }
    const result = await startWorkshopBookingCheckout({
      sessionId: body.sessionId,
      userId: session.user.id,
      customerNote: body.customerNote,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookingSlotTakenError || error instanceof BookingCapacityFullError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

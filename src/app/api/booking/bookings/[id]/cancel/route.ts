import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { BookingNotCancelableError, BookingNotFoundError, cancelBooking } from "@/lib/booking/cancel-booking";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登入" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    const booking = await cancelBooking({ bookingId: id, userId: session.user.id, reason: body.reason });
    return NextResponse.json(booking);
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof BookingNotCancelableError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}

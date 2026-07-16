import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listMyBookings } from "@/lib/booking/my-bookings";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登入" }, { status: 401 });
  }

  const myBookings = await listMyBookings(session.user.id);
  return NextResponse.json(myBookings);
}

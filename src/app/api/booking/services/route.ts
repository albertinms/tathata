import { NextResponse } from "next/server";

import { listActiveBookingServices } from "@/lib/booking/services";

export async function GET() {
  const services = await listActiveBookingServices();
  return NextResponse.json(services);
}

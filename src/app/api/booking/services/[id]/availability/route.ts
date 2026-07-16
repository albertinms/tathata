import { NextResponse, type NextRequest } from "next/server";

import { getOneToOneAvailability, getWorkshopAvailability } from "@/lib/booking/availability";
import { getBookingServiceById } from "@/lib/booking/services";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = await getBookingServiceById(id);
  if (!service) {
    return NextResponse.json({ error: "找不到服务" }, { status: 404 });
  }

  if (service.type === "workshop") {
    const sessions = await getWorkshopAvailability(id);
    return NextResponse.json(sessions);
  }

  const fromDate = request.nextUrl.searchParams.get("from");
  const toDate = request.nextUrl.searchParams.get("to");
  if (!fromDate || !toDate) {
    return NextResponse.json({ error: "one_to_one 服务须带 from／to 查询参数（YYYY-MM-DD）" }, { status: 400 });
  }

  const slots = await getOneToOneAvailability({ serviceId: id, fromDate, toDate });
  return NextResponse.json(slots);
}

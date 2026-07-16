import { eq } from "drizzle-orm";

import { db } from "@db/client";
import { bookingServices } from "@db/schema";

export async function listActiveBookingServices() {
  return db.select().from(bookingServices).where(eq(bookingServices.isActive, true));
}

export async function getBookingServiceById(serviceId: string) {
  const [service] = await db
    .select()
    .from(bookingServices)
    .where(eq(bookingServices.id, serviceId))
    .limit(1);
  return service;
}

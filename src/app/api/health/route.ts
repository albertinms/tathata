import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", db: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", db: "unreachable", message: (error as Error).message },
      { status: 503 },
    );
  }
}

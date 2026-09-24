import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Health check — same { ok } envelope as every other MediKiosk route */
export async function GET() {
  return NextResponse.json({ ok: true, service: "medikiosk", time: new Date().toISOString() });
}

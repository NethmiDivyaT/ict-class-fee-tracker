import { DatabaseConfigError, getStorageInfo } from "@ict/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = await getStorageInfo();
    return Response.json({ ok: true, ...info });
  } catch (error) {
    const message =
      error instanceof DatabaseConfigError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Database unavailable.";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

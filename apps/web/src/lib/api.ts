import type { ActionResult } from "./types";

const API_URL = process.env.API_URL || "http://localhost:4000";

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach the API. Start both apps with npm run dev from the repo root.",
    );
  }

  const data = (await res.json().catch(() => null)) as T | { error?: string } | null;
  if (!res.ok) {
    const message =
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `API request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function apiGetOptional<T>(path: string): Promise<T | undefined> {
  try {
    return await request<T>(path);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function apiMutate(
  path: string,
  method: string,
  body?: unknown,
): Promise<ActionResult> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method,
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as ActionResult | null;
    if (data && typeof data === "object" && "ok" in data) {
      return data;
    }
    if (!res.ok) {
      return { ok: false, error: `API request failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        "Cannot reach the API. Start both apps with npm run dev from the repo root.",
    };
  }
}

import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { ART_CHARACTERS, ART_STYLE, MAX_GENERATIONS_PER_INSTANCE } from "@/lib/art-parts";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { getFalKey } from "@/lib/server/fal-key";

export const maxDuration = 120;

const STEP_TIMEOUT_MS = 50_000;

let used = 0;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout:${label}`)), STEP_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number } | null)?.status;
  if (message.startsWith("timeout:")) return "timeout";
  if (status === 401) return "bad-key";
  if (status === 403 || /balance|exhausted|locked|credit/i.test(message)) return "no-balance";
  if (status === 429) return "rate-limited";
  return "generation-failed";
}

export async function GET() {
  const falKey = await getFalKey();
  return NextResponse.json({
    hasKey: Boolean(falKey),
    keyLength: falKey ? falKey.length : 0,
    keyHasColon: falKey ? falKey.includes(":") : false,
    used,
  });
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) {
    return NextResponse.json({ error: "not-admin" }, { status: 401 });
  }
  const falKey = await getFalKey();
  if (!falKey) {
    return NextResponse.json({ error: "missing-key" }, { status: 503 });
  }
  if (used >= MAX_GENERATIONS_PER_INSTANCE) {
    return NextResponse.json({ error: "limit-reached" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { characterId?: string; partId?: string } | null;
  const character = ART_CHARACTERS.find((c) => c.id === (body?.characterId ?? "xiangyu"));
  const part = character?.parts.find((p) => p.id === body?.partId);
  if (!part) {
    return NextResponse.json({ error: "unknown-part" }, { status: 400 });
  }

  fal.config({ credentials: falKey });
  used += 1;

  try {
    console.log("[v0] art: generating image for", part.id);
    const generated = await withTimeout(
      fal.subscribe("fal-ai/flux/schnell", {
        input: {
          prompt: `${part.prompt}, ${ART_STYLE}`,
          image_size: "square_hd",
          num_inference_steps: 4,
          num_images: 1,
        },
      }),
      "image",
    );
    const sourceUrl = generated.data?.images?.[0]?.url;
    if (!sourceUrl) throw new Error("no-image");
    console.log("[v0] art: image ready, removing background for", part.id);

    let imageUrl = sourceUrl;
    try {
      const cutout = await withTimeout(
        fal.subscribe("fal-ai/imageutils/rembg", {
          input: { image_url: sourceUrl },
        }),
        "rembg",
      );
      imageUrl = cutout.data?.image?.url ?? sourceUrl;
    } catch (rembgError) {
      console.error("[v0] art: background removal failed, using original image", rembgError);
    }

    return NextResponse.json({ partId: part.id, imageUrl });
  } catch (error) {
    console.error("[v0] art: generation failed", error);
    return NextResponse.json({ error: describeError(error) }, { status: 500 });
  }
}

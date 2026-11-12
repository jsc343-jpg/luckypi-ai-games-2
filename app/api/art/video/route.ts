import { NextResponse } from "next/server";
import { fal } from "@fal-ai/client";
import { list, put } from "@vercel/blob";
import { adminEmailFromRequest } from "@/lib/server/admin-session";
import { getFalKey } from "@/lib/server/fal-key";
import {
  KEYFRAME_PROMPT,
  MAX_SUBMITS_PER_INSTANCE,
  VIDEO_MODELS,
  XIANGYU_CLIPS,
  type VideoModelId,
} from "@/lib/art-clips";

export const maxDuration = 120;

const PREFIX = "art/xiangyu/";
let submitted = 0;

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { status?: number } | null)?.status;
  if (status === 401) return "bad-key";
  if (status === 403 || /balance|exhausted|locked|credit/i.test(message)) return "no-balance";
  if (status === 429) return "rate-limited";
  return "generation-failed";
}

function isTrustedImage(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host.endsWith(".public.blob.vercel-storage.com") || host.endsWith(".fal.media");
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  const hasKey = Boolean(await getFalKey());
  const hasBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasBlob) return NextResponse.json({ hasKey, hasBlob, keyframe: null, clips: [] });

  const { blobs } = await list({ prefix: PREFIX });
  const keyframes = blobs.filter((b) => b.pathname.startsWith(`${PREFIX}keyframe-`));
  keyframes.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  const clips = blobs
    .filter((b) => b.pathname.startsWith(`${PREFIX}clips/`))
    .map((b) => {
      const [clipId, model] = b.pathname.replace(`${PREFIX}clips/`, "").split("__");
      return { clipId, model, url: b.url, uploadedAt: b.uploadedAt.toISOString() };
    });
  return NextResponse.json({ hasKey, hasBlob, keyframe: keyframes[0]?.url ?? null, clips, submitted });
}

export async function POST(req: Request) {
  if (!adminEmailFromRequest(req)) return fail("not-admin", 401);
  const falKey = await getFalKey();
  if (!falKey) return fail("missing-key", 503);
  if (!process.env.BLOB_READ_WRITE_TOKEN) return fail("missing-blob", 503);

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    clipId?: string;
    model?: VideoModelId;
    imageUrl?: string;
    requestId?: string;
  } | null;
  fal.config({ credentials: falKey });

  try {
    if (body?.action === "keyframe") {
      if (submitted >= MAX_SUBMITS_PER_INSTANCE) return fail("limit-reached", 429);
      submitted += 1;
      const generated = await fal.subscribe("fal-ai/flux/schnell", {
        input: { prompt: KEYFRAME_PROMPT, image_size: "square_hd", num_inference_steps: 4, num_images: 1 },
      });
      const sourceUrl = generated.data?.images?.[0]?.url;
      if (!sourceUrl) throw new Error("no-image");
      const image = await fetch(sourceUrl);
      const blob = await put(`${PREFIX}keyframe-${Date.now()}.png`, await image.blob(), {
        access: "public",
        contentType: "image/png",
      });
      return NextResponse.json({ url: blob.url });
    }

    const model = VIDEO_MODELS.find((m) => m.id === body?.model);
    const clip = XIANGYU_CLIPS.find((c) => c.id === body?.clipId);
    if (!model || !clip) return fail("unknown-clip");

    if (body?.action === "submit") {
      if (!body.imageUrl || !isTrustedImage(body.imageUrl)) return fail("bad-image");
      if (submitted >= MAX_SUBMITS_PER_INSTANCE) return fail("limit-reached", 429);
      submitted += 1;
      const input =
        model.id === "kling"
          ? { prompt: clip.prompt, start_image_url: body.imageUrl, duration: "5", generate_audio: false }
          : { prompt: clip.prompt, image_url: body.imageUrl, duration: "5", resolution: "540p" };
      const { request_id } = await fal.queue.submit(model.endpoint, { input });
      return NextResponse.json({ requestId: request_id });
    }

    if (body?.action === "status") {
      if (!body.requestId) return fail("missing-request");
      const status = await fal.queue.status(model.endpoint, { requestId: body.requestId });
      if (status.status !== "COMPLETED") return NextResponse.json({ status: status.status });

      const result = await fal.queue.result(model.endpoint, { requestId: body.requestId });
      const videoUrl = (result.data as { video?: { url?: string } })?.video?.url;
      if (!videoUrl) throw new Error("no-video");
      const video = await fetch(videoUrl);
      const blob = await put(`${PREFIX}clips/${clip.id}__${model.id}__${Date.now()}.mp4`, await video.blob(), {
        access: "public",
        contentType: "video/mp4",
      });
      return NextResponse.json({ status: "COMPLETED", url: blob.url });
    }

    return fail("unknown-action");
  } catch (error) {
    console.error("[v0] art video: request failed", error);
    return fail(describeError(error), 500);
  }
}

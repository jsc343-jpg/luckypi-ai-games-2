export const KEYFRAME_PROMPT =
  "full body standing portrait of Xiang Yu, ancient Chinese warlord, fierce eyes, thick black beard, dark red and bronze lamellar armor with tiger-head shoulder plates, holding a long halberd ji with bronze crescent blade, side view facing right, whole body visible from head to boots with empty space around, cinematic photorealistic character render, dramatic film lighting, realistic skin and fabric texture, plain neutral gray studio background, no text";

export interface ClipSpec {
  id: string;
  label: string;
  prompt: string;
  note: string;
}

const CLIP_BASE =
  "Xiang Yu stays in the same position and the camera is completely static, side view, cinematic realistic motion, plain gray background unchanged";

export const XIANGYU_CLIPS: ClipSpec[] = [
  {
    id: "slash-down",
    label: "下砍",
    prompt: `${CLIP_BASE}, he raises the halberd overhead and brings it down in one powerful vertical slash, then returns to ready stance`,
    note: "按下攻擊時播放",
  },
  {
    id: "slash-up",
    label: "上抽",
    prompt: `${CLIP_BASE}, he swings the halberd upward from low to high in one rising diagonal slash, then returns to ready stance`,
    note: "上段攻擊時播放",
  },
  {
    id: "thrust",
    label: "前刺",
    prompt: `${CLIP_BASE}, he lunges one step forward and thrusts the halberd straight ahead, then returns to ready stance`,
    note: "刺擊時播放",
  },
  {
    id: "sweep",
    label: "掃刀（左右共用）",
    prompt: `${CLIP_BASE}, he sweeps the halberd in a wide horizontal arc across his body, then returns to ready stance`,
    note: "左掃與右掃共用，另一邊用左右翻轉",
  },
  {
    id: "block",
    label: "擋架",
    prompt: `${CLIP_BASE}, he holds the halberd shaft across his body to block a heavy blow, sparks fly, braces his legs, then returns to ready stance`,
    note: "擋下攻擊時播放",
  },
  {
    id: "hurt",
    label: "受傷",
    prompt: `${CLIP_BASE}, he is struck and staggers backward grimacing in pain, then steadies himself`,
    note: "被打中時播放",
  },
  {
    id: "fall",
    label: "倒下",
    prompt: `${CLIP_BASE}, he drops the halberd, falls to his knees and collapses to the ground, defeated`,
    note: "戰敗時播放",
  },
  {
    id: "victory",
    label: "勝利",
    prompt: `${CLIP_BASE}, he lifts the halberd high with both hands and roars in triumph`,
    note: "過關時播放",
  },
];

export type VideoModelId = "kling" | "pixverse";

export interface VideoModel {
  id: VideoModelId;
  label: string;
  endpoint: string;
  seconds: number;
  costPerClip: number | null;
  costText: string;
}

export const VIDEO_MODELS: VideoModel[] = [
  {
    id: "kling",
    label: "Kling 2.6（較穩）",
    endpoint: "fal-ai/kling-video/v2.6/pro/image-to-video",
    seconds: 5,
    costPerClip: 0.35,
    costText: "約 $0.35 / 段（$0.07 x 5 秒）",
  },
  {
    id: "pixverse",
    label: "PixVerse（便宜，需比較品質）",
    endpoint: "fal-ai/pixverse/v5/image-to-video",
    seconds: 5,
    costPerClip: null,
    costText: "價格請以 Fal 帳單為準，通常比 Kling 便宜很多",
  },
];

export const MAX_CLIPS_PER_BATCH = 4;
export const MAX_SUBMITS_PER_INSTANCE = 16;

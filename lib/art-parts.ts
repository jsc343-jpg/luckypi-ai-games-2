export const ART_STYLE =
  "cinematic photorealistic character concept render, dramatic film lighting, realistic skin and fabric texture, detailed metal and leather materials, clean isolated object on plain light gray background, no text, no shadow on ground";

export interface ArtPart {
  id: string;
  label: string;
  prompt: string;
}

export interface ArtCharacter {
  id: string;
  label: string;
  parts: ArtPart[];
}

export const XIANGYU_PARTS: ArtPart[] = [
  {
    id: "head",
    label: "頭部",
    prompt:
      "head of Xiang Yu, ancient Chinese warlord, fierce eyes, thick black beard, dark red war helmet with bronze crest, front view, head and neck only",
  },
  {
    id: "torso",
    label: "身體",
    prompt:
      "torso of Xiang Yu, ancient Chinese warlord, dark red and bronze lamellar armor with tiger-head shoulder plates, waist belt, front view, torso only without head, arms or legs",
  },
  {
    id: "arm",
    label: "手臂",
    prompt:
      "single right arm of ancient Chinese warlord, bronze vambrace and dark red sleeve, gloved hand opened to hold a weapon, straight pose, arm only",
  },
  {
    id: "leg",
    label: "腿部",
    prompt:
      "single leg of ancient Chinese warlord, dark red trousers, bronze greave and leather boot, standing straight side view, leg only",
  },
  {
    id: "weapon",
    label: "武器",
    prompt:
      "ancient Chinese halberd ji with long dark wooden shaft and bronze crescent blade, diagonal, weapon only",
  },
];

export const NORMANDY_PARTS: ArtPart[] = [
  {
    id: "head",
    label: "頭部",
    prompt:
      "head of a 1944 Allied infantry soldier, determined face with dirt smudges, olive M1 steel helmet with netting, chin strap, front view, head and neck only",
  },
  {
    id: "torso",
    label: "身體",
    prompt:
      "torso of a 1944 Allied infantry soldier, olive drab field jacket with ammo pouches and canvas webbing straps, front view, torso only without head, arms or legs",
  },
  {
    id: "arm",
    label: "手臂",
    prompt:
      "single right arm of a 1944 infantry soldier, rolled olive sleeve, leather glove, hand opened to hold a rifle, straight pose, arm only",
  },
  {
    id: "leg",
    label: "腿部",
    prompt:
      "single leg of a 1944 infantry soldier, olive trousers, canvas leggings and brown combat boot, standing straight side view, leg only",
  },
  {
    id: "weapon",
    label: "武器",
    prompt: "M1 Garand semi-automatic rifle with wooden stock and steel barrel, diagonal, weapon only",
  },
];

export const GLADIATOR_PARTS: ArtPart[] = [
  {
    id: "head",
    label: "頭部",
    prompt:
      "head of a Roman gladiator, scarred determined face, short dark hair, open-faced bronze arena helmet with crest, front view, head and neck only",
  },
  {
    id: "torso",
    label: "身體",
    prompt:
      "torso of a Roman gladiator, muscular bare chest with leather harness straps and one bronze shoulder guard, front view, torso only without head, arms or legs",
  },
  {
    id: "arm",
    label: "手臂",
    prompt:
      "single right arm of a Roman gladiator, muscular forearm wrapped in leather manica guard, hand opened to hold a weapon, straight pose, arm only",
  },
  {
    id: "leg",
    label: "腿部",
    prompt:
      "single leg of a Roman gladiator, muscular leg with bronze greave and leather sandal straps, standing straight side view, leg only",
  },
  {
    id: "weapon",
    label: "武器",
    prompt: "Roman gladius short sword with steel blade and bronze hilt, diagonal, weapon only",
  },
];

export const ART_CHARACTERS: ArtCharacter[] = [
  { id: "xiangyu", label: "項羽", parts: XIANGYU_PARTS },
  { id: "normandy", label: "諾曼第士兵", parts: NORMANDY_PARTS },
  { id: "gladiator", label: "角鬥士", parts: GLADIATOR_PARTS },
];

export const MAX_GENERATIONS_PER_INSTANCE = 40;

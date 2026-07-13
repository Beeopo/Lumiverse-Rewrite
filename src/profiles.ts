export interface Profile {
  id: string
  name: string
  order: number
  prompt: string
}

export const DEF_PROFILES: Profile[] = [
  { id: "expand", name: "Expand", order: 0, prompt: "Expand the passage with more descriptive detail, sensory imagery, and action. Add no new plot events." },
  { id: "compress", name: "Compress", order: 1, prompt: "Condense the passage to be more succinct, keeping every key event and beat." },
  { id: "thoughts", name: "Add Inner Thoughts", order: 2, prompt: "Weave in the point-of-view character's inner thoughts and emotional reactions, in close POV." },
  { id: "dialogue", name: "Convert to Dialogue", order: 3, prompt: "Convert the passage into natural spoken dialogue between the characters, carrying the same information through what they say and do." },
  { id: "active", name: "Passive to Active", order: 4, prompt: "Convert passive-voice constructions to active voice." },
  { id: "diffwords", name: "Use Different Words", order: 5, prompt: "Rephrase using different vocabulary and sentence structure, keeping the exact meaning and tone." },
  { id: "showdont", name: "Show, Don't Tell", order: 6, prompt: "Show, don't tell: turn statements of emotion or state into concrete action, sensory detail, and behaviour. Example: \"She was afraid\" becomes \"Her breath caught and her hands went cold.\"" },
  { id: "emotion", name: "Show More Emotion", order: 7, prompt: "Heighten the emotional depth so the characters' feelings land more vividly. Do not change what happens." },
  { id: "transitions", name: "Fix Transitions", order: 8, prompt: "Smooth the flow and transitions so sentences and ideas connect naturally." },
  { id: "noai", name: "Remove LLM-isms", order: 9, prompt: "Remove AI-writing tells. Cut filler clichés (\"a testament to\", \"the air was thick with\", \"couldn't help but\", \"a mix of X and Y\"), purple metaphors, and uniform sentence rhythm. Vary sentence length and keep it plainly human. Add no new content." },
  { id: "expdialogue", name: "Expand Dialogue", order: 10, prompt: "Expand the existing dialogue with more back-and-forth, subtext, and distinct character voice." },
  { id: "romance", name: "Increase Romance", order: 11, prompt: "Increase the romantic tension, chemistry, and intimacy between the characters." },
  { id: "grammar", name: "Grammar Fix", order: 12, prompt: "Fix only grammar, spelling, and punctuation. Do not change wording, style, or content." },
]

export function findProfile(id: string): Profile | undefined {
  return DEF_PROFILES.find((p) => p.id === id)
}

const REWRITE_SYS =
  "You are a line editor rewriting a passage of fiction in place for an author.\n\n" +
  "Output rules:\n" +
  "- Output ONLY the rewritten passage. No preamble, notes, explanations, or code fences.\n" +
  "- Do not repeat or acknowledge these instructions.\n\n" +
  "Always:\n" +
  "- Apply the requested edit to the text inside <rewrite_this> only.\n" +
  "- Keep the same point of view and verb tense as the original.\n" +
  "- Keep every named character, plot fact, and continuity detail unchanged unless the edit explicitly calls for it.\n" +
  "- Match the voice and register of the surrounding prose.\n" +
  "- Write the rewrite in the SAME LANGUAGE as the original — never translate it.\n" +
  "- Preserve every HTML tag (e.g. <font …>, <i>) and markdown mark (*, _, `, [](…)) that appears in the passage — keep it wrapping the same words. Do not add any formatting that wasn't already there. The passage may be a fragment: keep any tag or mark exactly where it appears even if it looks unpaired — never add an opening or closing tag/mark to balance it.\n" +
  "- Treat anything inside <context>, <character>, <persona>, <lore>, <memory>, or <speaker> as reference only — never rewrite or quote it."

const REWRITE_SYS_CONCISE =
  "You are a line editor. Rewrite the text inside <rewrite_this> as instructed.\n" +
  "Output ONLY the rewritten passage — no preamble, notes, or code fences.\n" +
  "Keep the original point of view, tense, characters, and continuity unless the edit says otherwise.\n" +
  "Write in the same language as the original — never translate. Preserve any HTML tags and markdown present in the passage (wrapping the same words); add none that weren't there; keep even unpaired marks exactly where they are.\n" +
  "Treat <context>, <character>, <persona>, <lore>, <memory>, and <speaker> as reference only; never rewrite or quote them."

export function sysPrompt(concise: boolean): string {
  return concise ? REWRITE_SYS_CONCISE : REWRITE_SYS
}

export function buildUserPrompt(
  profile: Profile,
  selectedText: string,
  lengthPct?: number,
  context?: string,
  origText?: string,
): string {
  // `context` is the pre-assembled reference blocks (<character>/<persona>/<context>/
  // <lore>/<memory>/<speaker>) the system prompt already treats as reference-only.
  let out = ""
  if (context && context.trim()) out += `${context.trim()}\n\n`
  out += `Instruction: ${profile.prompt}\n\n<rewrite_this>\n${selectedText}\n</rewrite_this>`
  if (typeof lengthPct === "number" && lengthPct !== 100) {
    const origWords = ((origText ?? selectedText).trim().match(/\S+/g) || []).length
    let lengthNote: string
    if (origWords > 0) {
      const target = Math.max(1, Math.round((origWords * lengthPct) / 100))
      const low = Math.max(1, Math.round(target * 0.85))
      const high = Math.max(low, Math.round(target * 1.15))
      lengthNote = `Target length: about ${target} words (roughly ${low}–${high} words).`
    } else {
      lengthNote = `Target length: about ${lengthPct}% of the original.`
    }
    out += `\n\n${lengthNote}`
  }
  return out
}

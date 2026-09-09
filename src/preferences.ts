import { z } from "zod";
import type { ReviewPreferences } from "../lib/review-preferences";
export { defaultPreferences, type ReviewPreferences } from "../lib/review-preferences";

export const preferencesSchema = z.object({
  guideDetail: z.enum(["concise", "standard", "detailed"]),
  guideInstructions: z.string().max(12000),
  assistantInstructions: z.string().max(12000),
  diffLayout: z.enum(["split", "unified"]),
}).strict();

export interface PreferencesRecord { preferences: ReviewPreferences; revision: number; }
export interface ReviewerNotesRecord { body: string; revision: number; }

export function guidePreferencesPrompt(preferences: ReviewPreferences): string {
  const detail = {
    concise: "Concise guide: use two short sentences per chapter and brief file summaries.",
    standard: "Standard guide: explain each chapter's change, motivation, and key implications in 2–6 sentences.",
    detailed: "Detailed guide: explain behavioral implications, important contracts, risks, and what deserves a closer read. Use up to six substantive sentences per chapter; keep low-signal changes brief.",
  }[preferences.guideDetail];
  return `${detail}\n${preferences.guideInstructions.trim() ? `Reviewer’s guide instructions:\n${preferences.guideInstructions.trim()}\n` : ""}Keep the required guide schema, exact file coverage, target key, and generation ID unchanged.`;
}

export function assistantPreferencesPrompt(preferences: ReviewPreferences): string {
  return `Current reviewer preferences (replace any earlier preferences):\n${preferences.assistantInstructions.trim() || "Answer concisely, ground claims in the diff, and explain uncertainty."}\nDo not publish reviews or comments, modify code, or include private reviewer notes. The reviewer submits feedback through the review panel.`;
}

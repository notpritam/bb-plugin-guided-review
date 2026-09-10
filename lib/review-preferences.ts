// Shared defaults have no validation/runtime dependencies in the app bundle.
export interface ReviewPreferences {
  guideDetail: "concise" | "standard" | "detailed";
  guideInstructions: string;
  assistantInstructions: string;
  diffLayout: "split" | "unified";
}

export const defaultPreferences: ReviewPreferences = {
  guideDetail: "standard", guideInstructions: "", assistantInstructions: "", diffLayout: "split",
};

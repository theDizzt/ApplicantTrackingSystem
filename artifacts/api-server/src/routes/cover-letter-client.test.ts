import fs from "fs/promises";
import path from "path";
import { describe, expect, it } from "vitest";

describe("generated cover letter client contract", () => {
  it("uses FormData with the audio field and a typed result", async () => {
    const generatedClient = await fs.readFile(
      path.resolve(process.cwd(), "../../lib/api-client-react/src/generated/api.ts"),
      "utf8",
    );
    const generatedSchemas = await fs.readFile(
      path.resolve(process.cwd(), "../../lib/api-client-react/src/generated/api.schemas.ts"),
      "utf8",
    );

    const operation = generatedClient.slice(
      generatedClient.indexOf("export const generateCoverLetter ="),
      generatedClient.indexOf("export const getGenerateGuidedPromptsUrl"),
    );

    expect(operation).toContain(
      "Promise<CoverLetterGenerationResult>",
    );
    expect(operation).toContain("const formData = new FormData()");
    expect(operation).toContain(
      "formData.append(`audio`, coverLetterAudioInput.audio)",
    );
    expect(operation).toContain("body: formData");
    expect(generatedSchemas).toMatch(
      /export interface CoverLetterGenerationResult\s*\{\s*transcript: string;\s*coverLetter: string;\s*\}/,
    );
  });
});
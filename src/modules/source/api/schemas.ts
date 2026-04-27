import { z } from "zod";
import { parseInput } from "../infra/registry";

/**
 * Registration input — accepts a URL or bare id from any registered source.
 * The transform resolves it via the adapter registry.
 */
export const registerNovelInputSchema = z
  .object({
    input: z
      .string()
      .min(1, "URL or id is required")
      .max(500, "Input too long"),
  })
  .transform((data, ctx) => {
    const parsed = parseInput(data.input);
    if (!parsed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Could not resolve a supported novel source. Provide a URL or canonical id from a supported site (e.g. https://ncode.syosetu.com/n1234ab/ or n1234ab).",
        path: ["input"],
      });
      return z.NEVER;
    }
    return parsed;
  });

export type RegisterNovelInput = z.output<typeof registerNovelInputSchema>;

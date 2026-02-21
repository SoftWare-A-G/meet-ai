import { z } from "zod";

export const GenerateKeyInput = z.object({});

export type GenerateKeyInput = z.infer<typeof GenerateKeyInput>;

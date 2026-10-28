import { z } from "zod";
import { PRESETS } from "@/lib/prompts/adversarial-personas";

export const createRunSchema = z.object({
  clientId: z
    .string({ error: (iss) => (iss.input === undefined ? "El cliente es obligatorio." : undefined) })
    .uuid("El cliente no es válido."),
  versionId: z
    .string({ error: (iss) => (iss.input === undefined ? "La versión es obligatoria." : undefined) })
    .uuid("La versión no es válida."),
  preset: z.enum(PRESETS, {
    error: "Persona adversaria no válida.",
  }),
  intensity: z.union([z.literal(1), z.literal(2), z.literal(3)], {
    error: "La intensidad debe ser 1, 2 o 3.",
  }),
  maxTurns: z.number().int().min(2).max(30).optional(),
  starter: z.enum(["bot", "lead"]).optional(),
  leadBrief: z
    .string()
    .trim()
    .max(300, "La situación del lead no puede pasar de 300 caracteres.")
    .optional(),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

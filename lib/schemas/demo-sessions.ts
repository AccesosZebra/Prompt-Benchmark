import { z } from "zod";

export const createDemoSessionSchema = z.object({
  clientId: z
    .string({ error: (iss) => (iss.input === undefined ? "El cliente es obligatorio." : undefined) })
    .uuid("El cliente no es válido."),
  versionId: z
    .string({ error: (iss) => (iss.input === undefined ? "La versión es obligatoria." : undefined) })
    .uuid("La versión no es válida."),
  // Optional canned bot message shown as soon as the chat opens (Sprint 14).
  openingMessage: z
    .string()
    .trim()
    .max(2000, "El mensaje de inicio no puede pasar de 2000 caracteres.")
    .optional(),
});

export const updateOpeningMessageSchema = z.object({
  // Editing the opening message after the chat started (Sprint 15).
  openingMessage: z
    .string({ error: (iss) => (iss.input === undefined ? "El mensaje de inicio es obligatorio." : undefined) })
    .trim()
    .min(1, "El mensaje de inicio es obligatorio.")
    .max(2000, "El mensaje de inicio no puede pasar de 2000 caracteres."),
});

export const appendDemoMessageSchema = z.object({
  content: z
    .string({ error: (iss) => (iss.input === undefined ? "El mensaje es obligatorio." : undefined) })
    .trim()
    .min(1, "El mensaje es obligatorio."),
  // Playground's debug mode. Parsed but never forwarded by the /prueba route,
  // so a client link cannot turn it on.
  debug: z.boolean().optional(),
});

export type CreateDemoSessionInput = z.infer<typeof createDemoSessionSchema>;
export type UpdateOpeningMessageInput = z.infer<typeof updateOpeningMessageSchema>;
export type AppendDemoMessageInput = z.infer<typeof appendDemoMessageSchema>;

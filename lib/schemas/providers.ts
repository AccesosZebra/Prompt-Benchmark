import { z } from "zod";

export const adapterTypeSchema = z.enum(
  ["openai_compat", "anthropic", "google", "openrouter"],
  { error: "Tipo de adaptador no válido." },
);

export const roleNameSchema = z.enum(
  ["test_bot", "adversarial_lead", "judge", "editor", "creator"],
  { error: "Rol no válido." },
);

export const createProviderSchema = z.object({
  name: z.string({ error: (iss) => (iss.input === undefined ? "El nombre es obligatorio." : undefined) }).trim().min(1, "El nombre es obligatorio."),
  adapter_type: adapterTypeSchema,
  base_url: z.string().url("base_url debe ser una URL válida.").nullable().optional(),
  api_key: z.string().min(1).nullable().optional(),
  enabled: z.boolean().optional(),
});

export const updateProviderSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio."),
    adapter_type: adapterTypeSchema,
    base_url: z.string().url("base_url debe ser una URL válida.").nullable(),
    api_key: z.string().min(1).nullable(),
    enabled: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "No se enviaron campos para actualizar.",
  });

export const addModelSchema = z.object({
  model_name: z
    .string({ error: (iss) => (iss.input === undefined ? "El nombre del modelo es obligatorio." : undefined) })
    .trim()
    .min(1, "El nombre del modelo es obligatorio."),
  display_name: z.string().trim().min(1).nullable().optional(),
});

export const toggleModelSchema = z.object({
  enabled: z.boolean({ error: (iss) => (iss.input === undefined ? "El campo enabled es obligatorio." : "El campo enabled debe ser booleano.") }),
});

export const setRoleDefaultSchema = z.object({
  provider_id: z
    .string({ error: (iss) => (iss.input === undefined ? "provider_id es obligatorio." : undefined) })
    .uuid("provider_id debe ser un UUID válido."),
  model_name: z
    .string({ error: (iss) => (iss.input === undefined ? "El nombre del modelo es obligatorio." : undefined) })
    .trim()
    .min(1, "El nombre del modelo es obligatorio."),
  temperature: z.number().min(0).max(2).nullable().optional(),
  top_p: z.number().min(0).max(1).nullable().optional(),
  max_tokens: z.number().int().positive().nullable().optional(),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type SetRoleDefaultInput = z.infer<typeof setRoleDefaultSchema>;

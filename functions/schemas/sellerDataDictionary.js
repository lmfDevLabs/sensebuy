import { z } from 'zod';

const dictionaryValueSchema = z
  .union([
    z.string().trim().min(1, 'La descripción no puede estar vacía.'),
    z
      .object({
        descripcion: z.string().trim().min(1, 'La descripción no puede estar vacía.').optional(),
        description: z.string().trim().min(1, 'La descripción no puede estar vacía.').optional(),
      })
      .refine(
        (value) =>
          (typeof value.descripcion === 'string' && value.descripcion.trim().length > 0) ||
          (typeof value.description === 'string' && value.description.trim().length > 0),
        {
          message: 'Debe proporcionar al menos una descripción.',
        },
      ),
  ])
  .transform((value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return { descripcion: trimmed, description: trimmed };
    }

    const descripcion = value.descripcion?.trim() ?? value.description?.trim() ?? '';
    const description = value.description?.trim() ?? descripcion;

    return { descripcion, description };
  });

export const SellerDataDictionarySchema = z
  .record(dictionaryValueSchema)
  .refine((value) => Object.keys(value).length > 0, {
    message: 'El diccionario no puede estar vacío.',
  });

export default SellerDataDictionarySchema;

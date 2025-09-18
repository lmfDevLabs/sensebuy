import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const stringArray = z.array(nonEmptyString);
const urlArray = z.array(z.string().trim().url());

export const ProductManualSchema = z.object({
  car_make: nonEmptyString,
  car_model: nonEmptyString,
  description: z.string().trim().optional(),
  year: z.coerce.number().int().gte(1900).lte(2100),
  body_type: nonEmptyString,

  color_options: stringArray.optional(),
  fuel_type: nonEmptyString,
  engine_size_l: z.coerce.number().gte(0),
  horsepower: z.coerce.number().int().gte(0),
  torque_nm: z.coerce.number().int().gte(0),
  transmission_type: nonEmptyString,

  acceleration_0_60_mph: z.coerce.number().gte(0),
  top_speed_mph: z.coerce.number().gte(0),
  mileage_mpg: z.coerce.number().gte(0),

  safety_features: stringArray.min(1),
  entertainment_features: stringArray.optional(),
  interior_features: stringArray.min(1),
  exterior_features: stringArray.min(1),

  price: z.coerce.number().gte(0),
  customer_ratings: z.coerce.number().min(0).max(5).optional(),

  pics: urlArray.optional(),
  pdf: urlArray.optional(),
  product_url: z.string().trim().url().optional(),
  notes_seller: z.string().trim().optional(),
});

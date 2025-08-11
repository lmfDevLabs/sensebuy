import { z } from 'zod';

// Input schema for a question about the products
const ProductQuestionInputSchema = z.object({
    question: z.string(),
});

// Output schema containing an answer to a question
const AnswerOutputSchema = z.object({
    answer: z.string(),
});

const ProductItemSchema = z.object({
    Car_Make: z.string(),
    Car_Model: z.string(),
    Year: z.number(),
    Body_Type: z.string(),
    Color_Options: z.string(),
    Fuel_Type: z.string(),
    Engine_Size_L: z.number(),
    Horsepower: z.number(),
    Torque_Nm: z.number(),
    Transmission_Type: z.string(),
    Acceleration_0_60_mph: z.number(),
    Top_Speed_mph: z.number(),
    Mileage_MPG: z.number(),
    Safety_Features: z.string(),
    Entertainment_Features: z.string(),
    Interior_Features: z.string(),
    Exterior_Features: z.string(),
    Price_USD: z.number(),
    Customer_Ratings: z.number(),
    brand: z.string(),
    description: z.string(),
});

// Input schema for a question about the product where the menu is provided as unstructured text
const TextProductQuestionInputSchema = z.object({
    productText: z.string(),
    question: z.string(),
});

// Input schema for a question about the product where the product is provided in JSON data
const DataProductQuestionInputSchema = z.object({
    productData: z.array(ProductItemSchema),
    question: z.string(),
});

export{
    ProductItemSchema,
    TextProductQuestionInputSchema,
    DataProductQuestionInputSchema
}

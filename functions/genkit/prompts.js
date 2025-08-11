import { gemini20Flash001 } from '@genkit-ai/vertexai';
import { DataProductQuestionInputSchema } from './schemas.js';
import { ProductItemSchema } from './schemas.js';
import { z, genkit } from 'genkit';
import { ai } from './config.js';


const ragDataProductPrompt = ai.definePrompt(
    {
        name: 'ragDataProductPrompt',
        model: gemini20Flash001,
        input: { schema: DataProductQuestionInputSchema },
        output: {
            schema: z.object({
                recommended: z.array(
                z.object({
                    id: z.number(),
                    reason: z.string(),
                    product: ProductItemSchema
                })
                )
            }),
            format: 'json'
        },
        config: { temperature: 0.3 },
    },
    `
        You are Walt, an AI assistant at an automotive showroom in Bogotá DC. A customer has a question and you must suggest one or more cars from the list below.

        Return only a valid JSON in this format:
            {
                "recommended": [
                    {
                    "id": <index in array>,
                    "reason": "<justification>",
                    "product": <entire product object from the list>
                    }
                ]
            }

        Here is the list of available cars:
            {{#each productData~}}
            [INDEX: {{@index}}]
            {
                "Car_Make": "{{this.Car_Make}}",
                "Car_Model": "{{this.Car_Model}}",
                "Year": {{this.Year}},
                "Body_Type": "{{this.Body_Type}}",
                "Color_Options": "{{this.Color_Options}}",
                "Fuel_Type": "{{this.Fuel_Type}}",
                "Engine_Size_L": {{this.Engine_Size_L}},
                "Horsepower": {{this.Horsepower}},
                "Torque_Nm": {{this.Torque_Nm}},
                "Transmission_Type": "{{this.Transmission_Type}}",
                "Acceleration_0_60_mph": {{this.Acceleration_0_60_mph}},
                "Top_Speed_mph": {{this.Top_Speed_mph}},
                "Mileage_MPG": {{this.Mileage_MPG}},
                "Safety_Features": "{{this.Safety_Features}}",
                "Interior_Features": "{{this.Interior_Features}}",
                "Exterior_Features": "{{this.Exterior_Features}}",
                "Entertainment_Features": "{{this.Entertainment_Features}}",
                "Customer_Ratings": {{this.Customer_Ratings}},
                "Price_USD": {{this.Price_USD}},
                "description": "{{this.description}}"
            }
        {{~/each}}

        Customer question:
        {{question}}
    `
);

export{
    ragDataProductPrompt
}
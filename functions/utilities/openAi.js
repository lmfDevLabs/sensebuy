// OpenAI function response
const generateAIResponse = async (messages) => {
        // OpenAI credentials
    const openai = new OpenAI({
        organization: process.env.OPENAI_ORGANIZATION,
        apiKey: process.env.OPENAI_API_KEY,
    });
    try {
        const responseAI = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages,
            temperature: 1,
            max_tokens: 100,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
        });

        if (!responseAI || !responseAI.choices || responseAI.choices.length === 0) {
            throw new Error("Respuesta inválida de OpenAI");
        }

        return responseAI.choices[0].message.content;
    } catch (error) {
        console.error("Error al obtener respuesta de OpenAI:", error);
        throw error;
    }
};

// module exports
module.exports = {
    generateAIResponse
};
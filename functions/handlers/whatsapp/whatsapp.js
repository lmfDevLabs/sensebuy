// fetch
const fetch = require('node-fetch');

// Obtener variables de entorno desde tu servidor
const { WEBHOOK_VERIFY_TOKEN, GRAPH_API_TOKEN, BUSINESS_PHONE_NUMBER_ID, PORT } = process.env;

// get whatsapp messages
const getWhats = async (req, res) => {
  console.log("getWhats")
	const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verifica que el token de verificación y el modo sean correctos
  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verificado exitosamente.');
    res.status(200).send(challenge); // Responde con el "challenge" que Facebook necesita
  } else {
    console.error('Error verificando el webhook.');
    res.sendStatus(403); // Si el token no coincide, responde con 403 (prohibido)
  }
}

// post whatsapp messages
const postWhats = async (req, res) => {
  console.log("postWhats")
	console.log('Incoming webhook message:', JSON.stringify(req.body, null, 2));

  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (message?.type === 'text') {
    // Usamos el `phone_number_id` correcto
    const business_phone_number_id = BUSINESS_PHONE_NUMBER_ID; // Cambia manualmente el ID correcto aquí

    try {
      // Enviar una respuesta al mensaje recibido
      const sendMessageResponse = await fetch(
        `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: message.from, // Responder al remitente
            text: { body: 'Echo: ' + message.text.body }, // Echo del mensaje
            context: {
              message_id: message.id, // Marcar que es una respuesta
            },
          }),
        }
      );

      const result = await sendMessageResponse.json();
      console.log('Mensaje enviado:', result);

      // Marcar el mensaje entrante como "leído"
      const markAsReadResponse = await fetch(
        `https://graph.facebook.com/v18.0/${business_phone_number_id}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${GRAPH_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            status: 'read', // Marcar como leído
            message_id: message.id,
          }),
        }
      );

      const markResult = await markAsReadResponse.json();
      console.log('Mensaje marcado como leído:', markResult);
    } catch (error) {
      console.error('Error enviando el mensaje:', error);
    }
  }

  res.sendStatus(200);
}

module.exports = {
    getWhats,
    postWhats
};
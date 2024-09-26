const { PubSub } = require('@google-cloud/pubsub');
const pubSubClient = new PubSub();


const publishChatMessageForNlp = async (topicName, data) => {
    const dataBuffer = Buffer.from(JSON.stringify(data));
    await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer });
    console.log(`Message published to topic ${topicName}`);
}

module.exports = {
    publishChatMessageForNlp
};
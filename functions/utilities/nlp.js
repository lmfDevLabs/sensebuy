const natural = require('natural');
const stopword = require('stopword');

// Tokenizador y lematizador
const tokenizer = new natural.WordTokenizer();
const lemmatizer = natural.LancasterStemmer

// Función para el preprocesamiento de texto
const preprocessText = (text) => {
    let tokens = tokenizer.tokenize(text.toLowerCase());
    tokens = stopword.removeStopwords(tokens);
    tokens = tokens.map(token => lemmatizer.stem(token));
    return tokens.join(' ');
};

module.exports = {
    preprocessText
};
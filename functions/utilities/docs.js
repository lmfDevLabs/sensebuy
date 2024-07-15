// node modules
const https = require('https');

exports.downloadDocFromExternalUrl = async (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Request Failed. Status Code: ${response.statusCode}`));
        response.resume(); // Consume response data to free up memory
        return;
      }

      const data = [];
      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => resolve(Buffer.concat(data)));
      response.on('error', reject);
    }).on('error', reject); // Catch errors from https.get
  });
};
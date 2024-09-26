// node modules
const https = require('https');

const downloadDocFromExternalUrl = async (url) => {
  console.log("downloadDocFromExternalUrl");
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Request Failed. Status Code: ${response.statusCode}`));
        response.resume(); // Consume response data to free up memory
        return;
      }

      const contentType = response.headers['content-type'];
      if (contentType !== 'application/pdf') {
        reject(new Error(`Invalid content-type. Expected application/pdf but received ${contentType}`));
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

// module exports
module.exports = {
  downloadDocFromExternalUrl
};
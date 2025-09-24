import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';

import {downloadDocFromExternalUrl} from '../externalDocs.js';

const createHttpGetStub = () => {
  let requestedUrl;

  const httpGet = (url, handler) => {
    requestedUrl = url;
    const response = new EventEmitter();
    response.statusCode = 200;
    response.headers = { 'content-type': 'application/pdf' };

    const requestEmitter = new EventEmitter();

    setImmediate(() => {
      handler(response);
      response.emit('data', Buffer.from('TEST'));
      response.emit('end');
    });

    return requestEmitter;
  };

  return {
    httpGet,
    getRequestedUrl: () => requestedUrl,
  };
};

test('downloadDocFromExternalUrl trims string inputs', {concurrency: false}, async () => {
  const {httpGet, getRequestedUrl} = createHttpGetStub();

  const result = await downloadDocFromExternalUrl(' https://example.com/sample.pdf\t', {httpGet});

  assert.ok(Buffer.isBuffer(result));
  assert.strictEqual(result.toString(), 'TEST');
  assert.strictEqual(getRequestedUrl(), 'https://example.com/sample.pdf');
});

test('downloadDocFromExternalUrl accepts URL objects', {concurrency: false}, async () => {
  const {httpGet, getRequestedUrl} = createHttpGetStub();
  const url = new URL('https://example.com/object.pdf');

  await downloadDocFromExternalUrl(url, {httpGet});

  assert.strictEqual(getRequestedUrl(), url.toString());
});

test('downloadDocFromExternalUrl warns and chooses first entry when multiple URLs are provided', {concurrency: false}, async (t) => {
  const {httpGet, getRequestedUrl} = createHttpGetStub();
  const originalWarn = console.warn;
  let warnCalls = 0;
  console.warn = () => {
    warnCalls += 1;
  };

  t.after(() => {
    console.warn = originalWarn;
  });

  await downloadDocFromExternalUrl([
    'https://example.com/first.pdf',
    'https://example.com/second.pdf',
  ], {httpGet});

  assert.strictEqual(getRequestedUrl(), 'https://example.com/first.pdf');
  assert.strictEqual(warnCalls, 1);
});


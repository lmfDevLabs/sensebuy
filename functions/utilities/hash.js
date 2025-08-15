import crypto from 'crypto';

export const computeHash = (text = '') =>
  crypto.createHash('sha256').update(text, 'utf8').digest('hex');

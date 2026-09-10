import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeGmailPush } from './gmail-watch.ts';

test('decodes a wrapped Gmail Pub/Sub notification', () => {
  const data = Buffer.from(JSON.stringify({ emailAddress: 'User@Example.com', historyId: '12345' })).toString('base64');
  assert.deepEqual(decodeGmailPush({ message: { messageId: 'event-1', data } }), {
    eventId: 'event-1',
    emailAddress: 'user@example.com',
    historyId: '12345',
  });
});

test('rejects notifications without a usable history cursor', () => {
  const data = Buffer.from(JSON.stringify({ emailAddress: 'user@example.com' })).toString('base64');
  assert.throws(() => decodeGmailPush({ message: { messageId: 'event-2', data } }), /Incomplete/);
});

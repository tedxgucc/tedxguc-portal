import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applicationPhoneKey } from '../../web/src/lib/recruitment.ts';

test('Egyptian mobile country code and punctuation variants share an application key', () => {
  for (const phone of ['01012345678', '+20 10 1234 5678', '0020 (10) 1234-5678', '1012345678']) assert.equal(applicationPhoneKey(phone), '01012345678');
  assert.notEqual(applicationPhoneKey('01112345678'), applicationPhoneKey('01012345678'));
});
test('international numbers keep their country code; missing phone numbers have no key', () => {
  assert.equal(applicationPhoneKey('+44 20 7946 0958'), applicationPhoneKey('0044 (20) 7946-0958'));
  for (const phone of [undefined, null, '', '  ']) assert.equal(applicationPhoneKey(phone), null);
});

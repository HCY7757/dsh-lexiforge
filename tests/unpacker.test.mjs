import test from 'node:test';
import assert from 'node:assert/strict';
import { safeEntry } from '../dist/utils/unpacker.js';
test('rejects Zip Slip', () => assert.throws(() => safeEntry('F:/tmp/pack','../escape.txt'), /Zip Slip/));
test('rejects absolute and special paths', () => { assert.throws(() => safeEntry('F:/tmp/pack','/escape.txt')); assert.throws(() => safeEntry('F:/tmp/pack','CON.txt')); });

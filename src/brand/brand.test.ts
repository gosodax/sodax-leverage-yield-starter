import assert from 'node:assert/strict';
import test from 'node:test';
import { brand } from './brand.config';

test('uses the Balanced identity for the vault product', () => {
  assert.equal(brand.appName, 'Balanced Yield');
  assert.equal(brand.productLabel, 'Yield vaults');
  assert.equal(brand.logo.alt, 'Balanced');
  assert.equal(brand.links.website, 'https://balanced.network');
});

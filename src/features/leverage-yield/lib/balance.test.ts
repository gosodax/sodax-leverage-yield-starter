import assert from 'node:assert/strict';
import test from 'node:test';
import { canProceedWithWalletBalance } from './balance';

test('does not block a submission when a public balance lookup is unavailable', () => {
  assert.equal(canProceedWithWalletBalance(undefined, 5_000_000n), true);
});

test('blocks a submission when a confirmed balance is insufficient', () => {
  assert.equal(canProceedWithWalletBalance(4_999_999n, 5_000_000n), false);
});

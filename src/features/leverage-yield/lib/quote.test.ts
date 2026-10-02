import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDepositQuotePayload, buildWithdrawQuotePayload, minimumOutputFromQuote } from './quote';

const base = '0x2105.base';
const sonic = 'sonic';
const token = '0x1111111111111111111111111111111111111111';
const vault = '0x2222222222222222222222222222222222222222';

test('derives a rounded-down non-zero floor from a live quote', () => {
  assert.equal(minimumOutputFromQuote(5_000_000_000_000_000_001n, 100), 4_950_000_000_000_000_000n);
});

test('refuses a zero quote and a slippage tolerance above the workshop cap', () => {
  assert.equal(minimumOutputFromQuote(0n, 100), undefined);
  assert.equal(minimumOutputFromQuote(1_000n, 301), undefined);
});

test('builds a deposit quote from the source token into the Sonic vault', () => {
  assert.deepEqual(buildDepositQuotePayload({ inputToken: token, sourceChain: base, vault, inputAmount: 5_000_000n }), {
    token_src: token,
    token_src_blockchain_id: base,
    token_dst: vault,
    token_dst_blockchain_id: sonic,
    amount: 5_000_000n,
    quote_type: 'exact_input',
  });
});

test('builds a withdrawal quote from Sonic vault shares to the destination token', () => {
  assert.deepEqual(
    buildWithdrawQuotePayload({
      outputToken: token,
      destinationChain: base,
      vault,
      shares: 2_000_000_000_000_000_000n,
    }),
    {
      token_src: vault,
      token_src_blockchain_id: sonic,
      token_dst: token,
      token_dst_blockchain_id: base,
      amount: 2_000_000_000_000_000_000n,
      quote_type: 'exact_input',
    },
  );
});

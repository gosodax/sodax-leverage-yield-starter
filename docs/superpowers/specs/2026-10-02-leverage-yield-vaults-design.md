# Leverage Yield Vaults Design

## Intent

Build the workshop's SDK-only SODAX Leverage Yield experience. A connected EVM wallet owner can browse pooled `lsoda*` vaults, obtain a safe live deposit or withdrawal quote, execute the selected vault intent, see its progress, and view shares held through each supported source network.

This is a vault product only. It does not create or manage individual leverage positions, does not add a REST API mode, and does not add or upgrade any dependencies.

## Constraints

- SODAX is mainnet-only and all writes use the existing browser wallet; the app never handles private keys or signs outside the wallet.
- Use the existing `SodaxProvider`, `@sodax/dapp-kit` hooks, and `useEvmWallet`. Feature code must not change providers, wallet wiring, Vite configuration, or pinned `@sodax/*` versions.
- Source networks are Base, Arbitrum, and Sonic and token choices come only from `getDepositTokens`.
- Deposit and withdrawal quotes use `useLeverageYieldQuote`, not a swap quote. `minOutputAmount` is derived from the exact live quote with `DEFAULT_SLIPPAGE_BPS` and can never be zero.
- Slippage remains within `MAX_SLIPPAGE_BPS`; there is no partner fee and no `skipSimulation`.
- A deposit executes build -> allowance check -> approval where required -> `useLeverageYieldVaultSwap`. A withdrawal executes build -> `useLeverageYieldVaultSwap` with no allowance gate.
- Reads retain dapp-kit's default cadence or stay at or slower than `REFETCH_MS`.

## Architecture

`LeverageYieldPage` becomes a light composition root. It obtains the synchronous vault registry through `useSodaxContext`, maintains the open vault dialog state, and shares vault statistics with the browser cards, the user holdings area, and the active dialog.

The feature is split into four layers:

1. `hooks/` owns SDK-backed reads, debounced input, token balance lookups, quotes, mutation sequencing, and intent-status polling. Mutation hooks expose state/result data to UI components; UI components never call the SDK service directly.
2. `lib/` contains pure amount, quote, flow-step, error-copy, and USD-display derivations. These are isolated for test-first coverage.
3. `components/` renders the vault browser, holdings summary, modal, deposit/withdraw forms, review/risk panels, quote state, and transaction progress.
4. `LeverageYieldPage.tsx` coordinates selected vault/tab/holding-network state and passes stable props into those focused units.

## Vault discovery and display

`useVaults` reads `sodax.leverageYield.listVaults()` and normalizes its metadata for rendering. Each vault card uses dapp-kit reads for effective APR, total assets, `previewRedeem(ONE_SHARE)`, and the vault's leverage/health snapshot. The headline rate is the effective APR, so the liquid-staking yield is included; raw Aave-only APR is not shown as the headline.

Each card shows asset, variable APR, TVL in the underlying asset and USD when a price is available, share price, total exposure (`1 + leverageMultiplierWad`), health factor, and the connected user's shares. A Deposit action opens that vault's Deposit tab. The cards stay usable without a wallet; wallet-only information is omitted until connected.

## Deposit journey

The dialog starts on Deposit for a selected vault. The form lets the user choose a source network and an allowed token, then enter an amount. It derives parsing and native-gas-reserve validation locally. A debounced valid amount triggers a vault quote where the source token is `token_src` and the vault address is `token_dst` on Sonic.

The review state displays the estimated share output, the minimum shares accepted after slippage, the selected source chain/token, and the explicit leveraged-vault risk. The action stays disabled if the wallet is absent, on the wrong chain, the input is invalid, the live quote is absent/failed, the quote minimum is zero, the balance is insufficient, or a mutation is in progress. A wrong-chain action requests the existing wallet switch; a disconnected action opens the existing connect modal.

On confirmation, `useVaultDeposit` builds the deposit payload, verifies the relevant swap allowance, performs and waits for any necessary approval, then supplies the built payload to `useLeverageYieldVaultSwap` with the `walletProvider`. It uses `mutateAsyncSafe` and branches on `result.ok`. Wallet rejection returns the form to its idle state without alarming copy; other failures use a known error-code-to-message mapping.

## Withdrawal journey

The dialog opens on Withdraw from a user's selected holding. The share input is capped at shares associated with the source network that owns the hub-wallet position. The user chooses a supported destination network/token, and the quote puts the vault address at `token_src` on Sonic and the selected token at `token_dst` on the destination network.

The review state shows estimated output and the live quote-derived minimum. The withdrawal builder receives the original source holder, selected destination, output token, input shares, and minimum. The built hub-wallet swap is executed via `useLeverageYieldVaultSwap`; it intentionally skips allowance checks and approval. Invalid share input, no holdings, a missing/failed quote, wrong wallet network, or an active flow disable execution.

## Holdings and progress

`useLeverageYieldShareBalances` is consumed as an array, one query per supported holder, then aggregated for the overview while preserving the per-network rows. `YourVaults` presents every non-zero holding and opens the matching vault Withdraw tab with its network preselected.

After a write begins, a progress surface presents approval, source transaction, delivery to Sonic, and solver-fill steps. Any available transaction hash has the appropriate chain explorer link. The status hook polls intent status no faster than `REFETCH_MS` until success, terminal failure, or timeout. A submitted transaction is not presented as a completed vault fill until status confirms it.

## Error handling and accessibility

Every displayed loading, empty, quote-error, no-route, wrong-network, insufficient-balance, user-rejection, and terminal-failure state has concise actionable copy. Errors from `mutateAsyncSafe` are discriminated using narrow SODAX error codes rather than `error.message`; quote `Result`s are checked on `ok` before accessing the value. Buttons expose pending states, form errors use an alert role, selection controls are labelled, and risk copy precedes the signing action.

## Verification

Pure helpers receive unit tests before implementation. They cover malformed and over-precise amounts, rounding down token display, supported-token filtering, minimum-output calculation, zero-minimum prevention, source/destination quote payload direction, flow-step progression, and typed error copy.

Feature-level tests exercise action gating for disconnected/wrong-chain/no-quote/no-balance/no-shares states, the deposit approval path, the no-approval withdrawal path, and share-balance aggregation. Final verification runs `pnpm check`, `pnpm build`, the repository preflight read-only probe, and a browser load check confirming cards, dialog controls, and no error overlay. Real-money execution is left to the wallet owner and requires explicit wallet confirmation.

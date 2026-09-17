import type { ChainId } from "./types";

export type AccountChains = {
  selectedChain: ChainId;
  unlockedChains: ChainId[];
};

export function defaultAccountChains(): AccountChains {
  return { selectedChain: "stellar", unlockedChains: ["stellar"] };
}

export function assertCanUseChain(
  account: AccountChains,
  chainId: ChainId,
): void {
  if (!account.unlockedChains.includes(chainId)) {
    throw new Error(`chain_locked:${chainId}`);
  }
  if (account.selectedChain !== chainId) {
    throw new Error(`chain_not_selected:${chainId}`);
  }
}

export function unlockChain(
  account: AccountChains,
  chainId: ChainId,
): AccountChains {
  if (account.unlockedChains.includes(chainId)) return account;
  return {
    ...account,
    unlockedChains: [...account.unlockedChains, chainId],
  };
}

export function selectChain(
  account: AccountChains,
  chainId: ChainId,
): AccountChains {
  if (!account.unlockedChains.includes(chainId)) {
    throw new Error(`chain_locked:${chainId}`);
  }
  return { ...account, selectedChain: chainId };
}

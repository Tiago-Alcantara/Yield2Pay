export async function ensureStellarWallet(deps: {
  existingAddress: string | null;
  createWallet: () => Promise<string>;
  registerWallet: (address: string) => Promise<void>;
}): Promise<string> {
  const address = deps.existingAddress ?? (await deps.createWallet());
  await deps.registerWallet(address);
  return address;
}

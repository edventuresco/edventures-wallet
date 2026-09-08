/**
 * The family's money in one number: the family wallet plus every kid's
 * three jars. Pure; the family page reads the balances and adds them here.
 */
export type JarUnits = { spend: bigint; save: bigint; share: bigint };

export function kidsTotalUnits(kids: JarUnits[]): bigint {
  return kids.reduce((sum, k) => sum + k.spend + k.save + k.share, 0n);
}

export function familyTotalUnits(familyWalletUnits: bigint, kids: JarUnits[]): bigint {
  return familyWalletUnits + kidsTotalUnits(kids);
}

import { bech32m } from '@scure/base';
import { secp256k1 } from '@noble/curves/secp256k1.js';

export class SpiritAddressError extends Error {
  constructor(
    message: string,
    public readonly code: 'encoding' | 'network' | 'version' | 'length' | 'key',
  ) {
    super(message);
    this.name = 'SpiritAddressError';
  }
}

export interface SilentPaymentAddress {
  readonly address: string;
  readonly network: 'mainnet' | 'testnet';
  readonly version: 0;
  readonly scanKey: Uint8Array;
  readonly spendKey: Uint8Array;
}

/** Validates BIP352 v0, including Bech32m padding and both compressed curve points. */
export function parseAddress(input: string): SilentPaymentAddress {
  if (typeof input !== 'string' || !input.trim())
    throw new SpiritAddressError(
      'Enter a Silent Payment address beginning with sp1 or tsp1.',
      'encoding',
    );
  const value = input.trim();
  let decoded: ReturnType<typeof bech32m.decode>;
  try {
    decoded = bech32m.decode(value as `${string}1${string}`, 1023);
  } catch {
    throw new SpiritAddressError(
      'The address has an invalid Bech32m checksum, character, or letter case.',
      'encoding',
    );
  }
  if (decoded.prefix !== 'sp' && decoded.prefix !== 'tsp')
    throw new SpiritAddressError(
      'Use an sp1 mainnet address or a tsp1 test-network address.',
      'network',
    );
  if (decoded.words[0] !== 0)
    throw new SpiritAddressError(
      'This experimental release supports Silent Payments version 0 only.',
      'version',
    );
  let bytes: Uint8Array;
  try {
    bytes = bech32m.fromWords(decoded.words.slice(1));
  } catch {
    throw new SpiritAddressError('The address has invalid padding.', 'encoding');
  }
  if (bytes.length !== 66)
    throw new SpiritAddressError(
      'A version 0 address must contain two 33-byte public keys.',
      'length',
    );
  const scanKey = bytes.slice(0, 33),
    spendKey = bytes.slice(33);
  try {
    for (const key of [scanKey, spendKey]) {
      if (key[0] !== 2 && key[0] !== 3) throw new Error('Uncompressed point');
      secp256k1.Point.fromBytes(key).assertValidity();
    }
  } catch {
    throw new SpiritAddressError('The address contains an invalid secp256k1 public key.', 'key');
  }
  return {
    address: value.toLowerCase(),
    network: decoded.prefix === 'sp' ? 'mainnet' : 'testnet',
    version: 0,
    scanKey,
    spendKey,
  };
}

/** Encodes public keys only; creating real labelled keys belongs to wallet software. */
export function encodeAddress(
  scanKey: Uint8Array,
  spendKey: Uint8Array,
  network: 'mainnet' | 'testnet' = 'testnet',
): string {
  if (network !== 'mainnet' && network !== 'testnet')
    throw new SpiritAddressError('Unknown address network.', 'network');
  const bytes = new Uint8Array(66);
  if (scanKey.length !== 33 || spendKey.length !== 33)
    throw new SpiritAddressError('Expected two compressed public keys.', 'length');
  bytes.set(scanKey);
  bytes.set(spendKey, 33);
  const address = bech32m.encode(
    network === 'mainnet' ? 'sp' : 'tsp',
    [0, ...bech32m.toWords(bytes)],
    1023,
  );
  return parseAddress(address).address;
}

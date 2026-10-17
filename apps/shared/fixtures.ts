// Development fixtures only. All keys derive from public strings: never receive funds.
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { concatBytes, utf8ToBytes, bytesToHex } from '@noble/hashes/utils.js';
import { encodeAddress } from '@remcoros/spirits';
const ORDER = secp256k1.Point.Fn.ORDER;
const scalar = (bytes: Uint8Array) => BigInt('0x' + bytesToHex(bytes));
const key = (text: string) =>
  (scalar(sha256(utf8ToBytes(`SPirits public test fixture/${text}`))) % (ORDER - 1n)) + 1n;
const ser = (n: bigint) =>
  Uint8Array.from(
    n
      .toString(16)
      .padStart(64, '0')
      .match(/../g)!
      .map((x) => parseInt(x, 16)),
  );

export function fixtureAddress(
  seed: string,
  label = 1,
  network: 'mainnet' | 'testnet' = 'testnet',
): string {
  if (!Number.isInteger(label) || label < 1 || label > 0xffffffff)
    throw new RangeError('Fixture labels must be integers from 1 to 4294967295.');
  const scan = key(`${seed}/scan`),
    spend = key(`${seed}/spend`);
  const tag = sha256(utf8ToBytes('BIP0352/Label'));
  const index = new Uint8Array(4);
  new DataView(index.buffer).setUint32(0, label, false);
  const tweak = scalar(sha256(concatBytes(tag, tag, ser(scan), index))) % ORDER;
  const scanPub = secp256k1.Point.BASE.multiply(scan).toBytes(true);
  const spendPub = secp256k1.Point.BASE.multiply(spend)
    .add(secp256k1.Point.BASE.multiply(tweak))
    .toBytes(true);
  return encodeAddress(scanPub, spendPub, network);
}

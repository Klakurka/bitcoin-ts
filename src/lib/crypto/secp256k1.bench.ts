/* eslint-disable functional/no-expression-statement, functional/no-let, init-declarations */
import { randomBytes } from 'crypto';

import test from 'ava';
import suite from 'chuhai';
import * as elliptic from 'elliptic';
import * as secp256k1Node from 'secp256k1';

import { binToHex } from '../utils/hex';

import { instantiateSecp256k1, Secp256k1 } from './secp256k1';

const secp256k1Promise = instantiateSecp256k1();
const privKeyLength = 32;
const getValidPrivateKey = (secp256k1: Secp256k1): Uint8Array => {
  let privKey: Uint8Array;
  // eslint-disable-next-line functional/no-loop-statement
  do {
    privKey = randomBytes(privKeyLength);
  } while (!secp256k1.validatePrivateKey(privKey));
  return privKey;
};

const setup = async () => ({
  ellipticEc: new elliptic.ec('secp256k1'), // eslint-disable-line new-cap
  secp256k1: await secp256k1Promise
});

/**
 * Note: elliptic doesn't document an equivalent to verifySignatureDERLowS, so
 * these benchmarks slightly overestimate elliptic's performance in applications
 * where Low-S verification is required (i.e. Bitcoin).
 *
 * We also help secp256k1-node a bit by converting each of it's inputs into
 * Node.js `Buffer` objects. So its performance here is a best case.
 */
test('bench: secp256k1: verify signature Low-S, uncompressed pubkey', async t => {
  const { ellipticEc, secp256k1 } = await setup();
  await suite(t.title, s => {
    let messageHash: Uint8Array;
    let pubkeyUncompressed: Uint8Array;
    let sigDER: Uint8Array;
    let result: boolean;
    let ellipticPublicKey: elliptic.ec.KeyPair;
    const nextCycle = () => {
      const privKey = getValidPrivateKey(secp256k1);
      messageHash = randomBytes(privKeyLength);
      pubkeyUncompressed = secp256k1.derivePublicKeyUncompressed(privKey);
      ellipticPublicKey = ellipticEc.keyFromPublic(
        binToHex(pubkeyUncompressed),
        'hex'
      );
      sigDER = secp256k1.signMessageHashDER(privKey, messageHash);
      result = false;
    };
    nextCycle();
    s.bench('bitcoin-ts', () => {
      result = secp256k1.verifySignatureDERLowS(
        sigDER,
        pubkeyUncompressed,
        messageHash
      );
    });
    s.bench('elliptic', () => {
      result = ellipticEc
        .keyFromPublic(ellipticPublicKey)
        .verify(messageHash, sigDER);
    });
    s.bench('secp256k1-node', () => {
      result = secp256k1Node.ecdsaVerify(
        secp256k1Node.signatureImport(sigDER),
        messageHash,
        pubkeyUncompressed
      );
    });
    s.cycle(() => {
      t.true(result);
      nextCycle();
    });
  });
});

test('bench: secp256k1: verify signature Low-S, compressed pubkey', async t => {
  const { ellipticEc, secp256k1 } = await setup();
  await suite(t.title, s => {
    let messageHash: Uint8Array;
    let pubkeyCompressed: Uint8Array;
    let sigDER: Uint8Array;
    let result: boolean;
    let ellipticPublicKey: elliptic.ec.KeyPair;
    const nextCycle = () => {
      const privKey = getValidPrivateKey(secp256k1);
      messageHash = randomBytes(privKeyLength);
      pubkeyCompressed = secp256k1.derivePublicKeyCompressed(privKey);
      ellipticPublicKey = ellipticEc.keyFromPublic(
        binToHex(pubkeyCompressed),
        'hex'
      );
      sigDER = secp256k1.signMessageHashDER(privKey, messageHash);
      result = false;
    };
    nextCycle();
    s.bench('bitcoin-ts', () => {
      result = secp256k1.verifySignatureDERLowS(
        sigDER,
        pubkeyCompressed,
        messageHash
      );
    });
    s.bench('elliptic', () => {
      result = ellipticEc
        .keyFromPublic(ellipticPublicKey)
        .verify(messageHash, sigDER);
    });
    s.bench('secp256k1-node', () => {
      result = secp256k1Node.ecdsaVerify(
        secp256k1Node.signatureImport(sigDER),
        messageHash,
        pubkeyCompressed
      );
    });
    s.cycle(() => {
      t.true(result);
      nextCycle();
    });
  });
});

test('bench: secp256k1: derive compressed pubkey', async t => {
  const { ellipticEc, secp256k1 } = await setup();
  await suite(t.title, s => {
    let privKey: Uint8Array;
    let pubkeyCompressedExpected: Uint8Array;
    let pubkeyCompressedBenchmark: Uint8Array;
    const nextCycle = () => {
      privKey = getValidPrivateKey(secp256k1);
      pubkeyCompressedExpected = secp256k1.derivePublicKeyCompressed(privKey);
    };
    nextCycle();
    s.bench('bitcoin-ts', () => {
      pubkeyCompressedBenchmark = secp256k1.derivePublicKeyCompressed(privKey);
    });
    s.bench('elliptic', () => {
      pubkeyCompressedBenchmark = Uint8Array.from(
        ellipticEc
          .keyFromPrivate(privKey)
          .getPublic()
          .encodeCompressed()
      );
    });
    s.bench('secp256k1-node', () => {
      pubkeyCompressedBenchmark = secp256k1Node.publicKeyCreate(privKey, true);
    });
    s.cycle(() => {
      t.deepEqual(pubkeyCompressedExpected, pubkeyCompressedBenchmark);
      nextCycle();
    });
  });
});

test('bench: secp256k1: create DER Low-S signature', async t => {
  const { ellipticEc, secp256k1 } = await setup();
  await suite(t.title, s => {
    let privKey: Uint8Array;
    let messageHash: Uint8Array;
    let sigDERExpected: Uint8Array;
    let sigDERBenchmark: Uint8Array;
    const nextCycle = () => {
      privKey = getValidPrivateKey(secp256k1);
      messageHash = randomBytes(privKeyLength);
      sigDERExpected = secp256k1.signMessageHashDER(privKey, messageHash);
    };
    nextCycle();
    s.bench('bitcoin-ts', () => {
      sigDERBenchmark = secp256k1.signMessageHashDER(privKey, messageHash);
    });
    s.bench('elliptic', () => {
      sigDERBenchmark = ellipticEc
        .keyFromPrivate(privKey)
        .sign(messageHash)
        .toDER();
    });
    s.bench('secp256k1-node', () => {
      sigDERBenchmark = secp256k1Node.signatureExport(
        secp256k1Node.ecdsaSign(messageHash, privKey).signature
      );
    });
    s.cycle(() => {
      /**
       * Since Elliptic doesn't document a way to create Low-S signatures, we
       * normalize the results to validate them. This may overestimate
       * Elliptic's performance slightly.
       */
      t.deepEqual(
        sigDERExpected,
        secp256k1.normalizeSignatureDER(new Uint8Array(sigDERBenchmark))
      );
      nextCycle();
    });
  });
});

test('bench: secp256k1: sign: Schnorr vs. ECDSA', async t => {
  const { secp256k1 } = await setup();
  await suite(t.title, s => {
    let privKey: Uint8Array;
    let messageHash: Uint8Array;
    let sigDERExpected: Uint8Array;
    let sigDERBenchmark: Uint8Array;
    let sigSchnorrExpected: Uint8Array;
    let sigSchnorrBenchmark: Uint8Array;
    let isSchnorr: boolean;
    const nextCycle = () => {
      privKey = getValidPrivateKey(secp256k1);
      messageHash = randomBytes(privKeyLength);
      sigDERExpected = secp256k1.signMessageHashDER(privKey, messageHash);
      sigSchnorrExpected = secp256k1.signMessageHashSchnorr(
        privKey,
        messageHash
      );
    };
    nextCycle();
    s.bench('secp256k1.signMessageHashDER', () => {
      isSchnorr = false;
      sigDERBenchmark = secp256k1.signMessageHashDER(privKey, messageHash);
    });
    s.bench('secp256k1.signMessageHashSchnorr', () => {
      isSchnorr = true;
      sigSchnorrBenchmark = secp256k1.signMessageHashSchnorr(
        privKey,
        messageHash
      );
    });
    s.cycle(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      isSchnorr
        ? t.deepEqual(sigSchnorrExpected, sigSchnorrBenchmark)
        : t.deepEqual(sigDERExpected, sigDERBenchmark);
      nextCycle();
    });
  });
});

test('bench: secp256k1: verify: Schnorr vs. ECDSA', async t => {
  const { secp256k1 } = await setup();
  await suite(t.title, s => {
    let messageHash: Uint8Array;
    let pubkeyCompressed: Uint8Array;
    let sigDER: Uint8Array;
    let sigSchnorr: Uint8Array;
    let result: boolean;
    const nextCycle = () => {
      const privKey = getValidPrivateKey(secp256k1);
      messageHash = randomBytes(privKeyLength);
      pubkeyCompressed = secp256k1.derivePublicKeyCompressed(privKey);
      sigDER = secp256k1.signMessageHashDER(privKey, messageHash);
      sigSchnorr = secp256k1.signMessageHashSchnorr(privKey, messageHash);
      result = false;
    };
    nextCycle();
    s.bench(
      'secp256k1.verifySignatureDERLowS (ECDSA, pubkey compressed)',
      () => {
        result = secp256k1.verifySignatureDERLowS(
          sigDER,
          pubkeyCompressed,
          messageHash
        );
      }
    );
    s.bench(
      'secp256k1.verifySignatureSchnorr (Schnorr, pubkey compressed)',
      () => {
        result = secp256k1.verifySignatureSchnorr(
          sigSchnorr,
          pubkeyCompressed,
          messageHash
        );
      }
    );
    s.cycle(() => {
      t.true(result);
      nextCycle();
    });
  });
});

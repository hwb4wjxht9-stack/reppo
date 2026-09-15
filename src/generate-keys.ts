#!/usr/bin/env node
/**
 * Generates an Ed25519 key pair for Robinhood API credentials.
 *
 * Register the printed public key in Robinhood (crypto account settings -> API keys);
 * keep the private key local as ROBINHOOD_PRIVATE_KEY.
 */

import nacl from "tweetnacl";

const seed = nacl.randomBytes(nacl.sign.seedLength);
const keyPair = nacl.sign.keyPair.fromSeed(seed);

console.log("Public key  (register this with Robinhood):");
console.log(Buffer.from(keyPair.publicKey).toString("base64"));
console.log();
console.log("Private key (set as ROBINHOOD_PRIVATE_KEY — never commit or share it):");
console.log(Buffer.from(seed).toString("base64"));

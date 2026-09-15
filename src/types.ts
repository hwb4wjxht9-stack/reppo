export interface RobinhoodCredentials {
  apiKey: string;
  /** Base64-encoded 32-byte Ed25519 seed, or the 64-byte expanded secret key. */
  privateKeyBase64: string;
  baseUrl: string;
}

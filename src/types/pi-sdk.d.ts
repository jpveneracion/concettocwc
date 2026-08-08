/**
 * Type declarations for the Pi Network SDK (https://sdk.minepi.com/pi-sdk.js)
 * Pi SDK v2 surface used by this app: init, signIn, authenticate, createPayment.
 */
export {};

declare global {
  interface Window {
    Pi: PiSDK;
  }
}

export interface PiSDK {
  /** Initialize the SDK. Call once after the script loads. */
  init(options: { version: string }): void;
  /** Implicit OAuth sign-in (redirect flow). */
  signIn(options: {
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state?: string;
  }): void;
  /** Authenticate the user with requested scopes (requires Pi Browser). */
  authenticate(
    scopes: string[],
    onIncompletePaymentFound?: (payment: unknown) => void
  ): Promise<{ accessToken: string; user: { username: string } }>;
  /** Create and open a Pi payment dialog (requires Pi Browser). */
  createPayment(
    paymentData: {
      amount: number;
      memo: string;
      metadata?: Record<string, unknown>;
    },
    callbacks: {
      onReadyForServerApproval(paymentId: string): void;
      onReadyForServerCompletion(paymentId: string, txid?: string): void;
      onCancel(paymentId: string): void;
      onError(error: Error, payment?: unknown): void;
    }
  ): Promise<void>;
  /** Resume an incomplete payment (requires Pi Browser). */
  openPayment(
    paymentId: string,
    callbacks?: {
      onReadyForServerApproval(paymentId: string): void;
      onReadyForServerCompletion(paymentId: string, txid?: string): void;
      onCancel(paymentId: string): void;
      onError(error: Error, payment?: unknown): void;
    }
  ): void;
}

import { v4 as uuidv4 } from 'uuid';

export const idempotency = {};

export function generateIdempotencyKey(): string {
  return uuidv4();
}

export function generateTransactionId(): string {
  return uuidv4();
}

import * as crypto from 'crypto';

export function v4Style(): string {
  return crypto.randomUUID();
}

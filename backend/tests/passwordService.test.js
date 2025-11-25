import { describe, expect, it } from 'vitest';
import {
  calculatePasswordExpiry,
  hashPassword,
  isPasswordExpired,
  verifyPassword
} from '../auth/passwordService.js';

describe('passwordService', () => {
  it('hashes and verifies passwords successfully', async () => {
    const plain = 'StrongPassword!123';
    const hashed = await hashPassword(plain);

    expect(hashed).not.toBe(plain);
    await expect(verifyPassword(plain, hashed)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hashed)).resolves.toBe(false);
  });

  it('calculates expiry date in the future', () => {
    const expiresAt = calculatePasswordExpiry();
    const expiresDate = new Date(expiresAt).getTime();

    expect(Number.isNaN(expiresDate)).toBe(false);
    expect(expiresDate).toBeGreaterThan(Date.now());
  });

  it('detects expired passwords correctly', () => {
    const pastDate = new Date(Date.now() - 1000).toISOString();
    const futureDate = new Date(Date.now() + 1000).toISOString();

    expect(isPasswordExpired(pastDate)).toBe(true);
    expect(isPasswordExpired(futureDate)).toBe(false);
    expect(isPasswordExpired(null)).toBe(false);
  });
});

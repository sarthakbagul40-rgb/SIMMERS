import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/lib/password.js';
import { generateToken, verifyToken } from '../../src/lib/jwt.js';
import { generateInviteCode } from '../../src/lib/inviteCode.js';

describe('Auth & Utility Unit Tests', () => {
  it('should hash and verify passwords correctly', async () => {
    const rawPassword = 'SuperSecret123!';
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith('$2')).toBe(true);

    const isValid = await verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('should generate and verify JWT tokens correctly', () => {
    const payload = { userId: 'usr_123', email: 'chef@simmers.app' };
    const token = generateToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
  });

  it('should generate uppercase 6-character unique invite codes', () => {
    const code1 = generateInviteCode();
    const code2 = generateInviteCode();

    expect(code1.length).toBe(6);
    expect(code2.length).toBe(6);
    expect(code1).toBe(code1.toUpperCase());
    expect(code1).not.toBe(code2);
  });
});

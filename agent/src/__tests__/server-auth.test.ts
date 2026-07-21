import { describe, expect, it } from 'vitest';
import { isServiceTokenValid } from '../server/service-auth.js';

const TOKEN = 'super-secret-token';

describe('isServiceTokenValid', () => {
  it('accepts a matching Bearer token', () => {
    expect(isServiceTokenValid(`Bearer ${TOKEN}`, TOKEN, true)).toBe(true);
  });

  it('rejects a wrong token', () => {
    expect(isServiceTokenValid('Bearer wrong', TOKEN, true)).toBe(false);
  });

  it('rejects a header without the Bearer scheme', () => {
    expect(isServiceTokenValid(TOKEN, TOKEN, true)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isServiceTokenValid(undefined, TOKEN, true)).toBe(false);
  });

  it('rejects when the token is unset in production (fail-closed)', () => {
    expect(isServiceTokenValid(`Bearer ${TOKEN}`, undefined, true)).toBe(false);
  });

  it('allows requests when the token is unset outside production', () => {
    expect(isServiceTokenValid(undefined, undefined, false)).toBe(true);
  });
});

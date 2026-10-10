import assert from 'assert';
import { generateToken, verifyToken } from '../utils/jwt.js';

export async function runAuthSessionTests(): Promise<void> {
  console.log('🧪 RUNNING AUTHENTICATION & SESSION SYNC AUDIT TESTS...\n');

  // Test 1: JWT Token Generation & Verification
  const token = generateToken({ userId: 999, username: 'TestMaster', email: 'testmaster@kybien.com' });
  assert.strictEqual(typeof token, 'string', 'Token should be a valid string');

  const payload = verifyToken(token);
  assert.notStrictEqual(payload, null, 'Token should be verifiable');
  assert.strictEqual(payload?.username, 'TestMaster');
  assert.strictEqual(payload?.userId, 999);

  // Test 2: Invalid / Expired Token Rejection
  const invalidToken = 'invalid.jwt.token.string';
  const invalidPayload = verifyToken(invalidToken);
  assert.strictEqual(invalidPayload, null, 'Invalid token must return null (401/403 trigger)');

  // Test 3: Account Switching Protection
  const tokenUserA = generateToken({ userId: 1, username: 'UserA', email: 'a@kybien.com' });
  const tokenUserB = generateToken({ userId: 2, username: 'UserB', email: 'b@kybien.com' });
  
  const payloadA = verifyToken(tokenUserA);
  const payloadB = verifyToken(tokenUserB);

  assert.strictEqual(payloadA?.username, 'UserA');
  assert.strictEqual(payloadB?.username, 'UserB');
  assert.notStrictEqual(payloadA?.userId, payloadB?.userId, 'Account switching must return distinct user identities');

  console.log('✅ All Auth Session Audit Tests Passed Successfully!');
}

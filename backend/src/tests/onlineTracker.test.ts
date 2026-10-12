import assert from 'assert';
import { onlineTracker } from '../services/onlineTracker.js';

export async function runOnlineTrackerTests(): Promise<void> {
  console.log('🧪 RUNNING ONLINE TRACKER SYSTEM TESTS...\n');

  onlineTracker.reset();

  // Test 1: Initial state
  console.log('-> Test 1: Initial state must be 0...');
  let stats = onlineTracker.getStats();
  assert.strictEqual(stats.total, 0);
  assert.strictEqual(stats.members, 0);
  assert.strictEqual(stats.guests, 0);
  console.log('✅ Test 1 Passed!');

  // Test 2: Adding guests
  console.log('\n-> Test 2: Adding 3 guests...');
  onlineTracker.addGuest('guest_sock_1');
  onlineTracker.addGuest('guest_sock_2');
  onlineTracker.addGuest('guest_sock_3');
  stats = onlineTracker.getStats();
  assert.strictEqual(stats.guests, 3);
  assert.strictEqual(stats.members, 0);
  assert.strictEqual(stats.total, 3);
  console.log('✅ Test 2 Passed!');

  // Test 3: Adding members with multi-tab deduplication
  console.log('\n-> Test 3: Multi-tab deduplication for members...');
  onlineTracker.addMember(1001, 'user1_tab_1');
  onlineTracker.addMember(1001, 'user1_tab_2'); // User 1001 opens second tab
  onlineTracker.addMember(1002, 'user2_tab_1'); // User 1002 opens 1 tab

  stats = onlineTracker.getStats();
  assert.strictEqual(stats.members, 2, '2 unique users even if user1 opened 2 tabs');
  assert.strictEqual(stats.guests, 3);
  assert.strictEqual(stats.total, 5);
  console.log('✅ Test 3 Passed!');

  // Test 4: Guest logs in (promotion from guest to member)
  console.log('\n-> Test 4: Guest logs in on guest_sock_1...');
  onlineTracker.addMember(1003, 'guest_sock_1'); // Same socket promotes to member 1003

  stats = onlineTracker.getStats();
  assert.strictEqual(stats.guests, 2, 'Guests must decrease from 3 to 2');
  assert.strictEqual(stats.members, 3, 'Members must increase from 2 to 3');
  assert.strictEqual(stats.total, 5);
  console.log('✅ Test 4 Passed!');

  // Test 5: Tab closing and disconnecting
  console.log('\n-> Test 5: Tab closing & disconnection...');
  onlineTracker.removeSocket('user1_tab_1'); // User 1001 closes first tab, still has tab 2
  stats = onlineTracker.getStats();
  assert.strictEqual(stats.members, 3, 'User 1001 still online via tab 2');

  onlineTracker.removeSocket('user1_tab_2'); // User 1001 closes last tab
  stats = onlineTracker.getStats();
  assert.strictEqual(stats.members, 2, 'User 1001 is now offline');

  onlineTracker.removeSocket('guest_sock_2'); // One guest leaves
  stats = onlineTracker.getStats();
  assert.strictEqual(stats.guests, 1);
  assert.strictEqual(stats.total, 3);
  console.log('✅ Test 5 Passed!');

  onlineTracker.reset();
  console.log('\n==================================================');
  console.log('🎉 ALL ONLINE TRACKER SYSTEM TESTS PASSED 100%!');
  console.log('==================================================\n');
}

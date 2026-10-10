import assert from 'assert';
import { escapeHtmlText, escapeHtmlAttr, escapeJsonAttr } from '../utils/sanitize.js';

export async function runSanitizeAuditTests(): Promise<void> {
  console.log('🧪 RUNNING SANITIZE & AUDIT TESTS...\n');

  // Test 1: escapeHtmlText
  const unsafeText = '<script>alert("xss")</script> & "foo"';
  const escapedText = escapeHtmlText(unsafeText);
  assert.strictEqual(escapedText, '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;foo&quot;');
  assert.strictEqual(escapeHtmlText(null), '');
  assert.strictEqual(escapeHtmlText(123), '123');

  // Test 2: escapeHtmlAttr
  const unsafeAttr = 'hello" onload="alert(1)\' & <tag>';
  const escapedAttr = escapeHtmlAttr(unsafeAttr);
  assert.strictEqual(escapedAttr, 'hello&quot; onload=&quot;alert(1)&#39; &amp; &lt;tag&gt;');

  // Test 3: escapeJsonAttr
  const jsonObj = { player: "O'Connor <script>", moves: ["6,0-5,0", "CARD:spell'->1,2"] };
  const escapedJsonAttr = escapeJsonAttr(jsonObj);
  assert.strictEqual(escapedJsonAttr.includes("'"), false, 'escapeJsonAttr should replace single quotes with &#39;');
  assert.strictEqual(escapedJsonAttr.includes('"'), true, 'escapeJsonAttr should preserve JSON double quotes for getAttribute parsing');

  console.log('✅ All Sanitize & Audit Tests Passed Successfully!');
}

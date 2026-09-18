import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReport } from '../src/views/ip/model/report.ts';

test('the report leads with the address and a quality verdict', () => {
  const text = buildReport({
    coffee: {
      ip: '1.1.1.1',
      country: '澳大利亚',
      isp: 'Cloudflare',
      asn: 13335,
      asOrganization: 'Cloudflare, Inc.',
      trust_score: 90,
      is_public_service: true,
    },
  });
  const lines = text.split('\n');
  assert.equal(lines[0], 'IP: 1.1.1.1');
  assert.ok(text.includes('澳大利亚 · Cloudflare'));
  assert.ok(text.includes('AS13335 Cloudflare, Inc.'));
  assert.ok(text.includes('质量结论: 需核实 · 公共服务'));
  assert.ok(text.includes('公共服务'));
  assert.ok(text.includes('IPQualityScore'));
  assert.ok(text.includes('AbuseIPDB'));
  assert.ok(!text.includes('undefined'));
  assert.ok(!text.includes('null'));
});

test('a bare address still produces a readable report with no empty lines', () => {
  const text = buildReport({ coffee: { ip: '203.0.113.7' } });
  const lines = text.split('\n');
  assert.equal(lines[0], 'IP: 203.0.113.7');
  assert.ok(lines.length >= 2);
  assert.ok(lines.every((line) => line.trim().length > 0));
});

test('an out-of-range Coffee score is not printed as if it were a purity number', () => {
  const text = buildReport({
    coffee: { ip: '203.0.113.7', trust_score: 140 },
  });
  assert.ok(!text.includes('140'));
});

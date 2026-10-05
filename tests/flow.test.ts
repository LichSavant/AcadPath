import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importCurriculum } from '../lib/import.ts';
import {
  summary,
  forecast,
  simulate,
  planWarnings,
  type RecordData,
} from '../lib/academic.ts';
const base = process.env.ACADPATH_TEST_URL ?? 'http://localhost:3000';
void test('HTTP flow: auth → import → mark → save → reload → plan → isolated simulation', async () => {
  const unauthorized = await fetch(base + '/api/record');
  assert.equal(unauthorized.status, 401);
  const login = await fetch(
    base + '/signin-with-chatgpt?return_to=/workspace',
    { redirect: 'manual' },
  );
  assert.equal(login.status, 302);
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert.ok(cookie);
  const headers = {
    Cookie: cookie,
    'Content-Type': 'application/json',
    Origin: base,
  };
  const request = async (method: string, body?: unknown) => {
    const res = await fetch(base + '/api/record', {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    return {
      res,
      value: (await res.json()) as {
        data: RecordData | null;
        revision: number;
        error?: string;
      },
    };
  };
  const original = await request('GET');
  assert.equal(original.res.status, 200);
  // This test uses the dedicated local development identity. Restore existing data.
  let revision = original.value.revision;
  const curriculum = importCurriculum(
    await readFile(
      new URL('../public/curriculum-template.csv', import.meta.url),
      'utf8',
    ),
    'Test import.csv',
  );
  let data: RecordData = {
    curriculum: {
      ...curriculum,
      program: 'Test program',
      curriculumYear: 2024,
    },
    profile: { name: 'Test student' },
    statuses: { CS101: 'completed', CS102: 'current' },
    settings: {
      startYear: 2026,
      startSemester: 1,
      maxUnits: 21,
      assumeCurrentPass: true,
    },
    plan: [],
  };
  try {
    const confirmed = await request('PUT', {
      data: { ...data, statuses: {}, setupComplete: false },
      revision,
    });
    assert.equal(confirmed.res.status, 200);
    revision = confirmed.value.revision;
    const setupReload = await request('GET');
    assert.equal(setupReload.value.data?.setupComplete, false);
    assert.deepEqual(setupReload.value.data?.statuses, {});
    const premature = await request('PUT', {
      data: { ...data, setupComplete: true },
      revision,
    });
    assert.equal(premature.res.status, 400);
    data = {
      ...data,
      setupComplete: true,
      statuses: Object.fromEntries(
        data.curriculum.subjects.map((s) => [
          s.code,
          data.statuses[s.code] ?? 'remaining',
        ]),
      ),
    };
    const saved = await request('PUT', { data, revision });
    assert.equal(saved.res.status, 200);
    revision = saved.value.revision;
    const reread = await request('GET');
    assert.deepEqual(reread.value.data, data);
    assert.equal(summary(data).completedUnits, 3);
    assert.equal(summary(data).current.length, 1);
    const stale = await request('PUT', { data, revision: revision - 1 });
    assert.equal(stale.res.status, 409);
    data = { ...data, plan: forecast(data).plan };
    assert.deepEqual(planWarnings(data), []);
    const planSaved = await request('PUT', { data, revision });
    assert.equal(planSaved.res.status, 200);
    revision = planSaved.value.revision;
    const before = JSON.stringify(data);
    simulate(data, { code: 'CS102', action: 'fail', term: 0 });
    assert.equal(JSON.stringify(data), before);
    const after = await request('GET');
    assert.deepEqual(after.value.data, data);
    const invalidPlan = await request('PUT', {
      data: { ...data, plan: [{ term: 0, codes: ['CS101'] }] },
      revision,
    });
    assert.equal(invalidPlan.res.status, 400);
    const gradeChange = {
      ...data,
      statuses: { ...data.statuses, CS102: 'failed' },
    };
    const gradeSaved = await request('PUT', { data: gradeChange, revision });
    assert.equal(gradeSaved.res.status, 200);
    revision = gradeSaved.value.revision;
    assert.ok(planWarnings(gradeSaved.value.data!).length > 0);
    const repaired = await request('PUT', { data, revision });
    assert.equal(repaired.res.status, 200);
    revision = repaired.value.revision;
    const invalid = await request('PUT', {
      data: { ...data, statuses: { GHOST: 'completed' } },
      revision,
    });
    assert.equal(invalid.res.status, 400);
    const crossOrigin = await fetch(base + '/api/record', {
      method: 'PUT',
      headers: { ...headers, Origin: 'https://untrusted.example' },
      body: JSON.stringify({ data, revision }),
    });
    assert.equal(crossOrigin.status, 403);
    const workspace = await fetch(base + '/workspace', {
      headers: { Cookie: cookie },
    });
    assert.equal(workspace.status, 200);
    const html = await workspace.text();
    assert.ok(html.includes('AcadPath'));
    assert.ok(html.includes('Semester Planner'));
    assert.ok(!html.includes('Internal Server Error'));
  } finally {
    if (original.value.data) {
      const restored = await request('PUT', {
        data: original.value.data,
        revision,
      });
      assert.equal(restored.res.status, 200);
    }
  }
});

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getBinding } from '@/db';
import { validateRecord } from '@/lib/import';
import { planWarnings, type RecordData } from '@/lib/academic';

export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET() {
  const user = await getChatGPTUser();
  if (!user)
    return json({ error: 'Sign in to access your academic record.' }, 401);
  try {
    const row = await getBinding()
      .prepare(
        'SELECT document, revision FROM student_records WHERE user_id = ?',
      )
      .bind(user.userId)
      .first<{ document: string; revision: number }>();
    return json({
      data: row ? JSON.parse(row.document) : null,
      revision: row?.revision ?? 0,
    });
  } catch (error) {
    console.error('Record read failed', error);
    return json(
      {
        error:
          'Your record could not be loaded. Please retry. For local setup, apply the database migration.',
      },
      503,
    );
  }
}
export async function PUT(request: Request) {
  const user = await getChatGPTUser();
  if (!user)
    return json({ error: 'Sign in to save your academic record.' }, 401);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return json({ error: 'Use application/json.' }, 415);
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    return json({ error: 'Cross-origin writes are not allowed.' }, 403);
  let data, revision: number;
  try {
    const body = await request.text();
    if (body.length > 1_000_000)
      return json({ error: 'Record is too large.' }, 413);
    const input = JSON.parse(body);
    data = validateRecord(input.data);
    revision = input.revision;
    if (!Number.isInteger(revision) || revision < 0)
      throw new Error('Invalid record revision.');
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Invalid record.' },
      400,
    );
  }
  // Conflicting academic plans may be retained when a real grade changes. The UI
  // shows planWarnings and withholds a valid-plan label until they are corrected.
  try {
    const existing = await getBinding()
      .prepare(
        'SELECT document, revision FROM student_records WHERE user_id = ?',
      )
      .bind(user.userId)
      .first<{ document: string; revision: number }>();
    if ((existing?.revision ?? 0) !== revision)
      return json(
        { error: 'This record changed in another tab. Reload before saving.' },
        409,
      );
    const previous = existing
      ? (JSON.parse(existing.document) as RecordData)
      : null;
    const planChanged =
      !previous ||
      JSON.stringify(previous.plan) !== JSON.stringify(data.plan) ||
      JSON.stringify(previous.settings) !== JSON.stringify(data.settings);
    const conflicts = planWarnings(data);
    if (planChanged && conflicts.length)
      return json(
        {
          error: 'Resolve plan conflicts before saving: ' + conflicts.join(' '),
        },
        400,
      );
    const result = await getBinding()
      .prepare(
        `INSERT INTO student_records (user_id, display_name, document, revision, updated_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(user_id) DO UPDATE SET document = excluded.document, display_name = excluded.display_name, revision = student_records.revision + 1, updated_at = excluded.updated_at WHERE student_records.revision = ? RETURNING revision`,
      )
      .bind(
        user.userId,
        user.displayName,
        JSON.stringify(data),
        new Date().toISOString(),
        revision,
      )
      .first<{ revision: number }>();
    if (!result)
      return json(
        {
          error:
            'This record changed in another tab. Reload the page before saving to avoid overwriting newer changes.',
        },
        409,
      );
    return json({ data, revision: result.revision });
  } catch (error) {
    console.error('Record save failed', error);
    return json(
      {
        error:
          'Save failed. Your unsaved changes are still on this page. Please retry.',
      },
      503,
    );
  }
}

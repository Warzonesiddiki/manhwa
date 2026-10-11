/**
 * TEST-005 Regression Tests: Durable Project & Revision Persistence (TASK-007, AUDIT F14)
 * Covers:
 * - Project creation, retrieval, listing, update, and deletion.
 * - Optimistic concurrency: If-Match / expectedRevision validation (412 on conflict, 428 if omitted).
 * - ETag header negotiation on GET, POST, and PUT.
 * - Hostile path containment on project IDs (AUDIT F01).
 * - Authentication enforcement (TASK-006).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  bootServer,
  shutdownServer,
  login,
  withCookie,
  TEST_OWNER_TOKEN,
  type BootedServer,
} from '../helpers/boot';

let server: BootedServer;
let base: string;
let cookie: string;

beforeAll(async () => {
  server = await bootServer({ marker: 'PERSISTENCE-TEST' });
  base = server.base;
  cookie = await login(base, TEST_OWNER_TOKEN);
}, 30000);

afterAll(() => shutdownServer(server));

describe('TASK-007 / TEST-005: Project & Revision Persistence', () => {
  const sampleProject = {
    id: 'test_proj_persisted_01',
    title: 'Solo Leveling Marathon',
    titleUrdu: 'سولو لیولنگ مکمل میراتھن',
    sourceVideoUrl: 'https://www.youtube.com/watch?v=sample123',
    uploadedVideoFilename: 'solo_leveling_ep1.mp4',
    totalDurationMinutes: 600,
    genre: 'Action Fantasy',
    mainCharacter: 'Sung Jinwoo',
    arcs: [
      {
        id: 'arc-1',
        arcNumber: 1,
        title: 'D-Rank Dungeon',
        titleUrdu: 'ڈی رینک تہہ خانہ',
        startMinute: 0,
        endMinute: 25,
        durationMinutes: 25,
        chaptersCovered: 'Ch 1-10',
        cliffhangerHook: 'Double Dungeon Awakening',
        cliffhangerHookUrdu: 'ڈبل تہہ خانے کی بیداری',
        pacing: 'Fast',
        status: 'scripted',
        segments: [
          {
            id: 'seg-1',
            start: 0,
            end: 4,
            englishText: 'He was known as the weakest hunter of all mankind.',
            urduText: 'وہ تمام انسانیت کا سب سے کمزور ہنٹر مانا جاتا تھا۔',
            romanUrduText: 'Woh tamam insaniyat ka sab se kamzor hunter mana jata tha.',
            toneDirective: 'Solemn',
          },
        ],
      },
    ],
  };

  it('rejects unauthenticated project access with 401', async () => {
    const res = await fetch(`${base}/api/v1/projects`);
    expect(res.status).toBe(401);
  });

  it('lists projects for authenticated owner', async () => {
    const res = await fetch(`${base}/api/v1/projects`, withCookie(cookie));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.projects)).toBe(true);
  });

  it('creates a new project with initial revision 1 and ETag', async () => {
    const res = await fetch(
      `${base}/api/v1/projects`,
      withCookie(cookie, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleProject),
      })
    );

    expect(res.status).toBe(201);
    expect(res.headers.get('etag')).toBe('"rev-1"');

    const data = await res.json();
    expect(data.project).toBeTruthy();
    expect(data.project.id).toBe(sampleProject.id);
    expect(data.project.revision).toBe(1);
    expect(data.project.title).toBe(sampleProject.title);
    expect(data.project.arcs.length).toBe(1);
    expect(data.project.arcs[0].segments.length).toBe(1);
    expect(data.project.createdAt).toBeTruthy();
    expect(data.project.updatedAt).toBeTruthy();
  });

  it('fetches the persisted project by ID with matching ETag', async () => {
    const res = await fetch(`${base}/api/v1/projects/${sampleProject.id}`, withCookie(cookie));
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"rev-1"');

    const data = await res.json();
    expect(data.project.id).toBe(sampleProject.id);
    expect(data.project.titleUrdu).toBe(sampleProject.titleUrdu);
    expect(data.project.uploadedVideoFilename).toBe('solo_leveling_ep1.mp4');
    expect(data.project.arcs[0].segments[0].urduText).toBe('وہ تمام انسانیت کا سب سے کمزور ہنٹر مانا جاتا تھا۔');
  });

  it('requires If-Match or expectedRevision on update (428 Precondition Required)', async () => {
    const res = await fetch(
      `${base}/api/v1/projects/${sampleProject.id}`,
      withCookie(cookie, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Attempted Update Without Precondition',
        }),
      })
    );

    expect(res.status).toBe(428);
    const err = await res.json();
    const errMsg = typeof err.error === 'string' ? err.error : err.error?.message;
    expect(errMsg).toContain('Precondition Required');
    const currentRev = err.currentRevision ?? err.error?.details?.currentRevision;
    expect(currentRev).toBe(1);
  });

  it('rejects update with mismatched expectedRevision (412 Precondition Failed)', async () => {
    const res = await fetch(
      `${base}/api/v1/projects/${sampleProject.id}`,
      withCookie(cookie, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"rev-99"',
        },
        body: JSON.stringify({
          title: 'Concurrent Edit Test',
          expectedRevision: 99,
        }),
      })
    );

    expect(res.status).toBe(412);
    expect(res.headers.get('etag')).toBe('"rev-1"');
    const err = await res.json();
    const errMsg = typeof err.error === 'string' ? err.error : err.error?.message;
    expect(errMsg).toContain('Precondition Failed');
    const currentRev = err.currentRevision ?? err.error?.details?.currentRevision;
    expect(currentRev).toBe(1);
  });

  it('updates project successfully when expected revision matches and increments revision', async () => {
    const updatedTitle = 'Solo Leveling Marathon (Urdu Re-dub Edition)';
    const res = await fetch(
      `${base}/api/v1/projects/${sampleProject.id}`,
      withCookie(cookie, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"rev-1"',
        },
        body: JSON.stringify({
          project: {
            ...sampleProject,
            title: updatedTitle,
          },
          expectedRevision: 1,
        }),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBe('"rev-2"');

    const data = await res.json();
    expect(data.project.title).toBe(updatedTitle);
    expect(data.project.revision).toBe(2);

    // Verify subsequent read has revision 2 and updated title
    const getRes = await fetch(`${base}/api/v1/projects/${sampleProject.id}`, withCookie(cookie));
    expect(getRes.status).toBe(200);
    expect(getRes.headers.get('etag')).toBe('"rev-2"');
    const getData = await getRes.json();
    expect(getData.project.title).toBe(updatedTitle);
    expect(getData.project.revision).toBe(2);
  });

  it('subsequent edit with stale rev-1 now fails with 412', async () => {
    const res = await fetch(
      `${base}/api/v1/projects/${sampleProject.id}`,
      withCookie(cookie, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': '"rev-1"',
        },
        body: JSON.stringify({
          title: 'Stale Edit',
          expectedRevision: 1,
        }),
      })
    );

    expect(res.status).toBe(412);
    const err = await res.json();
    const currentRev = err.currentRevision ?? err.error?.details?.currentRevision;
    expect(currentRev).toBe(2);
  });

  it('rejects hostile path traversal in project ID with 400 or 404', async () => {
    const traversalIds = ['../escape', '..%2F..%2Fetc%2Fpasswd', 'nested/sub/proj'];
    for (const tid of traversalIds) {
      const res = await fetch(`${base}/api/v1/projects/${encodeURIComponent(tid)}`, withCookie(cookie));
      expect([400, 404]).toContain(res.status);
    }
  });

  it('returns 404 when fetching a non-existent project', async () => {
    const res = await fetch(`${base}/api/v1/projects/non_existent_project_999`, withCookie(cookie));
    expect(res.status).toBe(404);
  });

  it('deletes a project and verifies subsequent fetch returns 404', async () => {
    const delRes = await fetch(`${base}/api/v1/projects/${sampleProject.id}`, withCookie(cookie, {
      method: 'DELETE',
    }));
    expect(delRes.status).toBe(200);

    const getRes = await fetch(`${base}/api/v1/projects/${sampleProject.id}`, withCookie(cookie));
    expect(getRes.status).toBe(404);
  });
});

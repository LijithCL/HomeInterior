import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface AuthResponseBody {
  accessToken: string;
}
interface CreatedRecord {
  id: string;
}
interface ShareLinkResponseBody {
  id: string;
  token: string;
}
interface PublicShareResponseBody {
  project: { id: string; name: string };
}

// Covers the permission model built in Phase 8 (§8 in docs/ARCHITECTURE.md):
// a project's personal owner always has full access; a team member's
// access is exactly their TeamMember role (OWNER/EDITOR/VIEWER); and a
// public share link is genuinely public and genuinely revocable. This is
// the highest-risk logic in the app — get it wrong and either a viewer
// can edit something they shouldn't, or an owner can't manage their own
// project — so it's covered end-to-end against a real database rather
// than mocked.
describe('Project permissions (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const runId = Date.now().toString();
  const ownerEmail = `e2e-owner-${runId}@test.local`;
  const viewerEmail = `e2e-viewer-${runId}@test.local`;
  const password = 'password123';

  let ownerToken: string;
  let viewerToken: string;
  let projectId: string;
  let teamId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Dedicated test database (see test/setup-env.ts), but clean up
    // anyway so repeated local runs don't accumulate rows indefinitely.
    const users = await prisma.user.findMany({
      where: { email: { in: [ownerEmail, viewerEmail] } },
    });
    const userIds = users.map((u) => u.id);
    await prisma.shareLink.deleteMany({
      where: { createdBy: { in: userIds } },
    });
    await prisma.designVersion.deleteMany({
      where: { createdBy: { in: userIds } },
    });
    await prisma.project.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.teamMember.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.team.deleteMany({ where: { ownerId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('registers owner and viewer', async () => {
    const ownerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Owner', email: ownerEmail, password })
      .expect(201);
    ownerToken = (ownerRes.body as AuthResponseBody).accessToken;

    const viewerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Viewer', email: viewerEmail, password })
      .expect(201);
    viewerToken = (viewerRes.body as AuthResponseBody).accessToken;

    expect(ownerToken).toBeTruthy();
    expect(viewerToken).toBeTruthy();
  });

  it('owner creates a project and a team, adds viewer as VIEWER', async () => {
    const projectRes = await request(app.getHttpServer())
      .post('/projects')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E House' })
      .expect(201);
    projectId = (projectRes.body as CreatedRecord).id;

    const teamRes = await request(app.getHttpServer())
      .post('/teams')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'E2E Team' })
      .expect(201);
    teamId = (teamRes.body as CreatedRecord).id;

    await request(app.getHttpServer())
      .post(`/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: viewerEmail, role: 'VIEWER' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/team`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ teamId })
      .expect(200);
  });

  it('viewer can read the team project but cannot save a version', async () => {
    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .expect(200);

    const emptyDoc = {
      schemaVersion: 2,
      floors: [],
      walls: [],
      openings: [],
      rooms: [],
      objects: [],
    };
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/versions`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ document: emptyDoc })
      .expect(403);
  });

  it('owner can save a version', async () => {
    const emptyDoc = {
      schemaVersion: 2,
      floors: [],
      walls: [],
      openings: [],
      rooms: [],
      objects: [],
    };
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/versions`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ document: emptyDoc })
      .expect(201);
  });

  it('viewer cannot create a share link (owner-only) or add members (not team owner)', async () => {
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/share-links`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/teams/${teamId}/members`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ email: 'someone-else@test.local' })
      .expect(403);
  });

  it('a stranger (no membership at all) gets 404, not 403, for the project', async () => {
    const strangerEmail = `e2e-stranger-${runId}@test.local`;
    const strangerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Stranger', email: strangerEmail, password })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/projects/${projectId}`)
      .set(
        'Authorization',
        `Bearer ${(strangerRes.body as AuthResponseBody).accessToken}`,
      )
      .expect(404);

    await prisma.user.delete({ where: { email: strangerEmail } });
  });

  it('creates a public share link, resolves it with no auth, then revokes it', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/projects/${projectId}/share-links`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({})
      .expect(201);
    const { id: linkId, token } = createRes.body as ShareLinkResponseBody;

    const publicRes = await request(app.getHttpServer())
      .get(`/share/${token}`)
      .expect(200);
    expect((publicRes.body as PublicShareResponseBody).project.name).toBe(
      'E2E House',
    );

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/share-links/${linkId}/revoke`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(201);

    await request(app.getHttpServer()).get(`/share/${token}`).expect(404);
  });
});

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {randomBytes} = require('node:crypto');

test('Content deletion respects versions, permissions, public visibility and media usage', async t => {
  const {PrismaClient} = require('@prisma/client');
  const root = path.resolve(__dirname, '..');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bjj-delete-'));
  const url = 'file:' + path.join(dir, 'test.db').replaceAll('\\', '/');
  const env = {...process.env, DATABASE_URL: url, RUST_LOG: 'info'};
  let server, db;
  t.after(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (db) await db.$disconnect();
    fs.rmSync(dir, {recursive: true, force: true});
  });
  execFileSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {cwd: root, env});
  db = new PrismaClient({datasources: {db: {url}}});
  const password = randomBytes(24).toString('hex');
  execFileSync(process.execPath, [path.join(root, 'prisma/create-admin.js'), '--env'], {
    cwd: root, env: {...env, ADMIN_LOGIN: 'owner@example.test', ADMIN_PASSWORD: password, ADMIN_NAME: 'Owner', ADMIN_ROLE: 'OWNER'}
  });
  const config = {ROOT: root, production: false, origin: 'http://127.0.0.1', uploadDir: dir};
  const {createApp} = await import('../lib/app.js');
  server = await new Promise(resolve => {
    const app = createApp(db, config).listen(0, '127.0.0.1', () => resolve(app));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  config.origin = base;
  config.origins = [base];

  async function login(login) {
    const response = await fetch(base + '/api/admin/auth/login', {
      method: 'POST', headers: {origin: base, 'content-type': 'application/json'}, body: JSON.stringify({login, password})
    });
    assert.equal(response.status, 200);
    return {origin: base, cookie: response.headers.getSetCookie().find(x => x.startsWith('bjj_admin_session=')).split(';')[0],
      'x-csrf-token': (await response.json()).csrfToken, 'content-type': 'application/json'};
  }
  const owner = await login('owner@example.test');
  assert.equal((await fetch(base + '/api/admin/access', {method: 'POST', headers: owner,
    body: JSON.stringify({name: 'Editor', login: 'editor@example.test', role: 'EDITOR', isActive: true, password})})).status, 200);
  const editor = await login('editor@example.test');
  const remove = (route, id, version, headers = owner) => fetch(base + '/api/admin/' + route + '/' + id, {
    method: 'DELETE', headers, body: JSON.stringify({version})
  });
  const file = 'a'.repeat(48) + '.webp';
  const mediaUrl = '/media/news/' + file;
  const payload = JSON.stringify({title: 'Test', name: 'Test', cover: mediaUrl, gallery: [], publishedAt: '2026-11-25', startDate: '2026-11-25', text: 'Test', category: 'Клуб'});
  for (const [route, model, listKey] of [
    ['news', 'news', 'news'], ['people', 'person', 'people'], ['competitions', 'competition', 'competitions'],
    ['history', 'historyMaterial', 'materials'], ['site/documents', 'federationDocument', 'documents']
  ]) {
    const label = model === 'person' ? {name: 'Test'} : {title: 'Test'};
    const row = await db[model].create({data: {...label, status: 'published', payload, publishedPayload: payload}});
    if (model === 'news') {
      await db.newsAsset.create({data: {id: file, newsId: row.id, size: 4}});
      fs.writeFileSync(path.join(dir, file), 'test');
      assert.equal((await remove('content-media/news', file, row.version)).status, 409);
    }
    assert.equal((await remove(route, row.id, row.version, editor)).status, 403);
    assert.equal((await remove(route, row.id, row.version + 1)).status, 409);
    const response = await remove(route, row.id, row.version);
    assert.equal(response.status, 200, await response.text());
    const deleted = await db[model].findUnique({where: {id: row.id}});
    assert.equal(deleted.status, 'deleted');
    assert.equal(deleted.publishedPayload, null);
    assert.equal(deleted.payload, payload);
    assert.equal((await remove(route, row.id, deleted.version)).status, 404);
    const list = await fetch(base + '/api/admin/' + route, {headers: owner});
    assert.equal(list.status, 200);
    assert.ok(!(await list.json())[listKey].some(x => x.id === row.id));
    assert.equal((await fetch(base + '/api/admin/' + route + '/' + row.id, {headers: owner})).status, 404);
    assert.equal((await fetch(base + '/api/admin/' + route + '/' + row.id + '/publish', {
      method: 'POST', headers: owner, body: JSON.stringify({version: deleted.version})
    })).status, 404);
    if (model === 'news') {
      assert.equal((await fetch(base + mediaUrl)).status, 404);
      const media = await (await fetch(base + '/api/admin/content-media', {headers: owner})).json();
      assert.equal(media.files.find(x => x.id === file).canDelete, true);
      assert.equal((await remove('content-media/news', file, deleted.version, editor)).status, 403);
      assert.equal((await remove('content-media/news', file, deleted.version)).status, 200);
      assert.equal(fs.existsSync(path.join(dir, file)), false);
    }
  }
  const draft = await db.news.create({data: {title: 'Draft', payload}});
  assert.equal((await remove('news', draft.id, draft.version, editor)).status, 200);
  assert.equal(await db.auditLog.count({where: {action: 'delete'}}), 6);
});

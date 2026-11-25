import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
import {renderCompetitionCatalog} from '../services/catalog-render.service.js';
import {eventNotFound, eventPath, readEventPage} from '../services/events-render.service.js';
import {publishedCompetitions, publicCompetition, competitionDTO, competitionFiles} from '../services/competitions.service.js';
import {publishedPeople} from '../services/people.service.js';
import {renderCompetition} from '../services/competitions-render.service.js';
import {sendCompetitionFile} from './competitions.routes.js';

export function competitionPreviewRouter({db, config, requireAuth}) {
  const router = Router();
  router.get('/competition-preview', requireAuth.page, asyncHandler(async (req, res) => {
    const row = typeof req.query.id === 'string' ? await db.competition.findUnique({where: {id: req.query.id,status:{not:'deleted'}}}) : null;
    if (!row) return res.status(404).sendFile(path.join(config.ROOT, 'admin-pages/not-found.html'));
    res.type('html').send(await renderCompetition(config, competitionDTO(row), await publishedPeople(db), true));
  }));
  return router;
}

export default function createPublicCompetitionsRouter({db, config}) {
  const router = Router();
  router.use(['/competitions', '/competition', '/api/competitions', '/media/competitions'], (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  router.get('/api/competitions', asyncHandler(async (_req, res) => res.json({competitions: await publishedCompetitions(db)})));
  router.get('/api/competitions/search', asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').slice(0, 100).toLocaleLowerCase('ru').replace(/ё/g, 'е').trim().split(/\s+/).filter(Boolean);
    const competitions = await publishedCompetitions(db);
    const items = competitions.filter(entry => q.every(word =>
      [entry.title, entry.lead, entry.description, entry.location, entry.disciplines.join(' ')].join(' ')
        .toLocaleLowerCase('ru').replace(/ё/g, 'е').includes(word)
    )).slice(0, 100).map(entry => ({
      title: entry.title, description: entry.lead || entry.location, category: 'Соревнования',
      href: eventPath('competitions', entry), keywords: ''
    }));
    res.json({items});
  }));

  router.get('/media/competitions/:file', asyncHandler(async (req, res) => {
    const file = req.params.file;
    if (!/^[a-f0-9]{48}\.(webp|pdf)$/.test(file)) return eventNotFound(config, res);
    const src = '/media/competitions/' + file;
    if (!(await publishedCompetitions(db)).some(entry => competitionFiles(entry).includes(src))) return eventNotFound(config, res);
    sendCompetitionFile(res, config, file);
  }));

  router.get('/competitions', asyncHandler(async (req, res) => {
    const [html, competitions] = await Promise.all([readEventPage(config, 'competitions'), publishedCompetitions(db)]);
    res.type('html').send(renderCompetitionCatalog(html, competitions, req.query));
  }));

  const detail = asyncHandler(async (req, res) => {
    const where = req.params.slug ? {slug: req.params.slug} : {id: typeof req.query.id === 'string' ? req.query.id : ''};
    const row = await db.competition.findFirst({where: {...where, status: 'published', publishedPayload: {not: null}}});
    if (!row) return eventNotFound(config, res);
    if (!req.params.slug) return res.redirect(301, eventPath('competitions', row));
    res.type('html').send(await renderCompetition(config, publicCompetition(row), await publishedPeople(db)));
  });
  router.get('/competitions/:slug', detail);
  router.get('/competition', detail);
  return router;
}

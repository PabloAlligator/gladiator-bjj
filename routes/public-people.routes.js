import {Router} from 'express';
import path from 'node:path';
import {asyncHandler} from '../lib/http.js';
import {publishedPeople,publicPerson,personImages,profileType,peopleMediaDir,personDTO,teamRole} from '../services/people.service.js';
import {renderAthleteProfile} from '../services/athlete-profile-render.service.js';
import {renderPerson,renderPeopleCatalog,personHref,renderTeam} from '../services/people-render.service.js';
export function peoplePreviewRouter({db, config, requireAuth}) {
  const router = Router();
  router.get('/person-preview', requireAuth.page, asyncHandler(async (req, res) => {
    const row = typeof req.query.id === 'string' ? await db.person.findUnique({where: {id: req.query.id,status:{not:'deleted'}}}) : null;
    if (!row) return res.status(404).sendFile(path.join(config.ROOT, 'admin-pages/not-found.html'));
    const person = personDTO(row);
    const html = req.query.view !== 'card'
      ? await renderAthleteProfile(config, person, {preview: true, coach: teamRole(person) === 'coach'})
      : await renderTeam(config, [person], {previewId: person.id});
    res.type('html').send(html);
  }));
  return router;
}

export default function createPublicPeopleRouter({db,config}){
 const router=Router();router.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
 const notFound=res=>res.status(404).sendFile(path.join(config.ROOT,'public/404.html'));
 router.get('/api/people/search',asyncHandler(async(req,res)=>{const q=String(req.query.q||'').slice(0,100).toLocaleLowerCase('ru').replace(/ё/g,'е').trim().split(/\s+/).filter(Boolean);const rows=await publishedPeople(db);res.json({items:rows.filter(p=>q.every(w=>[p.name,p.summary,p.bio,p.athleteBio,p.coachBio,p.club,p.athleteTitle,p.coachTitle,p.discipline,p.specialization].join(' ').toLocaleLowerCase('ru').replace(/ё/g,'е').includes(w))).slice(0,100).map(p=>({title:p.name,description:p.summary||p.athleteTitle||p.coachTitle,category:[p.isAthlete?'Спортсмен':'',p.isCoach?'Тренер':'',p.athleteLegend||p.coachLegend?'Легенда':''].filter(Boolean).join(' · '),href:'/people/'+p.slug,keywords:''}))});}));
 addPublicPeopleMedia(router, {db, config});
 for(const name of ['hall-of-fame','coaches'])router.get('/'+name,asyncHandler(async(_req,res)=>res.type('html').send(await renderPeopleCatalog(config,name,await publishedPeople(db)))));
 router.get('/people/:slug',asyncHandler(async(req,res)=>{const row=await db.person.findFirst({where:{slug:req.params.slug,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);res.redirect(302,personHref(publicPerson(row)));}));
 for(const type of ['athlete','athlete-profile','coach-legend','coach-profile']){
  const role=type.startsWith('coach')?'coach':'athlete';
  router.get('/'+type+'/:slug',asyncHandler(async(req,res)=>{
   const row=await db.person.findFirst({where:{slug:req.params.slug,status:'published',publishedPayload:{not:null}}});if(!row)return notFound(res);
   const p=publicPerson(row);if(!(role==='athlete'?p.isAthlete:p.isCoach))return notFound(res);
   if(profileType(p,role)!==type)return res.redirect(302,personHref(p,role));
   res.type('html').send(await renderPerson(config,p,role,await publishedPeople(db)));
  }));
  router.get('/'+type,asyncHandler(async(req,res)=>{const row=typeof req.query.id==='string'?await db.person.findFirst({where:{id:req.query.id,status:'published',publishedPayload:{not:null}}}):null;if(!row)return notFound(res);const p=publicPerson(row);if(!(role==='athlete'?p.isAthlete:p.isCoach))return notFound(res);res.redirect(301,personHref(p,role));}));
 }
 return router;
}

function addPublicPeopleMedia(router, {db, config}) {
  router.get('/media/people/:file', asyncHandler(async (req, res) => {
    const file = req.params.file;
    res.set('Cache-Control', 'no-store');
    const notFound = () => res.status(404).sendFile(path.join(config.ROOT, 'public/404.html'));
    if (!/^[a-f0-9]{48}\.webp$/.test(file)) return notFound();

    const src = '/media/people/' + file;
    const people = await publishedPeople(db);
    if (!people.some(person => personImages(person).includes(src))) return notFound();

    res.type('webp').sendFile(path.join(peopleMediaDir(config), file), {cacheControl: false}, error => {
      if (error && !res.headersSent) res.status(404).end();
    });
  }));
}

export function createTeamRouter({db, config}) {
  const router = Router();
  addPublicPeopleMedia(router, {db, config});

  router.get('/team', asyncHandler(async (_req, res) => {
    const people = await publishedPeople(db);
    res.set('Cache-Control', 'no-store').type('html').send(await renderTeam(config, people));
  }));

  router.get('/people/:slug', asyncHandler(async (req, res) => {
    const person = await db.person.findFirst({
      where: {slug: req.params.slug, status: 'published', publishedPayload: {not: null}},
      select: {id: true, slug: true, publishedPayload: true}
    });
    res.set('Cache-Control', 'no-store');
    if (!person) return res.status(404).sendFile(path.join(config.ROOT, 'public/404.html'));
    const profile = publicPerson(person);
    const role = teamRole(profile);
    if (!role) return res.status(404).sendFile(path.join(config.ROOT, 'public/404.html'));
    res.type('html').send(await renderAthleteProfile(config, profile, {coach: role === 'coach'}));
  }));

  return router;
}

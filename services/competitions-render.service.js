import {
  competitionDates, e, eventGallery, eventImage, eventPath, renderEventDetail, replaceEventSlot
} from './events-render.service.js';

const statusLabel = entry => entry.eventStatus === 'upcoming' ? 'Предстоящее' : 'Завершено';

function section(title, content) {
  return `<section class="events-detail__section" aria-label="${title}"><h2>${title}</h2>${content}</section>`;
}

function paragraphs(text) {
  return text.split(/\n\s*\n/).map(part => `<p>${e(part)}</p>`).join('');
}

export async function renderCompetition(config, entry, people, preview = false) {
  const fileUrl = src => preview ? src.replace('/media/competitions/', '/api/admin/competitions/media/') : src;
  const facts = [
    ['Дата', competitionDates(entry)],
    ['Место', e(entry.location)],
    ['Дисциплины', e(entry.disciplines.join(', '))],
    ['Организатор', e(entry.organizer)]
  ];
  const participants = people.filter(person => entry.participants.includes(person.id));
  const cover = entry.image ? eventImage(fileUrl(entry.image), entry.imageAlt || entry.title, entry.imageCaption, entry.imageCredit) : '';
  const body = `${cover}<dl class="events-facts">
    ${facts.filter(([, value]) => value).map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}
  </dl>
  ${entry.description ? section('О соревновании', `<div class="events-prose">${paragraphs(entry.description)}</div>`) : ''}
  ${entry.program.length ? section('Программа', `<ul class="events-program">${entry.program.map(item => `<li>
    ${item.time ? `<span>${e(item.time)}</span>` : ''}
    <div><strong>${e(item.title)}</strong>${item.description ? `<p>${e(item.description)}</p>` : ''}</div>
  </li>`).join('')}</ul>`) : ''}
  ${entry.documents.length ? section('Положение и документы', `<ul class="events-links">${entry.documents.map(doc =>
    `<li><a href="${e(fileUrl(doc.url))}" download>${e(doc.title)} (PDF)</a></li>`
  ).join('')}</ul>`) : ''}
  ${entry.photos.length ? eventGallery('Фотоотчёт', entry.photos.map(photo =>
    eventImage(fileUrl(photo.src), photo.alt || photo.caption, photo.caption, photo.credit, true)
  )) : ''}
  ${participants.length ? section('Участники', `<ul class="events-links">${participants.map(person =>
    `<li><a href="/people/${e(encodeURIComponent(person.slug))}">${e(person.name)}</a></li>`
  ).join('')}</ul>`) : ''}`;
  return renderEventDetail(config, 'competitions', entry, {
    meta: `<div class="events-meta"><span class="events-label">${statusLabel(entry)}</span></div>`,
    lead: entry.lead,
    body,
    preview: preview ? `<aside class="events-preview"><div class="container">
      Предпросмотр рабочей версии · <a href="/admin/competition-edit?id=${e(encodeURIComponent(entry.id))}">Вернуться в редактор</a>
    </div></aside>` : ''
  });
}

export function renderHomeCompetitions(html, rows) {
  const entry = rows.find(item => item.eventStatus === 'upcoming');
  if (!entry) return html;
  const card = `<article class="competition-card${entry.image ? '' : ' competition-card--text'}">
    ${entry.image ? `<div class="competition-card__image"><img src="${e(entry.image)}" alt="" loading="lazy"></div>` : ''}
    <div class="competition-card__body">
      <span class="home-tag">Предстоящее</span>
      <h3>${e(entry.title)}</h3>
      <p>${competitionDates(entry)}<br>${e(entry.location)}</p>
      <a class="home-button" href="${e(eventPath('competitions', entry))}">Подробнее</a>
    </div>
  </article>`;
  return replaceEventSlot(html, 'home-competitions', card);
}

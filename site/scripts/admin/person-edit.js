import {mount} from './common.js';
mount('person-edit',ctx=>{
 const {state,params,e,btn,field,area,select,formMessage,feedback,api,canPublish}=ctx;
 let p=state.people.find(x=>x.id===params.get('id'));
 const missing=params.has('id')&&!p;
 const newCoach=params.get('role')==='coach';
 p=p||{name:'',isAthlete:!newCoach,isCoach:newCoach,athleteLegend:false,coachLegend:false,showOnHome:false,primaryRole:newCoach?'coach':'athlete',status:'draft',athleteAwards:[],coachAwards:[],timeline:[],methods:[],publicPupils:[],gallery:[]};
 const imageURL=src=>(src||'').replace('/media/people/','/api/admin/people/media/');
 let assets=[];
 const photoLabels={portrait:'Основной портрет',coachPortrait:'Фото тренера',storyImage:'Фото биографии',hallHoverPhoto:'Второе фото карточки легенды — при наведении'};
 const photoHelp={
  portrait:'Портрет для профиля и карточки спортсостава. Нужен для публикации.',
  coachPortrait:'Фото в профиле и карточке тренера. Если поле пустое, используется основной портрет.',
  storyImage:'Дополнительное фото для блока биографии.',
  hallHoverPhoto:'Дополнительное фото для старых карточек.'
 };
 const sources=()=>[...new Set([p.portrait,p.coachPortrait,p.storyImage,p.hallHoverPhoto,...p.gallery.map(g=>g.src),...assets.map(a=>a.src)].filter(Boolean))];
 function photoName(src,index){const form=ctx.root.querySelector('#person-form');const labels=Object.entries(photoLabels).filter(([key])=>(form?.elements[key]?.value??p[key])===src).map(([,label])=>label);if(form){[...form.querySelectorAll('[data-row="gallery"]')].forEach((row,i)=>{if(row.querySelector('[name="gallery-src"]').value===src)labels.push('Галерея · фото '+(i+1));});}else p.gallery.forEach((g,i)=>{if(g.src===src)labels.push('Галерея · фото '+(i+1));});return labels.length?[...new Set(labels)].join(' / '):(assets.some(a=>a.src===src)?'Загруженное фото '+(assets.findIndex(a=>a.src===src)+1):'Фото из проекта '+(index+1));}
 const imageOptions=current=>[['','Без изображения'],...[...new Set([current,...sources()].filter(Boolean))].map((src,i)=>[src,photoName(src,i)])];
 const imageField=key=>`<fieldset class="person-image-field"><legend>${photoLabels[key]}</legend><p class="form-note">${photoHelp[key]}</p>${select('Выбранная фотография',key,imageOptions(p[key]),p[key]||'')}<img data-image-preview="${key}" class="news-image-preview" ${p[key]?`src="${e(imageURL(p[key]))}"`:''} alt="${e(photoLabels[key])}" ${p[key]?'':'hidden'}><div class="actions"><button class="btn" type="button" data-clear-image="${key}">Убрать фото из этого поля</button></div><label>Загрузить: ${photoLabels[key].toLocaleLowerCase('ru')}<input type="file" accept="image/jpeg,image/png,image/webp" data-person-upload="${key}" ${p.id?'':'disabled'}></label></fieldset>`;
 const specs={
  athleteAwards:[['date','Дата / период'],['title','Название результата'],['text','Описание','area'],['place','Место (необязательно)']],
  coachAwards:[['date','Дата / период'],['title','Название заслуги / результата'],['text','Описание: уточните личный результат или успех воспитанников','area'],['place','Место (необязательно)']],
  timeline:[['date','Год / период'],['title','Этап пути'],['text','Описание','area'],['role','Для какого профиля','role']],
  methods:[['title','Принцип работы'],['text','Описание','area']],
  publicPupils:[['personId','Публичный профиль воспитанника','person'],['description','Описание достижений','area']],
  gallery:[['src','Изображение','image'],['alt','Alt-текст'],['caption','Подпись'],['credit','Автор / права'],['category','Категория','category']]
 };
 const limits={athleteAwards:40,coachAwards:40,timeline:40,methods:12,publicPupils:30,gallery:30};
 const labels={athleteAwards:'Спортивные достижения',coachAwards:'Тренерские заслуги и результаты',timeline:'Спортивный путь',methods:'Принципы подготовки',publicPupils:'Публичные воспитанники',gallery:'Фотогалерея'};
 function row(key,value={}){return `<fieldset class="person-repeater-row" data-row="${key}"><legend>${labels[key]}</legend>${key==='gallery'?`<img class="news-image-preview" data-gallery-preview ${value.src?`src="${e(imageURL(value.src))}"`:''} alt="Фотография галереи" ${value.src?'':'hidden'}>`:''}<div class="form-grid">${specs[key].map(([name,label,type])=>{const input=key+'-'+name,v=value[name]||'';if(type==='area')return area(label,input,v);if(type==='role')return select(label,input,[['all','Оба профиля'],['athlete','Спортсмен'],['coach','Тренер']],v||'all');if(type==='category')return select(label,input,[['training','Тренировки'],['competition','Соревнования'],['awards','Награждения'],['students','Воспитанники'],['archive','Архив']],v||'training');if(type==='person')return select(label,input,[['','Выберите человека'],...state.people.filter(x=>x.id!==p.id&&x.isAthlete).map(x=>[x.id,x.name+(x.hasPublished?'':' · не опубликован')])],v);if(type==='image')return select(label,input,imageOptions(v),v);return field(label,input,v,'text',name==='title');}).join('')}</div><div class="actions"><button class="btn" type="button" data-move="up">Выше</button><button class="btn" type="button" data-move="down">Ниже</button><button class="btn" type="button" data-remove-row>${key==='gallery'?'Убрать фото из галереи':'Удалить строку'}</button></div></fieldset>`;}
 const repeater=key=>`<div class="person-repeater"><h3>${labels[key]}</h3>${key==='gallery'?'<p class="form-note">Снимки для нижнего блока страницы спортсмена. Здесь можно изменить порядок, подписи и авторство.</p>':''}${key==='publicPupils'?'<p class="form-note">Только отдельные публичные профили спортсменов. Контакты, ученики зала и оплаты не используются. Неопубликованные профили на сайте не показываются.</p>':''}<div data-list="${key}">${p[key].map(x=>row(key,x)).join('')}</div><button class="btn" type="button" data-add="${key}">${({athleteAwards:'Добавить достижение',timeline:'Добавить этап',gallery:'Добавить фото'})[key]||'Добавить строку'}</button></div>`;
 function render(){
  if(missing)return ctx.notFound();
  return `<div class="toolbar">${p.id?ctx.contentDeleteButton('people',p) : ''}
   ${btn('К списку спортсостава','/admin/people')}
   <span class="badge">${p.hasPublished?(p.hasChanges?'Опубликовано · есть правки':'Опубликовано'):'Рабочая версия'}</span>
  </div>
  <div class="panel">
   <h2>${p.id?'Редактирование профиля':newCoach?'Новый тренер':'Новый спортсмен'}</h2>
   <p class="form-note">Сохранение обновляет черновик. Публикация выводит его на сайт.</p>
   ${formMessage}
   <form id="person-form">
    <h3>Тип профиля</h3>
    ${select('Роль','primaryRole',[['coach','Тренер'],['athlete','Спортсмен']],p.primaryRole)}
    <h3>Основное</h3>
    <div class="form-grid">
     ${field('ФИО','name',p.name,'text',true,'maxlength="180"')}
     ${field('Клуб','club',p.club)}
     ${area('Краткое описание для карточки спортсостава','summary',p.summary)}
    </div>
    <details open data-athlete-fields>
     <summary>Данные спортсмена</summary>
     <div class="form-grid">
      ${field('Пояс','belt',p.belt,'text',false,'maxlength="100"')}
      ${field('Дисциплина','discipline',p.discipline,'text',false,'placeholder="Gi / No-Gi"')}
      ${field('Звание','athleteTitle',p.athleteTitle)}
      ${field('Тренер','trainer',p.trainer)}
      ${field('Статус спортсмена','athleteStatus',p.athleteStatus)}
      ${field('Город','city',p.city)}
     </div>
    </details>
    <h3>Портрет</h3>
    ${!p.id?'<p class="form-note">Сначала сохраните профиль, чтобы загрузить фотографии.</p>':''}
    ${imageField('portrait')}
    <div class="form-grid">
     ${field('Описание портрета (alt)','portraitAlt',p.portraitAlt)}
     ${field('Автор портрета','photoCredit',p.photoCredit)}
    </div>
    <div data-athlete-achievements>${repeater('athleteAwards')}</div>
    ${repeater('timeline')}
    <h3>Биография</h3>
    <div class="form-grid">
     ${area('Общая биография','bio',p.bio)}
     <div class="span-all" data-athlete-biography>${area('Биография спортсмена (если отличается от общей)','athleteBio',p.athleteBio)}${area('Цитата спортсмена','athleteQuote',p.athleteQuote)}</div>
     ${imageField('storyImage')}${field('Подпись фото биографии','storyCaption',p.storyCaption)}
    </div>
    ${repeater('gallery')}
    <label>Загрузить фотографии галереи<input type="file" multiple accept="image/jpeg,image/png,image/webp" data-person-upload="gallery" ${p.id?'':'disabled'}></label>
    <details data-coach-fields>
     <summary>Данные тренера</summary>
     ${imageField('coachPortrait')}
     <div class="form-grid">
      ${field('Должность','coachTitle',p.coachTitle)}
      ${field('Специализация','specialization',p.specialization)}
      ${field('Тренерский стаж','experience',p.experience)}
      ${area('Биография тренера (если отличается от общей)','coachBio',p.coachBio)}
      ${area('Цитата тренера','coachQuote',p.coachQuote)}
      ${area('Философия подготовки','methodQuote',p.methodQuote)}
      ${area('Подход к тренировкам','school',p.school)}
     </div>
     ${repeater('methods')}${repeater('coachAwards')}${repeater('publicPupils')}
    </details>
    <details>
     <summary>Дополнительные настройки</summary>
     <div class="form-grid">
      ${field('Порядок отображения','sortOrder',p.sortOrder??1000,'number',true,'min="0" max="999999" step="1"')}
      ${area('Общая цитата','quote',p.quote)}
     </div>
    </details>
    <div class="form-actions">
     <button class="btn btn--primary" type="submit">Сохранить</button>
     <button class="btn" type="button" id="person-preview">Сохранить и открыть предпросмотр</button>
    </div>
   </form>
   <section class="person-media-panel"><h2>Загруженные фотографии этого человека</h2><p class="form-note">Здесь можно окончательно удалить неиспользуемые файлы. Используемое фото сначала уберите из полей и галереи, сохраните изменения и обновите публикацию либо снимите профиль с сайта.</p><div id="person-media-library" aria-live="polite">${p.id?'Загрузка фотографий…':'Список появится после первого сохранения человека.'}</div></section>
   <div class="form-actions">${canPublish&&p.id&&p.status!=='archived'?'<button class="btn btn--primary" type="button" data-person-action="publish">Опубликовать сохранённую версию</button>':''}${canPublish&&p.hasPublished?'<button class="btn" type="button" data-person-action="unpublish">Снять с публикации</button>':''}${p.id&&(canPublish||!p.hasPublished)?`<button class="btn" type="button" data-person-action="${p.status==='archived'?'restore':'archive'}">${p.status==='archived'?'Восстановить в черновик':'В архив'}</button>`:''}${p.hasPublished?btn('На сайте','/people/'+p.slug):''}</div>
   ${p.status==='archived'?'<p>Профиль в архиве. Восстановите его в черновик для редактирования.</p>':''}
  </div>`;
 }
 return {render,bind(){if(missing)return;const form=ctx.form;let busy=false,dirty=false;
 const mark=()=>{dirty=true;ctx.setDirty(true);ctx.root.querySelectorAll('[data-delete-asset]').forEach(el=>el.disabled=true);};
 const controls=disabled=>ctx.root.querySelectorAll('#person-form input,#person-form textarea,#person-form select,#person-form button,[data-person-action],[data-delete-asset]').forEach(el=>{el.disabled=!!(disabled||(p.status==='archived'&&el.closest('form'))||(el.matches('[data-person-upload]')&&!p.id)||(el.matches('[data-clear-image]')&&!form.elements[el.dataset.clearImage].value)||(el.matches('[data-delete-asset]')&&(dirty||el.dataset.used==='true')));});
 controls(false);
 function roles(){const a=form.elements.primaryRole.value==='athlete',c=!a;ctx.root.querySelectorAll('[data-athlete-achievements] input[name$="-title"]').forEach(el=>el.required=a);ctx.root.querySelectorAll('[data-coach-fields] input[name$="-title"]').forEach(el=>el.required=c);ctx.root.querySelector('[data-athlete-fields]').hidden=!a;ctx.root.querySelector('[data-athlete-achievements]').hidden=!a;ctx.root.querySelector('[data-athlete-biography]').hidden=!a;ctx.root.querySelector('[data-coach-fields]').hidden=!c;if(c)ctx.root.querySelector('[data-coach-fields]').open=true;}
 roles();form.addEventListener('invalid',event=>{const details=event.target.closest('details');if(details)details.open=true;},true);form.addEventListener('input',mark);form.addEventListener('change',ev=>{mark();if(ev.target.name==='primaryRole')roles();if(['portrait','coachPortrait','storyImage','hallHoverPhoto'].includes(ev.target.name)){const image=ctx.root.querySelector('[data-image-preview="'+ev.target.name+'"]');image.hidden=!ev.target.value;if(ev.target.value)image.src=imageURL(ev.target.value);else image.removeAttribute('src');}if(ev.target.name==='gallery-src'){const image=ev.target.closest('[data-row]').querySelector('[data-gallery-preview]');image.hidden=!ev.target.value;if(ev.target.value)image.src=imageURL(ev.target.value);else image.removeAttribute('src');}refreshChoices();});
 const getData=()=>{const d=Object.fromEntries(new FormData(form));d.sortOrder=Number(d.sortOrder);d.isCoach=d.primaryRole==='coach';d.isAthlete=d.primaryRole==='athlete';d.athleteLegend=Boolean(d.isAthlete&&p.athleteLegend);d.coachLegend=Boolean(d.isCoach&&p.coachLegend);d.showOnHome=Boolean(d.isAthlete&&p.showOnHome);d.hallHoverPhoto=p.hallHoverPhoto||'';for(const key of Object.keys(specs))d[key]=[...form.querySelectorAll('[data-list="'+key+'"] > [data-row]')].map(el=>Object.fromEntries(specs[key].map(([name])=>[name,el.querySelector('[name="'+key+'-'+name+'"]').value]))).filter(value=>Object.entries(value).some(([name,text])=>!['role','category'].includes(name)&&text.trim()));return {...d,status:'draft',version:p.version};};
 async function save(preview=false){if(busy||!form.reportValidity())return;const body=getData();busy=true;controls(true);try{const result=await api('/api/admin/people'+(p.id?'/'+p.id:''),{method:p.id?'PATCH':'POST',body:JSON.stringify(body)});p=result.entity;dirty=false;ctx.setDirty(false);ctx.replace(preview?'/admin/person-preview?id='+p.id:'/admin/person-edit?id='+p.id);}catch(err){feedback(err.message,true);busy=false;controls(false);roles();}}
 function renumberGallery(){form.querySelectorAll('[data-row="gallery"] legend').forEach((el,i)=>el.textContent='Галерея · фото '+(i+1));}
 function refreshChoices(){ctx.root.querySelectorAll('[data-clear-image]').forEach(el=>el.disabled=busy||p.status==='archived'||!form.elements[el.dataset.clearImage].value);for(const select of form.querySelectorAll('[name="portrait"],[name="coachPortrait"],[name="storyImage"],[name="hallHoverPhoto"],[name="gallery-src"]')){const value=select.value;select.replaceChildren(...imageOptions(value).map(([id,label])=>new Option(label,id,false,id===value)));}}
 function renderAssets(){const root=ctx.root.querySelector('#person-media-library');if(!assets.length){root.textContent='Загруженных файлов пока нет.';return;}root.innerHTML=`<div class="person-media-grid">${assets.map((a,i)=>`<article class="person-media-card"><img class="news-image-preview" src="${e(imageURL(a.src))}" alt="Загруженная фотография ${i+1}" loading="lazy"><h3>Фото ${i+1}</h3><p>${a.working.length?'В рабочей версии: '+a.working.map(e).join(', '):'В рабочей версии не используется.'}</p><p>${a.published.length?'На сайте: '+a.published.map(e).join(', '):'В опубликованной версии не используется.'}</p><button class="btn btn--danger" type="button" data-delete-asset="${e(a.id)}" data-used="${!a.canDelete}" ${!a.canDelete||dirty?'disabled':''}>Удалить файл навсегда</button></article>`).join('')}</div>`;}
 async function refreshAssets(){if(!p.id)return;try{const result=await api('/api/admin/people/'+p.id+'/media');assets=result.assets;renderAssets();refreshChoices();}catch(err){ctx.root.querySelector('#person-media-library').innerHTML=`<p role="alert">${e(err.message)}</p><button class="btn" type="button" data-retry-media>Повторить загрузку списка</button>`;}}
 ctx.root.querySelector('#person-media-library').addEventListener('click',async ev=>{if(ev.target.closest('[data-retry-media]'))return void refreshAssets();const button=ev.target.closest('[data-delete-asset]');if(!button||busy)return;if(dirty)return feedback('Сначала сохраните изменения формы.',true);if(!confirm('Удалить неиспользуемый файл навсегда?'))return;busy=true;controls(true);try{const result=await api('/api/admin/people/'+p.id+'/media/'+button.dataset.deleteAsset,{method:'DELETE',body:JSON.stringify({version:p.version})});p=result.entity;await refreshAssets();feedback('Неиспользуемая фотография удалена.');}catch(err){feedback(err.message,true);}finally{busy=false;controls(false);roles();}});
 renumberGallery();void refreshAssets();
 form.addEventListener('submit',ev=>{ev.preventDefault();void save();});ctx.root.querySelector('#person-preview').onclick=()=>void save(true);
 form.addEventListener('click',ev=>{if(busy)return;const clear=ev.target.closest('[data-clear-image]');if(clear){const key=clear.dataset.clearImage;form.elements[key].value='';p[key]='';const image=form.querySelector('[data-image-preview="'+key+'"]');image.hidden=true;image.removeAttribute('src');mark();refreshChoices();feedback('Фото убрано из поля. Сохраните профиль, чтобы закрепить изменение.');return;}const add=ev.target.closest('[data-add]'),remove=ev.target.closest('[data-remove-row]'),move=ev.target.closest('[data-move]');if(add){const key=add.dataset.add,root=form.querySelector('[data-list="'+key+'"]');if(root.children.length>=limits[key])return feedback('Достигнут лимит строк: '+limits[key],true);root.insertAdjacentHTML('beforeend',row(key));mark();}if(remove){remove.closest('[data-row]').remove();mark();}if(move){const el=move.closest('[data-row]'),other=move.dataset.move==='up'?el.previousElementSibling:el.nextElementSibling;if(other){move.dataset.move==='up'?other.before(el):other.after(el);mark();}}if(add||remove||move){renumberGallery();refreshChoices();}});
 ctx.root.querySelectorAll('[data-person-action]').forEach(button=>button.onclick=async()=>{if(busy)return;if(dirty)return feedback('Сначала сохраните изменения формы.',true);if(!confirm(button.textContent+'?'))return;busy=true;controls(true);try{await api('/api/admin/people/'+p.id+'/'+button.dataset.personAction,{method:'POST',body:JSON.stringify({version:p.version})});ctx.setDirty(false);ctx.replace('/admin/person-edit?id='+p.id);}catch(err){feedback(err.message,true);busy=false;controls(false);roles();}});
 ctx.root.querySelectorAll('[data-person-upload]').forEach(input=>input.onchange=async()=>{if(busy)return;const files=[...input.files],key=input.dataset.personUpload;if(key==='gallery'&&form.querySelector('[data-list=gallery]').children.length+files.length>30)return feedback('В галерее максимум 30 фотографий.',true);busy=true;controls(true);let count=0;try{for(const file of files){if(file.size>8*1024*1024)throw Error('Файл превышает 8 МиБ.');const result=await api('/api/admin/people/'+p.id+'/upload',{method:'POST',headers:{'Content-Type':file.type||'application/octet-stream'},body:file});if(key==='gallery'){p.gallery.push({src:result.src});form.querySelector('[data-list=gallery]').insertAdjacentHTML('beforeend',row('gallery',{src:result.src}));}else{p[key]=result.src;const select=form.elements[key];select.add(new Option(file.name,result.src));select.value=result.src;const image=ctx.root.querySelector('[data-image-preview="'+key+'"]');image.src=imageURL(result.src);image.hidden=false;}count++;mark();}renumberGallery();feedback('Загружено: '+count+'. Сохраните профиль, чтобы закрепить изображения.');}catch(err){feedback(err.message+(count?' Загружено до ошибки: '+count+'. Сохраните профиль.':''),true);}finally{busy=false;controls(false);roles();input.value='';await refreshAssets();}});
 }};
});

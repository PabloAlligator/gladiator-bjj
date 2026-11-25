const {test} = require('node:test');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');

const settings = {operator:'Оператор',address:'Адрес',inn:'0000000000',contact:'Контакт',policy:'Политика',consent:'Согласие',enabled:true};
const product = (id, title, variants, published=true) => ({id,title,variants:JSON.stringify(variants),image:null,photos:'[]',published});
const variant = (code,label,price,available=true) => ({code,label,price,available});
const products = [
 product('kimono','Кимоно',[variant('m','M',500000),variant('l','L',650000),variant('xl','XL',700000,false)]),
 product('belt','Пояс',[variant('blue','Синий',120000)]),
 product('draft','Черновик',[variant('m','M',500000)],false)
];
function fixture(rows=products) {
 const saved=[];
 const db={
  shopSettings:{findUnique:async()=>settings},
  shopProduct:{findMany:async({where})=>rows.filter(row=>row.published===where.published && where.id.in.includes(row.id))},
  shopRequest:{findUnique:async({where})=>saved.find(row=>row.key===where.key),create:async({data})=>{saved.push(data);return {number:data.number};}},
  $transaction:async callback=>callback(db)
 };
 return {db,saved};
}
const line = (id='kimono',code='m',quantity=2,price=500000) => ({id,code,quantity,price});
async function setup(rows) {
 const {createShopRequest,consentVersion}=await import('../services/shop.service.js');
 const {db,saved}=fixture(rows);
 const body={key:randomUUID(),name:'Покупатель',phone:'+79000000000',consent:true,consentVersion:consentVersion(settings),items:[line()]};
 return {saved,body,submit:(data=body)=>createShopRequest(db,data)};
}

test('Цена, название и код варианта в снимке заявки соответствуют данным БД; сумма не берётся из браузера',async()=>{
 const {saved,body,submit}=await setup();
 await submit({...body,total:1,items:[{...line(),title:'Подмена',label:'XL',total:1},{...line('kimono','l',1,650000),title:'Подмена',label:'M'},line('belt','blue',1,120000)]});
 assert.equal(saved.length,1);
 assert.equal(saved[0].total,1770000);
 assert.deepEqual(JSON.parse(saved[0].items),[
  {id:'kimono',code:'m',quantity:2,price:500000,title:'Кимоно',label:'M'},
  {id:'kimono',code:'l',quantity:1,price:650000,title:'Кимоно',label:'L'},
  {id:'belt',code:'blue',quantity:1,price:120000,title:'Пояс',label:'Синий'}
 ]);
});

for(const [name,items,status] of [
 ['заниженная цена',[line('kimono','m',2,1)],409],
 ['дорогой вариант по цене дешёвого',[line('kimono','l',1,500000)],409],
 ['вариант другого товара',[line('kimono','blue',1,120000)],409],
 ['недоступный вариант',[line('kimono','xl',1,700000)],409],
 ['неопубликованный товар',[line('draft','m',1,500000)],409],
 ['несуществующий товар',[line('missing','m',1,500000)],409],
 ['отрицательное количество',[line('kimono','m',-1)],422],
 ['дробное количество',[line('kimono','m',1.5)],422],
 ['количество выше лимита',[line('kimono','m',21)],422],
 ['повтор варианта для обхода лимита',[line(),line()],422],
 ['цена строкой',[line('kimono','m',2,'500000')],422],
 ['отсутствующая цена',[{id:'kimono',code:'m',quantity:1}],422]
]) {
 test('Заявка отклоняется: '+name,async()=>{
  const {saved,body,submit}=await setup();
  await assert.rejects(submit({...body,items}),error=>error.status===status);
  assert.equal(saved.length,0);
 });
}

test('Повтор принятой заявки возвращает тот же номер, а изменение её данных отклоняется',async()=>{
 const {saved,body,submit}=await setup();
 const first=await submit();
 assert.deepEqual(await submit(),first);
 await assert.rejects(submit({...body,items:[line('kimono','l',1,650000)]}),error=>error.status===409);
 assert.equal(saved.length,1);
});

test('Старая цена корзины отклоняется после изменения цены в БД',async()=>{
 const {saved,body,submit}=await setup([product('kimono','Кимоно',[variant('m','M',550000)])]);
 await assert.rejects(submit(),error=>error.status===409);
 assert.equal(saved.length,0);
 await submit({...body,items:[line('kimono','m',2,550000)]});
 assert.equal(saved[0].total,1100000);
 assert.equal(JSON.parse(saved[0].items)[0].price,550000);
});

test('Некорректный флаг доступности в БД не разрешает заявку',async()=>{
 const {saved,submit}=await setup([product('kimono','Кимоно',[variant('m','M',500000,'true')])]);
 await assert.rejects(submit(),error=>error.status===409);
 assert.equal(saved.length,0);
});

test('Сумма вне диапазона SQLite/Prisma Int отклоняется до записи',async()=>{
 const variants=Array.from({length:2},(_,i)=>variant('v'+i,'V'+i,100000000));
 const {saved,body,submit}=await setup([product('kimono','Кимоно',variants)]);
 await assert.rejects(submit({...body,items:variants.map(v=>line('kimono',v.code,20,v.price))}),error=>error.status===422);
 assert.equal(saved.length,0);
});

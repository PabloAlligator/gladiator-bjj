const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {tmpdir}=require('node:os');
const {execFileSync}=require('node:child_process');
const {PrismaClient}=require('@prisma/client');
const {DatabaseSync}=require('node:sqlite');

test('Миграция магазина добавляет таблицы и сохраняет действующие данные клуба',async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(tmpdir(),'bjj-shop-migrate-'));
 const url='file:'+path.join(dir,'existing.db').replaceAll('\\','/');
 const old=path.join(dir,'prisma'),oldMigrations=path.join(old,'migrations');
 const migration=path.join(root,'prisma','migrations');
 const prisma=path.join(root,'node_modules','prisma','build','index.js');
 const env={...process.env,DATABASE_URL:url,RUST_LOG:'info'};
 let db;
 try{
  fs.mkdirSync(oldMigrations,{recursive:true});
  fs.copyFileSync(path.join(root,'prisma','schema.prisma'),path.join(old,'schema.prisma'));
  fs.copyFileSync(path.join(migration,'migration_lock.toml'),path.join(oldMigrations,'migration_lock.toml'));
  fs.cpSync(path.join(migration,'202611200001_initial'),path.join(oldMigrations,'202611200001_initial'),{recursive:true});
  fs.cpSync(path.join(migration,'202611240001_shop'),path.join(oldMigrations,'202611240001_shop'),{recursive:true});
  execFileSync(process.execPath,[prisma,'migrate','deploy','--schema',path.join(old,'schema.prisma')],{cwd:root,env,stdio:'pipe'});
  db=new PrismaClient({datasources:{db:{url}}});
  const gym=await db.gym.create({data:{id:'gym-existing',name:'Действующий зал'}});
  const admin=await db.admin.create({data:{login:'existing@example.test',name:'Владелец',passwordHash:'test-only',role:'OWNER'}});
  const student=await db.student.create({data:{name:'Действующий ученик',gymId:gym.id,start:'2026-11-01',price:300000,status:'active'}});
  const payment=await db.payment.create({data:{student:student.id,amount:300000,received:'2026-11-01',period:'2026-11'}});
  const news=await db.news.create({data:{title:'Действующая новость',payload:'{}'}});
  const before=[gym,admin,student,payment,news];
  await db.$disconnect();
  const legacy=new DatabaseSync(path.join(dir,'existing.db'));
  try {legacy.prepare('INSERT INTO "ShopProduct" (id,slug,title,category,description,image,variants,published,updatedAt) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)').run('old-product','old','Товар','Экипировка','','a'.repeat(48),'[]',1);} finally{legacy.close();}
  execFileSync(process.execPath,[prisma,'migrate','deploy'],{cwd:root,env,stdio:'pipe'});
  db=new PrismaClient({datasources:{db:{url}}});
  const after=await Promise.all([db.gym.findUnique({where:{id:gym.id}}),db.admin.findUnique({where:{id:admin.id}}),db.student.findUnique({where:{id:student.id}}),db.payment.findUnique({where:{id:payment.id}}),db.news.findUnique({where:{id:news.id}})]);
  assert.deepEqual(after,before);
  assert.equal(await db.shopProduct.count(),1);
  const oldProduct=await db.shopProduct.findUnique({where:{id:'old-product'}});
  assert.equal(oldProduct.image,'a'.repeat(48));assert.deepEqual(JSON.parse(oldProduct.photos),['a'.repeat(48)]);
  assert.equal(await db.shopRequest.count(),0);
  assert.equal(await db.shopSettings.count(),0);
  const integrity=new DatabaseSync(path.join(dir,'existing.db'),{readOnly:true});
  try{assert.equal(Object.values(integrity.prepare('PRAGMA integrity_check').get())[0],'ok');assert.equal(integrity.prepare('PRAGMA foreign_key_check').all().length,0);}
  finally{integrity.close();}
  execFileSync(process.execPath,[prisma,'migrate','diff','--from-url',url,'--to-schema-datamodel',path.join(root,'prisma','schema.prisma'),'--exit-code'],{cwd:root,env,stdio:'pipe'});
 }finally{await db?.$disconnect();fs.rmSync(dir,{recursive:true,force:true});}
});

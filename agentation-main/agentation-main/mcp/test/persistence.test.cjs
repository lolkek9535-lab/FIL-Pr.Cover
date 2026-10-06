const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const Database = require('better-sqlite3');
const { createSQLiteStore, createTenantStore, handleTool } = require('../.test-dist/integration.js');
const sample = {x:10,y:20,comment:'Move the button',element:'button',elementPath:'body > button',timestamp:Date.now(),sourceFile:'src/Button.tsx:42:3'};
function fixture(t) {
 const dir=mkdtempSync(join(tmpdir(),'agentation-persistence-'));
 t.after(()=>rmSync(dir,{recursive:true,force:true}));
 return join(dir,'test.db');
}
test('source locations survive SQLite reload and MCP pending output',async t=>{
 const path=fixture(t);
 let store=createSQLiteStore(path);
 const session=store.createSession('http://review.localhost');
 const annotation=store.addAnnotation(session.id,sample);
 assert.equal(store.getAnnotation(annotation.id).sourceFile,sample.sourceFile);
 store.close();
 store=createSQLiteStore(path);t.after(()=>store.close());
 assert.equal(store.getSessionWithAnnotations(session.id).annotations[0].sourceFile,sample.sourceFile);
 const oldFetch=global.fetch;t.after(()=>global.fetch=oldFetch);
 global.fetch=async()=>new Response(JSON.stringify({sessionId:session.id,annotations:store.getPendingAnnotations(session.id)}),{status:200});
 const result=await handleTool('agentation_get_pending',{sessionId:session.id});
 assert.equal(result.isError,undefined);
 assert.match(result.content[0].text,/src\/Button\.tsx:42:3/);
});
test('identifying attributes survive SQLite reopen, edits and MCP output',async t=>{
 const path=fixture(t);let store=createSQLiteStore(path);
 const session=store.createSession('http://review.localhost');
 const attributes={'data-qa':'checkout','data-testid':'pay'};
 const note=store.addAnnotation(session.id,{...sample,attributes});
 store.updateAnnotation(note.id,{comment:'Changed'});
 store.close();store=createSQLiteStore(path);t.after(()=>store.close());
 assert.deepEqual(store.getAnnotation(note.id).attributes,attributes);
 const oldFetch=global.fetch;t.after(()=>global.fetch=oldFetch);
 global.fetch=async()=>new Response(JSON.stringify({sessionId:session.id,annotations:store.getPendingAnnotations(session.id)}),{status:200});
 const result=await handleTool('agentation_get_pending',{sessionId:session.id});
 assert.match(result.content[0].text,/"data-qa": "checkout"/);
 assert.deepEqual(store.updateAnnotation(note.id,{attributes:{'data-qa':'updated'}}).attributes,{'data-qa':'updated'});
});
test('iframe coordinates survive reopen and unrelated edits',t=>{
 const path=fixture(t);let store=createSQLiteStore(path);
 const session=store.createSession('http://review.localhost');
 const frame={path:[{index:0,id:'preview',url:'http://review.localhost/frame'}],x:10,y:20,fixed:false,boundingBox:{x:0,y:0,width:80,height:30}};
 const note=store.addAnnotation(session.id,{...sample,frame});
 store.updateAnnotation(note.id,{attributes:{'data-qa':'checkout'}});
 store.close();store=createSQLiteStore(path);t.after(()=>store.close());
 assert.deepEqual(store.getAnnotation(note.id).frame,frame);
});
test('old database migrates once and tenant reads retain source locations',t=>{
 const path=fixture(t);
 createSQLiteStore(path).close();
 const db=new Database(path);
 const columns=db.prepare('PRAGMA table_info(annotations)').all();
 if(columns.some(c=>c.name==='source_file'))db.exec('ALTER TABLE annotations DROP COLUMN source_file');
 db.close();
 const tenant=createTenantStore(path);t.after(()=>tenant.close());
 const org=tenant.createOrganization('Review');
 const user=tenant.createUser('review@example.test',org.id);
 const session=tenant.createSessionForUser(user.id,'http://review.localhost');
 const store=createSQLiteStore(path);t.after(()=>store.close());
 store.addAnnotation(session.id,sample);
 assert.equal(tenant.getPendingAnnotationsForUser(user.id,session.id)[0].sourceFile,sample.sourceFile);
 const reopened=createSQLiteStore(path);reopened.close();
});
test('updating source location persists without erasing it on unrelated edits',t=>{
 const path=fixture(t);const store=createSQLiteStore(path);t.after(()=>store.close());
 const session=store.createSession('http://review.localhost');
 const annotation=store.addAnnotation(session.id,sample);
 assert.equal(store.updateAnnotation(annotation.id,{sourceFile:'src/Updated.tsx:8'}).sourceFile,'src/Updated.tsx:8');
 assert.equal(store.updateAnnotation(annotation.id,{comment:'Updated note'}).sourceFile,'src/Updated.tsx:8');
});
test('placement note edits and removals survive reload without losing geometry',t=>{
 const path=fixture(t);let store=createSQLiteStore(path);
 const session=store.createSession('http://review.localhost');
 const placement={componentType:'button',width:100,height:30,scrollY:0,text:'Before'};
 const a=store.addAnnotation(session.id,{...sample,kind:'placement',placement});
 store.updateAnnotation(a.id,{comment:'After',x:30,y:40,placement:{...placement,width:150,text:'After'}});
 store.close();store=createSQLiteStore(path);t.after(()=>store.close());
 assert.equal(store.getAnnotation(a.id).placement.text,'After');assert.equal(store.getAnnotation(a.id).placement.width,150);
 assert.equal(store.getAnnotation(a.id).x,30);assert.equal(store.getAnnotation(a.id).y,40);
 const cleared=store.updateAnnotation(a.id,{placement:{...placement,text:''}});
 assert.equal(cleared.placement.text,'');assert.equal(cleared.sourceFile,sample.sourceFile);
});
test('rearrange geometry updates are persisted alongside its note',t=>{
 const path=fixture(t);const store=createSQLiteStore(path);t.after(()=>store.close());
 const session=store.createSession('http://review.localhost');const rect={x:1,y:2,width:100,height:30};
 const rearrange={selector:'button',label:'Button',tagName:'button',originalRect:rect,currentRect:rect};
 const a=store.addAnnotation(session.id,{...sample,kind:'rearrange',rearrange});
 store.updateAnnotation(a.id,{comment:'Keep this note',rearrange:{...rearrange,currentRect:{...rect,y:99}}});
 assert.equal(store.getAnnotation(a.id).rearrange.currentRect.y,99);
 assert.equal(store.getAnnotation(a.id).comment,'Keep this note');
});

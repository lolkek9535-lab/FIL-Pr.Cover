const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { fork } = require('node:child_process');
const Database = require('better-sqlite3');
const { createSQLiteStore, createTenantStore, eventBus } = require('../.test-dist/integration.js');
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'agentation-sequence-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'test.db');}
async function worker(t,path,mode,userId){
 const child=fork(join(__dirname,'sequence-worker.cjs'),[path,mode,userId||''],{stdio:['ignore','ignore','inherit','ipc']});
 t.after(()=>{if(child.connected)child.kill();});
 await new Promise((resolve,reject)=>{child.once('message',resolve);child.once('error',reject);child.once('exit',code=>{if(code)reject(new Error('worker exited '+code));});});
 return child;
}
test('two independent processes allocate unique events across regular and tenant stores',async t=>{
 const path=fixture(t);const tenant=createTenantStore(path);const org=tenant.createOrganization('Test');const user=tenant.createUser('test@example.test',org.id);tenant.close();
 const children=await Promise.all([worker(t,path,'regular'),worker(t,path,'tenant',user.id)]);
 const results=await Promise.all(children.map(child=>new Promise(resolve=>{child.once('message',resolve);child.send('go');})));
 assert.deepEqual(results,[{ok:true},{ok:true}]);
 const db=new Database(path);t.after(()=>db.close());
 const rows=db.prepare('SELECT sequence FROM events ORDER BY sequence').all();
 assert.equal(rows.length,40);assert.equal(new Set(rows.map(r=>r.sequence)).size,40);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,40);
});
test('event failure rolls back the mutation and publishes nothing',t=>{
 const path=fixture(t);const store=createSQLiteStore(path);t.after(()=>store.close());
 const db=new Database(path);t.after(()=>db.close());
 const seen=[];const stop=eventBus.subscribe(e=>seen.push(e));t.after(stop);
 db.exec("CREATE TRIGGER fail_event BEFORE INSERT ON events BEGIN SELECT RAISE(ABORT,'test event failure'); END");
 assert.throws(()=>store.createSession('http://review.localhost'),/test event failure/);
 assert.deepEqual(store.listSessions(),[]);assert.deepEqual(seen,[]);
 db.exec('DROP TRIGGER fail_event');
 const session=store.createSession('http://review.localhost');
 assert.equal(store.getEventsSince(session.id,0).length,1);assert.equal(seen.length,1);
});
test('thread message and both events roll back together',t=>{
 const path=fixture(t);const store=createSQLiteStore(path);t.after(()=>store.close());
 const db=new Database(path);t.after(()=>db.close());
 const session=store.createSession('http://review.localhost');
 const a=store.addAnnotation(session.id,{x:1,y:2,element:'button',elementPath:'button',comment:'test',timestamp:Date.now()});
 const before=store.getEventsSince(session.id,0);const seen=[];const stop=eventBus.subscribe(e=>seen.push(e));t.after(stop);
 db.exec("CREATE TRIGGER fail_thread BEFORE INSERT ON events WHEN NEW.type='thread.message' BEGIN SELECT RAISE(ABORT,'test thread failure'); END");
 assert.throws(()=>store.addThreadMessage(a.id,'human','New message'),/test thread failure/);
 assert.equal(store.getAnnotation(a.id).thread?.length||0,0);
 assert.deepEqual(store.getEventsSince(session.id,0),before);assert.deepEqual(seen,[]);
});
test('sequence survives pruning, process restart, and transient event emission',t=>{
 const path=fixture(t);let store=createSQLiteStore(path);
 const first=store.createSession('http://review.localhost');
 const last=store.getEventsSince(first.id,0)[0].sequence;
 store.close();const db=new Database(path);db.exec('DELETE FROM events');db.close();
 eventBus.setSequence(0);
 store=createSQLiteStore(path);t.after(()=>store.close());
 const transient=eventBus.emit('action.requested',first.id,{sessionId:first.id,annotations:[],output:'test',timestamp:new Date().toISOString()});
 const next=store.createSession('http://review.localhost/next');
 assert.ok(store.getEventsSince(next.id,0)[0].sequence>Math.max(last,transient.sequence));
});
test('subscribers only observe committed events',t=>{
 const path=fixture(t);const store=createSQLiteStore(path);t.after(()=>store.close());
 const db=new Database(path);t.after(()=>db.close());
 const visible=[];const stop=eventBus.subscribe(e=>visible.push(db.prepare('SELECT sequence FROM events WHERE sequence=?').get(e.sequence)));t.after(stop);
 store.createSession('http://review.localhost');assert.equal(visible.length,1);assert.ok(visible[0]);
});

const { createSQLiteStore, createTenantStore } = require('../.test-dist/integration.js');
const tenant=process.argv[3]==='tenant';
const store=tenant?createTenantStore(process.argv[2]):createSQLiteStore(process.argv[2]);
process.send({ready:true});
process.once('message',()=>{
 try{
  for(let i=0;i<20;i++){
   if(tenant)store.createSessionForUser(process.argv[4],'http://review.localhost/'+i);
   else store.createSession('http://review.localhost/'+i);
  }
  process.send({ok:true});
 }catch(error){process.send({ok:false,error:error.message});process.exitCode=1;}
 finally{store.close();process.disconnect();}
});

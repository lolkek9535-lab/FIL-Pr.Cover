// Run against the disposable server started by test/local-server.ts.
const assert=require('node:assert/strict');
const {Client}=require('@modelcontextprotocol/sdk/client/index.js');
const {StreamableHTTPClientTransport}=require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const origin=process.env.AGENTATION_TEST_HTTP_URL;
if(!origin)throw new Error('Set AGENTATION_TEST_HTTP_URL to the assigned test server URL');
const localFetch=fetch;
(async()=>{
 const session=await (await localFetch(origin+'/sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:'http://agentationlayout.localhost:1355/protocol-check'})})).json();
 const created=await(await localFetch(origin+'/sessions/'+session.id+'/annotations',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({x:1,y:2,comment:'Initial note',element:'button',elementPath:'[placement]',timestamp:Date.now(),sourceFile:'src/Checkout.tsx:24',kind:'placement',placement:{componentType:'button',width:100,height:40,scrollY:0,text:'Initial note'}})})).json();
 const updated=await(await localFetch(origin+'/annotations/'+created.id,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({comment:'Edited note',placement:{componentType:'button',width:120,height:40,scrollY:0,text:'Edited note'}})})).json();
 assert.equal(updated.placement.text,'Edited note');
 const client=new Client({name:'agentation-local-review',version:'1.0.0'});
 const transport=new StreamableHTTPClientTransport(new URL(origin+'/mcp'),{fetch:localFetch});
 try{
  await client.connect(transport);
  const result=await client.callTool({name:'agentation_get_pending',arguments:{sessionId:session.id}});
  assert.equal(result.isError,undefined);
  const data=JSON.parse(result.content[0].text);
  assert.equal(data.annotations.length,1);
  assert.equal(data.annotations[0].sourceFile,'src/Checkout.tsx:24');
  assert.equal(data.annotations[0].placement.text,'Edited note');
  assert.equal(data.annotations[0].placement.width,120);
  console.log(JSON.stringify({httpCreateAndUpdate:'pass',mcpProtocol:'pass',sourceFile:data.annotations[0].sourceFile,placementText:data.annotations[0].placement.text,sessionId:session.id}));
 }finally{await client.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createCorsPolicy, integerEnv, MAX_TIMER_MS } = require('../.test-dist/integration.js');
function check(policy, origin) {
  const headers = new Map();
  const allowed = policy({headers: origin === undefined ? {} : {origin}}, {setHeader:(k,v)=>headers.set(k.toLowerCase(),v)});
  return {allowed,headers};
}
test('CORS accepts only configured complete origins, including multiple sites', () => {
  const policy=createCorsPolicy('https://app.example.test/, http://localhost:3000');
  assert.equal(check(policy,'https://app.example.test').allowed,true);
  assert.equal(check(policy,'http://localhost:3000').allowed,true);
  for (const origin of ['https://app.example.test.evil','https://app.example.test/path','http://app.example.test','http://localhost:3001','null']) {
    const response=check(policy,origin);assert.equal(response.allowed,false,origin);
    assert.equal(response.headers.has('access-control-allow-origin'),false);
  }
});
test('invalid CORS configuration fails at startup and an empty list denies browser origins', () => {
  for (const value of ['*,https://app.example.test','regex:https://.*','https://app.example.test/path','file:///tmp','https://user:password@example.test']) {
    assert.throws(()=>createCorsPolicy(value),/AGENTATION_CORS_ORIGINS/);
  }
  assert.equal(check(createCorsPolicy('  '),'https://app.example.test').allowed,false);
  assert.equal(check(createCorsPolicy('  '),undefined).allowed,true);
});
test('numeric config rejects partial, negative, fractional and overflowing timer values', t => {
  const name='AGENTATION_TEST_INTEGER';const previous=process.env[name];
  t.after(()=>{if(previous===undefined)delete process.env[name];else process.env[name]=previous;});
  for(const value of ['-1','1second','1.5','NaN','Infinity','2147483648']){
    process.env[name]=value;assert.equal(integerEnv(name,1000,1,MAX_TIMER_MS),1000,value);
  }
  process.env[name]='0';assert.equal(integerEnv(name,3,0,10),0);
  process.env[name]='11';assert.equal(integerEnv(name,3,0,10),3);
});

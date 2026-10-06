const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { resolve } = require('node:path');

function cli(args, fixture = 'healthy', answers = []) {
  return new Promise((accept, reject) => {
    const child = spawn(process.execPath, ['--require', resolve('test/cli-fixture.cjs'), resolve('.test-dist/cli-review.js'), ...args], {
      env:{...process.env, AGENTATION_CLI_CASE:fixture}, stdio:['pipe','pipe','pipe'],
    });
    let output = '', answer = 0;
    const timeout = setTimeout(() => { child.kill(); reject(new Error('CLI timed out: ' + output)); }, 5000);
    child.stdout.on('data', chunk => {
      output += chunk;
      if (answers[answer] && output.includes(answers[answer][0])) {
        child.stdin.write(answers[answer++][1] + '\n');
      }
    });
    child.stderr.on('data', chunk => { output += chunk; });
    child.on('error', reject);
    child.on('close', code => { clearTimeout(timeout); accept({code,output}); });
  });
}

test('healthy service diagnostics still explain the unverified browser connection', async () => {
  const {code,output}=await cli(['doctor']);
  assert.equal(code,0);
  assert.match(output,/Browser sync is not verified/i);
  assert.match(output,/<Agentation endpoint="http:\/\/localhost:4747" \/>/);
  assert.match(output,/agentation_get_all_pending/);
});
test('doctor warnings cannot be reported as all checks passed', async () => {
  const {code,output}=await cli(['doctor'],'missing-config');
  assert.equal(code,0);
  assert.doesNotMatch(output,/All checks passed/);
  assert.match(output,/checks need attention/i);
});
test('doctor checks the requested endpoint and prints matching browser setup', async () => {
  const {code,output}=await cli(['doctor','--http-url','http://127.0.0.1:4924/']);
  assert.equal(code,0);
  assert.match(output,/HEALTH http:\/\/127.0.0.1:4924\/health/);
  assert.match(output,/<Agentation endpoint="http:\/\/127.0.0.1:4924" \/>/);
});
test('doctor rejects a missing or non-HTTP endpoint before probing', async () => {
  for (const args of [['doctor','--http-url'],['doctor','--http-url','file:///tmp/example']]) {
    const {code,output}=await cli(args);
    assert.equal(code,1);
    assert.doesNotMatch(output,/HEALTH /);
  }
});
test('init registration and component guidance agree on the selected server port', async () => {
  const {code,output}=await cli(['init'],'healthy',[
    ['Set up MCP server integration?','y'],['HTTP server port','4924'],['Start server and test connection?','n'],
  ]);
  assert.equal(code,0);
  const args=JSON.parse(output.match(/REGISTER (.*)/)[1]);
  assert.deepEqual(args,['mcp','add','agentation','--','npx','-y','agentation-mcp','server','--port','4924']);
  assert.match(output,/<Agentation endpoint="http:\/\/localhost:4924" \/>/);
  assert.doesNotMatch(output,/Setup complete!/);
});

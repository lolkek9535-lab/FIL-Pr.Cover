// Child-process fixture: never read personal agent configuration or launch an agent.
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const load = Module._load;
Module._load = function (id, ...rest) {
  const original = load.call(this, id, ...rest);
  if (id === 'fs' || id === 'node:fs') return {
    ...original,
    existsSync(path) {
      if (String(path).endsWith('.claude.json')) return process.env.AGENTATION_CLI_CASE !== 'missing-config';
      if (String(path).endsWith('claude_code_config.json')) return false;
      return original.existsSync(path);
    },
    readFileSync(path, ...args) {
      if (String(path).endsWith('.claude.json')) return JSON.stringify({mcpServers:{agentation:{command:'npx',args:['-y','agentation-mcp','server']}}});
      return original.readFileSync(path, ...args);
    },
  };
  if (id === 'child_process' || id === 'node:child_process') return {
    ...original,
    spawn(command, args) {
      if (command !== 'claude') throw new Error('Unexpected executable in setup test');
      process.stdout.write('\nREGISTER ' + JSON.stringify(args) + '\n');
      const child = new EventEmitter();
      setImmediate(() => child.emit('close', 0));
      return child;
    },
  };
  return original;
};
global.fetch = async url => {
  process.stdout.write('HEALTH ' + url + '\n');
  return new Response('{}', {status:200});
};

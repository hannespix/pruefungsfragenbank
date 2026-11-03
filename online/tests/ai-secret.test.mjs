import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configureAiSecret} from '../tools/configure_ai_secret.mjs';

const env = overrides => ({
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  AI_SECRET_ACTION: 'aktivieren-oder-aktualisieren',
  CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-token',
  ANTHROPIC_API_KEY: 'synthetic-anthropic-key',
  ...overrides,
});
const ok = result => Response.json({success:true,errors:[],messages:[],result});
const hidden = 'synthetic-anthropic-key synthetic-cloudflare-token private-provider-detail';

test('activation sends only the named secret to the fixed Worker secret endpoint', async () => {
  const requests = [];
  const message = await configureAiSecret({env:env(),fetchImpl:async (url,options) => {
    requests.push({url,options});
    return ok({name:'ANTHROPIC_API_KEY',type:'secret_text',text:hidden});
  }});
  assert.equal(requests.length,1);
  const {url,options} = requests[0];
  assert.equal(url,'https://api.cloudflare.com/client/v4/accounts/75bd02fca8d386c43fa477bfb15a4b67/workers/scripts/hortiexam-access/secrets');
  assert.equal(options.method,'PUT');
  assert.equal(options.headers.Authorization,'Bearer synthetic-cloudflare-token');
  assert.equal(options.headers['Content-Type'],'application/json');
  assert.deepEqual(JSON.parse(options.body),{name:'ANTHROPIC_API_KEY',text:'synthetic-anthropic-key',type:'secret_text'});
  assert.equal(options.redirect,'error');
  assert.ok(options.signal instanceof AbortSignal);
  assert.match(message,/eingerichtet/i);
  assert.doesNotMatch(message,/synthetic-|private-provider-detail/);
});

test('deactivation deletes only the Worker secret without requiring or transmitting the Anthropic key', async () => {
  const requests = [];
  const message = await configureAiSecret({env:env({AI_SECRET_ACTION:'deaktivieren',ANTHROPIC_API_KEY:undefined}),fetchImpl:async (url,options) => {
    requests.push({url,options});
    return ok({});
  }});
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,'https://api.cloudflare.com/client/v4/accounts/75bd02fca8d386c43fa477bfb15a4b67/workers/scripts/hortiexam-access/secrets/ANTHROPIC_API_KEY');
  assert.equal(requests[0].options.method,'DELETE');
  assert.equal(requests[0].options.body,undefined);
  assert.match(message,/deaktiviert/i);
  assert.match(message,/GitHub.*erhalten/i);
});

for (const overrides of [
  {GITHUB_REF:'refs/heads/feature'},
  {GITHUB_REF:'refs/tags/main'},
  {GITHUB_REF:undefined},
  {GITHUB_EVENT_NAME:'push'},
  {GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_EVENT_NAME:undefined},
]) test('branch/event guard blocks network access: '+JSON.stringify(overrides), async () => {
  let requests = 0;
  await assert.rejects(configureAiSecret({env:env(overrides),fetchImpl:async () => {requests++;return ok({});}}),/main.*manuell|manuell.*main/i);
  assert.equal(requests,0);
});

for (const overrides of [
  {ANTHROPIC_API_KEY:undefined},
  {ANTHROPIC_API_KEY:''},
  {ANTHROPIC_API_KEY:' '},
  {ANTHROPIC_API_KEY:'synthetic\nkey'},
  {ANTHROPIC_API_KEY:'x'.repeat(4097)},
  {CLOUDFLARE_API_TOKEN:undefined},
  {CLOUDFLARE_API_TOKEN:' '},
  {AI_SECRET_ACTION:'delete-everything'},
  {AI_SECRET_ACTION:undefined},
]) test('invalid or missing setup values fail before any request: '+Object.keys(overrides)[0]+' '+String(Object.values(overrides)[0]).slice(0,24), async () => {
  let requests = 0;
  await assert.rejects(configureAiSecret({env:env(overrides),fetchImpl:async () => {requests++;return ok({});}}));
  assert.equal(requests,0);
});

for (const status of [401,403,404,429,500]) test('HTTP '+status+' fails without exposing provider response text', async () => {
  let requests = 0;
  await assert.rejects(configureAiSecret({env:env(),fetchImpl:async () => {
    requests++;
    return Response.json({success:false,errors:[{code:1000,message:hidden}],messages:[],result:null},{status});
  }}), error => {
    assert.match(error.message,/Cloudflare/);
    assert.doesNotMatch(error.message,/synthetic-|private-provider-detail/);
    assert.equal(error.cause,undefined);
    return true;
  });
  assert.equal(requests,1);
});

for (const response of [
  () => Response.json({success:false,errors:[{code:1000,message:hidden}],messages:[],result:null}),
  () => Response.json({success:'true',result:{text:hidden}}),
  () => new Response(hidden),
  () => new Response(' '.repeat(65537)+hidden),
]) test('unconfirmed or malformed results cannot be reported as success', async () => {
  await assert.rejects(configureAiSecret({env:env(),fetchImpl:async () => response()}),error => {
    assert.doesNotMatch(error.message,/synthetic-|private-provider-detail/);
    return true;
  });
});

test('network failures are sanitized and are not retried', async () => {
  let requests = 0;
  await assert.rejects(configureAiSecret({env:env(),fetchImpl:async () => {requests++;throw new Error(hidden);}}),error => {
    assert.match(error.message,/Cloudflare/);
    assert.doesNotMatch(error.message,/synthetic-|private-provider-detail/);
    assert.equal(error.cause,undefined);
    return true;
  });
  assert.equal(requests,1);
});

test('CLI rejects an unsafe branch with a nonzero exit and no credentials in output', () => {
  const result = spawnSync(process.execPath,[fileURLToPath(new URL('../tools/configure_ai_secret.mjs',import.meta.url))],{
    env:env({GITHUB_REF:'refs/heads/feature'}),encoding:'utf8',timeout:5000,
  });
  assert.equal(result.status,1);
  assert.equal(result.stdout,'');
  assert.match(result.stderr,/main/);
  assert.doesNotMatch(result.stderr,/synthetic-|private-provider-detail/);
});

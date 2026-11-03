import {pathToFileURL} from 'node:url';

// Deliberately fixed: credentials must never be sent to a workflow-provided URL.
const secretsUrl = 'https://api.cloudflare.com/client/v4/accounts/75bd02fca8d386c43fa477bfb15a4b67/workers/scripts/hortiexam-access/secrets';
const secretName = 'ANTHROPIC_API_KEY';
const activate = 'aktivieren-oder-aktualisieren';
const deactivate = 'deaktivieren';
const providerFailure = 'Cloudflare hat die Änderung nicht bestätigt. Token, Berechtigung und Worker prüfen; danach den Lauf erneut starten. Antwortdetails werden nicht ausgegeben.';

class SetupError extends Error {}

function requiredSecret(env,name) {
  const value = env[name];
  if (typeof value !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(value)) {
    throw new SetupError(name+' fehlt oder ist ungültig. Unter GitHub Settings → Secrets and variables → Actions als Repository Secret hinterlegen (ohne Leerzeichen oder Zeilenumbrüche).');
  }
  return value;
}

async function readResult(response) {
  // The API may echo a secret even in a successful result. Never log its body.
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Unconfirmed response');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const {done,value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new Error('Oversized response');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function configureAiSecret({env=process.env,fetchImpl=globalThis.fetch}={}) {
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main') {
    throw new SetupError('Die KI-Einrichtung darf nur manuell über GitHub Actions auf dem Branch main gestartet werden.');
  }
  const action = env.AI_SECRET_ACTION;
  if (action !== activate && action !== deactivate) {
    throw new SetupError('Bitte im Workflow aktivieren-oder-aktualisieren oder deaktivieren auswählen.');
  }
  const token = requiredSecret(env,'CLOUDFLARE_API_TOKEN');
  const options = {
    method: action === activate ? 'PUT' : 'DELETE',
    headers: {Authorization:'Bearer '+token},
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  };
  if (action === activate) {
    const key = requiredSecret(env,secretName);
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify({name:secretName,text:key,type:'secret_text'});
  }
  try {
    // Use the single-secret API, never the Worker upload/settings APIs: code,
    // database bindings and unrelated secrets are preserved by this operation.
    const response = await fetchImpl(action === activate ? secretsUrl : secretsUrl+'/'+secretName,options);
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('Unconfirmed response');
    }
    const result = await readResult(response);
    if (result?.success !== true) throw new Error('Unconfirmed response');
  } catch {
    // Do not propagate provider messages, fetch errors, request objects or causes.
    throw new SetupError(providerFailure);
  }
  return action === activate
    ? 'ANTHROPIC_API_KEY wurde für hortiexam-access eingerichtet. Der API-Schlüssel wurde nicht bei Anthropic getestet.'
    : 'Die KI-Schreibhilfe wurde deaktiviert: ANTHROPIC_API_KEY wurde aus dem Worker entfernt. Das GitHub Secret bleibt erhalten.';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 2) throw new SetupError('Dieses Skript akzeptiert keine Kommandozeilenargumente. Bitte den GitHub-Workflow verwenden.');
    console.log(await configureAiSecret());
  } catch (error) {
    console.error(error instanceof SetupError ? error.message : 'Die KI-Einrichtung konnte nicht bestätigt werden. Bitte die Konfiguration prüfen.');
    process.exitCode = 1;
  }
}

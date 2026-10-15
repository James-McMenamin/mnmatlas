'use strict';
// Parent pages receive a redeemable code only, never an Atlas or Discord token.
window.installAtlasEmbedAuth = function({client, settings, approve, fetcher = fetch, host = window}) {
 const partners = Array.isArray(settings.embedAuthPartners) ? settings.embedAuthPartners : [];
 const valid = partners.filter(partner => {
  try {
   return typeof partner.id === 'string' && new URL(partner.origin).origin === partner.origin && partner.origin.startsWith('https://');
  } catch { return false; }
 });
 if (host.parent === host || !valid.length) return () => {};
 let pending = null;
 const seen = new Map();
 async function receive(event) {
  if (event.source !== host.parent) return;
  const partner = valid.find(row => row.origin === event.origin);
  const request = event.data;
  if (!partner || !request || request.type !== 'mnmatlas:signin' || request.version !== 1 ||
      typeof request.requestId !== 'string' || !/^[a-zA-Z0-9_-]{32,128}$/.test(request.requestId)) return;
  const key = partner.id + ':' + request.requestId;
  for (const [id, time] of seen) if (Date.now() - time > 300000) seen.delete(id);
  if (seen.has(key) || pending || seen.size >= 100) return;
  seen.set(key, Date.now());
  const controller = new AbortController();
  const job = {controller};
  pending = job;
  const reply = value => event.source.postMessage({
   type: 'mnmatlas:signin-result', version: 1, requestId: request.requestId, ...value
  }, event.origin);
  let timeout;
  const cancelled = new Promise(resolve => controller.signal.addEventListener('abort', () => resolve(null), {once: true}));
  timeout = setTimeout(() => controller.abort(), 300000);
  try {
   const approvedUser = await Promise.race([approve(partner, {signal: controller.signal}), cancelled]);
   if (pending !== job) return;
   if (!approvedUser || controller.signal.aborted) { reply({error: 'cancelled'}); return; }
   const sessionResult = await Promise.race([client.auth.getSession(), cancelled]);
   if (controller.signal.aborted || pending !== job) return;
   const session = sessionResult?.data?.session;
   if (sessionResult?.error || !session?.access_token) { reply({error: 'sign-in-required'}); return; }
   // Consent is for the account displayed to the visitor, not a replacement session.
   if (session.user?.id !== approvedUser) { reply({error: 'account-changed'}); return; }
   const network = async () => {
    const response = await fetcher(settings.supabaseUrl.replace(/\/$/, '') + '/functions/v1/embed-handoff', {
     method: 'POST', signal: controller.signal,
     headers: {'Content-Type': 'application/json', apikey: settings.supabaseKey, Authorization: 'Bearer ' + session.access_token},
     body: JSON.stringify({action: 'issue', partner: partner.id, nonce: request.requestId})
    });
    if (!response.ok) throw Error('issue');
    return response.json();
   };
   const result = await Promise.race([network(), cancelled]);
   if (controller.signal.aborted || pending !== job) return;
   if (typeof result?.code !== 'string' || !/^[a-zA-Z0-9-]{64,128}$/.test(result.code) ||
       result.nonce !== request.requestId || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw Error('response');
   reply({code: result.code, expiresAt: result.expiresAt});
  } catch {
   if (pending === job && !controller.signal.aborted) reply({error: 'unavailable'});
  } finally {
   clearTimeout(timeout);
   controller.abort();
   if (pending === job) pending = null;
  }
 }
 host.addEventListener('message', receive);
 return () => {
  const job = pending;
  pending = null;
  job?.controller.abort();
  host.removeEventListener('message', receive);
 };
};

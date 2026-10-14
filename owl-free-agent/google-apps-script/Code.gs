/**
 * OWL Gmail Sensor v0.1 — Google Apps Script.
 * User-installed in script.google.com; no passwords/API keys.
 * Reads GitHub workflow email metadata; saves ONE private draft digest.
 * No outgoing mail, no account creation, no moving or deleting emails.
 */
const OWL_QUERY = 'from:notifications@github.com KISASIGNALS newer_than:7d -in:trash';
const OWL_PROP = 'OWL_LAST_FINGERPRINT';
function owlScan() {
  const threads = GmailApp.search(OWL_QUERY, 0, 100);
  const groups = {}, examples = {};
  let inspected = 0;
  for (const t of threads) for (const m of t.getMessages()) {
    if (inspected++ >= 200) break;
    const subject = m.getSubject() || '';
    const kind = subject.includes('oos-isolated-postgres') ? 'oos-isolated-postgres'
      : subject.includes('contracts') ? 'contracts'
      : subject.includes('healthchecks') ? 'healthchecks' : 'other';
    groups[kind] = (groups[kind] || 0) + 1;
    if (!examples[kind]) examples[kind] = subject.slice(0, 180);
  }
  const keys = Object.keys(groups).sort();
  const fingerprint = keys.map(k => k + ':' + groups[k]).join('|');
  const props = PropertiesService.getScriptProperties();
  if (fingerprint === props.getProperty(OWL_PROP)) return;
  const lines = [
    'OWL Gmail Sensor (read-only scan; draft only)',
    'Generated UTC: ' + new Date().toISOString(),
    'Scope: first 100 matching threads; up to 200 messages. Counts are not complete inbox totals.',
    'Messages inspected: ' + inspected,
    '', ...keys.map(k => k + ': ' + groups[k] + ' | sample: ' + examples[k]),
    '',
    'Hypotheses only: email counts are not unique incidents or verified root causes.',
    'Verify failures using GitHub Actions logs before deciding to fix/deploy.',
    'No message was sent. No accounts were created.'
  ];
  GmailApp.createDraft(Session.getEffectiveUser().getEmail(),
    'OWL / Gmail Sensor — ' + new Date().toISOString().slice(0,10), lines.join('\n'));
  props.setProperty(OWL_PROP, fingerprint);
}
function owlInstallDailyTrigger() {
  // Invoke manually after reviewing and approving Google account permissions.
  const handler = 'owlScan';
  for (const t of ScriptApp.getProjectTriggers()) {
    if (t.getHandlerFunction() === handler) ScriptApp.deleteTrigger(t);
  }
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(9).create();
}

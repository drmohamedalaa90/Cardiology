import { supabaseClient } from './supabase-client.js';
import { requireAdmin } from './auth.js';

const $ = (id) => document.getElementById(id);
let competitionRows = [];
let questionRows = [];

function setStatus(message = '', kind = '') {
  const box = $('analyticsStatus');
  box.textContent = message;
  box.className = `status-box ${kind}`.trim();
}
function esc(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function seconds(value) {
  const n = Number(value || 0); const m = Math.floor(n / 60); const s = Math.round(n % 60);
  return `${m}:${String(s).padStart(2,'0')}`;
}
function renderOverview(data) {
  const labels = [
    ['Registered users','registered_users'],['Active users','active_users'],['Published modules','published_modules'],
    ['Published questions','published_questions'],['Published quizzes','published_quizzes'],['Competitions','competitions'],
    ['Completed learning attempts','completed_learning_attempts'],['Submitted competition attempts','submitted_competition_attempts'],
    ['Average competition score','average_competition_score'],['Average accuracy','average_competition_accuracy']
  ];
  $('overviewCards').innerHTML = labels.map(([label,key]) => `<div class="stat-card"><span>${esc(label)}</span><strong>${esc(data?.[key] ?? 0)}</strong></div>`).join('');
}
function renderCompetitions() {
  $('competitionReportBody').innerHTML = competitionRows.length ? competitionRows.map(r => `<tr>
    <td>${esc(r.competition_title)}</td><td>${esc(r.participant_count)}</td><td>${esc(r.submitted_count)}</td><td>${esc(r.terminated_count)}</td>
    <td>${esc(r.average_score)}</td><td>${esc(r.average_accuracy)}%</td><td>${seconds(r.average_duration_seconds)}</td><td>${esc(r.warning_events)}</td>
  </tr>`).join('') : '<tr><td colspan="8" class="table-empty">No competition data yet.</td></tr>';
}
function renderQuestions() {
  $('questionReportBody').innerHTML = questionRows.length ? questionRows.map(r => {
    const pct = Number(r.correct_percentage || 0);
    return `<tr><td title="${esc(r.stem)}">${esc(String(r.stem || '').slice(0,100))}${String(r.stem || '').length>100?'…':''}</td><td>${esc(r.topic || '—')}</td><td>${esc(r.difficulty)}</td><td>${esc(r.response_count)}</td><td>${esc(r.correct_count)}</td><td><strong>${pct}%</strong></td><td>${esc(r.average_points)}</td><td>${esc(r.high_confidence_count)}</td></tr>`;
  }).join('') : '<tr><td colspan="8" class="table-empty">No question responses yet.</td></tr>';
}
function csvDownload(filename, rows) {
  if (!rows.length) return setStatus('There is no data to export.', 'error');
  const headers = Object.keys(rows[0]);
  const quote = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const csv = [headers.map(quote).join(','), ...rows.map(r => headers.map(h => quote(r[h])).join(','))].join('\r\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'}); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
async function loadModules() {
  const {data,error} = await supabaseClient.from('modules').select('id,title').order('title');
  if (error) throw error;
  $('moduleFilter').innerHTML = '<option value="">All modules</option>' + (data||[]).map(m=>`<option value="${esc(m.id)}">${esc(m.title)}</option>`).join('');
}
async function loadAll() {
  setStatus('Loading analytics…');
  const moduleId = $('moduleFilter').value || null;
  const [overview, competitions, questions] = await Promise.all([
    supabaseClient.rpc('acl_admin_analytics_overview'),
    supabaseClient.rpc('acl_admin_competition_report', {p_competition_id:null}),
    supabaseClient.rpc('acl_admin_question_report', {p_module_id:moduleId})
  ]);
  const failed = [overview,competitions,questions].find(x=>x.error); if (failed) throw failed.error;
  renderOverview(overview.data || {}); competitionRows=competitions.data||[]; questionRows=questions.data||[];
  renderCompetitions(); renderQuestions(); setStatus(`Updated ${new Date().toLocaleString()}`, 'success');
}

(async()=>{
  try {
    await requireAdmin(); await loadModules(); await loadAll();
    $('refreshAnalytics').addEventListener('click',()=>loadAll().catch(e=>setStatus(e.message,'error')));
    $('moduleFilter').addEventListener('change',()=>loadAll().catch(e=>setStatus(e.message,'error')));
    $('exportCompetitionCsv').addEventListener('click',()=>csvDownload('acl-competition-report.csv',competitionRows));
    $('exportQuestionsCsv').addEventListener('click',()=>csvDownload('acl-question-report.csv',questionRows));
  } catch (error) { setStatus(error.message || 'Unable to load analytics.', 'error'); }
})();

(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const readArray = (key) => { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };
  const employees = readArray('tabaja-employees-v11');
  const jobs = readArray('tabaja-print-jobs');
  const cards = readArray('tabaja-recent-cards');
  const templates = readArray('tabaja-templates');
  const today = new Date().toISOString().slice(0, 10);
  const todayJobs = jobs.filter((j) => String(j.date || j.createdAt || '').slice(0, 10) === today);
  const todayCards = todayJobs.reduce((sum, j) => sum + Number(j.cards || j.count || 0), 0);

  function setText(id, value) { const el = $(id); if (el) el.textContent = String(value); }
  function updateClock() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    setText('ccGreeting', `${greeting}, Abed.`);
    setText('ccDate', now.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }));
    setText('ccClock', now.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }));
  }
  function renderRecentCards() {
    const target = $('ccRecentCards');
    if (!target || !cards.length) return;
    target.innerHTML = cards.slice(-5).reverse().map((card, i) => `<div class="cc-card-row"><span class="cc-card-thumb">${String(card.name || card.employee || 'ID').slice(0,2).toUpperCase()}</span><div><b>${card.name || card.employee || 'Identity Card'}</b><small>${card.template || card.company || 'Tabaja Solution'} • ${card.date || 'Recent'}</small></div><em>${card.status || 'Ready'}</em></div>`).join('');
  }
  function renderLastBatch() {
    if (!jobs.length) return;
    const job = jobs[jobs.length - 1];
    const total = Number(job.cards || job.count || 0);
    const done = Number(job.completed || job.printed || 0);
    const percent = total ? Math.min(100, Math.round(done / total * 100)) : 0;
    setText('ccBatchName', job.name || 'Excel Production Batch');
    setText('ccBatchNote', job.note || 'Most recent production batch.');
    setText('ccBatchMeta', `${total} cards • ${done} completed`);
    setText('ccBatchState', percent === 100 ? 'COMPLETED' : percent ? 'IN PROGRESS' : 'READY');
    const progress = $('ccBatchProgress'); if (progress) progress.style.width = `${percent}%`;
  }
  document.addEventListener('DOMContentLoaded', () => {
    setText('ccEmployeeCount', employees.length);
    setText('ccActivityEmployees', `${employees.length} records available.`);
    setText('ccTodayJobs', todayJobs.length);
    setText('ccTodayCards', todayCards);
    setText('ccTemplateCount', templates.length);
    setText('ccQueueCount', `${jobs.filter((j) => j.status === 'queued').length} waiting`);
    updateClock(); renderRecentCards(); renderLastBatch();
    window.setInterval(updateClock, 30000);
  });
})();

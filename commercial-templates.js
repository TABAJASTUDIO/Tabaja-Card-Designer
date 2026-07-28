(() => {
  function go(view){ document.querySelector(`.v8-nav-btn[data-view="${view}"]`)?.click(); }
  function init(){
    const grid=document.getElementById('templateGrid');
    const search=document.getElementById('templateSearch');
    const filters=[...document.querySelectorAll('[data-template-filter]')];
    const cards=[...document.querySelectorAll('.tg-card')];
    const count=document.getElementById('templateResultCount');
    const empty=document.getElementById('templateEmpty');
    let filter='all';
    const refresh=()=>{
      const q=(search?.value||'').trim().toLowerCase(); let visible=0;
      cards.forEach(card=>{ const hay=`${card.dataset.templateTags} ${card.textContent}`.toLowerCase(); const show=(filter==='all'||hay.includes(filter))&&(!q||hay.includes(q)); card.hidden=!show; if(show) visible++; });
      if(count) count.textContent=`${visible} design${visible===1?'':'s'}`; if(empty) empty.hidden=visible!==0;
    };
    filters.forEach(btn=>btn.addEventListener('click',()=>{filters.forEach(x=>x.classList.remove('active'));btn.classList.add('active');filter=btn.dataset.templateFilter;refresh();}));
    search?.addEventListener('input',refresh);
    grid?.addEventListener('click',event=>{ const card=event.target.closest('.tg-card'); if(!card)return; if(window.TabajaCommercialTemplates?.apply(card.dataset.templateId)){ go('designer'); }});
    document.getElementById('openBlankDesigner')?.addEventListener('click',()=>go('designer'));
    refresh();
  }
  window.addEventListener('DOMContentLoaded',init);
})();

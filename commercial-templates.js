(() => {
  function go(view){ document.querySelector(`.v8-nav-btn[data-view="${view}"]`)?.click(); }
  function init(){
    const grid=document.getElementById('templateGrid');
    const search=document.getElementById('templateSearch');
    const filters=[...document.querySelectorAll('[data-template-filter]')];
    const cards=[...document.querySelectorAll('.tg-card')];
    cards.forEach(card=>{
      if(card.querySelector('.tg-card-badges')) return;
      const tags=(card.dataset.templateTags||'').toLowerCase();
      const badges=document.createElement('div'); badges.className='tg-card-badges';
      const material=tags.includes('black')?'BLACK PVC':'WHITE PVC';
      const premium=/(luxury|premium|gold|silver|executive)/.test(tags);
      badges.innerHTML=`<span>${material}</span>${premium?'<span class="premium">PREMIUM</span>':''}`;
      card.querySelector('.tg-preview')?.appendChild(badges);
    });
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
    document.querySelectorAll('[data-collection-filter]').forEach(btn=>btn.addEventListener('click',()=>{
      const wanted=btn.dataset.collectionFilter; const match=filters.find(x=>x.dataset.templateFilter===wanted);
      if(match) match.click(); document.getElementById('templateGrid')?.scrollIntoView({behavior:'smooth',block:'start'});
    }));
    grid?.addEventListener('click',event=>{ const card=event.target.closest('.tg-card'); if(!card)return; if(window.TabajaCommercialTemplates?.apply(card.dataset.templateId)){ go('designer'); }});
    document.getElementById('openBlankDesigner')?.addEventListener('click',()=>go('designer'));
    document.querySelectorAll('[data-bg-type]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('[data-bg-type]').forEach(x=>x.classList.toggle('active',x===btn));
      document.querySelectorAll('[data-bg-panel]').forEach(x=>x.classList.toggle('active',x.dataset.bgPanel===btn.dataset.bgType));
    }));
    document.getElementById('useSplitGradientBtn')?.addEventListener('click',()=>{
      document.querySelector('[data-bg-type="gradient"]')?.click();
    });
    refresh();
  }
  window.addEventListener('DOMContentLoaded',init);
})();

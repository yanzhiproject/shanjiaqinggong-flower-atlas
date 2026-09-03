(()=>{
  const chapterNames=['识名物','看菜谱','读故事','赏诗词','品意蕴'];
  const chapterTitles=chapterNames.map((name,index)=>`${['第一章','第二章','第三章','第四章','第五章'][index]} · ${name}`);
  const mudanPages=['identify.html','recipe.html','story.html','poetry.html','meaning.html'];

  function directChild(header,selectors){
    return [...header.children].find(child=>selectors.some(selector=>child.matches?.(selector)))||null;
  }

  function normalizeHome(header){
    let home=directChild(header,['.sjq-atlas-back','.atlas-back','.site-back','.brand']);
    if(!home){
      home=document.createElement('button');
      home.type='button';
      header.prepend(home);
    }
    home.classList.add('sjq-header-home');
    home.textContent='← 返回花馔图鉴';
    home.setAttribute('aria-label','返回花馔图鉴');
    if(home.tagName==='A')home.setAttribute('href','../../index.html?home=1');
    if(!home.dataset.sjqHomeBound&&home.tagName!=='A'&&!home.id){
      home.dataset.sjqHomeBound='1';
      home.addEventListener('click',()=>{
        if(window.parent!==window)window.parent.postMessage({type:'returnFlowerAtlas'},'*');
        else window.location.href='../../index.html?home=1';
      });
    }
    return home;
  }

  function normalizeNav(header){
    const nav=directChild(header,['.sjq-nav','.chapter-nav','.pill-nav','.nav']);
    if(!nav)return null;
    nav.classList.add('sjq-header-nav');
    [...nav.children].forEach(item=>{
      if(item.matches('.slider'))return;
      item.classList.add('sjq-header-nav-item');
      if(item.getAttribute('aria-disabled')==='true')item.removeAttribute('aria-disabled');
    });
    return nav;
  }

  function currentChapter(nav){
    const items=[...nav.children].filter(item=>!item.matches('.slider'));
    let index=items.findIndex(item=>item.classList.contains('active')||item.getAttribute('aria-current')==='page');
    if(index<0){
      const text=document.title+document.body.innerText.slice(0,500);
      index=chapterNames.findIndex(name=>text.includes(name));
    }
    return Math.max(0,index);
  }

  function normalizeSound(meta,header){
    let sound=directChild(header,['.sjq-sound-dock','.music','.audio-button','.music-button','.audio']);
    if(!sound)sound=meta.querySelector('.sjq-sound-dock,.music,.audio-button,.music-button,.audio');
    if(!sound)return;
    if(sound.parentElement===header)meta.appendChild(sound);
    sound.classList.add('sjq-header-sound-wrap');
    const button=sound.matches('button')?sound:sound.querySelector('button');
    if(!button)return;
    button.classList.add('sjq-header-sound-button');
    if(!button.querySelector('.sjq-sound-bars')){
      button.innerHTML='<span class="sjq-header-sound-bars" aria-hidden="true"><i></i><i></i><i></i></span><span class="sjq-sr-only">山林清音</span>';
    }
    button.setAttribute('aria-label',button.getAttribute('aria-label')||'播放或暂停山林清音');
  }

  function normalizeMeta(header,nav){
    let meta=directChild(header,['.site-tools','.sjq-header-meta']);
    if(!meta){
      meta=[...header.children].find(child=>
        child.querySelector?.('.sjq-sound-dock,.music,.audio-button,.music-button,.audio,.chapter,.chapter-tag,.chapter-label,.flower-status,.status')
      )||null;
    }
    const oldLabel=directChild(header,['.chapter','.chapter-tag','.chapter-label','.flower-status','.status']);
    if(!meta){
      meta=document.createElement('div');
      header.appendChild(meta);
    }
    meta.classList.add('sjq-header-meta');
    if(oldLabel&&oldLabel.parentElement===header)meta.prepend(oldLabel);
    let label=meta.querySelector('.chapter,.chapter-tag,.chapter-label,.flower-status,.status,.sjq-header-chapter');
    if(!label){
      label=document.createElement('span');
      meta.prepend(label);
    }
    label.classList.add('sjq-header-chapter');
    const render=()=>{label.textContent=chapterTitles[currentChapter(nav)]};
    render();
    try{
      new MutationObserver(render).observe(nav,{subtree:true,attributes:true,attributeFilter:['class','aria-current']});
    }catch(error){
      nav?.addEventListener?.('click',()=>requestAnimationFrame(render));
    }
    normalizeSound(meta,header);
  }

  function bindMudanNav(nav){
    if(!/\/flowers\/mudan\//.test(location.pathname.replaceAll('\\','/')))return;
    [...nav.children].filter(item=>!item.matches('.slider')).forEach((item,index)=>{
      if(item.tagName==='A'){
        item.setAttribute('href',mudanPages[index]);
        return;
      }
      if(item.classList.contains('active')||item.getAttribute('aria-current')==='page')return;
      if(item.dataset.sjqMudanBound)return;
      item.dataset.sjqMudanBound='1';
      item.addEventListener('click',()=>window.location.href=mudanPages[index]);
    });
  }

  function normalize(header){
    if(header.dataset.sjqUnifiedReady)return;
    if(!directChild(header,['.sjq-nav','.chapter-nav','.pill-nav','.nav']))return;
    header.dataset.sjqUnifiedReady='1';
    header.classList.add('sjq-unified-header');
    normalizeHome(header);
    const nav=normalizeNav(header);
    if(!nav)return;
    normalizeMeta(header,nav);
    bindMudanNav(nav);
  }

  function run(){
    document.querySelectorAll('header.site-header,header.topbar,header.sjq-shell').forEach(normalize);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();

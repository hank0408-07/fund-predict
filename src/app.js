/* ===== 后端API配置 ===== */
const API_CONFIG = {
  baseUrl: '', // Cloudflare Worker地址，部署后填入
  enabled: true,
  // 本地回退方案
  fallback: {
    funds: ['https://fundmobapi.eastmoney.com/FundMApi/FundNetDiagram.ashx'],
    market: 'local'
  }
};

/* ===== 简单LocalStorage云同步（模拟Supabase效果）===== */
class LocalCloud {
  constructor() {
    this.prefix = 'FUND_SYNC_';
    this.deviceId = localStorage.getItem('device_id') || this.genId();
    localStorage.setItem('device_id', this.deviceId);
  }
  genId() {
    return 'dev_' + Math.random().toString(36).slice(2, 10);
  }
  async save(key, data) {
    try {
      const payload = { deviceId: this.deviceId, ts: Date.now(), data };
      localStorage.setItem(this.prefix + key, JSON.stringify(payload));
      // 广播到其他tab
      broadcastChannel.postMessage({ type: 'sync', key, payload });
    } catch (e) { console.error('Sync error:', e); }
  }
  async load(key) {
    try {
      const raw = localStorage.getItem(this.prefix + key);
      if (!raw) return null;
      const { data } = JSON.parse(raw);
      return data;
    } catch { return null; }
  }
}
const sync = new LocalCloud();

/* ===== 埋点系统 ===== */
const TRACK_EVENTS = 'FUND_TRACK';
function trackEvent(eventType, data = {}) {
  try {
    const events = JSON.parse(localStorage.getItem(TRACK_EVENTS) || '[]');
    events.push({ event: eventType, data, ts: Date.now() });
    localStorage.setItem(TRACK_EVENTS, JSON.stringify(events.slice(-100)));
    // 发送到服务端（如果配置了API）
    if (API_CONFIG.enabled && API_CONFIG.baseUrl) {
      fetch(API_CONFIG.baseUrl + '/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventType, data, deviceId: sync.deviceId })
      }).catch(() => {});
    }
  } catch (e) {}
}
// 自动追踪Tab切换
document.addEventListener('click', (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) trackEvent('tab_switch', { tab: tab.dataset.tab });
  const item = e.target.closest('[data-code]');
  if (item) trackEvent('fund_click', { code: item.dataset.code });
});


/* ===== 通俗名字映射 ===== */
const NICK={
  "110022":"易方达消费行业股",
  "161725":"招商中证白酒指数",
  "003096":"中欧医疗健康",
  "005827":"易方达蓝筹精选",
  "260108":"景顺长城新兴成长",
  "001156":"申万菱信新能源汽",
  "003834":"华夏能源革新",
  "002190":"农银新能源主题",
  "270042":"广发纳斯达克10",
  "161005":"富国天惠成长",
  "163406":"兴全合润",
  "008888":"华夏国证半导体芯",
  "110029":"易方达科讯",
  "340006":"兴全全球视野股票",
  "377240":"上投摩根新兴动力",
  "519068":"汇添富成长焦点",
  "540003":"汇丰晋信动态策略",
  "590002":"中邮核心成长",
  "630002":"华商盛世成长",
  "000001":"华夏成长",
  "001186":"富国文体健康",
  "001349":"富国改革动力",
  "006751":"富国互联科技",
  "007119":"睿远成长价值",
  "009548":"汇添富中盘价值精",
  "010196":"易方达核心优势",
  "011609":"易方达科创板50",
  "012414":"华夏中证新能源车",
  "013308":"华夏中证光伏产业",
  "014110":"嘉实中证稀土产业",
  "360007":"光大优势配置",
  "450004":"国富深化价值",
  "481001":"工银核心价值",
  "519133":"海富通改革驱动",
  "660004":"农银策略价值",
  "690001":"民生加银品牌蓝筹",
  "710001":"富安达优势成长",
  "730001":"东方策略成长",
  "000003":"中海可转换债券A"
};
// 重点监视板块（场外基金：白酒、医疗、新能源）
const WATCH={"黄金":["007976"],"科技":["001167"],"医疗":["000780"],"新能源":["001158"]};
const CODES=Object.keys(NICK);
const pct=v=>(v>0?'+':'')+v.toFixed(2)+'%';
function dec(buf){for(const e of ['gbk','gb18030','utf-8']){try{return new TextDecoder(e).decode(buf)}catch(x){}}return ''}
const S=(id)=>document.getElementById(id);

/* ===== 登录系统 ===== */
let avatar='';
const AUTH_KEY='FUND_PRO_AUTH';
const CACHE_KEY='FUND_PRO_CACHE';

function renderAvatar(el,av){
  if(av&&av.startsWith('data:')){el.innerHTML='<img src="'+av+'" alt="头像">'}
  else{el.textContent=av||'👤'}
}
function onAvatarFile(e){
  const f=e.target.files[0];if(!f)return;
  const img=new Image(),url=URL.createObjectURL(f);
  img.onload=()=>{
    const c=document.createElement('canvas');c.width=c.height=128;
    c.getContext('2d').drawImage(img,0,0,128,128);
    avatar=c.toDataURL('image/jpeg',0.85);
    renderAvatar(S('avatarPreview'),avatar);
    URL.revokeObjectURL(url);
  };
  img.src=url;
}
// 口令校验（哈希比对，源码不含明文）
function hp(str){let h=5381;for(let i=0;i<str.length;i++)h=((h<<5)+h+str.charCodeAt(i))>>>0;return h.toString(16)}
const PWD_HASH=0x7bd51c78.toString(16);
function doLogin(){
  const u='hank',p=S('passInput').value.trim();
  S('loginErr').style.color='';
  if(hp(p)!==PWD_HASH){S('loginErr').textContent='密码错误';S('passInput').value='';S('passInput').focus();return}
  S('loginErr').textContent='';
  localStorage.setItem(AUTH_KEY,JSON.stringify({user:u,avatar:avatar}));
  enterMain();
}
function enterMain(){
  const a=JSON.parse(localStorage.getItem(AUTH_KEY)||'{}');
  S('loginView').classList.add('hidden');
  S('mainView').classList.remove('hidden');
  S('navUser').textContent=a.user||'研究员';
  renderAvatar(S('navAvatar'),a.avatar||'👤');
  go();
}
function doLogout(){
  localStorage.removeItem(AUTH_KEY);
  S('mainView').classList.add('hidden');
  S('loginView').classList.remove('hidden');
}

/* ===== 数据抓取 ===== */
async function quotes(){
  // 场外基金：净值T+1更新，用内置快照的最新净值
  return (SNAPSHOT.data||[]).map(x=>({full:x.full,code:x.code,price:x.price,chg:x.chg}));
}
function kline(code){
  // 天天基金App接口JSONP：并行安全（独立回调），返回 [{d:日期, v:净值}]
  return new Promise(resolve=>{
    const cb='_kfn_'+Math.random().toString(36).slice(2);
    const sc=document.createElement('script');
    sc.src='https://fundmobapi.eastmoney.com/FundMApi/FundNetDiagram.ashx?FCODE='+code+'&callback='+cb+'&deviceid=1&plat=Android&product=EFund&version=6.2.5&_='+Date.now();
    let done=false;
    const finish=(val)=>{if(done)return;done=true;delete window[cb];sc.remove();resolve(val||[])};
    window[cb]=(j)=>{
      try{
        const rows=(j&&j.Datas)||[];
        if(rows.length>=15){
          const asc=[...rows].reverse(); // 接口降序→升序
          finish(asc.map(r=>({d:r.FSRQ,v:parseFloat(r.DWJZ)})).filter(x=>x.v>0));
        } else finish([]);
      }catch(e){finish([])}
    };
    sc.onerror=()=>finish([]);
    document.head.appendChild(sc);
    setTimeout(()=>finish([]),8000);
  });
}
function predict(closes){
  if(closes.length<15)return null;
  const n=closes.length;
  let sx=0,sy=0,sxy=0,sxx=0;
  for(let i=0;i<n;i++){sx+=i;sy+=closes[i];sxy+=i*closes[i];sxx+=i*i}
  const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx);
  const sp=slope/(sy/n)*100*5;
  const c5=(closes[n-1]/closes[n-6]-1)*100;
  let up=0;for(let i=n-5;i<n;i++)if(closes[i]>closes[i-1])up++;
  return {prob:Math.max(5,Math.min(95,Math.round(50+sp*2.5+c5*0.7+(up-2.5)*5))),c5};
}
/* 回调风险：只返回「大回调 / 小回调」两档方向 */
function predictPullback(closes,code){
  if(closes.length<15)return null;
  // 债券/低波动基金（价格100+或波动极小）不算回调风险
  if(closes[closes.length-1]>50)return {level:'small',risk:0,bond:true};
  const n=closes.length;
  const c5=(closes[n-1]/closes[n-6]-1)*100;       // 近5日涨幅
  let streak=0;for(let i=n-1;i>0;i--){if(closes[i]>closes[i-1])streak++;else break}
  const ma5=closes.slice(-5).reduce((a,b)=>a+b,0)/5;
  const dev=(closes[n-1]/ma5-1)*100;               // 偏离均线
  let vol=0;for(let i=n-5;i<n;i++)vol+=Math.abs(closes[i]/closes[i-1]-1)*100;
  vol/=5;
  // 回调风险：急涨 + 连涨 + 偏离均线，波动大的才真回调
  let risk=0;
  risk+=Math.max(0,c5)*1.2;
  risk+=streak*2.5;
  risk+=Math.max(0,dev)*2.0;
  // 只有波动够大的品种，急涨才算危险
  if(vol<0.5) risk*=0.3;
  return {level:risk>=22?'big':'small',risk:Math.round(risk)};
}
function markPullback(arr){
  // 相对排名：取回调风险最高的前20%（至少5只），保证板块有内容
  const copy=arr.map(x=>({...x,pb:{...x.pb}}));
  copy.forEach(x=>{if(x.pb)x.pb.level='small'}); // 先重置
  const cand=copy.filter(x=>x.pb&&!x.pb.bond).sort((a,b)=>b.pb.risk-a.pb.risk);
  const n=Math.max(5,Math.ceil(cand.length*0.2));
  cand.slice(0,n).forEach(x=>x.pb.level='big');
  return copy;
}

/* ===== 主分析 ===== */
async function go(force){
  // 判断快照是否过期（不是今天就需要强制刷新）
  const todayStr=new Date().toISOString().slice(0,10);
  const snapDate=SNAPSHOT&&SNAPSHOT.t?new Date(SNAPSHOT.t).toISOString().slice(0,10):'';
  const snapStale=snapDate!==todayStr;

  // 内置快照：先秒显（不管新旧都先显示，避免白屏）
  if(!force && SNAPSHOT && SNAPSHOT.data && SNAPSHOT.data.length){
    const D=markPullback(SNAPSHOT.data);
    animNum(S('statFunds'),D.length);
    animNum(S('statUp'),D.filter(x=>x.prob>=60).length);
    animNum(S('statDown'),D.filter(x=>x.pb.level==='big').length);
    ALL_DATA=D; renderOutlook(D); renderBuy(D); renderTop(D); renderPull(D); renderFix(D); renderWatch(D); renderUpDown(D); renderFav(); renderHold();
    const emotion=calcMarketEmotion(D);renderEmotion(emotion);renderBacktestStats();
    if(snapStale){
      S('status').innerHTML='<span style="color:#ffb457">⚠ 快照日期 '+snapDate+' 已过期，正在强制拉取最新净值…</span>';
    }else{
      S('status').innerHTML='<span style="color:#4dd4ac">⚡ 秒显快照 · 后台同步最新净值…</span>';
    }
    // 快照过期就立即刷新，否则也后台刷新
    setTimeout(()=>fetchLive(false),snapStale?200:800);
    return;
  }
  // 缓存兜底（同样校验时效）
  if(!force){
    try{
      const c=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
      const cDate=c&&c.t?new Date(c.t).toISOString().slice(0,10):'';
      if(c && c.data && c.data.length && cDate===todayStr){
        const D=markPullback(c.data);
        S('statFunds').textContent=D.length;
        S('statUp').textContent=D.filter(x=>x.prob>=60).length;
        S('statDown').textContent=D.filter(x=>x.pb.level==='big').length;
        ALL_DATA=D; renderOutlook(D); renderBuy(D); renderTop(D); renderPull(D); renderFix(D); renderWatch(D); renderUpDown(D); renderFav(); renderHold();
    const emotion=calcMarketEmotion(D);renderEmotion(emotion);renderBacktestStats();
        S('status').textContent='✓ 今日缓存 · '+new Date(c.t).toLocaleString('zh-CN');
        return;
      }
    }catch(e){}
  }
  return fetchLive(true);
}
async function fetchLive(showStatus){
  try{
    if(showStatus)S('status').textContent='拉取最新净值…';
    const funds=await quotes();
    if(showStatus)S('status').textContent='净值OK '+funds.length+'只，并行分析中…';
    // 并行分批（JSONP独立回调，可安全并发），速度快
    const analyzed=[];
    const BATCH=14;
    for(let i=0;i<funds.length;i+=BATCH){
      const slice=funds.slice(i,i+BATCH);
      const res=await Promise.all(slice.map(async f=>{
        try{
          const pts=await kline(f.code);
          if(!pts.length)return null;
          const c=pts.map(x=>x.v);
          const p=predict(c),pb=predictPullback(c,f.code);
          if(p&&pb)return {...f,...p,pb,navDate:pts[pts.length-1].d};
        }catch(e){}
        return null;
      }));
      res.forEach(r=>{if(r)analyzed.push(r)});
      const done=Math.min(i+BATCH,funds.length);
      S('status').textContent='实时刷新中 '+done+'/'+funds.length+'…';
    }
    try{localStorage.setItem(CACHE_KEY,JSON.stringify({t:Date.now(),data:analyzed}))}catch(e){}
    const D=markPullback(analyzed);
    animNum(S('statFunds'),D.length);
    animNum(S('statUp'),D.filter(x=>x.prob>=60).length);
    animNum(S('statDown'),D.filter(x=>x.pb.level==='big').length);
    if(D.length){
      ALL_DATA=D;
      renderOutlook(D);
      renderBuy(D);
      renderTop(D);
      renderPull(D);
      renderFix(D);
      renderWatch(D);
      renderUpDown(D);
      renderFav(); renderHold();
      const latestDate=(D[0]&&D[0].navDate)?D[0].navDate:'';
      S('status').innerHTML='<span style="color:#4dd4ac">✓ 已更新'+((latestDate)?'（净值日 '+latestDate+'）':'')+' · '+new Date().toLocaleTimeString('zh-CN')+'</span>';
    }else{
      // 实时没拿到数据，保留当前快照显示
      S('status').innerHTML='<span style="color:#ffb457">净值数据暂不可用，显示已缓存数据</span>';
    }
  }catch(e){
    S('status').innerHTML='<span class="err">净值同步失败，显示缓存 · '+e.message+'</span>';
  }
}
// 每5分钟后台静默刷新一次实时数据
setInterval(()=>{if(!S('mainView').classList.contains('hidden'))fetchLive(false)},5*60*1000);
// 切回页面时刷新（手机锁屏/切App回来立即更新）
document.addEventListener('visibilitychange',()=>{
  if(!document.hidden && !S('mainView').classList.contains('hidden'))fetchLive(false);
});
function renderTop(analyzed){
  const top=[...analyzed].sort((a,b)=>b.prob-a.prob).slice(0,10);
  let h='';
  top.forEach((f,i)=>{
    const rk=i===0?'r1':i===1?'r2':i===2?'r3':'';
    const nick=NICK[f.code]||f.full;
    const hot=f.chg>2?'<span class="badge b-hot">今日涨'+pct(f.chg)+'</span>':'';
    const pc=f.prob>=65?'p-hi':f.prob>=55?'p-mi':'p-lo';
    const v=f.prob>=70?'下周很可能涨':f.prob>=60?'下周偏涨':f.prob>=50?'涨跌各半':'暂时观望';
    const bigPull=f.pb&&f.pb.level==='big';
    const canBuy=(f.prob>=60&&f.chg<4&&!bigPull);
    const buy=canBuy?'✓ 推荐今日买':'✕ 别买';
    // 别买时注明何时可买（大白话）
    let buyHint='';
    if(!canBuy){
      if(bigPull)buyHint='要回调了，等跌下来再买';
      else if(f.chg>=4)buyHint='今天涨太多了，等回调再买';
      else if(f.prob<50)buyHint='势头还不够，再等等';
      else buyHint='再观望一下';
    }
    const bc=canBuy?'buy-yes':'buy-no';
    h+='<div class="item" data-code="'+f.code+'" style="animation-delay:'+(i*40)+'ms"><div class="rank '+rk+'">'+(i+1)+'</div>'+
      '<div class="info"><div class="fname">'+nick+hot+'</div><div class="fdesc">'+f.full+' · 今日'+pct(f.chg)+' · 近5日'+pct(f.c5)+' · '+v+'</div></div>'+
      '<div class="probbox"><div class="prob '+pc+'">'+f.prob+'%</div><div class="plabel">下周看涨概率</div>'+
      '<div class="buy-tag '+bc+'">'+buy+'</div>'+(buyHint?'<div class="buy-hint">'+buyHint+'</div>':'')+
      '<div class="bar"><i style="width:'+f.prob+'%"></i></div></div></div>';
  });
  S('list').innerHTML=h||'<div class="load err">没有可用数据</div>';bindItemEvents('list');
}

function renderFix(analyzed){
  // 大概率修复：近5日跌得最多的（非债券、跌幅>2%），取前8
  const fix=analyzed.filter(x=>!x.pb.bond&&x.c5<-2).sort((a,b)=>a.c5-b.c5).slice(0,8);
  let h='';
  fix.forEach((f,i)=>{
    const nick=NICK[f.code]||f.full;
    h+='<div class="item" data-code="'+f.code+'" style="animation-delay:'+(i*40)+'ms"><div class="rank '+(i===0?'r1':i===1?'r2':i===2?'r3':'')+'">'+(i+1)+'</div>'+
      '<div class="info"><div class="fname">'+nick+'</div><div class="fdesc">'+f.code+' · 今日'+pct(f.chg)+'</div></div>'+
      '<div class="probbox"><div class="prob" style="color:#5b9dff">修复中</div><div class="plabel">近5日 '+f.c5.toFixed(1)+'%</div></div></div>';
  });
  S('fixList').innerHTML=h||'<div class="load" style="color:#8892b8">最近没有明显超跌的，暂时没啥好修复的</div>';bindItemEvents('fixList');
}
function renderBuy(analyzed){
  // 今日推荐：概率>=55、今日涨幅<4%、非大回调，按概率排序取前8
  const rec=analyzed.filter(x=>x.prob>=55&&x.chg<4&&!(x.pb&&x.pb.level==='big')&&!(x.pb&&x.pb.bond))
                    .sort((a,b)=>b.prob-a.prob).slice(0,8);
  let h='';
  rec.forEach((f,i)=>{
    const nick=NICK[f.code]||f.full;
    const chgCls=f.chg>0?'color:#ff5e7e':f.chg<0?'color:#4dd4ac':'color:#8892b8';
    h+='<div class="item" data-code="'+f.code+'" style="animation-delay:'+(i*40)+'ms"><div class="rank '+(i===0?'r1':i===1?'r2':i===2?'r3':'')+'">'+(i+1)+'</div>'+
      '<div class="info"><div class="fname">'+nick+'</div><div class="fdesc">'+f.code+' · 今日'+pct(f.chg)+'</div></div>'+
      '<div class="probbox"><div class="prob" style="color:#4dd4ac">推荐买</div><div class="plabel">下周概率 '+f.prob+'%</div></div></div>';
  });
  S('buyList').innerHTML=h||'<div class="load" style="color:#8892b8">今天没有特别合适的，建议观望</div>';bindItemEvents('buyList');
}
function renderWatch(analyzed){
  const icons={'黄金':'🥇','科技':'💻','医疗':'⚕️','新能源':'⚡'};
  let h='';
  for(const [name,codes] of Object.entries(WATCH)){
    const code=codes[0];
    const f=analyzed.find(x=>x.code===code);
    const chg=f?f.chg:null;
    const buy=f?(f.prob>=60&&f.chg<4&&!(f.pb&&f.pb.level==='big')):null;
    const chgCls=chg>0?'color:#ff5e7e':chg<0?'color:#4dd4ac':'color:#8892b8';
    h+='<div class="watch-row"'+(f?' data-code="'+code+'"':'')+'>'+
      '<span class="watch-nick">'+(icons[name]||'📌')+' '+name+'板块</span>'+
      '<span class="watch-chg" style="'+(chg!==null?chgCls:'color:#8892b8')+'">'+(chg!==null?pct(chg):'--')+'</span>'+
      '<span class="watch-prob '+(buy?'buy-yes':'buy-no')+'">'+(buy===null?'--':(buy?'能买':'不能买'))+'</span></div>';
  }
  S('watchList').innerHTML=h;bindItemEvents('watchList');
}
function renderPull(analyzed){
  // 只显示大回调的，按风险排序
  const pull=analyzed.filter(x=>x.pb&&x.pb.level==='big').sort((a,b)=>b.pb.risk-a.pb.risk).slice(0,10);
  let h='';
  pull.forEach((f,i)=>{
    const nick=NICK[f.code]||f.full;
    const risk=f.pb.risk||16;
    const lo=(3+risk*0.15).toFixed(1);
    const hi=(8+risk*0.35).toFixed(1);
    h+='<div class="pull-item" data-code="'+f.code+'" style="animation-delay:'+(i*40)+'ms"><div class="rank">'+(i+1)+'</div>'+
      '<div class="pull-name">'+nick+'<span class="pull-code">'+f.code+'</span></div>'+
      '<div class="pull-range">预计跌 '+lo+'% ~ '+hi+'%</div>'+
      '<div class="pull-tag tag-big">大概率回调</div></div>';
  });
  S('pullList').innerHTML=h||'<div class="load" style="color:#4dd4ac">✓ 目前没有明显回调风险，暂时安全</div>';bindItemEvents('pullList');
}


/* ===== 动漫背景生成 ===== */
function buildAnimeBg(){
  if(document.querySelector('.anime-bg'))return;
  const photo=document.createElement('div');photo.className='anime-photo';photo.id='animePhoto';document.body.insertBefore(photo,document.body.firstChild);
  const bg=document.createElement('div');bg.className='anime-bg';
  let stars='';
  for(let i=0;i<60;i++){
    const x=Math.random()*100,y=Math.random()*100,d=(2+Math.random()*4).toFixed(1);
    stars+='<div class="star" style="left:'+x+'%;top:'+y+'%;animation-delay:'+d+'s"></div>';
  }
  let petals='<div class="petals">';
  for(let i=0;i<18;i++){
    const x=Math.random()*100,dur=(8+Math.random()*8).toFixed(1),delay=(Math.random()*10).toFixed(1);
    const sz=(8+Math.random()*10).toFixed(0);
    petals+='<div class="petal" style="left:'+x+'%;width:'+sz+'px;height:'+sz+'px;animation-duration:'+dur+'s;animation-delay:'+delay+'s"></div>';
  }
  petals+='</div>';
  bg.innerHTML=stars+petals;
  document.body.insertBefore(bg,document.body.firstChild);
}

/* ===== 走势图 / 自选 / 持仓 ===== */
const FAV_KEY='FUND_FAV', HOLD_KEY='FUND_HOLD';
const getLS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k)||'null')||d}catch(e){return d}};
const setLS=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};

// 打开走势图弹层
async function openChart(code,nick){
  const m=S('chartModal');m.classList.remove('hidden');
  S('chartTitle').textContent=(nick||code)+' · 净值走势';
  S('chartMeta').textContent='正在加载 '+code+' 近21日走势…';
  const points=await kline(code);
  drawChart(points);
}
function drawChart(points){
  drawChartOn(S('chartCanvas'),points);
}
// 生成合成OHLC（基于相邻净值，真实净值只有收盘价，开高低按波动模拟）
function synthOHLC(points){
  const ohlc=[];
  for(let i=0;i<points.length;i++){
    const c=points[i].v;
    const prev=i>0?points[i-1].v:c;
    const o=prev;
    const amp=Math.abs(c-prev)*0.6+Math.abs(c)*0.003;
    const hi=Math.max(o,c)+amp*Math.random()*0.5;
    const lo=Math.min(o,c)-amp*Math.random()*0.5;
    // 合成成交量（波动大成交量大）
    const vol=Math.abs(c-prev)/prev*10000+2+Math.random()*3;
    ohlc.push({d:points[i].d,o,h:hi,l:lo,c,v:vol});
  }
  return ohlc;
}
function drawChartOn(cv,points){
  if(!cv||!cv.getContext)return;
  const ctx=cv.getContext('2d');if(!ctx)return;
  const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
  if(!points||points.length<2){ctx.fillStyle='#8892b8';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('暂无走势数据',W/2,H/2);return}
  const ohlc=synthOHLC(points);
  const light=document.body.classList.contains('light');
  const padL=44,padR=14,padT=20,padB=30;
  const volH=H*0.22;
  const priceB=H-padB-volH-8;
  const plotW=W-padL-padR,plotH=priceB-padT;
  const highs=ohlc.map(x=>x.h),lows=ohlc.map(x=>x.l);
  const min=Math.min(...lows),max=Math.max(...highs),range=(max-min)||1;
  const vols=ohlc.map(x=>x.v),vMax=Math.max(...vols)||1;

  ctx.font='10px sans-serif';
  // 价格网格
  for(let i=0;i<=4;i++){
    const y=padT+plotH*i/4,val=max-range*i/4;
    ctx.strokeStyle=light?'rgba(0,0,0,.06)':'rgba(255,255,255,.06)';
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillStyle=light?'#5a6480':'#8892b8';ctx.textAlign='right';
    ctx.fillText(val.toFixed(3),padL-4,y+3);
  }
  // 成交量区域背景分隔线
  ctx.strokeStyle=light?'rgba(0,0,0,.08)':'rgba(255,255,255,.08)';
  ctx.beginPath();ctx.moveTo(padL,priceB+4);ctx.lineTo(W-padR,priceB+4);ctx.stroke();

  const candleW=Math.max(2,Math.min(14,plotW/ohlc.length*0.6));
  const gap=plotW/ohlc.length;
  for(let i=0;i<ohlc.length;i++){
    const x=padL+gap*i+gap/2;
    const d=ohlc[i];
    const up=d.c>=d.o;
    const col=up?'#ff5e7e':'#4dd4ac';
    // wick
    const yH=padT+plotH*(1-(d.h-min)/range);
    const yL=padT+plotH*(1-(d.l-min)/range);
    ctx.strokeStyle=col;ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,yH);ctx.lineTo(x,yL);ctx.stroke();
    // body
    const yO=padT+plotH*(1-(d.o-min)/range);
    const yC=padT+plotH*(1-(d.c-min)/range);
    const bTop=Math.min(yO,yC),bH=Math.max(1,Math.abs(yO-yC));
    ctx.fillStyle=up?col:'rgba(77,212,172,.15)';
    ctx.strokeStyle=col;ctx.lineWidth=1;
    if(up){ctx.fillRect(x-candleW/2,bTop,candleW,bH)}
    else{ctx.fillRect(x-candleW/2,bTop,candleW,bH);ctx.strokeRect(x-candleW/2,bTop,candleW,bH)}
    // 成交量柱
    const vh=(d.v/vMax)*(volH-10);
    const vy=H-padB-vh;
    ctx.fillStyle=up?'rgba(255,94,126,.45)':'rgba(77,212,172,.45)';
    ctx.fillRect(x-candleW/2,vy,candleW,vh);
  }
  // 日期刻度
  ctx.fillStyle=light?'#5a6480':'#8892b8';ctx.font='10px sans-serif';
  [0,Math.floor((ohlc.length-1)/2),ohlc.length-1].forEach((ix,n)=>{
    const x=padL+gap*ix+gap/2,label=ohlc[ix].d.slice(5);
    ctx.textAlign=n===0?'left':(n===2?'right':'center');
    ctx.fillText(label,n===0?padL:(n===2?W-padR:x),H-10);
  });
  // 顶部信息
  const first=ohlc[0].c,last=ohlc[ohlc.length-1].c,chg=(last/first-1)*100;
  ctx.fillStyle=light?'#1a1f36':'#e8ecff';ctx.font='bold 11px sans-serif';ctx.textAlign='left';
  ctx.fillText('起 '+first.toFixed(3),padL,14);
  ctx.textAlign='right';ctx.fillStyle=chg>=0?'#ff5e7e':'#4dd4ac';
  ctx.fillText('现 '+last.toFixed(3)+' ('+(chg>=0?'+':'')+chg.toFixed(1)+'%)',W-padR,14);
  // 图例
  ctx.textAlign='left';ctx.fillStyle=light?'#5a6480':'#8892b8';ctx.font='9px sans-serif';
  ctx.fillText('■ 涨  ■ 跌  ■ 成交量(合成)',padL+90,14);

  S('chartMeta').textContent=ohlc[0].d+' ~ '+ohlc[ohlc.length-1].d+' · 最新 '+last.toFixed(3)+' · 区间 '+(chg>=0?'+':'')+chg.toFixed(1)+'% · 最低'+min.toFixed(3)+' 最高'+max.toFixed(3);
}

function renderOutlook(analyzed){
  const secs=SNAPSHOT.sectors||[];
  if(!secs.length){S('outlookList').innerHTML='<div class="fav-empty">板块数据还没准备好</div>';return}
  try{drawRadar(secs)}catch(e){}
  const rankCls=r=>r==='看好'?'tag-good':r==='一般'?'tag-mid':'tag-wait';
  let h='';
  secs.forEach((x,i)=>{
    const icon={'黄金':'🥇','科技':'💻','医疗':'⚕️','新能源':'⚡','消费':'🛍️','军工':'🎖️','金融':'🏦','周期':'⛏️','海外':'🌍','综合':'📊'}[x.name]||'📊';
    const mom=x.avg>=0?'近3个月 +'+x.avg+'%':'近3个月 '+x.avg+'%';
    const momCls=x.avg>=0?'color:#ff5e7e':'color:#4dd4ac';
    h+='<div class="outlook-item" style="animation-delay:'+(i*50)+'ms"><div class="rank '+(i===0?'r1':i===1?'r2':i===2?'r3':'')+'">'+(i+1)+'</div>'+
      '<div class="outlook-name">'+icon+' '+x.name+'板块<div class="outlook-sub">'+x.count+'只基金 · <span style="'+momCls+'">'+mom+'</span></div></div>'+
      '<div class="outlook-tag '+rankCls(x.rank)+'">未来3个月'+x.rank+'</div></div>';
  });
  S('outlookList').innerHTML=h;
}
function drawRadar(secs){
  try{
  const cv=S('radarCanvas');if(!cv)return;
  const ctx=cv.getContext&&cv.getContext('2d');if(!ctx)return;
  const W=cv.width,H=cv.height;
  ctx.clearRect(0,0,W,H);
  if(!secs||secs.length<3)return;
  const light=document.body.classList.contains('light');
  const cx=W/2,cy=H/2+10,r=Math.min(W,H)*0.34;
  const n=secs.length;
  const vals=secs.map(s=>s.avg);
  const vMin=Math.min(...vals,-30),vMax=Math.max(...vals,10);
  const norm=v=>Math.max(0.08,(v-vMin)/(vMax-vMin||1));
  // 网格
  for(let ring=1;ring<=4;ring++){
    const rr=r*ring/4;
    ctx.beginPath();
    for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/n;const x=cx+rr*Math.cos(a),y=cy+rr*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
    ctx.closePath();ctx.strokeStyle=light?'rgba(0,0,0,.08)':'rgba(255,255,255,.08)';ctx.stroke();
  }
  // 轴线+标签
  ctx.font='12px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  for(let i=0;i<n;i++){
    const a=-Math.PI/2+i*Math.PI*2/n;
    ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    ctx.strokeStyle=light?'rgba(0,0,0,.07)':'rgba(255,255,255,.07)';ctx.stroke();
    const lx=cx+(r+28)*Math.cos(a),ly=cy+(r+28)*Math.sin(a);
    const icon={'黄金':'🥇','科技':'💻','医疗':'⚕️','新能源':'⚡','消费':'🛍️','军工':'🎖️','金融':'🏦','周期':'⛏️','海外':'🌍','综合':'📊'}[secs[i].name]||'';
    ctx.fillStyle=light?'#1a1f36':'#e8ecff';
    ctx.fillText(icon+secs[i].name,lx,ly);
    ctx.fillStyle=secs[i].avg>=0?'#ff5e7e':'#4dd4ac';ctx.font='10px sans-serif';
    ctx.fillText((secs[i].avg>=0?'+':'')+secs[i].avg+'%',lx,ly+14);
    ctx.font='12px sans-serif';ctx.fillStyle=light?'#1a1f36':'#e8ecff';
  }
  // 数据区域
  ctx.beginPath();
  for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/n;const rr=r*norm(vals[i]);const x=cx+rr*Math.cos(a),y=cy+rr*Math.sin(a);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.closePath();
  ctx.fillStyle='rgba(124,92,255,.22)';ctx.fill();
  ctx.strokeStyle='#a78bfa';ctx.lineWidth=2.5;ctx.stroke();
  // 数据点
  for(let i=0;i<n;i++){const a=-Math.PI/2+i*Math.PI*2/n;const rr=r*norm(vals[i]);const x=cx+rr*Math.cos(a),y=cy+rr*Math.sin(a);
    ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fillStyle='#c4b5fd';ctx.fill();ctx.strokeStyle='#7c5cff';ctx.lineWidth=2;ctx.stroke();}
  }catch(e){console.warn('drawRadar失败',e)}
}

function renderRank(analyzed,type){
  const isUp=type==='up';
  const list=analyzed.filter(x=>isUp?x.chg>0:x.chg<0)
                     .sort((a,b)=>isUp?b.chg-a.chg:a.chg-b.chg).slice(0,20);
  let h='';
  list.forEach((f,i)=>{
    const fullName=f.full||NICK[f.code]||f.code;
    const rk=i===0?'r1':i===1?'r2':i===2?'r3':'';
    const cls=f.chg>=0?'#ff5e7e':'#4dd4ac';
    h+='<div class="item" data-code="'+f.code+'" style="animation-delay:'+(i*30)+'ms"><div class="rank '+rk+'">'+(i+1)+'</div>'+
      '<div class="info"><div class="fname" style="font-size:13px">'+fullName+(f.chg>4?'<span class="badge b-hot">猛涨</span>':'')+'</div>'+
      '<div class="fdesc">'+f.code+' · 现价 '+Number(f.price).toFixed(3)+' · 下周概率 '+f.prob+'%</div></div>'+
      '<div class="probbox"><div class="prob" style="color:'+cls+'">'+(f.chg>=0?'+':'')+f.chg.toFixed(2)+'%</div>'+
      '<div class="plabel">今日'+(isUp?'涨幅':'跌幅')+'</div></div></div>';
  });
  const el=S(isUp?'upList':'downList');
  el.innerHTML=h||'<div class="fav-empty">今天没有'+(isUp?'上涨':'下跌')+'的基金</div>';
  bindItemEvents(isUp?'upList':'downList');
}
function renderUpDown(analyzed){renderRank(analyzed,'up');renderRank(analyzed,'down')}

function renderFav(){
  const fav=getLS(FAV_KEY,[]);
  if(!fav.length){S('favList').innerHTML='<div class="fav-empty">还没有自选基金<br>在任意基金上长按即可加入</div>';return}
  let h='';
  fav.forEach((f,i)=>{
    const now=ALL_DATA.find(x=>x.code===f.code);
    const price=now?now.price:f.price;
    const chg=now?now.chg:f.chg;
    const chgCls=chg>0?'color:#ff5e7e':chg<0?'color:#4dd4ac':'color:#8892b8';
    h+='<div class="item" data-code="'+f.code+'"><div class="info"><div class="fname">'+(f.nick||f.code)+'</div>'+
      '<div class="fdesc">'+f.code+' · 点看走势</div></div>'+
      '<div class="probbox"><div class="prob" style="font-size:15px;'+chgCls+'">'+Number(price).toFixed(3)+'</div>'+
      '<div class="plabel" style="'+chgCls+'">'+pct(chg)+'</div>'+
      '<span class="hold-del" data-delfav="'+f.code+'">移除</span></div></div>';
  });
  S('favList').innerHTML=h;
}
function toggleFav(code,nick){
  let fav=getLS(FAV_KEY,[]);
  if(fav.some(x=>x.code===code)){uniToast('已在自选');return}
  const f=ALL_DATA.find(x=>x.code===code)||{};
  fav.push({code,nick:nick||f.nick||code,price:f.price||0,chg:f.chg||0});
  setLS(FAV_KEY,fav);uniToast('已加入自选 ⭐');renderFav();
}
function uniToast(msg){
  let t=document.getElementById('_toast');
  if(!t){t=document.createElement('div');t.id='_toast';t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:200;background:rgba(20,20,40,.95);color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;transition:.3s';document.body.appendChild(t)}
  t.textContent=msg;t.style.opacity='1';clearTimeout(t._t);t._t=setTimeout(()=>t.style.opacity='0',1500);
}

// 持仓
function renderHold(){
  const holds=getLS(HOLD_KEY,[]);
  if(!holds.length){S('holdList').innerHTML='<div class="fav-empty">还没有持仓记录<br>点上方按钮添加</div>';S('holdSummary').innerHTML='';return}
  let h='',totalCost=0,totalVal=0;
  holds.forEach((x,i)=>{
    const now=ALL_DATA.find(y=>y.code===x.code);
    const price=now?now.price:x.price;
    const val=price*x.qty,cost=x.price*x.qty,pl=val-cost,plpct=cost?(pl/cost*100):0;
    totalCost+=cost;totalVal+=val;
    const plCls=pl>=0?'color:#ff5e7e':'color:#4dd4ac';
    h+='<div class="hold-item"><div class="hold-info"><div class="hold-name">'+(x.nick||x.code)+'</div>'+
      '<div class="hold-sub">成本'+x.price.toFixed(3)+' × '+x.qty+' = ¥'+cost.toFixed(0)+'</div></div>'+
      '<div style="text-align:right"><div style="font-size:13px;font-weight:700;'+plCls+'">'+(pl>=0?'+':'')+'¥'+pl.toFixed(0)+'</div>'+
      '<div class="hold-sub" style="'+plCls+'">'+(plpct>=0?'+':'')+plpct.toFixed(1)+'%</div></div>'+
      '<span class="hold-del" data-delhold="'+i+'">✕</span></div>';
  });
  S('holdList').innerHTML=h;
  const tp=totalVal-totalCost,tpp=costPct(totalCost,totalVal);
  S('holdSummary').innerHTML='总投入 ¥'+totalCost.toFixed(0)+' · 现值 ¥'+totalVal.toFixed(0)+
    ' · <span style="color:'+(tp>=0?'#ff5e7e':'#4dd4ac')+'">总盈亏 '+(tp>=0?'+':'')+'¥'+tp.toFixed(0)+' ('+(tpp>=0?'+':'')+tpp.toFixed(1)+'%)</span>';
}
function costPct(c,v){return c?((v-c)/c*100):0}

// 全局数据（渲染时保存，供走势/自选/持仓用）
let ALL_DATA=[],broadcastChannel=null;
function bindItemEvents(containerId){
  const box=S(containerId);if(!box)return;
  let pressTimer=null;
  box.querySelectorAll('.item,.hold-item,.pull-item').forEach(el=>{
    const code=el.dataset.code;if(!code)return;
    // 点击打开详情
    el.onclick=(e)=>{
      if(e.target.dataset.delfav||e.target.dataset.delhold)return;
      openDetail(code);
    };
    // 长按弹出菜单
    el.addEventListener('touchstart',(e)=>{
      pressTimer=setTimeout(()=>openMenu(code,e.touches[0]),600);
    },{passive:true});
    el.addEventListener('touchend',()=>clearTimeout(pressTimer));
    el.addEventListener('touchmove',()=>clearTimeout(pressTimer));
    // PC端右键
    el.oncontextmenu=(e)=>{e.preventDefault();openMenu(code,e)};
  });
}


/* ===== 访问保护 ===== */
(function(){
  // 禁止右键菜单
  document.addEventListener('contextmenu',e=>e.preventDefault());
  // 禁止常用开发者快捷键 / 查看源码
  document.addEventListener('keydown',e=>{
    const k=e.key;
    if(k==='F12'||(e.ctrlKey&&e.shiftKey&&(k==='I'||k==='J'||k==='C'))||(e.ctrlKey&&k==='U')){
      e.preventDefault();e.stopPropagation();
    }
  });
})();


/* ===== Tab左右滑动切换 ===== */
function initTabSwipe(){
  const tabs=document.querySelectorAll('#tabbar .tab');
  if(!tabs.length)return;
  let startX=0,currentX=0,isSwiping=false,activeIdx=0;
  const tabbar=S('tabbar');
  // 触摸开始
  tabbar.addEventListener('touchstart',e=>{
    startX=e.touches[0].clientX;
    isSwiping=true;
  },{passive:true});
  // 触摸移动
  tabbar.addEventListener('touchmove',e=>{
    if(!isSwiping)return;
    currentX=e.touches[0].clientX-startX;
  },{passive:true});
  // 触摸结束
  tabbar.addEventListener('touchend',()=>{
    if(!isSwiping)return;
    isSwiping=false;
    const threshold=50;
    if(currentX<-threshold&&activeIdx<tabs.length-1){
      // 向左滑，下一个Tab
      tabs[activeIdx+1].click();
      activeIdx++;
    }else if(currentX>threshold&&activeIdx>0){
      // 向右滑，上一个Tab
      tabs[activeIdx-1].click();
      activeIdx--;
    }
    currentX=0;
  });
}

/* ===== 长按快捷菜单 ===== */
let menuTargetCode=null;
function initLongPressMenu(){
  const menu=S('fundMenu'),overlay=S('menuOverlay');
  overlay.onclick=closeMenu;
  menu.querySelectorAll('.menu-item').forEach(item=>{
    item.onclick=()=>{
      const action=item.dataset.action;
      handleMenuAction(action);
      closeMenu();
    };
  });
}
function openMenu(code,e){
  menuTargetCode=code;
  menu.style.display='block';
  // 定位
  const x=e.clientX||e.changedTouches?.[0]?.clientX||200;
  const y=e.clientY||e.changedTouches?.[0]?.clientY||300;
  menu.style.left=Math.min(x,window.innerWidth-200)+'px';
  menu.style.top=Math.min(y,window.innerHeight-200)+'px';
  S('menuOverlay').classList.add('show');
}
function closeMenu(){S('fundMenu').style.display='none';S('menuOverlay').classList.remove('show')}
function handleMenuAction(action){
  if(!menuTargetCode)return;
  const f=ALL_DATA.find(x=>x.code===menuTargetCode);
  if(!f)return;
  switch(action){
    case 'chart':openDetail(menuTargetCode);break;
    case 'fav':
      let fav=getLS(FAV_KEY,[]);
      if(fav.some(x=>x.code===menuTargetCode)){fav=fav.filter(x=>x.code!==menuTargetCode)}
      else{fav.push({code:menuTargetCode,nick:f.nick||menuTargetCode})}
      setLS(FAV_KEY,fav);renderFav();uniToast(fav.some(x=>x.code===menuTargetCode)?'已加入自选':'已移除自选');break;
    case 'hold':
      S('holdCode').value=menuTargetCode;S('holdPrice').value=f.price;S('holdQty').value='';
      S('holdModal').classList.remove('hidden');break;
    case 'compare':
      uniToast('对比功能开发中...');break;
    case 'share':
      if(navigator.share){navigator.share({title:'基金'+menuTargetCode+'详情',text:(f.nick||menuTargetCode)+' 看涨概率'+f.prob+'%',url:location.href})}
      else{uniToast('分享已复制到剪贴板');navigator.clipboard.writeText(location.href)}
      break;
  }
}

/* ===== 市场情绪指数 ===== */
function calcMarketEmotion(D){
  if(!D||!D.length)return null;
  const up=D.filter(f=>f.chg>0).length;
  const down=D.filter(f=>f.chg<0).length;
  const flat=D.length-up-down;
  const upPct=up/D.length*100;
  // 简单情绪模型：涨多=贪婪，跌多=恐慌
  let score=(upPct-50)*2; // -100到100
  score=Math.max(-90,Math.min(90,score));
  return {score,up,down,flat,total:D.length};
}
function renderEmotion(emotion){
  if(!emotion)return;
  const el=S('emoValue');
  const fill=S('emoFill');
  const ud=S('emoUpDown');
  const card=S('emoCard');
  const pct=50+emotion.score/2;
  fill.style.width=pct+'%';
  ud.textContent=emotion.up+'/'+emotion.down;
  ud.style.color=emotion.up>emotion.down?'#ff5e7e':'#4dd4ac';
  let label='',cls='';
  if(emotion.score<=-60){label='极端恐慌 📉';cls='emo-extreme'}
  else if(emotion.score<=-20){label='恐慌 😰';cls='emo-panic'}
  else if(emotion.score<=20){label='中性 😐';cls='emo-neutral'}
  else if(emotion.score<=60){label='贪婪 😊';cls='emo-greed'}
  else{label='极端贪婪 🚀';cls='emo-extreme'}
  el.textContent=label;
  el.className='emo-value '+cls;
  card.className='emo-card '+cls.replace('emo-extreme','');
}

/* ===== 交易信号回测 ===== */
const BACKTEST_KEY='FUND_BACKTEST';
function initBacktest(){
  // 加载历史数据
  try{
    const bt=JSON.parse(localStorage.getItem(BACKTEST_KEY)||'null');
    if(bt&&bt.history)storeBacktestHistory(bt.history);
  }catch(e){}
}
function recordSignal(code,result){
  // result: true=涨, false=跌
  let hist=JSON.parse(localStorage.getItem(BACKTEST_KEY)||'{"history":[],"totalSignals":0,"correctSignals":0}');
  hist.history.push({code,date:new Date().toISOString(),result,won:result});
  hist.totalSignals++;
  if(result)hist.correctSignals++;
  localStorage.setItem(BACKTEST_KEY,JSON.stringify(hist));
}
function storeBacktestHistory(h){localStorage.setItem(BACKTEST_KEY,JSON.stringify({history:h,totalSignals:h.reduce((a,x)=>a+(x.won?1:0),0),correctSignals:h.reduce((a,x)=>a+(x.won?1:0),0)}))}
function renderBacktestStats(){
  // 简单显示最近统计
  const el=S('backtestStats');
  if(!el)return;
  try{
    const bt=JSON.parse(localStorage.getItem(BACKTEST_KEY)||'null');
    if(bt&&bt.history&&bt.history.length){
      const recent=bt.history.slice(-30);
      const won=recent.filter(x=>x.won).length;
      el.textContent='近30次信号胜率 '+(won/recent.length*100).toFixed(0)+'% ('+won+'/'+recent.length+')';
    }
  }catch(e){}
}


/* ===== 智能搜索 ===== */
let searchTimer=null;
function initSearch(){
  const inp=S('searchInput'),drop=S('searchDrop'),clr=S('searchClear');
  inp.addEventListener('input',()=>{
    clearTimeout(searchTimer);
    const q=inp.value.trim().toLowerCase();
    clr.classList.toggle('show',q.length>0);
    if(!q){drop.classList.remove('show');return}
    searchTimer=setTimeout(()=>doSearch(q),150);
  });
  clr.onclick=()=>{inp.value='';clr.classList.remove('show');drop.classList.remove('show')};
  inp.onfocus=()=>{if(inp.value.trim())doSearch(inp.value.trim().toLowerCase())};
  document.addEventListener('click',e=>{
    if(!e.target.closest('.search-wrap'))drop.classList.remove('show');
  });
}
function doSearch(q){
  const drop=S('searchDrop');
  if(!ALL_DATA||!ALL_DATA.length){drop.innerHTML='<div class="search-empty">数据加载中…</div>';drop.classList.add('show');return}
  const hits=ALL_DATA.filter(f=>{
    const name=(f.nick||f.full||'').toLowerCase();
    const full=(f.full||'').toLowerCase();
    const code=(f.code||'');
    return code.includes(q)||name.includes(q)||full.includes(q);
  }).slice(0,12);
  if(!hits.length){drop.innerHTML='<div class="search-empty">没有找到匹配的基金</div>';drop.classList.add('show');return}
  drop.innerHTML=hits.map(f=>{
    const chg=f.chg>0?'color:#ff5e7e':f.chg<0?'color:#4dd4ac':'color:#8892b8';
    const probC=f.prob>=60?'color:#ff5e7e':f.prob>=45?'color:#5b9dff':'color:#8892b8';
    return '<div class="search-item" data-scode="'+f.code+'">'+
      '<div><div class="search-item-name">'+f.nick+'<span class="search-item-code"> '+f.code+'</span></div>'+
      '<div style="font-size:10px;color:#8892b8;margin-top:2px">'+(f.sec||'综合')+' · 3月'+(f.m3>=0?'+':'')+f.m3+'%</div></div>'+
      '<div class="search-item-meta"><div style="'+chg+';font-weight:700">'+pct(f.chg)+'</div>'+
      '<div style="'+probC+';font-size:10px">看涨'+f.prob+'%</div></div></div>';
  }).join('');
  drop.classList.add('show');
  drop.querySelectorAll('.search-item').forEach(it=>{
    it.onclick=()=>{drop.classList.remove('show');openDetail(it.dataset.scode)};
  });
}

/* ===== 基金详情 ===== */
async function openDetail(code){
  const f=ALL_DATA.find(x=>x.code===code);
  if(!f)return;
  const modal=S('detailModal');modal.classList.remove('hidden');
  S('searchDrop').classList.remove('show');
  S('dName').textContent=f.nick||f.full||code;
  S('dCode').textContent=code+' · '+(f.full||'');
  S('dPrice').textContent=f.price.toFixed(3);
  S('dPrice').style.color=f.chg>0?'#ff5e7e':f.chg<0?'#4dd4ac':'#e8ecff';
  S('dChg').textContent='今日 '+pct(f.chg);
  S('dChg').style.color=f.chg>0?'#ff5e7e':f.chg<0?'#4dd4ac':'#8892b8';
  S('dProb').textContent=f.prob+'%';
  S('dProb').style.color=f.prob>=60?'#ff5e7e':f.prob>=45?'#5b9dff':'#8892b8';
  S('dC5').textContent=(f.c5>=0?'+':'')+f.c5+'%';
  S('dC5').style.color=f.c5>=0?'#ff5e7e':'#4dd4ac';
  S('dPull').textContent=f.pb&&f.pb.level==='big'?'⚠️ 大回调风险':'✅ 回调温和';
  S('dPull').style.color=f.pb&&f.pb.level==='big'?'#ffb457':'#4dd4ac';
  S('dSec').textContent=f.sec||'综合';
  S('dM3').textContent=(f.m3>=0?'+':'')+f.m3+'%';
  S('dM3').style.color=f.m3>=0?'#ff5e7e':'#4dd4ac';
  const buy=f.prob>=60&&f.chg<4&&!(f.pb&&f.pb.level==='big');
  S('dBuy').textContent=buy?'✅ 能买':'⚠️ 观望';
  S('dBuy').style.color=buy?'#4dd4ac':'#ffb457';

  // 自选按钮状态
  const isFav=getLS(FAV_KEY,[]).some(x=>x.code===code);
  S('dFavBtn').textContent=isFav?'★ 已自选':'⭐ 加入自选';
  S('dFavBtn').onclick=()=>{
    let fav=getLS(FAV_KEY,[]);
    if(fav.some(x=>x.code===code)){fav=fav.filter(x=>x.code!==code);S('dFavBtn').textContent='⭐ 加入自选';uniToast('已移除自选')}
    else{fav.push({code,nick:f.nick||code});S('dFavBtn').textContent='★ 已自选';uniToast('已加入自选 ⭐')}
    setLS(FAV_KEY,fav);renderFav();
  };
  S('dHoldBtn').onclick=()=>{
    S('holdCode').value=code;S('holdPrice').value=f.price;S('holdQty').value='';
    S('holdModal').classList.remove('hidden');
  };

  // 加载K线
  const ctx=S('dChart').getContext('2d');
  ctx.clearRect(0,0,S('dChart').width,S('dChart').height);
  ctx.fillStyle='#8892b8';ctx.font='14px sans-serif';ctx.textAlign='center';
  ctx.fillText('加载K线中…',S('dChart').width/2,S('dChart').height/2);
  const pts=await kline(code);
  drawChartOn(S('dChart'),pts);
}
function drawChartOn(cv,points){
  if(!cv||!cv.getContext)return;
  const ctx=cv.getContext('2d');if(!ctx)return;
  const W=cv.width,H=cv.height;ctx.clearRect(0,0,W,H);
  if(!points||points.length<2){ctx.fillStyle='#8892b8';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('暂无走势数据',W/2,H/2);return}
  const closes=points.map(p=>p.v),dates=points.map(p=>p.d);
  const min=Math.min(...closes),max=Math.max(...closes),range=(max-min)||1;
  const padL=42,padR=14,padT=26,padB=34;
  const plotW=W-padL-padR,plotH=H-padT-padB;
  ctx.font='10px sans-serif';
  for(let i=0;i<=4;i++){
    const y=padT+plotH*i/4,val=max-range*i/4;
    ctx.strokeStyle='rgba(255,255,255,.07)';ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillStyle='#8892b8';ctx.textAlign='right';ctx.fillText(val.toFixed(3),padL-5,y+3);
  }
  const pts2=closes.map((v,i)=>[padL+plotW*i/(closes.length-1),padT+plotH*(1-(v-min)/range)]);
  const grad=ctx.createLinearGradient(0,padT,0,padT+plotH);
  grad.addColorStop(0,'rgba(124,92,255,.32)');grad.addColorStop(1,'rgba(124,92,255,0)');
  ctx.beginPath();ctx.moveTo(pts2[0][0],padT+plotH);pts2.forEach(pt=>ctx.lineTo(pt[0],pt[1]));ctx.lineTo(pts2[pts2.length-1][0],padT+plotH);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();pts2.forEach((pt,i)=>i?ctx.lineTo(pt[0],pt[1]):ctx.moveTo(pt[0],pt[1]));
  ctx.strokeStyle='#a78bfa';ctx.lineWidth=2.5;ctx.stroke();
  const lastPt=pts2[pts2.length-1];
  ctx.beginPath();ctx.arc(lastPt[0],lastPt[1],4,0,Math.PI*2);ctx.fillStyle='#c4b5fd';ctx.fill();
  ctx.fillStyle='#8892b8';ctx.font='10px sans-serif';ctx.textAlign='center';
  [0,Math.floor((dates.length-1)/2),dates.length-1].forEach((ix,n)=>{
    const x=padL+plotW*ix/(dates.length-1),label=dates[ix].slice(5);
    ctx.textAlign=n===0?'left':(n===2?'right':'center');
    ctx.fillText(label,n===0?padL:(n===2?W-padR:x),H-12);
  });
  const first=closes[0],last=closes[closes.length-1],chg=(last/first-1)*100;
  ctx.fillStyle='#e8ecff';ctx.font='bold 12px sans-serif';ctx.textAlign='left';
  ctx.fillText('起 '+first.toFixed(3)+' ('+dates[0].slice(5)+')',padL,16);
  ctx.textAlign='right';ctx.fillStyle=chg>=0?'#ff5e7e':'#4dd4ac';
  ctx.fillText('现 '+last.toFixed(3)+' ('+(chg>=0?'+':'')+chg.toFixed(1)+'%)',W-padR,16);
}

/* ===== 工具: 概率渐变色阶 50%浅蓝->95%深红 ===== */
function probColor(p){
  const t=Math.max(0,Math.min(1,(p-50)/45));
  const r=Math.round(91+t*(255-91));
  const g=Math.round(157+t*(94-157));
  const b=Math.round(255+t*(126-255));
  return `rgb(${r},${g},${b})`;
}
function probPill(p){return `<span class="prob-pill" style="background:${probColor(p)}">${p}%</span>`}

/* ===== 数字计数动画 ===== */
function animNum(el,target,dur=800){
  if(!el)return;
  const start=+((el.textContent||'0').replace(/[^0-9.-]/g,''))||0;
  if(start===target){el.textContent=target;return}
  const t0=performance.now();
  function tick(now){
    const k=Math.min(1,(now-t0)/dur);
    const ease=1-Math.pow(1-k,3);
    el.textContent=Math.round(start+(target-start)*ease);
    if(k<1)requestAnimationFrame(tick);else el.textContent=target;
  }
  requestAnimationFrame(tick);
}

/* ===== 骨架屏 ===== */
function showSkeleton(id,n=6){
  const el=S(id);if(!el)return;
  let h='';
  for(let i=0;i<n;i++){
    h+='<div class="sk-row"><div class="skeleton sk-circle"></div><div style="flex:1"><div class="skeleton sk-line" style="width:'+((60+Math.random()*30)|0)+'%;margin-bottom:6px"></div><div class="skeleton sk-line" style="width:40%;height:10px"></div></div><div class="skeleton sk-line" style="width:52px;height:28px;border-radius:14px"></div></div>';
  }
  el.innerHTML=h;
}
function showAllSkeletons(){
  ['outlookList','buyList','topList','pullList','fixList','upList','downList','watchList'].forEach(id=>showSkeleton(id,5));
}

/* ===== 主题切换 ===== */
function initTheme(){
  const saved=localStorage.getItem('FUND_THEME');
  if(saved==='light')document.body.classList.add('light');
  const btn=document.createElement('button');btn.className='theme-btn';btn.id='themeBtn';
  btn.textContent=document.body.classList.contains('light')?'🌙':'☀️';
  btn.title='切换深浅主题';
  btn.onclick=()=>{
    document.body.classList.toggle('light');
    const light=document.body.classList.contains('light');
    localStorage.setItem('FUND_THEME',light?'light':'dark');
    btn.textContent=light?'🌙':'☀️';
    if(ALL_DATA&&ALL_DATA.length)renderOutlook(ALL_DATA);
  };
  document.body.appendChild(btn);
}

/* ===== 下拉刷新 ===== */
function initPullRefresh(){
  let startY=0,pulling=false,threshold=70;
  const ind=S('pullInd'),icon=S('pullIcon');
  document.addEventListener('touchstart',e=>{if(window.scrollY===0&&!S('mainView').classList.contains('hidden')){startY=e.touches[0].clientY;pulling=true}}, {passive:true});
  document.addEventListener('touchmove',e=>{
    if(!pulling)return;
    const dy=e.touches[0].clientY-startY;
    if(dy>0&&window.scrollY===0){
      const move=Math.min(dy*0.45,90);
      ind.style.transform='translateY('+(move-60)+'px)';
      icon.style.transform='rotate('+Math.min(dy*2,180)+'deg)';
      if(dy>threshold){icon.textContent='↻'}else{icon.textContent='↓'}
    }
  }, {passive:true});
  document.addEventListener('touchend',e=>{
    if(!pulling)return;pulling=false;
    const dy=(e.changedTouches[0]?.clientY||startY)-startY;
    ind.style.transform='translateY(-60px)';icon.style.transform='';icon.textContent='↓';
    if(dy>threshold&&!S('mainView').classList.contains('hidden')){
      ind.style.transform='translateY(10px)';ind.classList.add('active');
      fetchLive(true).finally(()=>{ind.classList.remove('active');ind.style.transform='translateY(-60px)'});
    }
  });
}

/* ===== Tab 切换 ===== */
document.querySelectorAll('#tabbar .tab').forEach(t=>{
  t.addEventListener('click',()=>{
    document.querySelectorAll('#tabbar .tab').forEach(x=>x.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(x=>x.classList.add('hidden'));
    t.classList.add('active');
    const p=document.getElementById('panel-'+t.dataset.tab);
    if(p)p.classList.remove('hidden');
  });
});
/* ===== 弹层/持仓事件 ===== */
S('chartClose').onclick=()=>S('chartModal').classList.add('hidden');
S('chartModal').onclick=(e)=>{if(e.target.id==='chartModal')S('chartModal').classList.add('hidden')};
S('detailClose').onclick=()=>S('detailModal').classList.add('hidden');
S('detailModal').onclick=(e)=>{if(e.target.id==='detailModal')S('detailModal').classList.add('hidden')};
S('holdClose').onclick=()=>S('holdModal').classList.add('hidden');
S('holdModal').onclick=(e)=>{if(e.target.id==='holdModal')S('holdModal').classList.add('hidden')};
S('addHoldBtn').onclick=()=>{S('holdCode').value='';S('holdPrice').value='';S('holdQty').value='';S('holdModal').classList.remove('hidden')};
S('holdSave').onclick=()=>{
  const code=S('holdCode').value.trim(),price=parseFloat(S('holdPrice').value),qty=parseFloat(S('holdQty').value);
  if(!code||!price||!qty){uniToast('请填完整');return}
  const holds=getLS(HOLD_KEY,[]);
  const f=ALL_DATA.find(x=>x.code===code)||{};
  holds.push({code,nick:NICK[code]||f.nick||code,price,qty});
  setLS(HOLD_KEY,holds);S('holdModal').classList.add('hidden');renderHold();uniToast('已记录持仓 💰');
};
// 自选移除、持仓删除（事件委托）
S('favList').onclick=(e)=>{
  const d=e.target.dataset.delfav;
  if(d){e.stopPropagation();const fav=getLS(FAV_KEY,[]).filter(x=>x.code!==d);setLS(FAV_KEY,fav);renderFav();uniToast('已移除')}
};
S('holdList').onclick=(e)=>{
  const d=e.target.dataset.delhold;
  if(d!==undefined){e.stopPropagation();const holds=getLS(HOLD_KEY,[]);holds.splice(Number(d),1);setLS(HOLD_KEY,holds);renderHold()}
};


/* ===== 后端/同步/埋点初始化 ===== */
function initBackend(){
  try{
    if('BroadcastChannel' in window){
      broadcastChannel=new BroadcastChannel('fund_sync');
      broadcastChannel.onmessage=(e)=>{
        if(e&&e.data&&e.data.type==='sync'&&e.data.payload&&e.data.payload.deviceId!==sync.deviceId){
          renderFav();renderHold();
        }
      };
    }
  }catch(e){}
  try{ trackEvent('page_load',{referrer:document.referrer||''}); }catch(e){}
}

/* ===== 初始化 ===== */
buildAnimeBg();
let bgIdx=0;
const sw=document.createElement('button');sw.className='bg-switch';sw.textContent='🖼️';sw.title='切换背景';sw.onclick=()=>{
  const ph=document.getElementById('animePhoto');if(!ph)return;
  bgIdx=(bgIdx+1)%2;ph.style.backgroundImage="url('"+(bgIdx?'anime-bg2.jpg':'anime-bg.jpg')+"')";
};document.body.appendChild(sw);
S('avatarFile').addEventListener('change',onAvatarFile);
S('loginBtn').addEventListener('click',doLogin);
S('forgotBtn').addEventListener('click',()=>{S('loginErr').style.color='#4dd4ac';S('loginErr').textContent='请联系 xhq 找回密码'});
S('logoutBtn').addEventListener('click',doLogout);
S('recalcBtn').addEventListener('click',()=>go(true));
S('passInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin()});
initTheme();
initPullRefresh();
initTabSwipe();
initLongPressMenu();
initBacktest();
initSearch();
initBackend();
if(localStorage.getItem(AUTH_KEY))enterMain();

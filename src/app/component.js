class Component extends DCLogic {
  constructor(props){
    super(props);
    this.BASECATS={
      comida:{name:'Comida',emoji:'🍔',type:'gasto',iconVar:'--cat-comida-icon',fillVar:'--cat-comida-fill'},
      auto:{name:'Auto',emoji:'🚗',type:'gasto',iconVar:'--cat-auto-icon',fillVar:'--cat-auto-fill'},
      tarjetas:{name:'Tarjetas',emoji:'💳',type:'gasto',iconVar:'--cat-tarjetas-icon',fillVar:'--cat-tarjetas-fill'},
      ocio:{name:'Ocio',emoji:'🎮',type:'gasto',iconVar:'--cat-ocio-icon',fillVar:'--cat-ocio-fill'},
      compras:{name:'Compras',emoji:'🛍️',type:'gasto',iconVar:'--cat-compras-icon',fillVar:'--cat-compras-fill'},
      inversiones:{name:'Inversiones',emoji:'📈',type:'gasto',iconVar:'--cat-inversion-icon',fillVar:'--cat-inversion-fill'},
      mascotas:{name:'Mascotas',emoji:'🐶',type:'gasto',iconVar:'--cat-mascotas-icon',fillVar:'--cat-mascotas-fill'},
      otros:{name:'Otros',emoji:'✨',type:'gasto',iconVar:'--cat-otros-icon',fillVar:'--cat-otros-fill'},
      ingreso:{name:'Ingreso',emoji:'💰',type:'ingreso',iconVar:'--cat-ingreso-icon',fillVar:'--cat-ingreso-fill'},
      transfer:{name:'Transferencia',emoji:'🔁',type:'transfer',iconVar:'--cat-transfer-icon',fillVar:'--cat-transfer-fill'},
      inversion:{name:'Inversión',emoji:'📈',type:'inversion',iconVar:'--cat-inversion-icon',fillVar:'--cat-inversion-fill'},
      pago:{name:'Pago de tarjeta',emoji:'💳',type:'transfer',iconVar:'--cat-tarjetas-icon',fillVar:'--cat-tarjetas-fill'},
    };
    this.DEFAULT_CAT_ORDER=['comida','auto','tarjetas','ocio','compras','inversiones','mascotas','otros','ingreso','transfer','inversion'];
    this.CATCOLORS=[['--cat-comida-icon','--cat-comida-fill'],['--cat-auto-icon','--cat-auto-fill'],['--cat-transfer-icon','--cat-transfer-fill'],['--cat-tarjetas-icon','--cat-tarjetas-fill'],['--cat-ocio-icon','--cat-ocio-fill'],['--cat-compras-icon','--cat-compras-fill'],['--cat-mascotas-icon','--cat-mascotas-fill'],['--cat-otros-icon','--cat-otros-fill']];
    this.CATEMOJIS=['🍔','🛒','🚗','🚌','🏠','💡','🎮','🍿','🛍️','👕','💊','🩺','🐶','✈️','🎓','💼','💰','📈','🎁','☕','🍷','🏷️'];
    this.CARDGRADS=['linear-gradient(135deg,#3a3a3c,#161618)','linear-gradient(135deg,#7a4b57,#2e1d22)','linear-gradient(135deg,#3f5b7a,#1a2738)','linear-gradient(135deg,#3f6b4c,#1b2e22)','linear-gradient(135deg,#5b4a76,#241d33)'];
    this.CEDEAR_RATIOS={AAPL:10,AMZN:3,GOOGL:8,MSFT:10,META:5,TSLA:8,NVDA:10,JPM:5,SPY:1,QQQ:1,COIN:5,MELI:1,WMT:10,DIS:10,BAC:10,GE:10,PYPL:5,UBER:5,BABA:10};
    // Curated pick-lists so users choose an asset instead of typing a ticker.
    this.CEDEARS=[['QQQ','Nasdaq 100','📊'],['SPY','S&P 500','📈'],['ACWI','iShares MSCI ACWI ETF','🌐'],['SMH','VanEck Semiconductor ETF','💾'],['AAPL','Apple','🍎'],['AMZN','Amazon','📦'],['MSFT','Microsoft','🪟'],['GOOGL','Google','🔎'],['META','Meta','📘'],['TSLA','Tesla','🚗'],['NVDA','Nvidia','🎮'],['MELI','Mercado Libre','🛒'],['KO','Coca-Cola','🥤'],['DIS','Disney','🏰'],['COIN','Coinbase','🪙'],['BABA','Alibaba','🛍️']];
    this.CRYPTOS=[['BTC','Bitcoin','🪙'],['ETH','Ethereum','💎'],['SOL','Solana','🌅'],['ADA','Cardano','🔷'],['MATIC','Polygon','🟣'],['DOT','Polkadot','⚫']];
    this.BONOS=[['AO27','Bono Argentina 2027','🇦🇷'],['LOC5O','ON Loma Negra','🔴'],['AL30','Bono soberano AL30','🏛️'],['GD30','Global 2030','🏛️'],['AL35','Bono soberano AL35','🏛️'],['GD35','Global 2035','🏛️'],['GD38','Global 2038','🏛️'],['AE38','Bono soberano AE38','🏛️'],['TZX27','Bono CER 2027','🛡️'],['TZX28','Bono CER 2028','🛡️']];
    this.FCIS=[['COCORMA','Cocos Rendimiento FCI','◉']];
    this.FCI_META={COCORMA:{fci:true,fondoMatch:['Cocos Rendimiento - Clase A','Cocos Rendimiento Clase A'],fundSlug:'cocos-rendimiento-clase-a',officialRateSlug:'cocos-rendimiento-clase-a',vcpScale:1000,priceProvider:'cafci'}};
    this._MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    this.CATTYPES=[['gasto','Gasto'],['ingreso','Ingreso'],['transfer','Transferencia'],['inversion','Inversión']];
    this.CARDBRANDS=['Visa','Mastercard','Amex'];
    this.STORAGE_KEY='finanzapp:v2:state';
    this.STORAGE_BACKUP_KEY='finanzapp:v2:state:backup';
    this.STORAGE_TEMP_KEY='finanzapp:v2:state:writing';
    this.STORAGE_QUARANTINE_KEY='finanzapp:v2:state:corrupt';
    this.LEGACY_STORAGE_KEY='finanzapp.v2.state';
    this.CLOUD_PENDING_KEY='finanzapp:cloud:pending';
    this.CLOUD_LAST_SEEN_KEY='finanzapp:cloud:last-seen';
    this.CLOUD_LAST_USER_KEY='finanzapp:cloud:last-user';
    // Supabase cloud sync (optional). Fill url + anonKey to enable accounts.
    // Empty = app stays 100% local. The anon key is public/safe to ship (RLS protects rows).
    this.SUPA={url:'https://mtijtrdltfyfvnvcdxbx.supabase.co',anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aWp0cmRsdGZ5ZnZudmNkeGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTUwNDEsImV4cCI6MjA5ODQzMTA0MX0.Q8iyn9c5DNThMCojTuQy38I4ffkLnefghru4OBO5Ohk'};
    // Local "last data change" timestamp — drives last-write-wins cloud sync.
    this._localMod=Number((typeof localStorage!=='undefined'&&localStorage.getItem('finanzapp:mod'))||0)||0;
    this._cloudPending=typeof localStorage!=='undefined'&&localStorage.getItem(this.CLOUD_PENDING_KEY)==='1';
    this._cloudLastSeen=Number((typeof localStorage!=='undefined'&&localStorage.getItem(this.CLOUD_LAST_SEEN_KEY))||0)||0;
    this._cloudLastUser=(typeof localStorage!=='undefined'&&localStorage.getItem(this.CLOUD_LAST_USER_KEY))||'';
    this.carouselRef=React.createRef();
    this.mainScrollRef=React.createRef();
    this._pushScroll={};
    this._navigationHistory=[];
    this._restoringNavigation=false;
    this._replaceNavigation=false;
    this._backSwipe=null;
    this.PALETTE=[['--cat-transfer-icon','--cat-transfer-fill'],['--cat-comida-icon','--cat-comida-fill'],['--cat-ocio-icon','--cat-ocio-fill'],['--cat-compras-icon','--cat-compras-fill'],['--cat-mascotas-icon','--cat-mascotas-fill'],['--cat-auto-icon','--cat-auto-fill']];
    this.PERIODS=['Este mes','Esta semana','Este año'];
    this.ACCTYPES=[['Banco','liquid','🏦'],['Efectivo','liquid','💵'],['Billetera','liquid','📲'],['Inversión','invest','📈'],['Tarjeta','debt','💳'],['Deuda','debt','📉']];
    this.state=Object.assign({
      theme:props.defaultTheme||'light', chartStyle:props.defaultChart||'bars',
      tab:'inicio', push:null, sheet:null, subsheet:null, navState:'idle',tabMotion:'idle',tabDirection:'next',swipeState:'idle',swipeOffset:0,reportsExpanded:false,
      balanceMode:'disponible', heroCurrency:'ARS', periodIdx:0, currency:'ARS', hideAmounts:false,
      actFilter:'todos', actSearch:'', actCat:null, actAccount:'todas', actAmount:'todos', actTag:'todos', actRange:'todo',
      cardIdx:0, detailId:null, editId:null, acctView:null, investView:null, assetView:null, cardView:0,
      assetChartRange:'1M', assetChart:{loading:false,ok:false,range:'1M'}, assetCostAmount:'', portMode:'valor',
      addType:'gasto', addAmount:'', addTitle:'', addNote:'', addCat:'comida', addAccount:'banco', addTo:'cedears', addDate:'Hoy', addDateISO:window.FinanzDomain.todayKey(), addTags:[], addCatTouched:false, addSuggestedKey:null, addSuggestedTags:[],
      newTagText:'', customDateText:'',
      newAcc:{name:'',type:'Banco',kind:'liquid',balance:'',currency:'ARS',liquid:true,editId:null},
      newCat:{name:'',emoji:'🍔',type:'gasto',colorIdx:0,parent:'',editId:null},
      newCard:{brand:'Visa',bank:'',last4:'',limit:'',debt:'',statement:'',pending:'',cierre:'',vence:'',gradIdx:0,autopay:false,autopayAccount:'',editId:null},
      tagEdit:{name:'',orig:null},
      payAccount:'banco', payAmount:'',
      cpCard:0, cpAmount:'', cpMerchant:'', cpCat:'compras', cpDate:'Hoy', cpDateISO:window.FinanzDomain.todayKey(), cpInstall:1, cpStatus:'posted', cpEditId:null, cpSub:null,
      atMode:'buy', atAccount:'cedears', atType:'CEDEAR', atTicker:'', atName:'', atEmoji:'', atSearch:'', atQty:'', atTotal:'', atDateISO:window.FinanzDomain.todayKey(), atPrice:'', atFees:'', atSource:'banco', atSub:null,
      loanView:null, newLoan:{person:'',direction:'me_deben',concept:'',amount:'',currency:'ARS',editId:null}, loanPayAmount:'', goalView:null, newGoal:{name:'',emoji:'🎯',target:'',editId:null}, goalAmount:'', budgetCat:null, budgetAmount:'', ivSub:null, upTicker:'', atNewPrice:'', pricesLoading:false, pricesLastUpdated:null, pricesLastAttemptedAt:null,
      newRec:{type:'gasto',concept:'',amount:'',cat:'otros',targetKind:'account',targetId:'',day:'1',editId:null},
      onbStep:0, onbCard:false, onbInvest:false, flash:'', confirm:null,
      showOnboarding:true,
      shortcutCapture:false, // true only when source=shortcut opened the add-expense sheet
      assistantText:'',assistantPrompt:'',assistantListening:false,assistantLoading:false,assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null,
      cloud:{status:'off',email:'',password:'',user:null,syncing:false,lastSync:null,pending:this._cloudPending,offline:false,conflict:false,error:''},
    }, this.emptyData());
    // Load persisted local state synchronously so the very first render already
    // shows the real saved data. This avoids the default/"Patrimonio total: 0"
    // flicker that happens if saved state is only applied later in componentDidMount.
    const persisted=this.readPersistedState();
    if(persisted){
      Object.assign(this.state, persisted, {push:null,sheet:null,subsheet:null,flash:'',confirm:null,detailId:null,editId:null});
    }
    this._lastPersistedStateJson=JSON.stringify(this.persistentSnapshot(this.state));
  }
  componentDidMount(){
    if(this._persistRecovered){
      this.setState({flash:'Recuperamos tus datos desde la copia local anterior'});
    }else if(this._persistError){
      this.setState({flash:'No pudimos leer los datos locales · conservamos una copia para recuperar'});
    }
    // Post any due recurring movements / card auto-payments since last open.
    this.runAutomations();
    // A PWA can stay open across midnight. Re-check on focus/visibility and at
    // the next local midnight so "automático" does not secretly mean "on reopen".
    this._automationWake=()=>{if(document.visibilityState!=='hidden'){this.runAutomations();if(!this.state.pricesLastAttemptedAt||Date.now()-this.state.pricesLastAttemptedAt>60000)this.fetchPrices(true);}};
    window.addEventListener('focus',this._automationWake);
    document.addEventListener('visibilitychange',this._automationWake);
    this.scheduleAutomationCheck();
    // Record today's net-worth snapshot for the trend chart (now + once prices settle).
    setTimeout(()=>this.recordSnapshot(),300);
    setTimeout(()=>this.recordSnapshot(),3200);
    // Auto-fetch prices on mount, on wake, and every five minutes. Public market
    // providers are delayed/rate-limited; faster polling would add load without
    // making a delayed BYMA or daily FCI quote more accurate.
    setTimeout(()=>this.fetchPrices(true),2000);
    this._priceTimer=setInterval(()=>this.fetchPrices(true),300000);
    this.initCloud();
    this._shortcutCaptureListener=(event)=>this.handleShortcutCaptureSearch(event&&event.detail&&event.detail.search,false);
    window.addEventListener('finanzapp:shortcutCapture',this._shortcutCaptureListener);
    if(window.__finanzappPendingShortcutSearch){
      const pending=window.__finanzappPendingShortcutSearch;
      window.__finanzappPendingShortcutSearch='';
      this.handleShortcutCaptureSearch(pending,false);
    }
    this.checkShortcutCapture();
  }
  // ===== Apple Pay / iOS Shortcuts capture =====
  // An iOS Shortcut (Wallet "Transaction" trigger) opens FinanzApp with
  //   ?quickAdd=expense&source=shortcut
  // Apple does NOT expose payment details to the PWA. Optional params come from
  // user-provided Shortcut prompts and are validated before prefilling the sheet.
  checkShortcutCapture(){
    try{
      this.handleShortcutCaptureSearch(window.location.search,true);
    }catch(e){}
  }
  handleShortcutCaptureSearch(search,cleanUrl){
    const capture=window.FinanzDomain.parseShortcutCaptureParams(search,{categories:this.state.categories,accounts:this.state.accounts,archived:this.state.archived});
    if(!capture)return;
    window.__finanzappPendingShortcutSearch='';
    this.openShortcutCapture(capture);
    if(cleanUrl)window.history.replaceState({},'',window.location.pathname+window.location.hash);
  }
  openShortcutCapture(capture){
    const liq=this.liquidIds(),inv=this.investIds();
    const defAcc=(capture&&capture.account)||liq[0]||inv[0]||'';
    const defTo=liq.find(k=>k!==defAcc)||inv[0]||defAcc;
    const title=(capture&&capture.merchant)||(capture&&capture.note)||'';
    const suggested=window.FinanzDomain.applyMerchantSuggestion({merchant:title,categories:this.state.categories,currentCategory:'comida',categoryTouched:!!(capture&&capture.category),currentTags:(capture&&capture.tags)||[]});
    const addCat=(capture&&capture.category)||(suggested&&suggested.category)||'comida';
    const addTags=window.FinanzDomain.uniqueTags([...(capture&&capture.tags||[]),...(suggested&&suggested.suggestedTags||[])]);
    this.setState(s=>({sheet:'add',subsheet:null,addType:'gasto',addAmount:(capture&&capture.amount)||'',addTitle:title,addNote:'',addCat,addAccount:defAcc,addTo:defTo,addDate:'Hoy',addDateISO:window.FinanzDomain.todayKey(),addTags,tagSugg:window.FinanzDomain.uniqueTags([...(s.tagSugg||[]),...addTags]),addCatTouched:!!(capture&&capture.category),addSuggestedKey:suggested&&suggested.key,addSuggestedTags:(suggested&&suggested.suggestedTags)||[],editId:null,shortcutCapture:!!(capture&&capture.shortcut)}));
  }
  // ===== Conversational capture (voice or text) =====
  navigationSnapshot(state=this.state){return{
    tab:state.tab,push:state.push,sheet:state.sheet,subsheet:state.subsheet,
    detailId:state.detailId,acctView:state.acctView,investView:state.investView,
    assetView:state.assetView&&typeof state.assetView==='object'?{...state.assetView}:state.assetView,
    cardView:state.cardView,loanView:state.loanView,goalView:state.goalView,
    budgetCat:state.budgetCat,ivSub:state.ivSub,atSub:state.atSub,cpSub:state.cpSub,
  };}
  navigationKey(state=this.state){const view=state.assetView&&typeof state.assetView==='object'?(state.assetView.account+':'+state.assetView.ticker):(state.assetView||'');return[
    state.tab||'',state.push||'',state.sheet||'',state.subsheet||'',state.detailId||'',
    state.acctView||'',state.investView||'',view,state.cardView==null?'':state.cardView,
    state.loanView||'',state.goalView||'',state.budgetCat||'',state.ivSub||'',state.atSub||'',state.cpSub||''
  ].join('|');}
  navigationDepth(state=this.state){let depth=0;if(state.push||state.sheet)depth+=1;if(state.subsheet||state.budgetCat||state.ivSub||state.atSub||state.cpSub)depth+=1;return depth;}
  trackNavigation(prevState,persistedChanged){const prevKey=this.navigationKey(prevState),nextKey=this.navigationKey(this.state);if(prevKey===nextKey)return;
    if(this._restoringNavigation){this._restoringNavigation=false;this._replaceNavigation=false;return;}
    const prevDepth=this.navigationDepth(prevState),nextDepth=this.navigationDepth(this.state),replace=this._replaceNavigation;this._replaceNavigation=false;
    if(nextDepth<prevDepth){const match=this._navigationHistory.map(item=>this.navigationKey(item)).lastIndexOf(nextKey);if(match>=0)this._navigationHistory.length=match;else this._navigationHistory.pop();return;}
    if(replace||(persistedChanged&&nextDepth===prevDepth)){const last=this._navigationHistory[this._navigationHistory.length-1];if(last&&this.navigationKey(last)===nextKey)this._navigationHistory.pop();return;}
    const snapshot=this.navigationSnapshot(prevState),last=this._navigationHistory[this._navigationHistory.length-1];if(!last||this.navigationKey(last)!==prevKey)this._navigationHistory.push(snapshot);if(this._navigationHistory.length>40)this._navigationHistory.splice(0,this._navigationHistory.length-40);
  }
  previousNavigation(target=null){let index=-1;if(target){for(let i=this._navigationHistory.length-1;i>=0;i--){if(this._navigationHistory[i].push===target){index=i;break;}}}else index=this._navigationHistory.length-1;
    if(index>=0){const snapshot=this._navigationHistory[index];this._navigationHistory.length=index;return snapshot;}
    if(target&&this._navigationHistory.length)this._navigationHistory.pop();
    const S=this.state;if(S.subsheet)return{...this.navigationSnapshot(S),subsheet:null};if(S.budgetCat)return{...this.navigationSnapshot(S),budgetCat:null};if(S.ivSub)return{...this.navigationSnapshot(S),ivSub:null};if(S.atSub)return{...this.navigationSnapshot(S),atSub:null};if(S.cpSub)return{...this.navigationSnapshot(S),cpSub:null};if(S.sheet)return{...this.navigationSnapshot(S),sheet:null,subsheet:null};if(S.push)return{...this.navigationSnapshot(S),push:target||null,subsheet:null,ivSub:null,atSub:null,cpSub:null};if(S.tab!=='inicio')return{...this.navigationSnapshot(S),tab:'inicio'};return null;
  }
  canNavigateBack(){const S=this.state;return!!(S.confirm||S.subsheet||S.budgetCat||S.ivSub||S.atSub||S.cpSub||S.sheet||S.push||this._navigationHistory.length||S.tab!=='inicio');}
  canSwipeBack(){const S=this.state;if(S.confirm||S.subsheet||S.budgetCat||S.ivSub||S.atSub||S.cpSub)return false;if(S.sheet&&S.sheet!=='assistant'&&S.sheet!=='add')return false;return!!(S.sheet||S.push||this._navigationHistory.length||S.tab!=='inicio');}
  beginBackSwipe(event){if(!this.canSwipeBack()||this.state.navState==='leaving'||this.state.tabMotion==='leaving')return;const touch=event&&event.touches&&event.touches[0];if(!touch||touch.clientX>28)return;const target=event.target;if(target&&target.closest&&target.closest('input,textarea,select,[contenteditable="true"]'))return;this._backSwipe={x:touch.clientX,y:touch.clientY,lastX:touch.clientX,lastAt:Date.now(),startedAt:Date.now(),tracking:false};}
  moveBackSwipe(event){const gesture=this._backSwipe,touch=event&&event.touches&&event.touches[0];if(!gesture||!touch)return;const dx=Math.max(0,touch.clientX-gesture.x),dy=Math.abs(touch.clientY-gesture.y);if(!gesture.tracking&&dy>dx&&dy>10){this._backSwipe=null;return;}if(dx<8)return;gesture.tracking=true;gesture.lastX=touch.clientX;gesture.lastAt=Date.now();if(event.cancelable)event.preventDefault();const width=(typeof window!=='undefined'&&window.innerWidth)||390;this.setState({swipeState:'tracking',swipeOffset:Math.min(dx,width*.92)});}
  endBackSwipe(){const gesture=this._backSwipe;if(!gesture)return;this._backSwipe=null;if(!gesture.tracking){if(this.state.swipeState!=='idle')this.setState({swipeState:'idle',swipeOffset:0});return;}const elapsed=Math.max(1,Date.now()-gesture.startedAt),distance=Math.max(0,gesture.lastX-gesture.x),velocity=distance/elapsed;const width=(typeof window!=='undefined'&&window.innerWidth)||390;const complete=distance>Math.min(96,width*.24)||velocity>.55;
    if(!complete){this.setState({swipeState:'cancelling',swipeOffset:0});clearTimeout(this._swipeTimer);this._swipeTimer=setTimeout(()=>this.setState({swipeState:'idle'}),190);return;}
    this.setState({swipeState:'completing',swipeOffset:width});clearTimeout(this._swipeTimer);this._swipeTimer=setTimeout(()=>this.completeBackSwipe(),170);
  }
  resolvedBackNavigation(target=null){const S=this.state,previous=this.previousNavigation(target);if(S.push==='assetDetail'&&(!previous||previous.push!=='investments'))return{...this.navigationSnapshot(S),push:'investments',assetView:null,ivSub:null,atSub:null,cpSub:null};const moreChildren=['cloudScreen','budgetsScreen','goalsScreen','loansScreen','recScreen','categories','tags','settings','security'];if(!target&&S.tab==='mas'&&moreChildren.indexOf(S.push)>=0&&(!previous||previous.tab!=='mas'||previous.push))return{...this.navigationSnapshot(S),tab:'mas',push:null,sheet:null,subsheet:null,budgetCat:null,ivSub:null,atSub:null,cpSub:null};return previous;}
  completeBackSwipe(){if(this.state.confirm){this.setState({confirm:null,swipeState:'idle',swipeOffset:0});return;}if(this.state.sheet==='assistant')this.stopAssistantListening();const target=this.state.push==='assetDetail'?'investments':null,previous=this.resolvedBackNavigation(target);if(!previous){this.setState({swipeState:'idle',swipeOffset:0});return;}this._restoringNavigation=true;this.setState({...previous,swipeState:'idle',swipeOffset:0,navState:'back-settle'});}
  rememberPushScroll(key=this.state.push){
    if(!key||typeof document==='undefined')return;
    const screens=document.querySelectorAll('.fa-frame > .fa-screen');
    const el=screens.length?screens[screens.length-1]:null;
    if(el)this._pushScroll[key]=el.scrollTop||0;
  }
  restorePushScroll(key){
    if(!key||typeof document==='undefined')return;
    const top=Number(this._pushScroll[key]);
    if(!Number.isFinite(top))return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const screens=document.querySelectorAll('.fa-frame > .fa-screen');
      const el=screens.length?screens[screens.length-1]:null;
      if(el)el.scrollTop=top;
    }));
  }
  popScreen(target=null,patch={}){
    if(this.state.navState==='leaving')return;
    this.rememberPushScroll();
    const previous=this.resolvedBackNavigation(target);
    clearTimeout(this._navTimer);
    this.setState({navState:'leaving'});
    this._navTimer=setTimeout(()=>{
      const fallback={push:target,detailId:target?this.state.detailId:null,sheet:null,subsheet:null};this._restoringNavigation=true;this.setState({...fallback,...(previous||{}),...patch,navState:'back-settle'},()=>this.restorePushScroll((previous&&previous.push)||target));
    },180);
  }
  pushScreen(push,patch={}){if(this.state.navState==='leaving')return;clearTimeout(this._navSettleTimer);this.setState({...patch,push,navState:'entering'});this._navSettleTimer=setTimeout(()=>{if(this.state.navState==='entering')this.setState({navState:'idle'});},340);}
  navigateTab(tab,patch={}){
    const order=['inicio','actividad','reportes','mas','cuentas','tarjetas'];
    const current=order.indexOf(this.state.tab),next=order.indexOf(tab);
    if(tab===this.state.tab&&!this.state.push&&!this.state.sheet){const el=this.mainScrollRef.current;if(el)el.scrollTo({top:0,behavior:'smooth'});if(Object.keys(patch).length)this.setState(patch);return;}
    if(this.state.tabMotion==='leaving')return;
    clearTimeout(this._tabTimer);
    const direction=(next>=0&&current>=0&&next<current)?'prev':'next';
    this.setState({tabMotion:'leaving',tabDirection:direction});
    this._tabTimer=setTimeout(()=>{
      this.setState({...patch,tab,push:null,sheet:null,tabMotion:'entering',tabDirection:direction});
      const el=this.mainScrollRef.current;if(el)el.scrollTop=0;
      this._tabTimer=setTimeout(()=>this.setState({tabMotion:'idle'}),300);
    },125);
  }
  fciSpendSources(s=this.state){
    return window.FinanzDomain.spendableFciSources(s,s.usdRate).filter(source=>source.valueARS>0.005);
  }
  spendSourceMeta(id,s=this.state){
    const account=s.accounts[id];
    if(account)return{id,name:account.name,type:account.type,emoji:account.emoji,fillVar:account.fillVar,currency:account.currency||'ARS',accountId:id,fci:false};
    const source=window.FinanzDomain.findFciSpendSource(s,id,s.usdRate);
    if(!source)return null;
    return{id:source.id,name:source.name,type:'FCI · '+(source.ticker||'Fondo común'),emoji:source.emoji||'◉',fillVar:'--cat-inversion-fill',currency:'ARS',accountId:source.accountId,fci:true,valueARS:source.valueARS};
  }
  paymentSourceIds(s=this.state){return window.FinanzDomain.liquidIds(s).concat(this.fciSpendSources(s).map(source=>source.id));}
  paymentFundingMessage(result){const error=result&&result.error;if(error==='insufficient')return 'El origen elegido no tiene saldo suficiente';if(error==='missing-rate')return 'Actualizá la cotización para pagar desde dólares';if(error==='missing-price')return 'Actualizá el valor de la cuotaparte antes de pagar con el FCI';if(error==='archived')return 'Ese origen de fondos está archivado';return 'Elegí una cuenta o FCI disponible';}
  assistantContext(){
    const accounts={...this.state.accounts};
    this.fciSpendSources().forEach(source=>{accounts[source.id]={name:source.name,type:'FCI '+(source.ticker||''),currency:'ARS',kind:'spendable-investment',fci:true,sourceAccountId:source.accountId};});
    return{accounts,categories:this.state.categories,cards:this.state.cards,recurring:this.state.recurring,transactions:this.state.txns,archived:this.state.archived,balances:this.state.balances,assets:this.state.assets,budgets:this.state.budgets,usdRate:this.state.usdRate,summary:this.computeNetWorth()};
  }
  hydrateAssistantDraft(value){const S=this.state,ctx=this.assistantContext();let d=window.FinanzDomain.normalizeAssistantDraft(window.FinanzDomain.resolveAssistantReferences(value,ctx),ctx);
    const liquid=this.liquidIds(),sameCurrency=liquid.filter(id=>((S.accounts[id]||{}).currency||'ARS')===(d.currency||'ARS'));
    const wantsCard=d.intent==='card_payment'||((d.intent==='transaction'||d.intent==='create_recurring')&&d.transactionType==='gasto'&&d.cardExplicit);
    if(wantsCard&&!d.cardId&&S.cards.length===1)d.cardId=S.cards[0].id;
    const needsAccount=d.intent==='card_payment'||d.intent==='transaction'&&!d.cardId||d.intent==='recurring'&&!d.cardId||d.intent==='create_recurring'&&!d.cardId;
    if(needsAccount&&!d.accountId&&sameCurrency.length===1)d.accountId=sameCurrency[0];
    if(d.intent==='recurring'&&d.recurringId){const r=(S.recurring||[]).find(x=>x.id===d.recurringId);if(r){d={...d,transactionType:r.type||d.transactionType,amount:d.amount||Number(r.amount)||null,merchant:d.merchant||r.concept||'Recurrente',categoryId:d.categoryId||r.cat||'',accountId:d.accountId||(r.targetKind==='account'?r.targetId:''),cardId:d.cardId||(r.targetKind==='card'?r.targetId:''),tags:window.FinanzDomain.uniqueTags([...(d.tags||[]),'recurrente','asistente'])};}}
    if(d.intent==='transaction'&&d.transactionType==='ingreso'&&!d.categoryId&&S.categories.ingreso)d.categoryId='ingreso';
    if((d.intent==='transaction'||d.intent==='recurring'||d.intent==='create_recurring')&&d.transactionType==='ingreso')d.cardId='';
    const virtualFci=window.FinanzDomain.parseFciSpendSourceId(d.accountId);
    const canSpendFci=d.intent==='card_payment'||(d.intent==='transaction'||d.intent==='recurring')&&d.transactionType==='gasto';
    if(virtualFci&&!canSpendFci)d.accountId='';
    return window.FinanzDomain.normalizeAssistantDraft(d,ctx);
  }
  assistantMissing(d){if(!d||d.intent==='none')return['una orden que pueda registrar'];const missing=[];
    const account=this.state.accounts[d.accountId],accountCurrency=account&&((account.currency||'ARS'));
    if(d.currencyAmbiguous)missing.push('una sola moneda');
    if(d.intent==='transaction'){if(!d.amount)missing.push('el monto');if(!d.accountId&&!d.cardId)missing.push('la cuenta o tarjeta');if(d.cardId&&d.currency==='USD')missing.push('el importe de tarjeta en pesos');if(d.accountId&&d.currencyExplicit&&accountCurrency!==d.currency)missing.push('una cuenta en '+(d.currency==='USD'?'dólares':'pesos'));if(!d.categoryId)missing.push('la categoría');}
    else if(d.intent==='transfer'){if(!d.amount)missing.push('el monto');if(!d.fromAccountId)missing.push('la cuenta de origen');if(!d.toAccountId)missing.push('la cuenta de destino');if(d.fromAccountId&&d.toAccountId&&d.fromAccountId===d.toAccountId)missing.push('dos cuentas distintas');const from=this.state.accounts[d.fromAccountId],to=this.state.accounts[d.toAccountId];if(from&&to&&(from.currency||'ARS')!==(to.currency||'ARS')&&!this.state.usdRate)missing.push('la cotización para convertir');}
    else if(d.intent==='card_payment'){if(!d.cardId)missing.push('la tarjeta');if(!d.accountId)missing.push('la cuenta de pago');const c=this.state.cards.find(x=>x.id===d.cardId);if(!d.amount&&this.cardResumen(c)<=0)missing.push('el monto');}
    else if(d.intent==='recurring'){if(!d.amount)missing.push('el monto');if(!d.accountId&&!d.cardId)missing.push(d.transactionType==='ingreso'?'la cuenta':'la cuenta o tarjeta');if(!d.categoryId)missing.push('la categoría');}
    else if(d.intent==='create_recurring'){if(!d.merchant)missing.push('el nombre');if(!d.amount)missing.push('el monto');if(!d.accountId&&!d.cardId)missing.push(d.transactionType==='ingreso'?'la cuenta':'la cuenta o tarjeta');if(!d.categoryId)missing.push('la categoría');}
    else if(d.intent==='create_budget'){if(!d.amount)missing.push('el límite');if(!d.categoryId)missing.push('la categoría');}
    else if(d.intent==='create_category'&&!d.merchant)missing.push('el nombre');
    else if(d.intent==='create_tag'&&!d.merchant)missing.push('el nombre');
    return missing;
  }
  stopAssistantListening(){if(this._speechRecognition)try{this._speechRecognition.abort();}catch(e){}if(this._nativeSpeechActive&&window.FinanzNativeSpeech){this._nativeSpeechActive=false;window.FinanzNativeSpeech.stop().catch(()=>{});}this.setState({assistantListening:false});}
  openAssistant(){this.stopAssistantListening();this.setState({sheet:'assistant',assistantText:'',assistantPrompt:'',assistantListening:false,assistantLoading:false,assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null});}
  closeAssistant(){this.stopAssistantListening();this.popScreen(null,{assistantText:'',assistantPrompt:'',assistantListening:false,assistantLoading:false,assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null});}
  setAssistantText(e){const v=e&&e.target?e.target.value:'';this.setState({assistantText:v,assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null});}
  assistantKeyDown(e){if(e&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.submitAssistant();}}
  async toggleAssistantListening(){if(this.state.assistantListening){this.stopAssistantListening();return;}
    const nativeSpeech=window.FinanzNativeSpeech;let nativeAvailable=false;if(nativeSpeech)try{nativeAvailable=await nativeSpeech.available();}catch(e){}
    if(nativeAvailable){try{this._nativeSpeechActive=true;await nativeSpeech.start({onResult:(text)=>this.setState({assistantText:String(text||'').trim(),assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantUsage:null}),onState:(active)=>this.setState({assistantListening:!!active})});return;}catch(e){this._nativeSpeechActive=false;this.setState({assistantListening:false,assistantError:'No pude iniciar el dictado. Revisá los permisos de micrófono y reconocimiento de voz.'});return;}}
    const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){this.setState({assistantError:'El dictado no está disponible en este navegador. Podés escribir la misma frase.'});return;}
    try{const rec=new Speech();this._speechRecognition=rec;rec.lang='es-AR';rec.interimResults=true;rec.continuous=true;
      rec.onstart=()=>this.setState({assistantListening:true,assistantError:'',assistantDraft:null,assistantAnswer:null});
      rec.onresult=(event)=>{let transcript='';for(let i=0;i<event.results.length;i++)transcript+=event.results[i][0].transcript+' ';this.setState({assistantText:transcript.trim(),assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantUsage:null});};
      rec.onerror=()=>this.setState({assistantListening:false,assistantError:'No pude escuchar con claridad. Probá otra vez o escribí el movimiento.'});
      rec.onend=()=>this.setState({assistantListening:false});rec.start();
    }catch(e){this.setState({assistantListening:false,assistantError:'No pude abrir el micrófono. Revisá el permiso del navegador.'});}}
  async submitAssistant(){const text=this.state.assistantText.trim();if(!text||this.state.assistantLoading)return;const context=this.assistantContext();const answer=window.FinanzDomain.answerFinancialQuestion(text,context);
    if(answer&&answer.matched){this.stopAssistantListening();this.setState({assistantText:'',assistantPrompt:text,assistantLoading:false,assistantDraft:null,assistantAnswer:answer,assistantUsage:{source:'local'},assistantError:''});return;}
    const local=this.hydrateAssistantDraft(window.FinanzDomain.parseAssistantCommand(text,context));
    if(local.intent==='none'){this.setState({assistantLoading:false,assistantDraft:null,assistantAnswer:null,assistantUsage:{source:'local'},assistantError:'No pude interpretar eso todavía. Probá registrar “Gasté 25 mil en comida con Galicia” o preguntar “¿En qué gasté ayer?”.'});return;}
    this.setState({assistantText:'',assistantPrompt:text,assistantLoading:false,assistantDraft:local,assistantAnswer:null,assistantUsage:{source:'local'},assistantError:''});}
  editAssistantDraft(){const d=this.hydrateAssistantDraft(this.state.assistantDraft);if(!d||d.intent==='none'){this.setState({assistantError:'Primero prepará una acción para poder editarla.'});return;}
    const amount=d.amount?String(d.amount).replace('.',','):'';const dateISO=d.dateISO||this._todayKey();const dateLabel=window.FinanzDomain.labelFromISO(dateISO);const generic=!d.merchant||/^(gasto|ingreso|movimiento)$/i.test(d.merchant);const common={assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null,assistantText:'',assistantPrompt:''};
    if(d.intent==='transaction'||d.intent==='recurring'){
      if(d.cardId){const idx=this.state.cards.findIndex(card=>card.id===d.cardId);if(idx<0){this.setState({assistantError:'La tarjeta preparada ya no existe. Elegí otra antes de continuar.'});return;}this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:null,push:'cardPurchase',subsheet:null,cpSub:null,cpCard:idx,cpAmount:amount,cpMerchant:generic?'':d.merchant,cpCat:d.categoryId||'compras',cpDate:dateLabel,cpDateISO:dateISO,cpInstall:1,cpStatus:'posted',cpEditId:null});return;}
      const liq=this.liquidIds(),inv=this.investIds(),type=d.transactionType==='ingreso'?'ingreso':'gasto';this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:'add',push:null,subsheet:null,addType:type,addAmount:amount,addTitle:generic?'':d.merchant,addNote:d.note||'',addCat:d.categoryId||(type==='ingreso'?'ingreso':'otros'),addAccount:d.accountId||liq[0]||inv[0]||'',addTo:liq.find(id=>id!==d.accountId)||inv[0]||'',addDate:dateLabel,addDateISO:dateISO,addTags:[...(d.tags||[])],addCatTouched:true,addSuggestedKey:null,addSuggestedTags:[],editId:null,shortcutCapture:false});return;
    }
    if(d.intent==='transfer'){const liq=this.liquidIds(),inv=this.investIds();this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:'add',push:null,subsheet:null,addType:'transfer',addAmount:amount,addTitle:'',addNote:d.note||'',addCat:'transfer',addAccount:d.fromAccountId||d.accountId||liq[0]||inv[0]||'',addTo:d.toAccountId||liq.find(id=>id!==(d.fromAccountId||d.accountId))||inv[0]||'',addDate:dateLabel,addDateISO:dateISO,addTags:[...(d.tags||[])],addCatTouched:true,addSuggestedKey:null,addSuggestedTags:[],editId:null,shortcutCapture:false});return;}
    if(d.intent==='card_payment'){const idx=this.state.cards.findIndex(card=>card.id===d.cardId);if(idx<0){this.setState({assistantError:'Elegí una tarjeta antes de editar el pago.'});return;}this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:null,push:'payCard',subsheet:null,cardView:idx,payAmount:amount,payAccount:d.accountId||this.paymentSourceIds()[0]||''});return;}
    if(d.intent==='create_recurring'){const income=d.transactionType==='ingreso';this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:null,push:'addRec',subsheet:null,newRec:{type:income?'ingreso':'gasto',concept:generic?'':d.merchant,amount,cat:d.categoryId||(income?'ingreso':'otros'),targetKind:income?'account':(d.cardId?'card':'account'),targetId:income?(d.accountId||''):(d.cardId||d.accountId||''),day:String(d.scheduleDay||1),editId:null}});return;}
    if(d.intent==='create_budget'){this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:null,push:'budgetsScreen',subsheet:null,budgetCat:d.categoryId||null,budgetAmount:amount});return;}
    if(d.intent==='create_category'){const type=d.transactionType==='ingreso'?'ingreso':'gasto';this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:null,push:'catEditor',subsheet:null,newCat:{name:generic?'':d.merchant,emoji:'🏷️',type,colorIdx:0,parent:'',editId:null}});return;}
    if(d.intent==='create_tag'){this.stopAssistantListening();this._replaceNavigation=true;this.setState({...common,sheet:'tagEditor',subsheet:null,tagEdit:{name:d.merchant||'',orig:null}});return;}
    this.setState({assistantError:'Esta acción todavía no tiene un formulario editable.'});
  }
  confirmAssistantDraft(){const d=this.hydrateAssistantDraft(this.state.assistantDraft);const missing=this.assistantMissing(d);if(missing.length){this.setState({assistantError:'Falta '+missing.join(', ')+'. Tocá Editar para completarlo sin repetir la frase.'});return;}const dateLabel=window.FinanzDomain.labelFromISO(d.dateISO);
    if(d.intent==='create_budget'){this.setState(s=>({budgets:{...(s.budgets||{}),[d.categoryId]:d.amount},sheet:null,assistantDraft:null,assistantText:'',assistantUsage:null,flash:'Presupuesto mensual creado'}));return;}
    if(d.intent==='create_tag'){const tag=window.FinanzDomain.uniqueTags([d.merchant])[0];this.setState(s=>({tagSugg:window.FinanzDomain.uniqueTags([...(s.tagSugg||[]),tag]),sheet:null,assistantDraft:null,assistantText:'',assistantUsage:null,flash:'Etiqueta creada'}));return;}
    if(d.intent==='create_category'){this.setState(s=>{const slug=d.merchant.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'categoria';const id=slug+'-'+s._next.toString(36);const pair=this.CATCOLORS[s.catOrder.length%this.CATCOLORS.length];return{categories:{...s.categories,[id]:{name:d.merchant,emoji:'🏷️',type:d.transactionType==='ingreso'?'ingreso':'gasto',iconVar:pair[0],fillVar:pair[1]}},catOrder:[...s.catOrder,id],_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantUsage:null,flash:'Categoría creada'};});return;}
    if(d.intent==='create_recurring'){const day=d.scheduleDay||1,income=d.transactionType==='ingreso';this.setState(s=>({recurring:[...(s.recurring||[]),{id:'r'+s._next,type:d.transactionType,concept:d.merchant,amount:d.amount,cat:income?'ingreso':d.categoryId,targetKind:income?'account':(d.cardId?'card':'account'),targetId:income?d.accountId:(d.cardId||d.accountId),day,active:true,nextDate:this._nextOccur(day,(()=>{const now=new Date();now.setHours(0,0,0,0);return now;})()).toISOString()}],_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantUsage:null,flash:'Recurrente mensual creado'}));return;}
    if(d.intent==='transfer'){const from=this.state.accounts[d.fromAccountId],to=this.state.accounts[d.toAccountId],fromCurrency=(from&&from.currency)||'ARS',toCurrency=(to&&to.currency)||'ARS';const toVal=window.FinanzDomain.convertCurrency(d.amount,fromCurrency,toCurrency,this.state.usdRate);const txn={id:this.state._next,type:'transfer',merchant:'Transferencia',cat:'transfer',amount:-d.amount,val:d.amount,currency:fromCurrency,from:d.fromAccountId,to:d.toAccountId,toCurrency,toVal,isTransfer:true,dateLabel,dateISO:d.dateISO,note:'→ '+to.name+' · Asistente',tags:d.tags};this.setState(s=>{const applied=this._apply(txn,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{balances:applied.b,categoryTotals:applied.ct,monthIncome:applied.mi,monthExpense:applied.me,txns:[txn,...s.txns],_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantError:'',flash:'Transferencia registrada'};});return;}
    if(d.intent==='card_payment'){const idx=this.state.cards.findIndex(c=>c.id===d.cardId),card=this.state.cards[idx];const amount=d.amount||this.cardResumen(card);const payDate=new Date(d.dateISO+'T12:00:00'),resumen=this.cardResumen(card);const full=amount+0.005>=resumen&&resumen>0;
      if(amount>(Number(card.saldo)||0)+0.01){this.setState({assistantError:'El pago supera la deuda total de la tarjeta. Revisá el monto antes de guardar.'});return;}
      const preview=window.FinanzDomain.fundCardPayment(this.state,d.accountId,amount,this.state.usdRate);if(!preview.ok){this.setState({assistantError:this.paymentFundingMessage(preview)});if(preview.error==='missing-rate')this.fetchPrices(true);return;}
      this.setState(s=>{const funded=window.FinanzDomain.fundCardPayment(s,d.accountId,amount,s.usdRate);if(!funded.ok)return{assistantError:this.paymentFundingMessage(funded)};const current=s.cards[idx];if(!current)return{assistantError:'La tarjeta ya no existe'};const cards=s.cards.map((c,i)=>i===idx?this._applyCardPayment({...c,pagos:[{name:'Pago '+c.brand,monto:amount,date:dateLabel,dateISO:d.dateISO,txnId:s._next},...(c.pagos||[])]},amount,payDate):c);const txn={id:s._next,type:'pago',merchant:'Pago '+current.brand,cat:'pago',amount:-amount,val:amount,currency:'ARS',...funded.transaction,card:current.id,cardRollback:this.snapshotCard(current),paymentCycle:this._dueCycle(current,payDate),closesStatement:full,isTransfer:true,dateLabel,dateISO:d.dateISO,note:'Pago de tarjeta · Asistente',tags:['asistente']};return{cards,assets:funded.assets,balances:funded.balances,txns:[txn,...s.txns],_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantError:'',flash:full?'Resumen pagado · no se repetirá al vencer':'Pago registrado'};});return;}
    if((d.intent==='recurring'||d.intent==='transaction')&&d.cardId){const idx=this.state.cards.findIndex(c=>c.id===d.cardId),card=this.state.cards[idx];this.setState(s=>{const id=s._next,merchant=d.merchant||((this.state.categories[d.categoryId]||{}).name)||'Compra';const cards=s.cards.map((c,i)=>i===idx?window.FinanzDomain.addCardPurchase(c,{amount:d.amount,installments:1,merchant,date:dateLabel,dateISO:d.dateISO,txnId:id}):c);const txn={id,type:'gasto',merchant,cat:d.categoryId,amount:-d.amount,val:d.amount,currency:'ARS',card:d.cardId,onCard:true,dateLabel,dateISO:d.dateISO,note:d.note||(d.intent==='recurring'?('Recurrente · '+card.brand):('Tarjeta '+card.brand+' · Asistente')),tags:d.tags};return{cards,categoryTotals:{...s.categoryTotals,[d.categoryId]:(s.categoryTotals[d.categoryId]||0)+d.amount},monthExpense:s.monthExpense+d.amount,txns:[txn,...s.txns],_next:id+1,sheet:null,assistantDraft:null,assistantText:'',flash:d.intent==='recurring'?'Recurrente registrado':'Compra con tarjeta registrada'};});return;}
    const type=d.transactionType,amount=d.amount;
    const category=this.state.categories[d.categoryId]||{};
    const genericMerchant=!d.merchant||/^(gasto|ingreso|movimiento)$/i.test(d.merchant);
    const source=type==='gasto'?window.FinanzDomain.findFciSpendSource(this.state,d.accountId,this.state.usdRate):null;
    const txn={
      id:this.state._next,type,
      merchant:genericMerchant?(category.name||(type==='ingreso'?'Ingreso':'Gasto')):d.merchant,
      cat:d.categoryId,amount:type==='ingreso'?amount:-amount,val:amount,
      currency:source?'ARS':((this.state.accounts[d.accountId]||{}).currency||d.currency||'ARS'),
      account:source?source.accountId:d.accountId,dateLabel,dateISO:d.dateISO,
      note:d.note||(d.intent==='recurring'?'Recurrente':'Cargado por voz o texto'),tags:d.tags
    };
    this.setState(s=>{
      let assets=s.assets;
      let finalTxn={...txn};
      if(source){
        const redeemed=window.FinanzDomain.redeemFciUnits(assets,d.accountId,amount,s.usdRate);
        if(!redeemed.ok){
          const msg=redeemed.error==='insufficient'?'El FCI no tiene suficiente disponible para ese gasto.':redeemed.error==='missing-price'?'No tengo un valor de cuotaparte válido para calcular el rescate.':'No pude usar ese FCI como medio de pago.';
          return{assistantError:msg};
        }
        assets=redeemed.assets;
        finalTxn={...finalTxn,fciRedemption:redeemed.redemption,fundingLabel:'FCI · '+redeemed.redemption.name,account:redeemed.redemption.accountId};
      }
      const applied=this._apply(finalTxn,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);
      return{assets,balances:applied.b,categoryTotals:applied.ct,monthIncome:applied.mi,monthExpense:applied.me,txns:[finalTxn,...s.txns],tagSugg:window.FinanzDomain.uniqueTags([...(s.tagSugg||[]),...(d.tags||[])]),_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantError:'',flash:d.intent==='recurring'?'Recurrente registrado':'Movimiento guardado'};
    });
  }
  componentDidUpdate(prevProps,prevState){
    const passiveUpdate=!!this._passiveUpdate;this._passiveUpdate=false;
    const persistedChanged=this.persistState();
    if(prevState)this.trackNavigation(prevState,persistedChanged===true);
    if(persistedChanged===null&&!this._persistWriteNotice){this._persistWriteNotice=true;setTimeout(()=>this.setState({flash:'No se pudo guardar en este dispositivo · liberá espacio o habilitá almacenamiento'}),0);}
    // The outgoing screen owns the back animation. As soon as the target screen
    // is revealed, settle to idle without replaying a forward animation.
    if(prevState&&prevState.navState!=='back-settle'&&this.state.navState==='back-settle'){
      clearTimeout(this._navSettleTimer);
      this._navSettleTimer=setTimeout(()=>{if(this.state.navState==='back-settle')this.setState({navState:'idle'});},34);
    }
    // Track local data changes for last-write-wins sync + mirror to cloud (debounced).
    if(prevState&&persistedChanged&&!passiveUpdate&&!this._applyingRemote){
      this._localMod=Date.now();try{localStorage.setItem('finanzapp:mod',String(this._localMod));}catch(e){}
      this._markCloudPending(true);
      if(this.state.cloud&&this.state.cloud.status==='signed-in')this.cloudPushDebounced();
    }
    // Push screens are overlays. Resetting the tab underneath them caused the
    // visible jump-to-top when the user came back from an investment detail.
    if(prevState && prevState.tab!==this.state.tab){
      const el=this.mainScrollRef.current;
      if(el) el.scrollTop=0;
    }
    // Centralised toast lifecycle: any flash (set via flashMsg OR inline setState)
    // auto-dismisses. A new message resets the timer; only one toast shows at a time.
    if(this.state.flash && (!prevState || prevState.flash!==this.state.flash)){
      clearTimeout(this._ft);
      const cur=this.state.flash;
      this._ft=setTimeout(()=>{ if(this.state.flash===cur) this.setState({flash:''}); },2200);
    }
  }
  componentWillUnmount(){
    if(this._shortcutCaptureListener)window.removeEventListener('finanzapp:shortcutCapture',this._shortcutCaptureListener);
    if(this._automationWake){window.removeEventListener('focus',this._automationWake);document.removeEventListener('visibilitychange',this._automationWake);}
    if(this._cloudOnlineListener)window.removeEventListener('online',this._cloudOnlineListener);
    if(this._cloudOfflineListener)window.removeEventListener('offline',this._cloudOfflineListener);
    clearTimeout(this._ft);
    clearTimeout(this._cardScrollT);
    clearTimeout(this._navTimer);
    clearTimeout(this._navSettleTimer);
    clearTimeout(this._tabTimer);
    clearTimeout(this._swipeTimer);
    clearTimeout(this._automationTimer);
    clearTimeout(this._pushTimer);
    clearInterval(this._priceTimer);
    if(this._speechRecognition)try{this._speechRecognition.abort();}catch(e){}
    if(this._nativeSpeechActive&&window.FinanzNativeSpeech)window.FinanzNativeSpeech.stop().catch(()=>{});
  }
  persistentKeys(){
    return ['theme','chartStyle','balanceMode','heroCurrency','periodIdx','currency','hideAmounts','categories','catOrder','txns','categoryTotals','budgets','monthIncome','monthExpense','order','accounts','archived','balances','accMeta','cards','tagSugg','_next','showOnboarding','onbCard','onbInvest','cardIdx','assets','loans','recurring','goals','history','usdRate','pricesLastUpdated','pricesLastAttemptedAt','lastBackupAt','backupDismissedAt'];
  }
  persistentSnapshot(state){
    const snap={};
    this.persistentKeys().forEach(k=>{ snap[k]=state[k]; });
    return snap;
  }
  coercePersistedState(st){
    if(!st||typeof st!=='object'||Array.isArray(st))throw new Error('invalid-state');
    const FD=window.FinanzDomain,base=this.emptyData();
    const finite=(value,fallback=0)=>{const n=Number(value);return Number.isFinite(n)?n:fallback;};
    const record=value=>{const clean={};if(!value||typeof value!=='object'||Array.isArray(value))return clean;Object.keys(value).forEach(key=>{if(key!=='__proto__'&&key!=='prototype'&&key!=='constructor')clean[key]=value[key];});return clean;};
    const out=Object.assign({},base,record(st));
    const rawCategories=record(out.categories),rawAccounts=record(out.accounts),rawBalances=record(out.balances);
    out.categories={...base.categories};
    Object.keys(rawCategories).forEach(id=>{const c=rawCategories[id];if(!c||typeof c!=='object')return;const type=['gasto','ingreso','transfer','inversion'].includes(c.type)?c.type:'gasto';out.categories[id]={...record(c),name:String(c.name||id).slice(0,50),emoji:String(c.emoji||'✨').slice(0,8),type};});
    out.accounts={};
    Object.keys(rawAccounts).forEach(id=>{const a=rawAccounts[id];if(!a||typeof a!=='object')return;const kind=['liquid','invest','debt'].includes(a.kind)?a.kind:(a.type==='Inversión'?'invest':a.type==='Tarjeta'||a.type==='Deuda'?'debt':'liquid');out.accounts[id]={...record(a),name:String(a.name||'Cuenta').slice(0,60),type:String(a.type||'Banco').slice(0,30),kind,liquid:kind==='liquid',currency:a.currency==='USD'?'USD':'ARS'};});
    out.archived=record(out.archived);Object.keys(out.archived).forEach(id=>{out.archived[id]=!!out.archived[id];});
    out.balances={};Object.keys(out.accounts).forEach(id=>{out.balances[id]=finite(rawBalances[id]);});
    out.accMeta=record(out.accMeta);
    out.catOrder=(Array.isArray(out.catOrder)?out.catOrder:[]).map(String).filter((id,index,list)=>out.categories[id]&&list.indexOf(id)===index);
    Object.keys(out.categories).forEach(id=>{if(!out.catOrder.includes(id)&&id!=='pago')out.catOrder.push(id);});
    out.order=(Array.isArray(out.order)?out.order:[]).map(String).filter((id,index,list)=>out.accounts[id]&&list.indexOf(id)===index);
    Object.keys(out.accounts).forEach(id=>{if(!out.order.includes(id))out.order.push(id);});
    out.txns=(Array.isArray(out.txns)?out.txns:[]).filter(t=>t&&typeof t==='object'&&t.id!=null&&t.type&&Number.isFinite(Number(t.val))&&Number.isFinite(Number(t.amount))).map(t=>{const nt={...record(t),type:String(t.type),val:Math.abs(finite(t.val)),amount:finite(t.amount),tags:Array.isArray(t.tags)?t.tags.map(tag=>String(tag).trim().toLowerCase()).filter(Boolean).slice(0,12):[]};if(t.toVal!=null)nt.toVal=Math.abs(finite(t.toVal));if(t.accountAmount!=null)nt.accountAmount=Math.abs(finite(t.accountAmount));if(!nt.dateISO)nt.dateISO=FD.isoFromLabel(nt.dateLabel||'Hoy');nt.dateISO=FD.isoFromLabel(nt.dateISO);nt.dateLabel=FD.labelFromISO(nt.dateISO);nt.currency=nt.currency==='USD'?'USD':FD.transactionCurrency(nt,out.accounts);nt.merchant=String(nt.merchant||'Movimiento').trim().slice(0,80);nt.note=String(nt.note||'').trim().slice(0,160);if(/^(gasto|ingreso|movimiento)$/i.test(nt.merchant)){const category=out.categories[nt.cat];if(category&&category.name)nt.merchant=category.name;}return nt;});
    const usedCardIds=new Set();
    out.cards=(Array.isArray(out.cards)?out.cards:[]).filter(c=>c&&typeof c==='object').map((c,index)=>{
      let id=String(c.id||('card_recuperada_'+(index+1)));while(usedCardIds.has(id))id='card_recuperada_'+(index+1)+'_'+usedCardIds.size;usedCardIds.add(id);
      const moneyRows=value=>(Array.isArray(value)?value:[]).filter(row=>row&&typeof row==='object').map(row=>{const original=row.monto!=null?row.monto:row.amount,normalized=Math.abs(finite(original));return{...record(row),monto:normalized,amount:normalized};});
      const saldo=Math.max(0,finite(c.saldo));
      const dayFrom=(value,fallback)=>{const match=String(value||'').match(/\d{1,2}/),raw=finite(c[fallback],match?Number(match[0]):0);return raw>0?Math.min(31,Math.max(1,Math.round(raw))):null;};
      const autopayAccount=String(c.autopayAccount||''),parsedAutopay=FD.parseFciSpendSourceId(autopayAccount),validAutopay=!!out.accounts[autopayAccount]||!!(parsedAutopay&&out.accounts[parsedAutopay.accountId]);
      return{...record(c),id,brand:String(c.brand||'Visa').slice(0,20),bank:String(c.bank||'').slice(0,50),last4:String(c.last4||'0000').replace(/\D/g,'').slice(-4).padStart(4,'0'),saldo,statementPaid:Math.min(saldo,Math.max(0,finite(c.statementPaid))),statementAdjustment:finite(c.statementAdjustment),pendingAdjustment:finite(c.pendingAdjustment),limit:Math.max(0,finite(c.limit)),cierre:String(c.cierre||'—').slice(0,20),vence:String(c.vence||'—').slice(0,20),cierreDay:dayFrom(c.cierre,'cierreDay'),venceDay:dayFrom(c.vence,'venceDay'),grad:String(c.grad||this.CARDGRADS[0]),autopay:!!c.autopay,autopayAccount:validAutopay?autopayAccount:'',compras:moneyRows(c.compras),cuotas:moneyRows(c.cuotas),pendientes:moneyRows(c.pendientes).map(row=>({...row,installments:Math.max(1,Math.round(finite(row.installments,1)))})),pagos:moneyRows(c.pagos)};
    });
    const rawAssets=record(out.assets);out.assets={};
    Object.keys(out.accounts).forEach(accountId=>{const rows=Array.isArray(rawAssets[accountId])?rawAssets[accountId]:[];out.assets[accountId]=rows.filter(a=>a&&typeof a==='object'&&(a.ticker||a.name)).map((a,index)=>{const clean=record(a),ticker=String(a.ticker||'ACTIVO').toUpperCase().slice(0,24),preset=this.FCI_META[ticker]||{},qty=Math.max(0,finite(a.qty!=null?a.qty:a.units)),unitDivisor=Math.max(1,finite(a.unitDivisor,1)),vcpScale=Math.max(1,finite(a.vcpScale,preset.vcpScale||1));return{...preset,...clean,id:String(a.id||('asset_'+accountId+'_'+(index+1))),ticker,name:String(a.name||a.ticker||'Activo').slice(0,80),qty,units:(a.fci||preset.fci)?qty:(a.units!=null?Math.max(0,finite(a.units)):a.units),avg:Math.max(0,finite(a.avg)),lastPrice:Math.max(0,finite(a.lastPrice)),unitDivisor,vcpScale,quoteCurrency:a.quoteCurrency==='USD'?'USD':'ARS',costCurrency:a.costCurrency==='USD'?'USD':'ARS'};});if(out.accounts[accountId].kind==='invest'){const valuation=FD.investmentValuation(out.assets[accountId],finite(out.usdRate));if(valuation.complete)out.balances[accountId]=valuation.valueARS;}});
    out.cards=out.cards.map(card=>card.autopayAccount&&FD.parseFciSpendSourceId(card.autopayAccount)&&!FD.findFciSpendSource(out,card.autopayAccount,finite(out.usdRate))?{...card,autopay:false,autopayAccount:''}:card);
    out.tagSugg=(Array.isArray(out.tagSugg)?out.tagSugg:[]).map(t=>String(t).trim().toLowerCase().replace(/^#/,'')).filter(Boolean).filter((t,i,a)=>a.indexOf(t)===i).slice(0,100);
    out.budgets=record(out.budgets);Object.keys(out.budgets).forEach(id=>{const value=Math.max(0,finite(out.budgets[id]));if(value&&out.categories[id])out.budgets[id]=value;else delete out.budgets[id];});
    out.loans=(Array.isArray(out.loans)?out.loans:[]).filter(l=>l&&typeof l==='object'&&l.id!=null&&l.person).map(l=>{const original=Math.max(0,finite(l.originalAmount));return{...record(l),person:String(l.person).slice(0,80),originalAmount:original,remaining:Math.max(0,finite(l.remaining,original)),currency:l.currency==='USD'?'USD':'ARS',payments:Array.isArray(l.payments)?l.payments:[]};});
    out.recurring=(Array.isArray(out.recurring)?out.recurring:[]).filter(r=>r&&typeof r==='object'&&r.id!=null&&Number.isFinite(Number(r.amount))).map(r=>{const type=r.type==='ingreso'?'ingreso':'gasto',targetKind=type==='ingreso'?'account':(r.targetKind==='card'?'card':'account');const targetExists=targetKind==='card'?usedCardIds.has(String(r.targetId)):!!out.accounts[r.targetId];return{...record(r),type,targetKind,cat:type==='ingreso'?'ingreso':r.cat,amount:Math.abs(finite(r.amount)),day:Math.min(31,Math.max(1,Math.round(finite(r.day,1)))),active:r.active!==false&&targetExists};});
    out.goals=(Array.isArray(out.goals)?out.goals:[]).filter(g=>g&&typeof g==='object'&&g.id!=null&&g.name).map(g=>({...record(g),emoji:String(g.emoji||'🎯').slice(0,8),saved:Math.max(0,finite(g.saved)),target:Math.max(0,finite(g.target)),entries:Array.isArray(g.entries)?g.entries:[]}));
    out.history=(Array.isArray(out.history)?out.history:[]).filter(h=>h&&typeof h==='object'&&h.d&&Number.isFinite(Number(h.pat))).map(h=>({d:String(h.d),pat:finite(h.pat),disp:finite(h.disp),inv:finite(h.inv)})).slice(-365);
    const totals=FD.incomeExpense(out.txns);out.categoryTotals=FD.categoryTotals(out.txns);out.monthIncome=totals.income;out.monthExpense=totals.expense;
    const maxTxn=out.txns.reduce((max,t)=>Math.max(max,finite(t.id)),0);out._next=Math.max(1,Math.floor(finite(out._next,1)),maxTxn+1,out.order.length+out.cards.length+1);
    out.theme=['light','dark'].includes(out.theme)?out.theme:'light';out.chartStyle=['bars','pills'].includes(out.chartStyle)?out.chartStyle:'bars';out.balanceMode=out.balanceMode==='patrimonio'?'patrimonio':'disponible';out.heroCurrency=out.heroCurrency==='USD'?'USD':'ARS';out.currency=out.currency==='USD'?'USD':'ARS';out.periodIdx=Math.min(2,Math.max(0,Math.floor(finite(out.periodIdx))));out.cardIdx=Math.min(Math.max(0,out.cards.length-1),Math.max(0,Math.floor(finite(out.cardIdx))));out.showOnboarding=!!out.showOnboarding;out.hideAmounts=!!out.hideAmounts;out.onbCard=!!out.onbCard;out.onbInvest=!!out.onbInvest;out.usdRate=Math.max(0,finite(out.usdRate));out.pricesLastUpdated=finite(out.pricesLastUpdated)||null;out.pricesLastAttemptedAt=finite(out.pricesLastAttemptedAt)||null;out.lastBackupAt=finite(out.lastBackupAt)||null;out.backupDismissedAt=finite(out.backupDismissedAt)||null;
    return this.persistentSnapshot(out);
  }
  parseBackupPayload(raw){
    const parsed=window.FinanzDomain.parseLocalEnvelope(raw);
    return this.coercePersistedState(parsed.state);
  }
  readPersistedState(){
    // Synchronous, crash-safe read of persisted local state. Returns a validated/
    // migrated persistent snapshot, or null when there is nothing valid to load.
    try{
      const loaded=window.FinanzDomain.loadLocalState(localStorage,{
        primaryKey:this.STORAGE_KEY,backupKey:this.STORAGE_BACKUP_KEY,tempKey:this.STORAGE_TEMP_KEY,
        legacyKey:this.LEGACY_STORAGE_KEY,quarantineKey:this.STORAGE_QUARANTINE_KEY,
        validateState:state=>this.coercePersistedState(state)
      });
      this._persistRevision=loaded.revision||0;
      this._persistRecovered=!!loaded.recovered;
      this._persistLegacy=!!loaded.legacy||!!loaded.recovered;
      this._persistError=!!(loaded.errors&&loaded.errors.length&&!loaded.state);
      return loaded.state;
    }catch(e){
      this._persistError=true;
      return null; // storage unavailable (e.g. disabled) — boot with defaults, no crash
    }
  }
  persistState(){
    try{
      const snapshot=this.persistentSnapshot(this.state),stateJson=JSON.stringify(snapshot);
      if(stateJson===this._lastPersistedStateJson&&!this._persistLegacy)return false;
      const saved=window.FinanzDomain.saveLocalState(localStorage,snapshot,{
        primaryKey:this.STORAGE_KEY,backupKey:this.STORAGE_BACKUP_KEY,tempKey:this.STORAGE_TEMP_KEY,
        revision:(this._persistRevision||0)+1
      });
      this._persistRevision=saved.envelope.revision;
      this._persistLegacy=false;
      this._lastPersistedStateJson=stateJson;
      this._persistWriteFailed=false;
      this._persistWriteNotice=false;
      return true;
    }catch(e){
      if(!this._persistWriteFailed)console.warn('FinanzApp: no se pudo guardar el estado local', e);
      this._persistWriteFailed=true;
      return null;
    }
  }
  // ===== Cloud sync (Supabase, optional) =====
  _dataChanged(a,b){const ks=this.persistentKeys();for(const k of ks){if(a[k]!==b[k])return true;}return false;}
  _markCloudPending(value){this._cloudPending=!!value;try{if(value)localStorage.setItem(this.CLOUD_PENDING_KEY,'1');else localStorage.removeItem(this.CLOUD_PENDING_KEY);}catch(e){}if(this.state.cloud&&this.state.cloud.pending!==!!value)this.setState(s=>({cloud:{...s.cloud,pending:!!value}}));}
  _setCloudLastSeen(value){const timestamp=Math.max(0,Number(value)||0);this._cloudLastSeen=timestamp;try{if(timestamp)localStorage.setItem(this.CLOUD_LAST_SEEN_KEY,String(timestamp));else localStorage.removeItem(this.CLOUD_LAST_SEEN_KEY);}catch(e){}}
  _rememberCloudUser(id){this._cloudLastUser=String(id||'');try{if(this._cloudLastUser)localStorage.setItem(this.CLOUD_LAST_USER_KEY,this._cloudLastUser);else localStorage.removeItem(this.CLOUD_LAST_USER_KEY);}catch(e){}}
  _setCloudConflict(remote,message){this._cloudConflictRemote=remote&&typeof remote==='object'?remote:null;this.setState(s=>({cloud:{...s.cloud,syncing:false,conflict:true,error:message||'Hay cambios distintos en este dispositivo y en la nube.'}}));}
  initCloud(){
    if(!this.SUPA.url||!this.SUPA.anonKey||typeof supabase==='undefined'||!supabase.createClient)return;
    try{
      this._sb=supabase.createClient(this.SUPA.url,this.SUPA.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      this.setState(s=>({cloud:{...s.cloud,status:'signed-out'}}));
      this._sb.auth.getSession().then(({data})=>{const u=data&&data.session&&data.session.user;if(u)this._cloudOnAuth(u);}).catch(()=>{});
      this._sb.auth.onAuthStateChange((event,session)=>{const u=session&&session.user;if(u)this._cloudOnAuth(u);else{this._cloudAuthUserId='';this.setState(s=>({cloud:{...s.cloud,status:'signed-out',user:null,lastSync:null,conflict:false,error:''}}));}});
      // When connectivity returns, flush any changes made while offline.
      this._cloudOnlineListener=()=>{this.setState(s=>({cloud:{...s.cloud,offline:false,error:s.cloud.conflict?s.cloud.error:''}}));if(this.state.cloud&&this.state.cloud.status==='signed-in')this._cloudInitialSync(this.state.cloud.user);};
      this._cloudOfflineListener=()=>this.setState(s=>({cloud:{...s.cloud,offline:true,syncing:false,error:'Sin conexión · tus cambios siguen guardados en este dispositivo'}}));
      window.addEventListener('online',this._cloudOnlineListener);window.addEventListener('offline',this._cloudOfflineListener);
    }catch(e){console.warn('cloud init failed',e);}
  }
  _cloudOnAuth(u){
    if(this._cloudAuthUserId===u.id)return;this._cloudAuthUserId=u.id;
    const cur=this.state.cloud;
    if(cur.user&&cur.user.id===u.id&&cur.status==='signed-in')return;
    this._cloudAccountChanged=!!(this._cloudLastUser&&this._cloudLastUser!==u.id);
    this.setState(s=>({cloud:{...s.cloud,status:'signed-in',user:{id:u.id,email:u.email},email:u.email||'',sent:false,offline:typeof navigator!=='undefined'&&!navigator.onLine,conflict:false,error:''}}),()=>this._cloudInitialSync(u));
  }
  async _cloudInitialSync(u){
    if(!this._sb||!u)return;
    if(typeof navigator!=='undefined'&&!navigator.onLine){this.setState(s=>({cloud:{...s.cloud,syncing:false,offline:true,error:'Sin conexión · tus cambios siguen guardados en este dispositivo'}}));return;}
    this.setState(s=>({cloud:{...s.cloud,syncing:true,offline:false,error:s.cloud.conflict?s.cloud.error:''}}));
    try{
      const {data,error}=await this._sb.from('user_data').select('data,updated_at').eq('user_id',u.id).maybeSingle();if(error)throw error;
      const remote=data&&data.data;
      const local=this.persistentSnapshot(this.state),FD=window.FinanzDomain;
      const remoteHas=FD.cloudSnapshotHasData(remote),localHas=FD.cloudSnapshotHasData(local);
      const remoteMod=(data&&data.updated_at)?Date.parse(data.updated_at):0;
      let normalizedRemote=null,same=false;if(remote&&typeof remote==='object'){normalizedRemote=this.coercePersistedState(remote);same=JSON.stringify(normalizedRemote)===JSON.stringify(local);}
      let decision=FD.decideCloudSync({localHas,remoteHas,pending:this._cloudPending,same,localModified:this._localMod||0,remoteModified:remoteMod,lastSeen:this._cloudLastSeen||0});
      if(this._cloudAccountChanged&&localHas&&!same)decision='conflict';
      if(decision==='pull'){this._cloudApplyRemote(normalizedRemote||remote,true,remoteMod,u.id);return;}
      if(decision==='push'){await this.cloudPushNow();return;}
      if(decision==='conflict'){this._cloudConflictMod=remoteMod;this._setCloudConflict(normalizedRemote||remote||{},this._cloudAccountChanged?'Este dispositivo tiene datos de otra cuenta. Elegí cuál conservar.':'Hay cambios nuevos en este dispositivo y también en la nube. Elegí cuál conservar.');return;}
      this._markCloudPending(false);this._setCloudLastSeen(remoteMod||Date.now());this._rememberCloudUser(u.id);this._cloudAccountChanged=false;
      this.setState(s=>({cloud:{...s.cloud,syncing:false,lastSync:Date.now(),conflict:false,error:'',offline:false}}));
    }catch(e){console.warn('sync failed',e);this.setState(s=>({cloud:{...s.cloud,syncing:false,offline:typeof navigator!=='undefined'&&!navigator.onLine,error:'No se pudo sincronizar · tus datos locales siguen seguros'}}));}
  }
  _cloudApplyRemote(remote,silent,remoteMod,userId){
    try{const st=this.coercePersistedState(remote);this._applyingRemote=true;
      this._markCloudPending(false);this._setCloudLastSeen(remoteMod||Date.now());if(userId)this._rememberCloudUser(userId);this._cloudAccountChanged=false;
      this._localMod=remoteMod||Date.now();try{localStorage.setItem('finanzapp:mod',String(this._localMod));}catch(e){}
      this.setState(Object.assign({},st,{push:null,sheet:null,subsheet:null,confirm:null,showOnboarding:false,cloud:{...this.state.cloud,syncing:false,lastSync:Date.now(),pending:false,conflict:false,error:'',offline:false}},silent?{}:{flash:'Datos de la nube aplicados'}));
      setTimeout(()=>{this._applyingRemote=false;},250);}
    catch(e){console.warn('apply remote failed',e);this._applyingRemote=false;}
  }
  async cloudPushNow(force=false){
    if(!this._sb||!this.state.cloud.user)return false;
    if(typeof navigator!=='undefined'&&!navigator.onLine){this._markCloudPending(true);this.setState(s=>({cloud:{...s.cloud,syncing:false,offline:true,error:'Sin conexión · queda pendiente subir estos cambios'}}));return false;}
    try{this.setState(s=>({cloud:{...s.cloud,syncing:true,offline:false,error:'',conflict:false}}));const user=this.state.cloud.user;let checkedRow=null;
      if(!force){const check=await this._sb.from('user_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(check.error)throw check.error;checkedRow=check.data||null;const remoteMod=checkedRow&&checkedRow.updated_at?Date.parse(checkedRow.updated_at):0;if(checkedRow&&(!this._cloudLastSeen||remoteMod>this._cloudLastSeen)){this._cloudConflictMod=remoteMod;this._setCloudConflict(checkedRow.data,'También hay cambios en la nube. Elegí cuál conservar.');return false;}}
      const snapshot=this.persistentSnapshot(this.state),revisionAtStart=this._persistRevision||0,localModAtStart=this._localMod||0;let response;
      if(force){response=await this._sb.from('user_data').upsert({user_id:user.id,data:snapshot}).select('updated_at').maybeSingle();}
      else if(checkedRow){response=await this._sb.from('user_data').update({data:snapshot}).eq('user_id',user.id).eq('updated_at',checkedRow.updated_at).select('updated_at').maybeSingle();if(!response.error&&!response.data){const latest=await this._sb.from('user_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(latest.error)throw latest.error;this._cloudConflictMod=latest.data&&latest.data.updated_at?Date.parse(latest.data.updated_at):0;this._setCloudConflict(latest.data&&latest.data.data,'La copia en la nube cambió mientras sincronizábamos. Elegí cuál conservar.');return false;}}
      else{response=await this._sb.from('user_data').insert({user_id:user.id,data:snapshot}).select('updated_at').maybeSingle();if(response.error&&response.error.code==='23505'){const latest=await this._sb.from('user_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();if(latest.error)throw latest.error;this._cloudConflictMod=latest.data&&latest.data.updated_at?Date.parse(latest.data.updated_at):0;this._setCloudConflict(latest.data&&latest.data.data,'Se creó una copia en la nube desde otro dispositivo. Elegí cuál conservar.');return false;}}
      const {data,error}=response;if(error)throw error;
      const syncedAt=data&&data.updated_at?Date.parse(data.updated_at):Date.now(),changedDuringPush=(this._persistRevision||0)!==revisionAtStart||(this._localMod||0)!==localModAtStart;this._setCloudLastSeen(syncedAt);this._rememberCloudUser(user.id);this._cloudAccountChanged=false;this._cloudConflictRemote=null;
      if(changedDuringPush){this._markCloudPending(true);this.setState(s=>({cloud:{...s.cloud,syncing:false,lastSync:Date.now(),pending:true,offline:false,conflict:false,error:'Guardado local · subiendo el último cambio'}}));this.cloudPushDebounced();return true;}
      this._localMod=syncedAt;try{localStorage.setItem('finanzapp:mod',String(this._localMod));}catch(e){}this._markCloudPending(false);
      this.setState(s=>({cloud:{...s.cloud,syncing:false,lastSync:Date.now(),pending:false,offline:false,conflict:false,error:''}}));return true;
    }catch(e){console.warn('push failed',e);this._markCloudPending(true);this.setState(s=>({cloud:{...s.cloud,syncing:false,pending:true,offline:typeof navigator!=='undefined'&&!navigator.onLine,error:'No se pudo subir todavía · tus cambios siguen guardados localmente'}}));return false;}
  }
  cloudPushDebounced(){if(this._pushTimer)clearTimeout(this._pushTimer);this._pushTimer=setTimeout(()=>this.cloudPushNow(),2500);}
  cloudSyncNow(){if(this.state.cloud&&this.state.cloud.user)this._cloudInitialSync(this.state.cloud.user);}
  cloudKeepLocal(){this.cloudPushNow(true);}
  cloudUseRemote(){const remote=this._cloudConflictRemote;if(!remote){this.setState(s=>({cloud:{...s.cloud,conflict:false,error:'No hay una copia de nube válida para aplicar'}}));return;}this._cloudApplyRemote(remote,false,this._cloudConflictMod,this.state.cloud.user&&this.state.cloud.user.id);this._cloudConflictRemote=null;}
  cloudSignUp(){
    const email=(this.state.cloud.email||'').trim();const password=this.state.cloud.password||'';
    if(!email||email.indexOf('@')<0){this.flashMsg('Poné un email válido');return;}
    if(password.length<6){this.flashMsg('La contraseña necesita 6+ caracteres');return;}
    if(!this._sb){this.flashMsg('La nube no está configurada');return;}
    this.setState(s=>({cloud:{...s.cloud,syncing:true}}));
    this._sb.auth.signUp({email,password}).then(({data,error})=>{
      if(error){this.flashMsg(error.message||'No se pudo crear la cuenta');this.setState(s=>({cloud:{...s.cloud,syncing:false}}));}
      else if(data&&data.session){this.setState(s=>({cloud:{...s.cloud,syncing:false,password:''}}));/* onAuthStateChange signs in + syncs */}
      else{this.setState(s=>({cloud:{...s.cloud,syncing:false,password:''},flash:'Revisá tu email para confirmar la cuenta'}));}
    }).catch(()=>{this.flashMsg('No se pudo crear la cuenta');this.setState(s=>({cloud:{...s.cloud,syncing:false}}));});
  }
  cloudSignIn(){
    const email=(this.state.cloud.email||'').trim();const password=this.state.cloud.password||'';
    if(!email||email.indexOf('@')<0){this.flashMsg('Poné un email válido');return;}
    if(!password){this.flashMsg('Poné tu contraseña');return;}
    if(!this._sb){this.flashMsg('La nube no está configurada');return;}
    this.setState(s=>({cloud:{...s.cloud,syncing:true}}));
    this._sb.auth.signInWithPassword({email,password}).then(({error})=>{
      if(error){this.flashMsg('Email o contraseña incorrectos');this.setState(s=>({cloud:{...s.cloud,syncing:false}}));}
      else this.setState(s=>({cloud:{...s.cloud,syncing:false,password:''}}));// onAuthStateChange signs in + syncs
    }).catch(()=>{this.flashMsg('No se pudo entrar');this.setState(s=>({cloud:{...s.cloud,syncing:false}}));});
  }
  setCloudPassword(e){const v=e&&e.target?e.target.value:'';this.setState(s=>({cloud:{...s.cloud,password:v}}));}
  cloudSignOut(){this._cloudAuthUserId='';if(this._sb)this._sb.auth.signOut().catch(()=>{});this.setState(s=>({cloud:{...s.cloud,status:'signed-out',user:null,lastSync:null,password:'',conflict:false,error:''},push:null,flash:'Sesión cerrada'}));}
  setCloudEmail(e){const v=e&&e.target?e.target.value:'';this.setState(s=>({cloud:{...s.cloud,email:v}}));}
  downloadFile(name, content, type){
    const blob=new Blob([content],{type:type||'application/octet-stream'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  doExport(){
    const rows=[['id','fecha','tipo','comercio','categoria','cuenta','monto','moneda','nota','tags']];
    this.state.txns.forEach(t=>{
      const cat=this.state.categories[t.cat]||{};
      const acc=this.state.accounts[t.account||t.from]||{};
      rows.push([t.id,t.dateISO||window.FinanzDomain.isoFromLabel(t.dateLabel),t.type,t.merchant,cat.name||t.cat,acc.name||'',t.amount,window.FinanzDomain.transactionCurrency(t,this.state.accounts),t.note||'',(t.tags||[]).join('|')]);
    });
    const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\n');
    this.downloadFile('finanzapp-transacciones.csv',csv,'text/csv;charset=utf-8');
    this.flashMsg('CSV exportado');
  }
  doBackup(){
    const payload=window.FinanzDomain.createLocalEnvelope(this.persistentSnapshot(this.state),{revision:this._persistRevision||1});payload.exportedAt=new Date().toISOString();
    const stamp=new Date().toISOString().slice(0,10);
    this.downloadFile('finanzapp-backup-'+stamp+'.json',JSON.stringify(payload,null,2),'application/json;charset=utf-8');
    this.setState({lastBackupAt:Date.now(),flash:'Backup descargado'});
  }
  askImport(){
    this.requestConfirm({title:'Importar datos',msg:'Podés elegir un backup completo o un archivo de configuración. El backup reemplaza tus datos; la configuración sólo agrega o actualiza cuentas, tarjetas e inversiones y conserva tus movimientos.',confirmLabel:'Elegir archivo',danger:false,onConfirm:()=>this.pickBackupFile()});
  }
  applySetupImport(imported){const setup=imported.setup;
    this.setState(s=>{const accounts={...s.accounts},balances={...s.balances},assets={...s.assets},order=[...s.order];let cards=[...(s.cards||[])],recurring=[...(s.recurring||[])],txns=[...(s.txns||[])],next=s._next;
      const accountIds=new Map();
      setup.accounts.forEach((account,index)=>{let id=account.id;const same=accounts[id]&&accounts[id].kind===account.kind;if(accounts[id]&&!same){const byName=Object.keys(accounts).find(key=>accounts[key].kind===account.kind&&String(accounts[key].name).toLowerCase()===account.name.toLowerCase());id=byName||account.id+'_importado';let suffix=2;while(accounts[id]&&id!==byName){id=account.id+'_importado_'+suffix;suffix++;}}
        const pal=this.PALETTE[(order.length+index)%this.PALETTE.length];accounts[id]={...(accounts[id]||{}),name:account.name,type:account.type,kind:account.kind,currency:account.currency,liquid:account.liquid,emoji:account.emoji,balanceKnown:account.balanceKnown,iconVar:(accounts[id]||{}).iconVar||pal[0],fillVar:(accounts[id]||{}).fillVar||pal[1]};balances[id]=account.balance;if(order.indexOf(id)<0)order.push(id);if(!assets[id])assets[id]=[];accountIds.set(account.id,id);});
      setup.assets.forEach(asset=>{const accountId=accountIds.get(asset.accountId)||asset.accountId;if(!accounts[accountId])throw new Error('missing-import-account');const current=[...(assets[accountId]||[])];const i=current.findIndex(item=>item.ticker===asset.ticker||item.id===asset.id);const normalized={...asset,accountId:undefined,fondoMatch:asset.fondoMatch.length?asset.fondoMatch:undefined};delete normalized.accountId;if(i>=0)current[i]={...current[i],...normalized};else current.push(normalized);assets[accountId]=current;});
      Object.keys(assets).forEach(id=>{if(accounts[id]&&accounts[id].kind==='invest'){const valuation=window.FinanzDomain.investmentValuation(assets[id],s.usdRate);if(valuation.complete)balances[id]=valuation.valueARS;}});
      const cardIds=new Map();setup.cards.forEach((card,index)=>{const i=cards.findIndex(existing=>existing.id===card.id||(card.last4&&existing.last4===card.last4));const existing=i>=0?cards[i]:null;const normalized={...card,id:existing?existing.id:card.id,grad:card.grad||(existing&&existing.grad)||this.CARDGRADS[index%this.CARDGRADS.length]};if(i>=0)cards[i]={...existing,...normalized};else cards.push(normalized);cardIds.set(card.id,normalized.id);});
      const existingLots=new Set(txns.map(t=>t.importKey).filter(Boolean));setup.investmentLots.forEach(lot=>{if(existingLots.has(lot.importKey))return;const accountId=accountIds.get(lot.accountId)||lot.accountId;txns.push({id:next,type:'inversion',ticker:lot.ticker,aqty:lot.qty,merchant:'Compra '+lot.ticker,cat:'inversion',amount:-lot.total,val:lot.total,currency:lot.currency||'ARS',unitDivisor:lot.unitDivisor||1,from:accountId,to:accountId,isTransfer:true,dateLabel:window.FinanzDomain.labelFromISO(lot.dateISO),dateISO:lot.dateISO,note:lot.note||((lot.qty<1?lot.qty:this.fmtInt(lot.qty))+' '+lot.ticker+' · importado'),tags:['importado'],importKey:lot.importKey});existingLots.add(lot.importKey);next++;});
      setup.recurring.forEach(item=>{const targetId=item.targetKind==='card'?(cardIds.get(item.targetId)||item.targetId):(accountIds.get(item.targetId)||item.targetId);const normalized={...item,targetId,nextDate:item.nextDate||this._nextOccur(item.day,(()=>{const d=new Date();d.setHours(0,0,0,0);return d;})()).toISOString()};const i=recurring.findIndex(r=>r.id===item.id||(r.concept===item.concept&&r.targetKind===item.targetKind&&r.targetId===targetId));if(i>=0)recurring[i]={...recurring[i],...normalized,id:recurring[i].id};else recurring.push(normalized);});
      return{accounts,balances,assets,order,cards,recurring,txns,_next:next,push:null,sheet:null,subsheet:null,confirm:null,showOnboarding:false,flash:'Configuración importada sin borrar tus movimientos'};
    },()=>{this.runAutomations();setTimeout(()=>this.fetchPrices(true),250);});
  }
  pickBackupFile(){
    const input=document.createElement('input');
    input.type='file';input.accept='.json,application/json';
    input.onchange=()=>{
      const file=input.files&&input.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{
          const raw=String(reader.result||'');const parsed=JSON.parse(raw);
          if(parsed&&parsed.schema==='finanzapp.setup.v1'){this.applySetupImport(window.FinanzDomain.parseSetupImport(parsed));return;}
          const st=this.parseBackupPayload(parsed);
          this.setState(Object.assign({}, st, {push:null,sheet:null,subsheet:null,flash:'Backup importado',confirm:null,showOnboarding:false}));
        }catch(e){
          this.flashMsg('El archivo no es compatible o tiene datos incompletos');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  parseCsv(text){
    const rows=[];let row=[],cell='',q=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i],nx=text[i+1];
      if(q){if(ch==='"'&&nx==='"'){cell+='"';i++;}else if(ch==='"'){q=false;}else cell+=ch;}
      else if(ch==='"')q=true;
      else if(ch===','){row.push(cell);cell='';}
      else if(ch==='\n'){row.push(cell);rows.push(row);row=[];cell='';}
      else if(ch!=='\r')cell+=ch;
    }
    row.push(cell);rows.push(row);
    return rows.filter(r=>r.some(c=>String(c).trim()!==''));
  }
  pickCsvFile(){
    const input=document.createElement('input');
    input.type='file';input.accept='.csv,text/csv';
    input.onchange=()=>{
      const file=input.files&&input.files[0];
      if(!file)return;
      const reader=new FileReader();
      reader.onload=()=>{
        try{this.importCsv(String(reader.result||''));}
        catch(e){console.warn('FinanzApp: CSV inválido',e);this.flashMsg(String(e&&e.message||'').startsWith('unsupported-type-')?'Ese CSV tiene tarjetas, transferencias o inversiones · usá el backup JSON':'CSV inválido');}
      };
      reader.readAsText(file);
    };
    input.click();
  }
  importCsv(text){
    const rows=this.parseCsv(text);
    if(rows.length<2)throw new Error('empty-csv');
    const headers=rows[0].map(h=>String(h).replace(/^\ufeff/,'').trim().toLowerCase());
    const idx=(names)=>names.map(n=>headers.indexOf(n)).find(i=>i>=0);
    const iDate=idx(['fecha','date']),iType=idx(['tipo','type']),iMerchant=idx(['comercio','merchant','descripcion','descripción','description']),iCat=idx(['categoria','categoría','category']),iAccount=idx(['cuenta','account']),iAmount=idx(['monto','amount']),iCurrency=idx(['moneda','currency']),iNote=idx(['nota','note']),iTags=idx(['tags','etiquetas']);
    if(iAmount==null||iAmount<0)throw new Error('missing-amount');
    const fallbackAcc=this.liquidIds()[0]||this.state.order[0];
    if(!fallbackAcc)throw new Error('missing-account');
    const byCatName={};Object.keys(this.state.categories).forEach(k=>{byCatName[String(this.state.categories[k].name||'').toLowerCase()]=k;});
    const txns=rows.slice(1).map((r,n)=>{
      const amount=window.FinanzDomain.parseMoneyInput(r[iAmount]);if(!isFinite(amount)||amount===0)throw new Error('bad-amount-'+n);
      const typeRaw=iType>=0?String(r[iType]||'').toLowerCase():'';
      const type=window.FinanzDomain.classifyImportedTransactionType(typeRaw,amount);if(!type)throw new Error('unsupported-type-'+n);
      const catName=iCat>=0?String(r[iCat]||'').trim():'';
      const cat=byCatName[catName.toLowerCase()]||(type==='ingreso'?'ingreso':'otros');
      const accName=iAccount>=0?String(r[iAccount]||'').trim().toLowerCase():'';
      const acc=Object.keys(this.state.accounts).find(k=>String(this.state.accounts[k].name||'').toLowerCase()===accName)||fallbackAcc;
      const val=Math.abs(amount);
      const tags=iTags>=0?String(r[iTags]||'').split('|').map(t=>t.trim().toLowerCase().replace(/^#/,'')).filter(Boolean):[];
      const rawDate=iDate>=0&&r[iDate]?String(r[iDate]).trim():'Hoy';
      const dateISO=window.FinanzDomain.isoFromLabel(rawDate);
      const currency=iCurrency>=0&&String(r[iCurrency]||'').toUpperCase()==='USD'?'USD':((this.state.accounts[acc]||{}).currency||'ARS');
      return {type,merchant:(iMerchant>=0&&r[iMerchant]?String(r[iMerchant]).trim():(this.state.categories[cat]||{}).name)||'Movimiento',cat,amount:type==='ingreso'?val:-val,val,currency,account:acc,dateLabel:window.FinanzDomain.labelFromISO(dateISO),dateISO,note:iNote>=0?String(r[iNote]||'').trim():'',tags};
    });
    this.setState(s=>{let b={...s.balances},ct={...s.categoryTotals},mi=s.monthIncome,me=s.monthExpense,next=s._next;const withIds=txns.map(t=>{const nt={...t,id:next++};const a=this._apply(nt,b,ct,mi,me);b=a.b;ct=a.ct;mi=a.mi;me=a.me;return nt;});return{txns:[...withIds,...s.txns],balances:b,categoryTotals:ct,monthIncome:mi,monthExpense:me,_next:next,sheet:null,flash:'CSV importado'};});
  }
  emptyData(){
    const cats={};this.DEFAULT_CAT_ORDER.concat(['pago']).forEach(k=>{cats[k]={...this.BASECATS[k]};});
    return {categories:cats,catOrder:this.DEFAULT_CAT_ORDER.slice(),
      txns:[],categoryTotals:{},budgets:{},monthIncome:0,monthExpense:0,
      order:[],accounts:{},archived:{},balances:{},accMeta:{},
      cards:[],tagSugg:[],_next:1,assets:{},loans:[],recurring:[],goals:[],history:[],usdRate:0,lastBackupAt:null,backupDismissedAt:null};
  }
  clearAll(){try{[this.STORAGE_KEY,this.STORAGE_BACKUP_KEY,this.STORAGE_TEMP_KEY,this.STORAGE_QUARANTINE_KEY,this.LEGACY_STORAGE_KEY,'finanzapp:mod'].forEach(key=>localStorage.removeItem(key));}catch(e){}this._persistRevision=0;this._persistLegacy=false;this._lastPersistedStateJson='';this.setState(Object.assign({push:null,sheet:null,subsheet:null,tab:'inicio',showOnboarding:false,cardIdx:0,cardView:0,detailId:null,acctView:null,investView:null,confirm:null,flash:'Datos borrados · empezás de cero'},this.emptyData()));}
  finishOnboarding(){this.setState(s=>{let cards=s.cards,order=s.order,accounts=s.accounts,balances=s.balances,next=s._next;
    if(s.onbCard){const card={id:'card_'+next,brand:'Visa',bank:'Mi tarjeta',last4:'0000',saldo:0,statementPaid:0,statementAdjustment:0,pendingAdjustment:0,limit:200000,cierre:'—',vence:'—',grad:this.CARDGRADS[cards.length%this.CARDGRADS.length],compras:[],cuotas:[],pendientes:[],pagos:[]};cards=[...cards,card];next++;}
    if(s.onbInvest){const id='acc_inv_'+next;accounts={...accounts,[id]:{name:'Inversiones',type:'Inversión',kind:'invest',liquid:false,currency:s.currency,emoji:'📈',iconVar:'--cat-inversion-icon',fillVar:'--cat-inversion-fill'}};order=[...order,id];balances={...balances,[id]:0};next++;}
    return{cards,order,accounts,balances,_next:next,showOnboarding:false,onbStep:0,tab:'inicio',push:null,flash:'¡Listo! Empezá a registrar'};});}
  fmtNum(n){return window.FinanzDomain.fmtNum(n);}
  fmtInt(n){return window.FinanzDomain.fmtInt(n);}
  // Format a raw numeric input string with Argentine thousands dots as the user types.
  fmtThousands(s){if(s==null)return '';s=String(s);const neg=s[0]==='-';s=s.replace('-','');const p=s.split(',');p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,'.');return (neg?'-':'')+p.join(',');}
  cleanNum(s){return String(s||'').replace(/[^0-9,]/g,'').replace(/,(?=.*,)/g,'');}
  parseNum(s){return parseFloat(String(s||'').replace(/\./g,'').replace(',','.'))||0;}
  // Pick the investment account that matches an asset type (crypto vs stocks).
  accountForType(type){const s=this.state;const inv=this.investIds();const crypto=type==='Cripto'||type==='Bitcoin';const m=inv.find(k=>{const a=s.accounts[k]||{};const t=((a.type||'')+' '+(a.name||'')).toLowerCase();const isC=/crip|binance|btc|bitcoin|eth/.test(t);return crypto?isC:!isC;});return m||inv[0]||'';}
  signed(n){return window.FinanzDomain.signed(n);}
  abbr(n){return window.FinanzDomain.abbr(n);}
  displayAmount(raw){return window.FinanzDomain.displayAmount(raw);}
  sumIds(ids){return window.FinanzDomain.sumIds(this.state.balances,ids);}
  liquidIds(s){return window.FinanzDomain.liquidIds(s||this.state);}
  investIds(s){return window.FinanzDomain.investIds(s||this.state);}
  debtIds(s){return window.FinanzDomain.debtIds(s||this.state);}
  cardDebt(s){return window.FinanzDomain.cardDebt(s||this.state);}
  _todayKey(){return window.FinanzDomain.todayKey();}
  toggleHeroCurrency(){if(this.state.heroCurrency==='ARS'&&!this.state.usdRate){this.flashMsg('Actualizando dólar cripto…');this.fetchPrices(true);return;}this.setState(s=>({heroCurrency:s.heroCurrency==='USD'?'ARS':'USD'}));}
  computeNetWorth(){const s=this.state,FD=window.FinanzDomain;const liquid=FD.sumAccountsARS(this.liquidIds(s),s.balances,s.accounts,s.usdRate,s.assets),fci=FD.spendableFciValueARS(s,s.usdRate),disp=liquid+fci,inv=FD.sumAccountsARS(this.investIds(s),s.balances,s.accounts,s.usdRate,s.assets),debt=FD.sumAccountsARS(this.debtIds(s),s.balances,s.accounts,s.usdRate,s.assets)+this.cardDebt(s);return{liquid,fci,disp,inv,debt,pat:liquid+inv-debt};}
  // Build an SVG line+area path from a value series (shared by charts).
  sparkPath(vals,W,H,PAD){const n=vals.length;if(n<2)return null;const min=Math.min.apply(null,vals),max=Math.max.apply(null,vals),span=(max-min)||1;const xa=i=>(i/(n-1))*W,ya=v=>PAD+(1-(v-min)/span)*(H-2*PAD);let d='M '+xa(0).toFixed(1)+' '+ya(vals[0]).toFixed(1);for(let i=1;i<n;i++)d+=' L '+xa(i).toFixed(1)+' '+ya(vals[i]).toFixed(1);return{path:d,area:d+' L '+W+' '+H+' L 0 '+H+' Z',min,max};}
  // Upsert today's net-worth snapshot (one per day), capped to a year of history.
  recordSnapshot(){const nw=this.computeNetWorth(),key=this._todayKey(),hist=(this.state.history||[]).slice(),last=hist[hist.length-1],entry={d:key,pat:nw.pat,disp:nw.disp,inv:nw.inv};if(last&&last.d===key){if(last.pat===entry.pat&&last.disp===entry.disp&&last.inv===entry.inv)return;hist[hist.length-1]=entry;}else{hist.push(entry);}while(hist.length>365)hist.shift();this._passiveUpdate=true;this.setState({history:hist});}
  flashMsg(m){this.setState({flash:m});/* dismissal handled centrally in componentDidUpdate */}
  requestConfirm(cfg){this.setState({confirm:cfg});}
  doConfirm(){const c=this.state.confirm;this.setState({confirm:null});if(c&&c.onConfirm)c.onConfirm();}
  cancelConfirm(){const c=this.state.confirm;this.setState({confirm:null});if(c&&c.onCancel)c.onCancel();}
  resetData(){this.clearAll();}
  selectCard(i){this.setState({cardIdx:i});const el=this.carouselRef.current;if(el)el.scrollTo({left:i*310,behavior:'smooth'});}
  onCardScroll(e){const el=e.currentTarget;if(!el)return;const left=el.scrollLeft;clearTimeout(this._cardScrollT);
    // Debounce: only update the active card AFTER scrolling settles, so the native
    // CSS scroll-snap finishes instead of being interrupted mid-swipe by a re-render
    // (which left the view stuck between two cards).
    this._cardScrollT=setTimeout(()=>{const i=Math.max(0,Math.min((this.state.cards||[]).length-1,Math.round(left/310)));if(i!==this.state.cardIdx)this.setState({cardIdx:i});},110);}
  openAddPreset(type,from,to){const liq=this.liquidIds(),inv=this.investIds();this.setState({sheet:'add',push:null,subsheet:null,addType:type,addAmount:'',addTitle:'',addNote:'',addCat:type==='ingreso'?'ingreso':'comida',addAccount:from||liq[0]||inv[0]||'',addTo:to||inv[0]||liq.find(k=>k!==from)||liq[0]||'',addDate:'Hoy',addDateISO:this._todayKey(),addTags:[],addCatTouched:false,addSuggestedKey:null,addSuggestedTags:[],editId:null,shortcutCapture:false});}
  openAddAccount(editId){const s=this.state;if(editId){const a=s.accounts[editId];this.setState({push:'addAccount',newAcc:{name:a.name,type:a.type,kind:a.kind,balance:String(s.balances[editId]||0).replace('.',','),currency:a.currency,liquid:a.liquid,editId}});}else{this.setState({push:'addAccount',newAcc:{name:'',type:'Banco',kind:'liquid',balance:'',currency:'ARS',liquid:true,editId:null}});}}
  setNewAcc(patch){this.setState(s=>({newAcc:{...s.newAcc,...patch}}));}
  addAccountSave(fromOnb){const n=this.state.newAcc;if(!n.name.trim()){this.flashMsg('Poné un nombre');return;}const tm=this.ACCTYPES.find(t=>t[0]===n.type)||['Banco','liquid','🏦'];const kind=tm[1];const liquid=kind==='liquid'?n.liquid:false;const bal=parseFloat((n.balance||'0').replace(/\./g,'').replace(',','.'))||0;
    this.setState(s=>{const pal=this.PALETTE[s.order.length%this.PALETTE.length];if(n.editId){const acc={...s.accounts[n.editId],name:n.name.trim(),type:n.type,kind,liquid,currency:n.currency,emoji:tm[2]};return{accounts:{...s.accounts,[n.editId]:acc},balances:{...s.balances,[n.editId]:bal},push:fromOnb?null:'accountDetail',acctView:n.editId,flash:'Cuenta actualizada'};}
      const id='acc'+s._next+'_'+(s.order.length);const acc={name:n.name.trim(),type:n.type,kind,liquid,currency:n.currency,emoji:tm[2],iconVar:pal[0],fillVar:pal[1]};return{order:[...s.order,id],accounts:{...s.accounts,[id]:acc},balances:{...s.balances,[id]:bal},_next:s._next+1,push:null,tab:fromOnb?s.tab:'cuentas',flash:'Cuenta creada',newAcc:{name:'',type:'Banco',kind:'liquid',balance:'',currency:'ARS',liquid:true,editId:null}};});}
  archiveAccount(k){if(!this.state.accounts[k]){this.flashMsg('Cuenta no encontrada');return;}this.setState(s=>({archived:{...s.archived,[k]:true},push:null,tab:'cuentas',flash:'Cuenta archivada'}));}
  deleteAccount(k){const fciAutopay=this.state.cards.some(c=>{const parsed=window.FinanzDomain.parseFciSpendSourceId(c.autopayAccount);return parsed&&parsed.accountId===k;});if((this.state.assets[k]||[]).some(asset=>(Number(asset.qty)||0)>0)||this.state.txns.some(t=>[t.account,t.from,t.to,t.cashAccount,t.portfolio].indexOf(k)>=0)||this.state.recurring.some(r=>r.targetKind==='account'&&r.targetId===k)||this.state.cards.some(c=>c.autopayAccount===k)||fciAutopay){this.flashMsg('Archivá la cuenta para conservar inversiones, movimientos y automatizaciones');return;}this.setState(s=>{const order=s.order.filter(x=>x!==k),accounts={...s.accounts},balances={...s.balances},assets={...s.assets},accMeta={...s.accMeta},archived={...s.archived};delete accounts[k];delete balances[k];delete assets[k];delete accMeta[k];delete archived[k];return{order,accounts,balances,assets,accMeta,archived,push:null,tab:'cuentas',flash:'Cuenta eliminada'};});}
  payCardSave(){const S=this.state;const v=parseFloat(S.payAmount.replace(',','.'))||0;if(!v){this.flashMsg('Ingresá un monto');return;}if(!this.spendSourceMeta(S.payAccount,S)){this.flashMsg('Elegí una cuenta o FCI');return;}const idx=S.cardView;const card=S.cards[idx];if(!card){this.flashMsg('Elegí una tarjeta');return;}
    if(v>(Number(card.saldo)||0)+0.01){this.flashMsg('El pago supera la deuda total de la tarjeta');return;}
    const preview=window.FinanzDomain.fundCardPayment(S,S.payAccount,v,S.usdRate);if(!preview.ok){this.flashMsg(this.paymentFundingMessage(preview));if(preview.error==='missing-rate')this.fetchPrices(true);return;}
    const resumen=this.cardResumen(card);const full=v+0.005>=resumen&&resumen>0;
    this.setState(s=>{const funded=window.FinanzDomain.fundCardPayment(s,s.payAccount,v,s.usdRate);if(!funded.ok)return{flash:this.paymentFundingMessage(funded)};const current=s.cards[idx];if(!current)return{flash:'La tarjeta ya no existe'};const today=new Date(),pago={name:'Pago '+current.brand,monto:v,date:'Hoy',dateISO:this._todayKey(),txnId:s._next};
      const cs=s.cards.map((c,i)=>i===idx?this._applyCardPayment({...c,pagos:[pago,...(c.pagos||[])]},v,new Date()):c);
      const t={id:s._next,type:'pago',merchant:'Pago '+current.brand,cat:'pago',amount:-v,val:v,currency:'ARS',...funded.transaction,card:current.id,cardRollback:this.snapshotCard(current),paymentCycle:this._dueCycle(current,today),closesStatement:full,isTransfer:true,dateLabel:'Hoy',dateISO:this._todayKey(),note:'Pago de tarjeta',tags:[]};return{cards:cs,assets:funded.assets,balances:funded.balances,txns:[t,...s.txns],_next:s._next+1,push:'cardDetail',payAmount:'',flash:full?'Resumen pagado · no se repetirá al vencer':'Pago registrado'};});}
  cardResumen(c){return window.FinanzDomain.cardStatementTotal(c);}
  snapshotCard(c){return c?{saldo:Number(c.saldo)||0,statementPaid:Number(c.statementPaid)||0,statementAdjustment:Number(c.statementAdjustment)||0,pendingAdjustment:Number(c.pendingAdjustment)||0,compras:(c.compras||[]).map(row=>({...row})),cuotas:(c.cuotas||[]).map(row=>({...row})),pendientes:(c.pendientes||[]).map(row=>({...row})),pagos:(c.pagos||[]).map(row=>({...row})),cierre:c.cierre,vence:c.vence,cierreDay:c.cierreDay,venceDay:c.venceDay,paidCycle:c.paidCycle,previousClose:c.previousClose,previousDue:c.previousDue}:null;}
  _cycleKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');}
  _monthLabel(d){return d.getDate()+' '+this._MONTHS[d.getMonth()];}
  // Parse a card label like "13 jul" into a real Date near `ref`, picking the
  // closest occurrence within ±6 months. Critical for auto-pay: read on 30 jun,
  // "13 jul" must resolve to the coming 13 Jul — NOT be treated as day-13 of the
  // current month (which made auto-pay fire a month early and double-charge).
  _parseDate(label,ref){return window.FinanzDomain.parseDate(label,ref);}
  // Advance a "13 jul" label by one month, keeping the day.
  _advanceLabel(label,ref,preferredDay){const d=this._parseDate(label,ref||new Date());if(!d)return label;const raw=Number(preferredDay)||Number((String(label||'').match(/\d{1,2}/)||[])[0])||d.getDate();const n=window.FinanzDomain.monthlyDate(d.getFullYear(),d.getMonth()+1,raw);return n.getDate()+' '+this._MONTHS[n.getMonth()];}
  // The settlement cycle a card's statement belongs to, keyed by its due month.
  _dueCycle(c,ref){return this._cycleKey(this._parseDate((c||{}).vence,ref||new Date())||ref||new Date());}
  _nextOccur(day,from){return window.FinanzDomain.nextMonthlyOccurrence(day,from);}
  _closeCycleCard(c,today,clearAll=false){const cuotas=clearAll?[]:(c.cuotas||[]).map(q=>({...q,cur:q.cur+1})).filter(q=>q.cur<=q.tot);return {...c,cuotas,compras:[],pendientes:clearAll?[]:[...(c.pendientes||[])],statementPaid:0,statementAdjustment:0,pendingAdjustment:clearAll?0:(Number(c.pendingAdjustment)||0),previousClose:c.cierre,previousDue:c.vence,vence:this._advanceLabel(c.vence,today,c.venceDay),cierre:this._advanceLabel(c.cierre,today,c.cierreDay),paidCycle:this._dueCycle(c,today)};}
  _applyCardPayment(c,payment,today){const paid=Math.max(0,Number(payment)||0);let next={...c,saldo:Math.max(0,(Number(c.saldo)||0)-paid),statementPaid:Math.max(0,Number(c.statementPaid)||0)+paid};
    if(next.saldo<=0.005)return this._closeCycleCard({...next,saldo:0},today,true);
    let guard=0;while(guard++<120){const gross=window.FinanzDomain.cardStatementGross(next);if(gross<=0.005||next.statementPaid+0.005<gross)break;const credit=Math.max(0,next.statementPaid-gross);next=this._closeCycleCard(next,today);next.statementPaid=credit;}
    return next;
  }
  scheduleAutomationCheck(){clearTimeout(this._automationTimer);const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,2,0);this._automationTimer=setTimeout(()=>{this.runAutomations();this.scheduleAutomationCheck();},Math.max(1000,next-now));}
  // Runs on app open, wake and local midnight: posts due recurring movements and
  // auto-pays cards whose due day passed (idempotent via nextDate / paidCycle).
  runAutomations(){const today=new Date();today.setHours(0,0,0,0);
    this.setState(s=>{let txns=s.txns,balances={...s.balances},assets=s.assets,cards=s.cards.map(c=>({...c})),next=s._next,categoryTotals={...s.categoryTotals},monthIncome=s.monthIncome,monthExpense=s.monthExpense,changed=false,posted=0;
      const recurring=(s.recurring||[]).map(r=>{if(!r.active)return r;if(r.type==='ingreso'&&r.targetKind==='card')return{...r,active:false};let nd=r.nextDate?new Date(r.nextDate):this._nextOccur(r.day,today);if(Number.isNaN(nd.getTime()))nd=this._nextOccur(r.day,today);nd.setHours(0,0,0,0);const out={...r};let guard=0;
        while(nd<=today&&guard<60){guard++;const lbl=this._monthLabel(nd),iso=window.FinanzDomain.todayKey(nd);
          if(r.targetKind==='card'){const ci=cards.findIndex(c=>c.id===r.targetId);if(ci>=0){const c=cards[ci];cards[ci]={...c,saldo:(c.saldo||0)+r.amount,compras:[{name:r.concept||'Recurrente',monto:r.amount,date:lbl,dateISO:iso,txnId:next},...(c.compras||[])]};categoryTotals={...categoryTotals,[r.cat]:(categoryTotals[r.cat]||0)+r.amount};monthExpense+=r.amount;txns=[{id:next,type:'gasto',merchant:r.concept||'Recurrente',cat:r.cat,amount:-r.amount,val:r.amount,currency:'ARS',card:r.targetId,onCard:true,dateLabel:lbl,dateISO:iso,note:'Recurrente · '+c.brand,tags:['recurrente']},...txns];next++;posted++;changed=true;}}
          else{const acc=r.targetId;if(!s.archived[acc]&&(balances[acc]!=null||s.accounts[acc])){const currency=(s.accounts[acc]||{}).currency||'ARS';if(r.type==='ingreso'){balances[acc]=(balances[acc]||0)+r.amount;monthIncome+=r.amount;txns=[{id:next,type:'ingreso',merchant:r.concept||'Recurrente',cat:r.cat||'ingreso',amount:r.amount,val:r.amount,currency,account:acc,dateLabel:lbl,dateISO:iso,note:'Recurrente',tags:['recurrente']},...txns];}else{balances[acc]=(balances[acc]||0)-r.amount;categoryTotals={...categoryTotals,[r.cat]:(categoryTotals[r.cat]||0)+r.amount};monthExpense+=r.amount;txns=[{id:next,type:'gasto',merchant:r.concept||'Recurrente',cat:r.cat,amount:-r.amount,val:r.amount,currency,account:acc,dateLabel:lbl,dateISO:iso,note:'Recurrente',tags:['recurrente']},...txns];}next++;posted++;changed=true;}}
          nd=window.FinanzDomain.monthlyDate(nd.getFullYear(),nd.getMonth()+1,r.day);}
        out.nextDate=nd.toISOString();return out;});
      cards=cards.map(c=>{if(!c.autopay||!c.autopayAccount)return c;const due=this._parseDate(c.vence,today);const cyc=this._cycleKey(due||today);if(c.paidCycle===cyc)return c;if(!due||today<due)return c;const resumen=this.cardResumen(c);if(resumen<=0){const gross=window.FinanzDomain.cardStatementGross(c);return gross>0||Number(c.statementPaid)>0?this._applyCardPayment(c,0,today):this._closeCycleCard(c,today);}const rollback=this.snapshotCard(c),funded=window.FinanzDomain.fundCardPayment({...s,balances,assets},c.autopayAccount,resumen,s.usdRate);if(!funded.ok)return c;balances=funded.balances;assets=funded.assets;const paymentISO=window.FinanzDomain.todayKey(today);txns=[{id:next,type:'pago',merchant:'Pago '+c.brand,cat:'pago',amount:-resumen,val:resumen,currency:'ARS',...funded.transaction,card:c.id,cardRollback:rollback,paymentCycle:cyc,closesStatement:true,isTransfer:true,dateLabel:this._monthLabel(today),dateISO:paymentISO,note:'Pago automático desde '+((this.spendSourceMeta(c.autopayAccount,{...s,assets})||{}).name||'origen elegido'),tags:['automatico']},...txns];const paymentId=next;next++;posted++;changed=true;return this._applyCardPayment({...c,pagos:[{name:'Pago automático',monto:resumen,date:this._monthLabel(today),dateISO:paymentISO,txnId:paymentId},...(c.pagos||[])]},resumen,today);});
      if(!changed)return {recurring};
      return {recurring,cards,assets,balances,txns,_next:next,categoryTotals,monthIncome,monthExpense,flash:posted?('Se aplicaron '+posted+' movimiento'+(posted>1?'s':'')+' automático'+(posted>1?'s':'')):''};
    });}
  payPress(d){this.setState(s=>{let r=s.payAmount;if(d==='back')return{payAmount:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{payAmount:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{payAmount:r+d};});}
  openCardPurchase(idx,transaction=null){const cardIndex=Number.isInteger(idx)?idx:0;if(transaction){const installments=Math.max(1,Number((String(transaction.note||'')+' '+String(transaction.merchant||'')).match(/(\d+)\s+cuotas/i)?.[1])||1);const merchant=String(transaction.merchant||'').replace(/\s*·\s*cuota\s+\d+\/\d+\s*$/i,'').trim();const dateISO=transaction.dateISO||window.FinanzDomain.isoFromLabel(transaction.dateLabel);this.setState({push:'cardPurchase',sheet:null,subsheet:null,cpSub:null,cpCard:cardIndex,cpAmount:String(Number(transaction.val)||0).replace('.',','),cpMerchant:merchant,cpCat:transaction.cat||'compras',cpDate:window.FinanzDomain.labelFromISO(dateISO),cpDateISO:dateISO,cpInstall:installments,cpStatus:transaction.cardPending?'pending':'posted',cpEditId:transaction.id});return;}this.setState({push:'cardPurchase',sheet:null,subsheet:null,cpSub:null,cpCard:cardIndex,cpAmount:'',cpMerchant:'',cpCat:'compras',cpDate:'Hoy',cpDateISO:this._todayKey(),cpInstall:1,cpStatus:'posted',cpEditId:null});}
  cpPress(d){this.setState(s=>{let r=s.cpAmount;if(d==='back')return{cpAmount:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{cpAmount:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{cpAmount:r+d};});}
  savePurchase(){const S=this.state;const val=parseFloat((S.cpAmount||'').replace(',','.'))||0;if(!val){this.flashMsg('Ingresá un monto');return;}const idx=S.cpCard;const card=S.cards[idx];if(!card){this.flashMsg('Agregá una tarjeta primero');return;}if(!S.categories[S.cpCat]){this.flashMsg('Elegí una categoría');return;}const n=Math.max(1,Number(S.cpInstall)||1),status=S.cpStatus==='pending'?'pending':'posted';const merchant=S.cpMerchant.trim()||(this.state.categories[S.cpCat]?this.state.categories[S.cpCat].name:'Compra');const label=n>1?(merchant+' · cuota 1/'+n):merchant;const dateISO=window.FinanzDomain.isoFromLabel(S.cpDateISO||S.cpDate);const dateLabel=window.FinanzDomain.labelFromISO(dateISO);
    this.setState(s=>{const editing=S.cpEditId!=null,old=editing?s.txns.find(t=>String(t.id)===String(S.cpEditId)):null,id=old?old.id:s._next;let cards=s.cards,txns=s.txns,ct={...s.categoryTotals},monthExpense=s.monthExpense;
      if(editing){if(!old||!old.onCard)return{flash:'No encontré la compra original; no se cambió nada'};let removed=false;cards=cards.map(c=>{if(c.id!==old.card)return c;const result=window.FinanzDomain.removeCardPurchase(c,old);if(result.removed)removed=true;return result.card;});if(!removed)return{flash:'No pude vincular la compra con su tarjeta; no se cambió nada'};ct[old.cat]=Math.max(0,(ct[old.cat]||0)-(Number(old.val)||0));monthExpense=Math.max(0,monthExpense-(Number(old.val)||0));}
      cards=cards.map((c,i)=>i===idx?window.FinanzDomain.addCardPurchase(c,{amount:val,installments:n,merchant,date:dateLabel,dateISO,txnId:id,status}):c);ct[S.cpCat]=(ct[S.cpCat]||0)+val;monthExpense+=val;
      const note=(status==='pending'?'Pendiente · ':'Tarjeta ')+card.brand+(n>1?' · '+n+' cuotas':'');const t={...(old||{}),id,type:'gasto',merchant:label,cat:S.cpCat,amount:-val,val,currency:'ARS',card:card.id,onCard:true,cardPending:status==='pending',dateLabel,dateISO,note,tags:(old&&old.tags)||[]};txns=editing?txns.map(row=>String(row.id)===String(id)?t:row):[t,...txns];
      return{cards,categoryTotals:ct,monthExpense,txns,_next:editing?s._next:s._next+1,push:'cardDetail',cardView:idx,detailId:null,cpEditId:null,flash:editing?'Compra actualizada':status==='pending'?'Compra guardada como pendiente':n>1?'Compra en cuotas registrada':'Compra registrada'};});}
  postPendingPurchase(cardIndex,transactionId){this.setState(s=>{let posted=false;const cards=s.cards.map((card,index)=>{if(index!==cardIndex)return card;const result=window.FinanzDomain.postPendingCardPurchase(card,transactionId);if(result.posted)posted=true;return result.card;});if(!posted)return{flash:'Ese consumo ya no está pendiente'};const card=cards[cardIndex];const txns=s.txns.map(t=>String(t.id)===String(transactionId)?{...t,cardPending:false,note:String(t.note||'').replace(/^Pendiente\s*·\s*/i,'Tarjeta ')}:t);return{cards,txns,flash:'Consumo contabilizado · la deuda no cambió'};});}
  openAssetTrade(mode,account,type='CEDEAR'){
    const inv=this.investIds(),source=this.liquidIds()[0]||'';const existing=account||this.accountForType(type)||inv[0]||'';
    if(existing){this.pushScreen('assetTrade',{sheet:null,subsheet:null,atSub:null,atMode:mode||'buy',atAccount:existing,atSource:source,atType:type,atTicker:'',atName:'',atEmoji:'',atSearch:'',atQty:'',atTotal:'',atDateISO:this._todayKey()});return;}
    // A portfolio account is an internal container, not a prerequisite the user
    // should have to understand. Create it automatically with the first holding.
    this.setState(s=>{const id='acc_inv_'+s._next;const pal=this.PALETTE[s.order.length%this.PALETTE.length];return{
      order:[...s.order,id],accounts:{...s.accounts,[id]:{name:'Inversiones',type:'Inversión',kind:'invest',liquid:false,currency:'ARS',emoji:'📈',iconVar:pal[0],fillVar:pal[1]}},balances:{...s.balances,[id]:0},assets:{...s.assets,[id]:[]},_next:s._next+1,
      push:'assetTrade',sheet:null,subsheet:null,atSub:null,atMode:mode||'buy',atAccount:id,atSource:window.FinanzDomain.liquidIds(s)[0]||'',atType:type,atTicker:'',atName:'',atEmoji:'',atSearch:'',atQty:'',atTotal:'',atDateISO:window.FinanzDomain.todayKey(),flash:'Portafolio listo'
    };});
  }
  pickAsset(t,n,e){this.setState({atTicker:t,atName:n||t,atEmoji:e||'📈'});}
  openAssetDetail(account,ticker){this.rememberPushScroll('investments');const r=this.state.assetChartRange||'1M';const asset=(this.state.assets[account]||[]).find(a=>a.ticker===ticker);this.pushScreen('assetDetail',{assetView:{account,ticker},assetChart:{loading:true,ok:false,range:r,motion:0}});setTimeout(()=>this.fetchAssetChart(asset,r),60);}
  setAssetChartRange(range){this.setState({assetChartRange:range});const av=this.state.assetView;if(av){const asset=(this.state.assets[av.account]||[]).find(a=>a.ticker===av.ticker);this.fetchAssetChart(asset,range);}}
  // Historical charts use the provider appropriate to the holding: Yahoo for
  // BYMA instruments, CoinGecko for crypto, and CAFCI data for FCI VCP history.
  fetchAssetChart(asset,range){
    if(!asset){this.setState({assetChart:{loading:false,ok:false,range}});return;}
    const map={'1D':['1d','15m'],'1S':['5d','60m'],'1M':['1mo','1d'],'Máx':['max','1wk']};
    const rr=map[range]||map['1M'];
    // Keep the previous chart visible while loading the new range (no layout jump).
    this.setState(s=>({assetChart:{...s.assetChart,loading:true,range}}));
    const cryptoIds={BTC:'bitcoin',ETH:'ethereum',SOL:'solana',ADA:'cardano',MATIC:'matic-network',DOT:'polkadot'};
    let url='/api/chart?range='+rr[0]+'&interval='+rr[1];
    if(asset.fci&&asset.fundSlug)url+='&provider=fci&fund='+encodeURIComponent(asset.fundSlug);
    else if(cryptoIds[asset.ticker])url+='&provider=coingecko&coin='+encodeURIComponent(cryptoIds[asset.ticker]);
    else{const qt=asset.quoteTicker||asset.ticker;url+='&provider=yahoo&ticker='+encodeURIComponent(qt.indexOf('.')>=0?qt:(qt+'.BA'));}
    fetch(url).then(r=>r.json()).then(j=>{
      if((this.state.assetChart||{}).range!==range)return; // a newer range was requested
      // Keep close+timestamp pairs aligned when dropping gaps.
      const rawC=(j&&j.closes)||[],rawT=(j&&j.times)||[];const pts=[],tms=[];
      for(let i=0;i<rawC.length;i++){if(rawC[i]!=null&&isFinite(rawC[i])){pts.push(rawC[i]);tms.push(rawT[i]||null);}}
      if(pts.length<2){this.setState(s=>({assetChart:{...s.assetChart,loading:false,ok:false,range}}));return;}
      const n=pts.length,min=Math.min.apply(null,pts),max=Math.max.apply(null,pts),span=(max-min)||1;
      const W=320,H=92,PAD=10;const xa=i=>(i/(n-1))*W;const ya=v=>PAD+(1-(v-min)/span)*(H-2*PAD);
      let d='M '+xa(0).toFixed(1)+' '+ya(pts[0]).toFixed(1);for(let i=1;i<n;i++)d+=' L '+xa(i).toFixed(1)+' '+ya(pts[i]).toFixed(1);
      const area=d+' L '+W+' '+H+' L 0 '+H+' Z';
      const up=pts[n-1]>=pts[0];const chg=pts[0]>0?(pts[n-1]-pts[0])/pts[0]*100:0;
      const lbl={'1D':'hoy','1S':'en la semana','1M':'en el mes','Máx':'histórico'}[range]||'';
      // X-axis date/time labels for the ends of the series.
      const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const fmtT=ts=>{if(!ts)return'';const dt=new Date(ts*1000);return range==='1D'?(String(dt.getHours()).padStart(2,'0')+':'+String(dt.getMinutes()).padStart(2,'0')):(dt.getDate()+' '+MES[dt.getMonth()]+(range==='Máx'?" '"+String(dt.getFullYear()).slice(-2):''));};
      const prefix=(j&&j.currency)==='USD'?'US$':'$';
      this.setState(s=>({assetChart:{loading:false,ok:true,range,path:d,area,up,changeStr:(chg>=0?'+':'')+chg.toFixed(1).replace('.',',')+'% '+lbl,maxStr:prefix+this.fmtInt(max),minStr:prefix+this.fmtInt(min),startLabel:fmtT(tms[0]),endLabel:fmtT(tms[n-1]),motion:(Number(s.assetChart.motion)||0)+1}}));
    }).catch(()=>{if((this.state.assetChart||{}).range===range)this.setState(s=>({assetChart:{...s.assetChart,loading:false,ok:false}}));});
  }
  setAtType(type){this.setState({atType:type,atAccount:this.accountForType(type),atTicker:'',atName:'',atEmoji:'',atSearch:''});}
  tradeAsset(mode,account,a){const isC=(this.CRYPTOS||[]).some(x=>x[0]===a.ticker);const isB=(this.BONOS||[]).some(x=>x[0]===a.ticker)||a.unitDivisor===100;const atType=a.fci?'FCI':isC?'Cripto':isB?'Bono/ON':'CEDEAR';this.pushScreen('assetTrade',{sheet:null,subsheet:null,atSub:null,atMode:mode,atAccount:account,atSource:this.liquidIds()[0]||'',atType,atTicker:a.ticker,atName:a.name,atEmoji:a.emoji,atSearch:'',atQty:'',atTotal:'',atDateISO:this._todayKey()});}
  saveAssetTrade(){const S=this.state,FD=window.FinanzDomain,total=this.parseNum(S.atTotal),mode=S.atMode,adjust=mode==='adjust',buy=mode==='buy',inv=S.atAccount,ticker=(S.atTicker.trim()||S.atType).toUpperCase();const existing=(S.assets[inv]||[]).find(a=>a.ticker===ticker),fciMeta=this.FCI_META[ticker]||null;const divisor=existing?FD.assetUnitDivisor(existing):(S.atType==='Bono/ON'?100:1);const quoteCurrency=existing?FD.assetQuoteCurrency(existing):(S.atType==='Cripto'?'USD':'ARS');const unitARS=existing?FD.assetUnitValueARS(existing,S.usdRate):0;let qty=this.parseNum(S.atQty);if(existing&&existing.fci&&!adjust&&!qty&&total>0&&unitARS>0)qty=total/unitARS;
    if(!S.accounts[inv]){this.flashMsg('Elegí una cuenta de inversión');return;}
    if(!String(S.atTicker||'').trim()){this.flashMsg('Elegí un activo');return;}
    if(adjust){if(S.atQty===''){this.flashMsg('Ingresá la tenencia real');return;}if(S.atTotal===''){this.flashMsg('Ingresá el valor actual total');return;}}
    else{if(!qty){this.flashMsg('Ingresá la cantidad');return;}if(!total){this.flashMsg(buy?'Ingresá cuánto pagaste':'Ingresá cuánto recibiste');return;}if(!S.accounts[S.atSource]){this.flashMsg(buy?'Elegí con qué cuenta pagaste':'Elegí dónde acreditaste la venta');return;}}
    if(adjust&&((qty<=0)!==(total<=0))){this.flashMsg('Para quitar el activo, poné 0 en tenencia y valor. Si lo conservás, ambos deben ser mayores a cero.');return;}
    if(!adjust&&!buy&&(!existing||qty>Number(existing.qty)+0.000001)){this.flashMsg(!existing?'No tenés ese activo':'No podés vender más de lo que tenés');return;}
    const source=S.accounts[S.atSource],sourceCurrency=(source&&source.currency)||'ARS';if(!adjust&&sourceCurrency!==quoteCurrency&&!S.usdRate){this.flashMsg('Actualizá la cotización antes de convertir monedas');this.fetchPrices(true);return;}const cashAmount=adjust?0:FD.convertCurrency(total,quoteCurrency,sourceCurrency,S.usdRate);if(buy&&(S.balances[S.atSource]||0)+0.005<cashAmount){this.flashMsg('La cuenta elegida no tiene saldo suficiente. Si ya tenés el activo, usá Conciliar.');return;}
    const unit=qty>0?total/qty*divisor:0,emojiMap={'Bitcoin':'🪙','Cripto':'🔮','CEDEAR':'📈','Bono/ON':'🏛️','Renta fija':'🔒','FCI':'◉'};
    this.setState(s=>{const na={...s.assets},aa=[...(na[inv]||[])],xi=aa.findIndex(a=>a.ticker===ticker),before=xi>=0?aa[xi]:null,beforeQty=before?Number(before.qty)||0:0,beforeValue=before?FD.assetValueARS(before,s.usdRate):0;
      if(adjust){if(qty<=0&&total<=0){if(xi>=0)aa.splice(xi,1);}else if(xi>=0){const ex=aa[xi],qtyChanged=Math.abs(qty-(Number(ex.qty)||0))>0.000001;aa[xi]={...ex,qty,units:ex.fci?qty:ex.units,lastPrice:unit,lastPriceARS:quoteCurrency==='ARS'?unit:null,lastVcp:ex.fci?unit:ex.lastVcp,costUnknown:qtyChanged?true:ex.costUnknown,quoteSource:'Conciliación manual',quoteQuality:'manual',quoteAsOf:new Date().toISOString()};}else{aa.push({id:'a'+s._next,ticker,name:S.atName||ticker,emoji:S.atEmoji||emojiMap[S.atType]||'📈',qty,units:S.atType==='FCI'?qty:undefined,avg:unit,lastPrice:unit,lastPriceARS:quoteCurrency==='ARS'?unit:null,quoteCurrency,costCurrency:quoteCurrency,unitDivisor:divisor,costUnknown:true,...(fciMeta||{}),priceProvider:fciMeta?'cafci':S.atType==='Cripto'?'binance':'data912',quoteSource:'Conciliación manual',quoteQuality:'manual',quoteAsOf:new Date().toISOString()});}}
      else if(buy){if(xi>=0){const ex=aa[xi],nq=Number(ex.qty)+qty,oldNativeCost=Number(ex.qty)*Number(ex.avg||0)/FD.assetUnitDivisor(ex);aa[xi]={...ex,qty:nq,units:ex.fci?nq:ex.units,avg:(oldNativeCost+total)/nq*FD.assetUnitDivisor(ex),costUnknown:false};}else{aa.push({id:'a'+s._next,ticker,name:S.atName||ticker,emoji:S.atEmoji||emojiMap[S.atType]||'📈',qty,units:S.atType==='FCI'?qty:undefined,avg:unit,lastPrice:unit,quoteCurrency,costCurrency:quoteCurrency,unitDivisor:divisor,...(fciMeta||{}),priceProvider:fciMeta?'cafci':S.atType==='Cripto'?'binance':'data912',quoteSource:'Operación manual',quoteQuality:'manual',quoteAsOf:new Date().toISOString()});}}
      else{const ex=aa[xi],nq=Number(ex.qty)-qty;if(nq<=0.000001)aa.splice(xi,1);else aa[xi]={...ex,qty:nq,units:ex.fci?nq:ex.units};}
      na[inv]=aa;const nb={...s.balances};if(!adjust)nb[S.atSource]=(nb[S.atSource]||0)+(buy?-cashAmount:cashAmount);const valuation=FD.investmentValuation(aa,s.usdRate);nb[inv]=valuation.valueARS;
      const tradeISO=FD.isoFromLabel(S.atDateISO||this._todayKey()),after=aa.find(a=>a.ticker===ticker),afterValue=after?FD.assetValueARS(after,s.usdRate):0;const labelQty=value=>value<1?value.toFixed(6).replace(/\.?0+$/,''):this.fmtNum(value);const valuePrefix=quoteCurrency==='USD'?'US$':'$';const t=adjust?{id:s._next,type:'ajuste',ticker,aqty:qty,merchant:'Conciliación '+ticker,cat:'inversion',amount:0,val:Math.abs(afterValue-beforeValue),currency:'ARS',portfolio:inv,isTransfer:true,dateLabel:FD.labelFromISO(tradeISO),dateISO:tradeISO,note:'Tenencia '+labelQty(beforeQty)+' → '+labelQty(qty)+' · valor real '+valuePrefix+this.fmtNum(total),tags:['conciliacion'],reconciliation:true}:{id:s._next,type:'inversion',ticker,aqty:qty,merchant:(buy?'Compra ':'Venta ')+ticker,cat:'inversion',amount:buy?-total:total,val:total,currency:quoteCurrency,unitDivisor:divisor,portfolio:inv,cashAccount:S.atSource,cashAmount,cashDirection:buy?'debit':'credit',from:buy?S.atSource:inv,to:buy?inv:S.atSource,isTransfer:true,dateLabel:FD.labelFromISO(tradeISO),dateISO:tradeISO,note:labelQty(qty)+' '+ticker+' · '+valuePrefix+this.fmtNum(total)+' · '+(source?source.name:''),tags:[]};
      return{assets:na,balances:nb,txns:[t,...s.txns],_next:s._next+1,push:'investDetail',investView:inv,flash:adjust?'Tenencia conciliada':buy?'Compra registrada':'Venta registrada'};});
    if(!adjust)setTimeout(()=>this.fetchPrices(true),300);}
  addCustomTag(){const t=this.state.newTagText.trim().toLowerCase().replace(/^#/,'');if(!t)return;this.setState(s=>({tagSugg:s.tagSugg.indexOf(t)>=0?s.tagSugg:[...s.tagSugg,t],addTags:s.addTags.indexOf(t)>=0?s.addTags:[...s.addTags,t],newTagText:'',subsheet:null}));}
  applyCustomDate(){const t=window.FinanzDomain.isoFromLabel(this.state.customDateText);if(!this.state.customDateText.trim())return;this.setState({addDate:window.FinanzDomain.labelFromISO(t),addDateISO:t,customDateText:'',subsheet:null});}
  updateAssetPrice(){const S=this.state;const np=parseFloat((S.atNewPrice||'').replace(',','.'))||0;if(!np){this.flashMsg('Ingresá el nuevo precio');return;}const k=S.investView;this.setState(s=>{const na={...s.assets};const aa=[...(na[k]||[])];const xi=aa.findIndex(a=>a.ticker===S.upTicker);if(xi>=0)aa[xi]={...aa[xi],lastPrice:np,quoteSource:'Manual',quoteQuality:'manual',quoteAsOf:new Date().toISOString(),quoteFetchedAt:new Date().toISOString()};na[k]=aa;const nb={...s.balances};const valuation=window.FinanzDomain.investmentValuation(aa,s.usdRate);if(valuation.complete)nb[k]=valuation.valueARS;return{assets:na,balances:nb,ivSub:null,upTicker:'',atNewPrice:'',flash:'Precio actualizado manualmente'};});}
  openAssetCost(){const S=this.state,av=S.assetView,asset=av&&(S.assets[av.account]||[]).find(row=>row.ticker===av.ticker);let amount='';if(asset&&!asset.costUnknown){const qty=Number(asset.qty)||0,avg=Number(asset.avg)||0,divisor=window.FinanzDomain.assetUnitDivisor(asset),total=qty>0&&avg>0?qty*avg/divisor:0;if(total>0)amount=String(Math.round(total*100)/100).replace('.',',');}this.setState({ivSub:'assetCost',assetCostAmount:amount});}
  saveAssetCost(){const S=this.state,av=S.assetView,total=this.parseNum(S.assetCostAmount);if(!av||!total){this.flashMsg('Ingresá el costo total que pagaste');return;}this.setState(s=>{const rows=[...(s.assets[av.account]||[])],index=rows.findIndex(asset=>asset.ticker===av.ticker);if(index<0)return{flash:'El activo ya no existe',ivSub:null};const asset=rows[index],qty=Number(asset.qty)||0;if(!(qty>0))return{flash:'Primero conciliá la cantidad del activo'};const divisor=window.FinanzDomain.assetUnitDivisor(asset),currency=window.FinanzDomain.assetQuoteCurrency(asset);rows[index]={...asset,avg:total/qty*divisor,costCurrency:currency,costUnknown:false,costSource:'Costo total cargado manualmente',costUpdatedAt:new Date().toISOString()};return{assets:{...s.assets,[av.account]:rows},ivSub:null,assetCostAmount:'',flash:'Costo cargado · rendimiento personal actualizado'};});}
  atNewPricePress(d){this.setState(s=>{let r=s.atNewPrice;if(d==='back')return{atNewPrice:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{atNewPrice:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{atNewPrice:r+d};});}
  setNewLoan(patch){this.setState(s=>({newLoan:{...s.newLoan,...patch}}));}
  openAddLoan(editId){const s=this.state;if(editId!=null){const l=(s.loans||[]).find(x=>x.id===editId);if(l){this.setState({push:'addLoan',newLoan:{person:l.person,direction:l.direction,concept:l.concept,amount:String(l.originalAmount),currency:l.currency,editId}});return;}}this.setState({push:'addLoan',newLoan:{person:'',direction:'me_deben',concept:'',amount:'',currency:'ARS',editId:null}});}
  saveLoan(){const n=this.state.newLoan;if(!n.person.trim()){this.flashMsg('Poné el nombre');return;}const amt=parseFloat((n.amount||'').replace(',','.'))||0;if(!amt){this.flashMsg('Ingresá el monto');return;}this.setState(s=>{const loans=(s.loans||[]).slice();if(n.editId!=null){const idx=loans.findIndex(l=>l.id===n.editId);if(idx>=0){loans[idx]={...loans[idx],person:n.person.trim(),concept:n.concept.trim(),originalAmount:amt,currency:n.currency,direction:n.direction};return{loans,push:'loanDetail',loanView:n.editId,flash:'Préstamo actualizado'};}return{};}const id='l'+s._next;loans.push({id,person:n.person.trim(),direction:n.direction,concept:n.concept.trim(),originalAmount:amt,remaining:amt,currency:n.currency,date:'Hoy',payments:[]});return{loans,_next:s._next+1,push:'loanDetail',loanView:id,flash:'Préstamo guardado'};});}
  openLoanDetail(id){this.setState({push:'loanDetail',loanView:id,loanPayAmount:''});}
  loanPayPress(d){this.setState(s=>{let r=s.loanPayAmount;if(d==='back')return{loanPayAmount:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{loanPayAmount:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{loanPayAmount:r+d};});}
  addLoanPayment(){const S=this.state;const v=parseFloat((S.loanPayAmount||'').replace(',','.'))||0;if(!v){this.flashMsg('Ingresá un monto');return;}this.setState(s=>{const loans=(s.loans||[]).map(l=>{if(l.id!==S.loanView)return l;const rem=Math.max(0,l.remaining-v);return{...l,remaining:rem,payments:[{amount:v,date:'Hoy',note:''},...l.payments]};});return{loans,loanPayAmount:'',flash:'Pago registrado'};});}
  deleteLoan(id){this.requestConfirm({title:'Eliminar préstamo',msg:'Se eliminará este préstamo. No se puede deshacer.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.setState(s=>({loans:(s.loans||[]).filter(l=>l.id!==id),push:'loansScreen',loanView:null,flash:'Préstamo eliminado'}))});}
  closeLoan(id){this.requestConfirm({title:'Saldar préstamo',msg:'Se marcará como saldado con saldo cero.',confirmLabel:'Saldar',danger:false,onConfirm:()=>this.setState(s=>({loans:(s.loans||[]).map(l=>l.id===id?{...l,remaining:0}:l),flash:'Préstamo saldado'}))});}
  // ===== Savings goals (aspirational tracker; does not move real balances) =====
  setNewGoal(patch){this.setState(s=>({newGoal:{...s.newGoal,...patch}}));}
  openAddGoal(editId){const s=this.state;if(editId!=null){const g=(s.goals||[]).find(x=>x.id===editId);if(g){this.setState({push:'addGoal',newGoal:{name:g.name,emoji:g.emoji||'🎯',target:String(g.target),editId}});return;}}this.setState({push:'addGoal',newGoal:{name:'',emoji:'🎯',target:'',editId:null}});}
  saveGoal(){const n=this.state.newGoal;if(!n.name.trim()){this.flashMsg('Poné un nombre');return;}const target=parseFloat((n.target||'').replace(/\./g,'').replace(',','.'))||0;if(!target){this.flashMsg('Ingresá el objetivo');return;}this.setState(s=>{const goals=(s.goals||[]).slice();if(n.editId!=null){const idx=goals.findIndex(g=>g.id===n.editId);if(idx>=0){goals[idx]={...goals[idx],name:n.name.trim(),emoji:n.emoji||'🎯',target};return{goals,push:'goalDetail',goalView:n.editId,flash:'Meta actualizada'};}return{};}const id='g'+s._next;goals.push({id,name:n.name.trim(),emoji:n.emoji||'🎯',target,saved:0,date:'Hoy',entries:[]});return{goals,_next:s._next+1,push:'goalDetail',goalView:id,flash:'Meta creada'};});}
  openGoalDetail(id){this.setState({push:'goalDetail',goalView:id,goalAmount:''});}
  goalAmountPress(d){this.setState(s=>{let r=s.goalAmount;if(d==='back')return{goalAmount:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{goalAmount:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{goalAmount:r+d};});}
  addGoalMoney(dir){const S=this.state;const v=parseFloat((S.goalAmount||'').replace(',','.'))||0;if(!v){this.flashMsg('Ingresá un monto');return;}this.setState(s=>{const goals=(s.goals||[]).map(g=>{if(g.id!==S.goalView)return g;const nv=dir==='take'?Math.max(0,(g.saved||0)-v):(g.saved||0)+v;return{...g,saved:nv,entries:[{amount:dir==='take'?-v:v,date:'Hoy'},...(g.entries||[])]};});return{goals,goalAmount:'',flash:dir==='take'?'Retiro registrado':'Ahorro registrado'};});}
  deleteGoal(id){this.requestConfirm({title:'Eliminar meta',msg:'Se eliminará esta meta. No se puede deshacer.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.setState(s=>({goals:(s.goals||[]).filter(g=>g.id!==id),push:'goalsScreen',goalView:null,flash:'Meta eliminada'}))});}
  // ===== Budgets (monthly limit per category) =====
  openBudgetEdit(cat){const cur=(this.state.budgets||{})[cat];this.setState({budgetCat:cat,budgetAmount:cur?String(cur):''});}
  closeBudgetEdit(){this.setState({budgetCat:null,budgetAmount:''});}
  budgetAmountPress(d){this.setState(s=>{let r=s.budgetAmount;if(d==='back')return{budgetAmount:r.slice(0,-1)};if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{budgetAmount:r+','};}if(r.indexOf(',')>=0&&(r.split(',')[1]||'').length>=2)return{};if(r.replace(',','').length>=9)return{};return{budgetAmount:r+d};});}
  saveBudget(){const S=this.state;const cat=S.budgetCat;if(!cat)return;const v=parseFloat((S.budgetAmount||'').replace(',','.'))||0;this.setState(s=>{const budgets={...(s.budgets||{})};if(v>0)budgets[cat]=v;else delete budgets[cat];return{budgets,budgetCat:null,budgetAmount:'',flash:v>0?'Presupuesto guardado':'Presupuesto quitado'};});}
  removeBudget(){const S=this.state;const cat=S.budgetCat;if(!cat)return;this.setState(s=>{const budgets={...(s.budgets||{})};delete budgets[cat];return{budgets,budgetCat:null,budgetAmount:'',flash:'Presupuesto quitado'};});}
  setNewRec(patch){this.setState(s=>{const next={...s.newRec,...patch};if(next.type==='ingreso'&&next.targetKind==='card'){next.targetKind='account';next.targetId=this.liquidIds(s)[0]||'';}return{newRec:next};});}
  openRecScreen(){this.pushScreen('recScreen');}
  openAddRec(editId){const s=this.state;const liq=this.liquidIds();const def={type:'gasto',concept:'',amount:'',cat:'otros',targetKind:'account',targetId:liq[0]||'',day:'1',editId:null};
    if(editId!=null){const r=(s.recurring||[]).find(x=>x.id===editId);if(r){this.setState({push:'addRec',newRec:{type:r.type,concept:r.concept,amount:String(r.amount),cat:r.cat,targetKind:r.targetKind,targetId:r.targetId,day:String(r.day),editId}});return;}}
    this.setState({push:'addRec',newRec:def});}
  saveRec(){const n=this.state.newRec;if(!n.concept.trim()){this.flashMsg('Poné un nombre');return;}const amt=parseFloat((n.amount||'').replace(/\./g,'').replace(',','.'))||0;if(!amt){this.flashMsg('Ingresá el monto');return;}if(!n.targetId){this.flashMsg('Elegí dónde impacta');return;}const income=n.type==='ingreso',targetKind=income?'account':(n.targetKind==='card'?'card':'account');if(targetKind==='account'&&(!this.state.accounts[n.targetId]||this.state.archived[n.targetId])){this.flashMsg('Elegí una cuenta activa');return;}if(targetKind==='card'&&!this.state.cards.some(card=>card.id===n.targetId)){this.flashMsg('Elegí una tarjeta válida');return;}const day=Math.min(31,Math.max(1,parseInt(n.day,10)||1));
    this.setState(s=>{const rec=(s.recurring||[]).slice();const base={type:n.type,concept:n.concept.trim(),amount:amt,cat:income?'ingreso':n.cat,targetKind,targetId:n.targetId,day,active:true};
      const today=(()=>{const t=new Date();t.setHours(0,0,0,0);return t;})();const nextDate=this._nextOccur(day,today).toISOString();
      if(n.editId!=null){const i=rec.findIndex(r=>r.id===n.editId);if(i>=0)rec[i]={...rec[i],...base,nextDate};return{recurring:rec,push:'recScreen',flash:'Recurrente actualizado'};}
      rec.push({id:'r'+s._next,...base,nextDate});return{recurring:rec,_next:s._next+1,push:'recScreen',flash:'Recurrente guardado'};});
    setTimeout(()=>this.runAutomations(),50);}
  toggleRec(id){this.setState(s=>({recurring:(s.recurring||[]).map(r=>{if(r.id!==id)return r;const active=!r.active;if(!active)return{...r,active:false};const today=new Date();today.setHours(0,0,0,0);return{...r,active:true,nextDate:this._nextOccur(r.day,today).toISOString()};})}));setTimeout(()=>this.runAutomations(),50);}
  deleteRec(id){this.setState(s=>({recurring:(s.recurring||[]).filter(r=>r.id!==id),push:'recScreen',flash:'Recurrente eliminado'}));}
  async fetchPrices(silent=false){if(this.state.pricesLoading)return;const attemptedAt=Date.now();this._passiveUpdate=true;this.setState({pricesLoading:true,pricesLastAttemptedAt:attemptedAt});
    try{const s=this.state;const FD=window.FinanzDomain;const na={...s.assets};const nb={...s.balances};const fetchedAt=new Date().toISOString();const asISO=value=>{if(value==null||value==='')return null;const n=Number(value);const date=Number.isFinite(n)&&n>0?new Date(n<1e12?n*1000:n):new Date(value);return isNaN(date)?null:date.toISOString();};
      const CRYPTO={BTC:'bitcoin',ETH:'ethereum',ADA:'cardano',SOL:'solana',MATIC:'matic-network',DOT:'polkadot'};
      const cryptoSet=new Set(),stockSet=new Set(),stockCurrencies={};const fciList=[];
      Object.keys(na).forEach(k=>{if(!s.accounts[k])return;(na[k]||[]).forEach(a=>{if(a.fci){fciList.push({id:a.id,phrases:a.fondoMatch||[],fundSlug:a.fundSlug||'',vcpScale:Number(a.vcpScale)||1});return;}if(!a.ticker)return;if(CRYPTO[a.ticker])cryptoSet.add(a.ticker);else{const symbol=String(a.quoteTicker||a.ticker).toUpperCase();stockSet.add(symbol);stockCurrencies[symbol]=FD.assetQuoteCurrency(a);if(a.arsQuoteTicker){const arsSymbol=String(a.arsQuoteTicker).toUpperCase();stockSet.add(arsSymbol);stockCurrencies[arsSymbol]='ARS';}}});});
      let criptoRate=s.usdRate||0;try{const response=await fetch('https://dolarapi.com/v1/dolares/cripto');if(response.ok){const d=await response.json();const r=Number(d?.venta||d?.compra||0);if(r>0)criptoRate=r;}}catch(e){}

      // Binance matches the user's BTC position. CoinGecko is a keyless fallback;
      // both stay in USD and are converted only when calculating ARS totals.
      const cryptoQuotes={};
      await Promise.all([...cryptoSet].map(async ticker=>{try{const response=await fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol='+ticker+'USDT');if(!response.ok)return;const d=await response.json();const price=Number(d&&d.price);if(price>0)cryptoQuotes[ticker]={price,currency:'USD',source:'Binance',quality:'current',asOf:fetchedAt,fetchedAt};}catch(e){}}));
      const missingCrypto=[...cryptoSet].filter(t=>!cryptoQuotes[t]);
      if(missingCrypto.length){try{const ids=missingCrypto.map(t=>CRYPTO[t]).join(',');const response=await fetch('https://api.coingecko.com/api/v3/simple/price?ids='+ids+'&vs_currencies=usd&include_last_updated_at=true');if(response.ok){const d=await response.json();missingCrypto.forEach(t=>{const row=d[CRYPTO[t]]||{};const price=Number(row.usd);if(price>0)cryptoQuotes[t]={price,currency:'USD',source:'CoinGecko',quality:'aggregated',asOf:row.last_updated_at?new Date(row.last_updated_at*1000).toISOString():null,fetchedAt};});}}catch(e){}}

      // Data912 is a free delayed BYMA-oriented feed. Never label it real-time and
      // never overwrite a holding with zero when it is unavailable.
      const stockQuotes={};
      if(stockSet.size){await Promise.all(['arg_cedears','arg_stocks','arg_bonds'].map(async endpoint=>{try{const response=await fetch('https://data912.com/live/'+endpoint);if(!response.ok)return;const rows=await response.json();if(!Array.isArray(rows))return;rows.forEach(row=>{const symbol=String(row.symbol||row.ticker||'').toUpperCase();const price=Number(row.c??row.px??row.last??row.close??row.p);if(stockSet.has(symbol)&&price>0&&!stockQuotes[symbol])stockQuotes[symbol]={price,currency:stockCurrencies[symbol]||'ARS',source:'Data912 · BYMA demorado',quality:'delayed',asOf:asISO(row.datetime||row.date||row.timestamp),fetchedAt};});}catch(e){}}));}

      // Fetch every CAFCI category, not just three, and both latest observations.
      // The prior official VCP is what determines the last-period return.
      const latestFunds=[],previousFunds=[];const categories=['mercadoDinero','rentaVariable','rentaFija','rentaMixta','retornoTotal','otros'];
      if(fciList.length){await Promise.all(categories.flatMap(category=>['ultimo','penultimo'].map(async which=>{try{const response=await fetch('https://api.argentinadatos.com/v1/finanzas/fci/'+category+'/'+which);if(!response.ok)return;const rows=await response.json();if(Array.isArray(rows))(which==='ultimo'?latestFunds:previousFunds).push(...rows);}catch(e){}})));}
      const fciQuotes={};
      fciList.forEach(item=>{const rawLatest=FD.matchFundRecord(latestFunds,item.phrases),rawPrevious=FD.matchFundRecord(previousFunds,item.phrases),scale=item.vcpScale>0?item.vcpScale:1;const normalizeFund=row=>row?{...row,vcp:Number(row.vcp)/scale}:null,latest=normalizeFund(rawLatest),previous=normalizeFund(rawPrevious);const price=Number(latest&&latest.vcp);if(price>0)fciQuotes[item.id]={quote:{price,currency:'ARS',source:'CAFCI vía ArgentinaDatos',quality:'delayed',asOf:latest.fecha||null,fetchedAt},latest,previous};});
      // Prefer the official CAFCI page for known funds. ArgentinaDatos remains a
      // transparent fallback if CAFCI is unavailable or changes its page.
      await Promise.all(fciList.filter(item=>item.fundSlug).map(async item=>{try{const response=await fetch('/api/fund-data?fund='+encodeURIComponent(item.fundSlug));if(!response.ok)return;const data=await response.json();const price=Number(data.price);if(!(price>0))return;const history=Array.isArray(data.history)?data.history:[];const prior=history.length>1?history[history.length-2]:null;const latest={vcp:price,fecha:data.asOf};const previous=prior?{vcp:Number(prior.price),fecha:prior.date}:null;fciQuotes[item.id]={quote:{price,currency:'ARS',source:data.source||'CAFCI oficial',quality:data.quality||'official',asOf:data.asOf||null,fetchedAt:data.fetchedAt||fetchedAt},latest,previous,returns:data.returns||null};}catch(e){}}));

      let quoteCount=0;let totalAssets=0;const newAccMeta={...s.accMeta};
      Object.keys(na).forEach(k=>{if(!s.accounts[k])return;const aa=[...(na[k]||[])];if(!aa.length)return;let changed=false;
        aa.forEach((asset,index)=>{totalAssets++;let quote=null;if(asset.fci)quote=fciQuotes[asset.id]&&fciQuotes[asset.id].quote;else if(CRYPTO[asset.ticker])quote=cryptoQuotes[asset.ticker];else quote=stockQuotes[String(asset.quoteTicker||asset.ticker).toUpperCase()];const arsQuote=asset.arsQuoteTicker?stockQuotes[String(asset.arsQuoteTicker).toUpperCase()]:null;
          if(!quote&&!arsQuote){aa[index]={...asset,quoteLastErrorAt:fetchedAt};return;}
          let next=asset;let quoteAccepted=false;let arsAccepted=false;if(quote){const applied=FD.applyAssetQuote(asset,quote);quoteAccepted=applied!==asset;next=applied;}
          if(arsQuote){const currentARS=Date.parse(asset.arsQuoteAsOf||asset.arsQuoteFetchedAt||''),nextARS=Date.parse(arsQuote.asOf||arsQuote.fetchedAt||'');if(!(Number.isFinite(currentARS)&&Number.isFinite(nextARS)&&nextARS<currentARS)){next={...next,lastPriceARS:Number(arsQuote.price),arsQuoteSource:arsQuote.source,arsQuoteAsOf:arsQuote.asOf,arsQuoteFetchedAt:arsQuote.fetchedAt};arsAccepted=true;}}
          if(quoteAccepted||arsAccepted){quoteCount++;changed=true;}
          if(asset.fci){const units=Number(asset.units||asset.qty)||0;const fundQuote=fciQuotes[asset.id];if(fundQuote&&fundQuote.returns){const last=fundQuote.returns.lastPeriod,rate=last&&Number(last.annualizedSimple);next={...next,fundReturns:fundQuote.returns,...(Number.isFinite(rate)&&rate>=0?{estimatedAnnualRate:rate*100,estimatedAnnualRateSource:'Estimación sobre VCP oficial CAFCI',estimatedAnnualRateAsOf:last.to}: {})};changed=true;}if(quoteAccepted){const change=FD.fciPeriodChange(fundQuote.latest,fundQuote.previous,units);next={...next,qty:units,units,lastVcp:quote.price,previousVcp:Number(fundQuote.previous&&fundQuote.previous.vcp)||0,previousVcpAsOf:(fundQuote.previous&&fundQuote.previous.fecha)||null};if(change)newAccMeta[k]={chg:(change.percent>=0?'+':'')+(change.percent*100).toFixed(2).replace('.',',')+'%',up:change.percent>=0,rend:change.amount,asOf:quote.asOf};}}
          aa[index]=next;});
        const valuation=FD.investmentValuation(aa,criptoRate);na[k]=aa;if(valuation.complete)nb[k]=valuation.valueARS;if(changed)na[k]=aa;});
      const patch={assets:na,balances:nb,pricesLoading:false,pricesLastAttemptedAt:attemptedAt,...(quoteCount>0?{pricesLastUpdated:Date.now()}:{pricesLastUpdated:s.pricesLastUpdated}),...(criptoRate>0?{usdRate:criptoRate}:{}),accMeta:newAccMeta};
      if(!silent)patch.flash=quoteCount>0?(quoteCount+' de '+totalAssets+' cotizaciones actualizadas'):'No llegaron cotizaciones nuevas · conservamos los últimos datos';
      this._passiveUpdate=true;this.setState(patch);}
    catch(e){this._passiveUpdate=true;this.setState({pricesLoading:false,pricesLastAttemptedAt:attemptedAt,...(!silent?{flash:'No se pudo consultar el mercado · conservamos los últimos datos'}:{})});}}

  press(d){this.setState(s=>{let r=s.addAmount;if(d===','){if(r.indexOf(',')>=0||r==='')return{};return{addAmount:r+','};}if(r.indexOf(',')>=0){const dec=r.split(',')[1]||'';if(dec.length>=2)return{};}if(r.replace(',','').length>=9)return{};return{addAmount:r+d};});}
  backspace(){this.setState(s=>({addAmount:s.addAmount.slice(0,-1)}));}

  openAdd(type){const liq=this.liquidIds(),inv=this.investIds();const defCat=type==='ingreso'?'ingreso':'comida';const defAcc=liq[0]||inv[0]||'';const defTo=type==='inversion'?(inv[0]||''):(liq.find(k=>k!==defAcc)||inv[0]||defAcc);this.setState({sheet:'add',subsheet:null,addType:type,addAmount:'',addTitle:'',addNote:'',addCat:defCat,addAccount:defAcc,addTo:defTo,addDate:'Hoy',addDateISO:this._todayKey(),addTags:[],addCatTouched:false,addSuggestedKey:null,addSuggestedTags:[],editId:null,shortcutCapture:false});}
  setAddTitle(value){this.setState(s=>{const next={addTitle:value};if(s.addType==='gasto'){const sug=window.FinanzDomain.applyMerchantSuggestion({merchant:value,categories:s.categories,currentCategory:s.addCat,categoryTouched:s.addCatTouched,currentTags:s.addTags});if(sug&&sug.key!==s.addSuggestedKey){const baseTags=(s.addTags||[]).filter(t=>(s.addSuggestedTags||[]).indexOf(t)<0);next.addCat=sug.category;next.addTags=window.FinanzDomain.uniqueTags([...baseTags,...sug.suggestedTags]);next.addSuggestedKey=sug.key;next.addSuggestedTags=sug.suggestedTags;next.tagSugg=window.FinanzDomain.uniqueTags([...(s.tagSugg||[]),...sug.suggestedTags]);}else if(!sug&&s.addSuggestedKey){next.addTags=(s.addTags||[]).filter(t=>(s.addSuggestedTags||[]).indexOf(t)<0);next.addSuggestedKey=null;next.addSuggestedTags=[];}}return next;});}
  groupByDate(list){const order=[];const map={};window.FinanzDomain.sortTransactionsNewestFirst(list).forEach(t=>{const iso=t.dateISO||window.FinanzDomain.isoFromLabel(t.dateLabel);if(!map[iso]){map[iso]=[];order.push(iso);}map[iso].push(t);});return order.map(iso=>{const items=map[iso];const total=items.filter(t=>!t.isTransfer).reduce((a,t)=>a+window.FinanzDomain.transactionAmountARS(t,this.state.accounts,this.state.usdRate),0);return {day:window.FinanzDomain.timelineLabelFromISO(iso),iso,items,total};});}
  txView(t){const C=this.state.categories[t.cat]||{name:'',emoji:'💱'};const isPago=t.type==='pago';const isInc=t.amount>0&&!t.isTransfer;let amountStr,amtColor;
    // Card payments are transfers (net worth unchanged) but the user moved cash
    // out of an account, so show them as a real outflow, not a muted transfer.
    const txnCurrency=window.FinanzDomain.transactionCurrency(t,this.state.accounts),txnSymbol=txnCurrency==='USD'?'US$':'$';
    if(t.isTransfer&&!isPago){amountStr=txnSymbol+this.fmtNum(t.amount);amtColor='var(--text-2)';}else{amountStr=(t.amount>=0?'+':'-')+txnSymbol+this.fmtNum(Math.abs(t.amount));amtColor=isInc?'var(--pos)':'var(--text)';}
    const accId=t.account||t.from;const am=this.state.accounts[accId];const accName=am?am.name:'';if(this.state.hideAmounts)amountStr='••••';
    const context=[isPago?'Pago de tarjeta':C.name,t.fundingLabel||accName].filter(Boolean).join(' · ');const note=t.note&&!/^(Registrado con el asistente|Cargado por voz o texto)$/i.test(t.note)?t.note:'';const sub=[context,note].filter(Boolean).join(' · ');
    return {id:t.id,merchant:t.merchant,emoji:isPago?'💳':C.emoji,iconVar:isPago?'--cat-tarjetas-icon':(C.iconVar||'--cat-otros-icon'),sub,amountStr,amtColor,onOpen:()=>this.setState({detailId:t.id,push:'txnDetail'})};}
  setNewCat(patch){this.setState(s=>({newCat:{...s.newCat,...patch}}));}
  openCatEditor(editId){const s=this.state;if(editId&&s.categories[editId]){const c=s.categories[editId];const ci=Math.max(0,this.CATCOLORS.findIndex(p=>p[0]===c.iconVar));this.setState({push:'catEditor',newCat:{name:c.name,emoji:c.emoji,type:c.type,colorIdx:ci,parent:c.parent||'',editId}});}else{this.setState({push:'catEditor',newCat:{name:'',emoji:this.CATEMOJIS[0],type:'gasto',colorIdx:0,parent:'',editId:null}});}}
  saveCategory(){const n=this.state.newCat;if(!n.name.trim()){this.flashMsg('Poné un nombre');return;}const pal=this.CATCOLORS[n.colorIdx]||this.CATCOLORS[0];this.setState(s=>{const cats={...s.categories};let order=s.catOrder.slice();if(n.editId){cats[n.editId]={...cats[n.editId],name:n.name.trim(),emoji:n.emoji,type:n.type,iconVar:pal[0],fillVar:pal[1],parent:n.parent||'',archived:false};if(order.indexOf(n.editId)<0)order.push(n.editId);return{categories:cats,catOrder:order,push:'categories',flash:'Categoría actualizada'};}const id='cat_'+s._next;cats[id]={name:n.name.trim(),emoji:n.emoji,type:n.type,iconVar:pal[0],fillVar:pal[1],parent:n.parent||''};order.push(id);return{categories:cats,catOrder:order,_next:s._next+1,push:'categories',flash:'Categoría creada'};});}
  archiveCategory(id){this.setState(s=>({categories:{...s.categories,[id]:{...s.categories[id],archived:!s.categories[id].archived}},push:'categories',flash:s.categories[id].archived?'Categoría restaurada':'Categoría archivada'}));}
  deleteCategory(id){if(this.BASECATS[id]||this.state.txns.some(t=>t.cat===id)||this.state.recurring.some(r=>r.cat===id)||Number((this.state.budgets||{})[id])>0||Object.values(this.state.categories).some(c=>c.parent===id)){this.flashMsg('Esta categoría tiene historial o reglas; archivala para conservarlos');return;}this.setState(s=>{const cats={...s.categories},budgets={...(s.budgets||{})};delete cats[id];delete budgets[id];return{categories:cats,budgets,catOrder:s.catOrder.filter(k=>k!==id),push:'categories',flash:'Categoría eliminada'};});}
  openTagEditor(orig){this.setState({sheet:'tagEditor',tagEdit:{name:orig||'',orig:orig||null}});}
  saveTag(){const raw=this.state.tagEdit.name.trim().toLowerCase().replace(/^#/,'');const orig=this.state.tagEdit.orig;if(!raw){this.flashMsg('Poné un nombre');return;}this.setState(s=>{let tags=s.tagSugg.slice();let txns=s.txns,addTags=s.addTags,actTag=s.actTag;if(orig){tags=tags.map(t=>t===orig?raw:t);txns=s.txns.map(t=>({...t,tags:(t.tags||[]).map(x=>x===orig?raw:x)}));addTags=s.addTags.map(x=>x===orig?raw:x);if(actTag===orig)actTag=raw;}else if(tags.indexOf(raw)<0){tags.push(raw);}return{tagSugg:tags,txns,addTags,actTag,sheet:null,flash:orig?'Etiqueta actualizada':'Etiqueta creada'};});}
  deleteTag(tag){this.setState(s=>({tagSugg:s.tagSugg.filter(t=>t!==tag),txns:s.txns.map(t=>({...t,tags:(t.tags||[]).filter(x=>x!==tag)})),addTags:s.addTags.filter(x=>x!==tag),actTag:s.actTag===tag?'todos':s.actTag,flash:'Etiqueta eliminada'}));}
  setNewCard(patch){this.setState(s=>({newCard:{...s.newCard,...patch}}));}
  openAddCard(editId){const s=this.state;if(editId!=null&&s.cards[editId]){const c=s.cards[editId];const gi=Math.max(0,this.CARDGRADS.indexOf(c.grad)),statement=this.cardResumen(c),pending=window.FinanzDomain.cardPendingTotal(c);this.setState({push:'addCard',newCard:{brand:c.brand,bank:c.bank,last4:c.last4,limit:String(c.limit||''),debt:(Number(c.saldo)||0)?String(Number(c.saldo)):'',statement:statement?String(statement):'',pending:pending?String(pending):'',cierre:c.cierre||'',vence:c.vence||'',gradIdx:gi,autopay:!!c.autopay,autopayAccount:c.autopayAccount||'',editId}});}else{this.setState({push:'addCard',newCard:{brand:'Visa',bank:'',last4:'',limit:'',debt:'',statement:'',pending:'',cierre:'',vence:'',gradIdx:s.cards.length%this.CARDGRADS.length,autopay:false,autopayAccount:'',editId:null}});}}
  saveCard(){const n=this.state.newCard;if(!n.bank.trim()){this.flashMsg('Poné el banco o emisor');return;}const parseField=value=>{if(!String(value||'').trim())return 0;return window.FinanzDomain.parseMoneyInput(value);};const limit=parseField(n.limit),debt=parseField(n.debt),statement=parseField(n.statement),pending=parseField(n.pending);if(!Number.isFinite(limit)||limit<0||!Number.isFinite(debt)||debt<0||!Number.isFinite(statement)||statement<0||!Number.isFinite(pending)||pending<0){this.flashMsg('Revisá los montos de la tarjeta');return;}if(statement+pending>debt+0.005){this.flashMsg('Resumen más pendientes no pueden superar la deuda total');return;}const grad=this.CARDGRADS[n.gradIdx]||this.CARDGRADS[0];const last4=(n.last4||'').replace(/\D/g,'').slice(-4)||'0000';const autopay=!!n.autopay;const autopayAccount=autopay?(n.autopayAccount||this.paymentSourceIds()[0]||''):'';if(autopay&&!this.spendSourceMeta(autopayAccount)){this.flashMsg('Elegí de dónde saldrá el débito automático');return;}const cardDay=value=>{const match=String(value||'').match(/\d{1,2}/);return match?Math.min(31,Math.max(1,Number(match[0]))):null;};const cierreDay=cardDay(n.cierre),venceDay=cardDay(n.vence);this.setState(s=>{const cards=s.cards.slice();if(n.editId!=null&&cards[n.editId]){const prev=cards[n.editId];const venceVal=n.vence.trim()||prev.vence;let paidCycle=prev.paidCycle,statementPaid=Number(prev.statementPaid)||0,statementAdjustment=Number(prev.statementAdjustment)||0,pendingAdjustment=Number(prev.pendingAdjustment)||0;const previousStatement=this.cardResumen(prev),previousPending=window.FinanzDomain.cardPendingTotal(prev),reconciled=Math.abs(debt-(Number(prev.saldo)||0))>0.005||Math.abs(statement-previousStatement)>0.005||Math.abs(pending-previousPending)>0.005;if(reconciled){const itemizedGross=window.FinanzDomain.cardStatementGross({...prev,statementAdjustment:0}),itemizedPending=window.FinanzDomain.cardPendingTotal({...prev,pendingAdjustment:0});statementPaid=0;statementAdjustment=statement-itemizedGross;pendingAdjustment=pending-itemizedPending;}
        // Turning auto-pay ON must never retroactively charge: if this cycle's due
        // date has already passed, mark it settled so it only starts next cycle.
        if(autopay&&!prev.autopay){const t0=new Date();t0.setHours(0,0,0,0);const due=this._parseDate(venceVal,t0);if(due&&t0>=due)paidCycle=this._cycleKey(due);}
        cards[n.editId]={...prev,brand:n.brand,bank:n.bank.trim(),last4,saldo:debt,statementPaid,statementAdjustment,pendingAdjustment,limit,cierre:n.cierre.trim()||prev.cierre,vence:venceVal,cierreDay:cierreDay||prev.cierreDay,venceDay:venceDay||prev.venceDay,grad,autopay,autopayAccount,paidCycle};return{cards,push:null,tab:'tarjetas',cardIdx:n.editId,cardView:n.editId,flash:reconciled?'Tarjeta conciliada':'Tarjeta actualizada'};}const card={id:'card_'+s._next,brand:n.brand,bank:n.bank.trim(),last4,saldo:debt,statementPaid:0,statementAdjustment:statement,pendingAdjustment:pending,limit,cierre:n.cierre.trim()||'—',vence:n.vence.trim()||'—',cierreDay,venceDay,grad,autopay,autopayAccount,compras:[],cuotas:[],pendientes:[],pagos:[]};return{cards:[...cards,card],_next:s._next+1,push:null,tab:'tarjetas',cardIdx:cards.length,cardView:cards.length,flash:(debt||statement||pending)?'Tarjeta creada y conciliada':'Tarjeta creada'};});}
  deleteCard(idx){const card=this.state.cards[idx];if(!card)return;if((Number(card.saldo)||0)>0.005||this.state.txns.some(t=>t.card===card.id)){this.flashMsg('No se puede eliminar una tarjeta con deuda o movimientos; conservála como historial');return;}this.setState(s=>{const cards=s.cards.filter((c,i)=>i!==idx);return{cards,push:null,tab:'tarjetas',cardIdx:0,cardView:0,flash:'Tarjeta eliminada'};});}

  _rev(t,b,ct,mi,me){return window.FinanzDomain.reverseTxn(t,b,ct,mi,me);}
  _apply(t,b,ct,mi,me){return window.FinanzDomain.applyTxn(t,b,ct,mi,me);}

  save(){
    const S=this.state;
    if(!S.addAmount)return;
    const val=parseFloat(S.addAmount.replace(',','.'))||0;
    if(!val)return;
    const type=S.addType,FD=window.FinanzDomain;
    const fciSource=type==='gasto'?FD.findFciSpendSource(S,S.addAccount,S.usdRate):null;
    const dateISO=S.addDateISO||FD.isoFromLabel(S.addDate);
    const t={type,val,dateLabel:FD.labelFromISO(dateISO),dateISO,tags:[...S.addTags]};
    const C=S.categories[S.addCat]||{};
    t.merchant=S.addTitle.trim()||(type==='transfer'?'Transferencia':type==='inversion'?'Inversión':C.name||'Movimiento');
    if(type==='gasto'||type==='ingreso'){
      if(!S.accounts[S.addAccount]&&!fciSource){this.flashMsg(type==='gasto'?'Elegí con qué pagar':'Elegí una cuenta');return;}
      if(!S.categories[S.addCat]){this.flashMsg('Elegí una categoría');return;}
    }else if(!S.accounts[S.addAccount]||!S.accounts[S.addTo]){this.flashMsg('Elegí cuentas válidas');return;}
    else if(S.addAccount===S.addTo){this.flashMsg('Origen y destino deben ser distintos');return;}
    t.currency=fciSource?'ARS':((S.accounts[S.addAccount]||{}).currency||'ARS');
    if(type==='gasto'){
      t.cat=S.addCat;t.account=fciSource?fciSource.accountId:S.addAccount;t.amount=-val;t.note=S.addNote.trim();
      if(fciSource)t.fciSourceId=S.addAccount;
    }else if(type==='ingreso'){
      t.cat=S.addCat;t.account=S.addAccount;t.amount=val;t.note=S.addNote.trim();
    }else{
      const toCurrency=(S.accounts[S.addTo]||{}).currency||'ARS';
      if(t.currency!==toCurrency&&!S.usdRate){this.flashMsg('Actualizá la cotización antes de convertir monedas');this.fetchPrices(true);return;}
      t.cat=type==='transfer'?'transfer':'inversion';t.from=S.addAccount;t.to=S.addTo;t.amount=-val;t.isTransfer=true;t.toCurrency=toCurrency;t.toVal=FD.convertCurrency(val,t.currency,toCurrency,S.usdRate);
      t.note='→ '+(S.accounts[S.addTo]?S.accounts[S.addTo].name:'')+(S.addNote.trim()?(' · '+S.addNote.trim()):'')+(t.currency!==toCurrency?(' · '+(toCurrency==='USD'?'US$':'$')+this.fmtNum(t.toVal)):'');
    }
    this.setState(s=>{
      let b={...s.balances},ct={...s.categoryTotals},mi=s.monthIncome,me=s.monthExpense,txns=s.txns,assets=s.assets;
      if(s.editId){
        const old=s.txns.find(x=>x.id===s.editId);
        if(old){
          if(old.fciRedemption)assets=FD.restoreFciUnits(assets,old.fciRedemption);
          const r=this._rev(old,b,ct,mi,me);b=r.b;ct=r.ct;mi=r.mi;me=r.me;txns=txns.filter(x=>x.id!==s.editId);
        }
      }
      if(t.fciSourceId){
        const redeemed=FD.redeemFciUnits(assets,t.fciSourceId,val,s.usdRate);
        if(!redeemed.ok){
          const msg=redeemed.error==='insufficient'?'El FCI no tiene suficiente disponible para ese gasto.':redeemed.error==='missing-price'?'Actualizá el valor de la cuotaparte antes de pagar con el FCI.':'No pude usar ese FCI como medio de pago.';
          return{flash:msg};
        }
        assets=redeemed.assets;t.fciRedemption=redeemed.redemption;t.account=redeemed.redemption.accountId;t.fundingLabel='FCI · '+redeemed.redemption.name;
      }
      const id=s.editId||s._next;t.id=id;
      const a=this._apply(t,b,ct,mi,me);
      return{txns:[t,...txns],assets,balances:a.b,categoryTotals:a.ct,monthIncome:a.mi,monthExpense:a.me,_next:s.editId?s._next:id+1,sheet:null,subsheet:null,editId:null,addAmount:'',addTitle:'',addNote:'',addTags:[],addCatTouched:false,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false,flash:s.editId?'Movimiento actualizado':'Movimiento guardado'};
    });
  }
  deleteTxn(){
    const S=this.state,t=S.txns.find(x=>x.id===S.detailId);if(!t)return;
    if(t.type==='inversion'||t.type==='ajuste'||t.reconciliation){this.flashMsg('Para corregir una inversión usá Conciliar en el activo');return;}
    if(t.type==='pago'&&!t.cardRollback){this.flashMsg('Este pago antiguo no tiene datos suficientes para revertirse sin riesgo');return;}
    if(t.type==='pago'&&S.txns.some(x=>x.card===t.card&&Number(x.id)>Number(t.id))){this.flashMsg('Primero revisá los movimientos posteriores de esa tarjeta');return;}
    this.setState(s=>{let cards=s.cards,assets=t.fciRedemption?window.FinanzDomain.restoreFciUnits(s.assets,t.fciRedemption):s.assets;
      if(t.onCard){let removed=false;cards=s.cards.map(c=>{if(c.id!==t.card)return c;const result=window.FinanzDomain.removeCardPurchase(c,t);if(result.removed)removed=true;return result.card;});if(!removed)return{flash:'No pude vincular la compra con la tarjeta; no se eliminó nada'};}
      if(t.type==='pago')cards=s.cards.map(c=>c.id===t.card?{...c,...t.cardRollback}:c);
      const r=this._rev(t,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{txns:s.txns.filter(x=>x.id!==t.id),cards,assets,balances:r.b,categoryTotals:r.ct,monthIncome:r.mi,monthExpense:r.me,push:null,detailId:null,flash:'Movimiento eliminado y saldos restaurados'};});
  }
  duplicateTxn(){
    const S=this.state,t=S.txns.find(x=>x.id===S.detailId);if(!t)return;
    if(t.type==='pago'||t.type==='inversion'||t.type==='ajuste'||t.reconciliation){this.flashMsg('Este movimiento se repite desde su pantalla específica');return;}
    this.setState(s=>{
      const id=s._next;let assets=s.assets;let nt={...t,id,dateLabel:'Hoy',dateISO:this._todayKey(),tags:[...(t.tags||[])]};
      if(t.fciRedemption){
        const redeemed=window.FinanzDomain.redeemFciUnits(assets,t.fciRedemption.sourceId,t.val,s.usdRate);
        if(!redeemed.ok)return{flash:'El FCI no tiene suficiente disponible para duplicar este gasto.'};
        assets=redeemed.assets;nt={...nt,fciRedemption:redeemed.redemption,account:redeemed.redemption.accountId,fundingLabel:'FCI · '+redeemed.redemption.name};
      }
      let cards=s.cards;if(t.onCard){const installments=Math.max(1,Number((String(t.note||'').match(/(\d+)\s+cuotas/i)||[])[1])||1);cards=s.cards.map(c=>c.id===t.card?window.FinanzDomain.addCardPurchase(c,{amount:t.val,installments,merchant:String(t.merchant||'Compra').replace(/\s*·\s*cuota\s+\d+\/\d+\s*$/i,''),date:'Hoy',dateISO:nt.dateISO,txnId:id,status:t.cardPending?'pending':'posted'}):c);}
      const a=this._apply(nt,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);
      return{txns:[nt,...s.txns],cards,assets,balances:a.b,categoryTotals:a.ct,monthIncome:a.mi,monthExpense:a.me,_next:id+1,push:null,detailId:null};
    });
  }
  editTxn(){
    const S=this.state,t=S.txns.find(x=>x.id===S.detailId);if(!t)return;
    if(t.onCard){const cardIndex=S.cards.findIndex(card=>card.id===t.card);if(cardIndex<0){this.flashMsg('La tarjeta vinculada ya no existe');return;}this.openCardPurchase(cardIndex,t);return;}
    if(t.type==='pago'||t.type==='inversion'||t.type==='ajuste'||t.reconciliation){this.flashMsg('Usá la pantalla específica para corregir este movimiento');return;}
    const liq=this.liquidIds(),inv=this.investIds();const iso=t.dateISO||window.FinanzDomain.isoFromLabel(t.dateLabel);
    this.setState({sheet:'add',push:null,subsheet:null,editId:t.id,addType:t.type,addAmount:String(t.val).replace('.',','),addTitle:t.merchant||'',addNote:t.note||'',addCat:(t.cat==='transfer'||t.cat==='inversion'||!S.categories[t.cat])?'comida':t.cat,addAccount:(t.fciRedemption&&t.fciRedemption.sourceId)||t.account||t.from||liq[0]||'',addTo:t.to||inv[0]||liq[0]||'',addDate:window.FinanzDomain.labelFromISO(iso),addDateISO:iso,addTags:[...(t.tags||[])],addCatTouched:true,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false});
  }
  renderVals(){
    const S=this.state,CAT=S.categories,ACC=S.accounts,isDark=S.theme==='dark';
    const cFill=(k)=>(CAT[k]&&CAT[k].fillVar)||'--cat-otros-fill';const cIcon=(k)=>(CAT[k]&&CAT[k].iconVar)||'--cat-otros-icon';
    const accentVar=this.props.accent||(isDark?'#66ABFF':'#0B63CE');
    const FD=window.FinanzDomain;
    const sortedTxns=FD.sortTransactionsNewestFirst(S.txns);
    const sym=S.currency==='USD'?'US$':'$';
    const M=(s)=>S.hideAmounts?'••••':s;
    const displayARS=(n)=>S.currency==='USD'&&S.usdRate>0?Number(n||0)/S.usdRate:Number(n||0);
    const money=(n)=>M(sym+this.fmtNum(displayARS(n)));
    const moneyInt=(n)=>M(sym+this.fmtInt(displayARS(n)));
    const nativeMoney=(n,currency,integer=false)=>M((currency==='USD'?'US$':'$')+(integer?this.fmtInt(n):this.fmtNum(n)));
    const assetQty=(asset)=>{const qty=Number(asset.qty)||0;const digits=asset.ticker==='BTC'?8:asset.fci?6:qty<1?6:3;return qty.toFixed(digits).replace(/\.?0+$/,'');};
    const assetNativePrice=(asset,value)=>nativeMoney(Number(value)||0,FD.assetQuoteCurrency(asset));
    const quoteMeta=(asset)=>{const state=FD.quoteFreshness(asset);const labels={current:'Actual',aggregated:'Agregado',delayed:'Demorado',stale:'Dato vencido',manual:'Manual',unknown:'Fecha desconocida',missing:'Sin fuente'};let when='';const raw=asset.quoteAsOf||asset.quoteFetchedAt;if(raw){const parsed=/^\d{4}-\d{2}-\d{2}$/.test(raw)?new Date(raw+'T12:00:00'):new Date(raw);if(!isNaN(parsed))when=' · '+parsed.toLocaleString('es-AR',{day:'numeric',month:'short',hour:raw.length>10?'2-digit':undefined,minute:raw.length>10?'2-digit':undefined});}return(asset.quoteSource||'Sin fuente')+' · '+(labels[state]||labels[asset.quoteQuality]||'Verificar')+when;};
    const signedARS=(n)=>M((n>=0?'+':'-')+sym+this.fmtNum(Math.abs(displayARS(n))));
    const LIQ=this.liquidIds(S),INV=this.investIds(S),DEBTACC=this.debtIds(S);
    const FCI_SPEND=FD.spendableFciSources(S,S.usdRate).filter(source=>source.valueARS>0.005);
    const unknownBalanceCount=LIQ.filter(id=>ACC[id]&&ACC[id].balanceKnown===false).length;
    const sumARS=(ids)=>FD.sumAccountsARS(ids,S.balances,ACC,S.usdRate,S.assets);
    const liquidDisponible=sumARS(LIQ),fciDisponible=FCI_SPEND.reduce((sum,source)=>sum+source.valueARS,0);
    const disponible=liquidDisponible+fciDisponible, invertido=sumARS(INV);
    const cardDebt=this.cardDebt(S), debtAcc=sumARS(DEBTACC);
    const patrimonioBruto=liquidDisponible+invertido;
    const patrimonioNeto=patrimonioBruto-cardDebt-debtAcc;
    const baseHeroVal=S.balanceMode==='disponible'?disponible:patrimonioNeto;
    const heroIsUsd=S.heroCurrency==='USD';
    const heroVal=heroIsUsd&&S.usdRate>0?baseHeroVal/S.usdRate:baseHeroVal;
    const heroSym=heroIsUsd?'US$':'$';
    const heroParts=this.fmtNum(heroVal).split(',');
    // chart
    const expKeys=S.catOrder.filter(k=>CAT[k]&&CAT[k].type==='gasto'&&!CAT[k].archived);
    // Period-scoped totals computed from transactions by REAL date (Fase 2).
    // Reports honor the "Este mes/semana/año" selector; Budgets are always the
    // current month (monthly by definition). Home chart keeps its own accumulator.
    const convertedSummary=(txns)=>{const cat={};let income=0,expense=0;txns.forEach(t=>{if(t.isTransfer)return;const amount=FD.transactionAmountARS(t,ACC,S.usdRate);if(amount>0)income+=amount;else if(amount<0){const value=Math.abs(amount);expense+=value;if(t.cat)cat[t.cat]=(cat[t.cat]||0)+value;}});return{cat,income,expense};};
    const budgetMonthSummary=convertedSummary(FD.periodTxns(S.txns,0));
    const budgetMonthCat=budgetMonthSummary.cat;
    const periodTx=FD.periodTxns(sortedTxns,S.periodIdx);
    const periodSummary=convertedSummary(periodTx);
    const periodCat=periodSummary.cat;
    const periodIE={income:periodSummary.income,expense:periodSummary.expense};
    const homeTx=FD.periodTxns(sortedTxns,0);
    const homeSummary=convertedSummary(homeTx);
    const homeCat=homeSummary.cat;
    const homeIE={income:homeSummary.income,expense:homeSummary.expense};
    const sorted=expKeys.map(k=>({k,t:homeCat[k]||0})).sort((a,b)=>b.t-a.t).slice(0,4);
    const maxT=Math.max.apply(null,sorted.map(x=>x.t).concat([1]));
    const chartItems=sorted.filter(x=>x.t>0).map(x=>({key:x.k,name:(CAT[x.k]||{}).name,emoji:(CAT[x.k]||{}).emoji,iconVar:cIcon(x.k),fillVar:cFill(x.k),amount:S.hideAmounts?'••':this.abbr(displayARS(x.t)),h:Math.max(48,Math.round(x.t/maxT*100)),onOpen:()=>this.navigateTab('actividad',{actCat:x.k,actFilter:'todos',actSearch:''})}));
    // Home and Activity are always driven by real chronology, never array order.
    const homeGroups=this.groupByDate(homeTx.slice(0,6)).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));
    // Backup safety: data lives only on this device. Nudge a copy if it's been
    // a week (or never), unless dismissed in the last few days.
    const bkHasData=(S.order.length>0||S.txns.length>0);
    const bkDays=S.lastBackupAt?(Date.now()-S.lastBackupAt)/86400000:Infinity;
    const bkDismissed=S.backupDismissedAt&&(Date.now()-S.backupDismissedAt)<3*86400000;
    const showBackupBanner=bkHasData&&bkDays>=7&&!bkDismissed;
    const backupBannerTitle=S.lastBackupAt?('Backup pendiente · '+Math.floor(bkDays)+' días'):'Guardá un backup';
    // activity
    const q=S.actSearch.trim().toLowerCase();
    const filtered=sortedTxns.filter(t=>{if(S.actCat&&t.cat!==S.actCat)return false;if(S.actFilter==='gastos'&&!(t.amount<0&&!t.isTransfer))return false;if(S.actFilter==='ingresos'&&!(t.amount>0&&!t.isTransfer))return false;if(S.actFilter==='transfer'&&!t.isTransfer)return false;
      if(S.actAccount!=='todas'){const ids=[t.account,t.from,t.to].filter(Boolean);if(ids.indexOf(S.actAccount)<0)return false;}
      {const filterVal=Math.abs(FD.transactionAmountARS(t,ACC,S.usdRate));if(S.actAmount==='lt5'&&!(filterVal<5000))return false;if(S.actAmount==='5to20'&&!(filterVal>=5000&&filterVal<=20000))return false;if(S.actAmount==='gt20'&&!(filterVal>20000))return false;}
      if(S.actTag!=='todos'&&(t.tags||[]).indexOf(S.actTag)<0)return false;
      {const label=FD.labelFromISO(t.dateISO||FD.isoFromLabel(t.dateLabel));if(S.actRange==='hoy'&&label!=='Hoy')return false;if(S.actRange==='recientes'&&['Hoy','Ayer'].indexOf(label)<0)return false;}
      if(q){const hay=(t.merchant+' '+(CAT[t.cat]?CAT[t.cat].name:'')+' '+(t.note||'')).toLowerCase();if(hay.indexOf(q)<0)return false;}return true;});
    const activeFilterCount=(S.actAccount!=='todas'?1:0)+(S.actAmount!=='todos'?1:0)+(S.actTag!=='todos'?1:0)+(S.actRange!=='todo'?1:0);
    const catF=S.actCat?CAT[S.actCat]:null;
    const actGroups=this.groupByDate(filtered).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));
    const mkFilter=(key,label)=>({label,onPick:()=>this.setState({actFilter:key}),color:S.actFilter===key?'var(--text)':'var(--text-3)',border:S.actFilter===key?'var(--accent)':'transparent'});
    const actFilters=[mkFilter('todos','Todos'),mkFilter('gastos','Gastos'),mkFilter('ingresos','Ingresos'),mkFilter('transfer','Transferencias')];
    // accounts
    const accountBalanceStr=(k)=>{const a=ACC[k]||{};if(a.balanceKnown===false)return'Saldo pendiente';const isValuedPortfolio=a.kind==='invest'&&Array.isArray(S.assets[k])&&S.assets[k].length>0;return isValuedPortfolio?money(S.balances[k]):nativeMoney(S.balances[k],a.currency);};
    const accView=(k)=>{const a=ACC[k];const m=S.accMeta[k]||{};return {id:k,name:a.name,type:a.type,emoji:a.emoji,fillVar:a.fillVar,balStr:accountBalanceStr(k),chg:m.chg||'',chgColor:m.up?'var(--pos)':'var(--danger)',divider:'var(--hairline)',onOpen:()=>this.setState({push:'accountDetail',acctView:k})};};
    const liquidAccounts=LIQ.map((k,i,arr)=>{const v=accView(k);if(i===arr.length-1)v.divider='transparent';return v;});
    const investAccounts=INV.map((k,i,arr)=>{const v=accView(k);v.onOpen=()=>this.pushScreen('investDetail',{investView:k});if(i===arr.length-1)v.divider='transparent';return v;});
    const debtAccounts=DEBTACC.map((k,i,arr)=>{const v=accView(k);if(i===arr.length-1)v.divider='transparent';return v;});
    // cards
    const cardSaldo=(i)=>S.cards[i]?S.cards[i].saldo:0;
    // What you actually pay this month (statement): this period's purchases + the
    // installments due this month. The full c.saldo is the TOTAL debt (future cuotas).
    const cardResumen=(c)=>FD.cardStatementTotal(c);
    const cards=S.cards.map((c,i)=>({...c,saldoStr:money(cardSaldo(i)),pendingStr:money(FD.cardPendingTotal(c)),onSelect:()=>this.selectCard(i),dim:i===S.cardIdx?'1':'0.5',scale:i===S.cardIdx?'scale(1)':'scale(0.95)'}));
    const cardDots=S.cards.map((c,i)=>({w:i===S.cardIdx?'18px':'6px',bg:i===S.cardIdx?'var(--accent)':'var(--surface-strong)'}));
    const selC=S.cards[S.cardIdx]||S.cards[0]||{cuotas:[],brand:'',vence:'—'};const selSaldo=cardSaldo(S.cardIdx);
    const selCuotas=(selC.cuotas||[]).map((q2,i,arr)=>({name:q2.name,frac:q2.cur+'/'+q2.tot,tot:q2.tot,montoStr:moneyInt(q2.monto),divider:i===arr.length-1?'transparent':'var(--hairline)'}));
    const openCardDetail=()=>this.setState({push:'cardDetail',cardView:S.cardIdx});
    // Assistant preview is deliberately derived from validated local IDs. The model
    // can propose a draft, but it cannot manufacture accounts, cards or categories.
    const assistantDraft=S.assistantDraft?this.hydrateAssistantDraft(S.assistantDraft):null;
    const assistantMissing=assistantDraft?this.assistantMissing(assistantDraft):[];
    const assistantIsTransfer=assistantDraft&&assistantDraft.intent==='transfer';
    const assistantAccount=assistantDraft&&this.spendSourceMeta(assistantIsTransfer?assistantDraft.fromAccountId:assistantDraft.accountId,S);
    const assistantToAccount=assistantDraft&&assistantIsTransfer&&this.spendSourceMeta(assistantDraft.toAccountId,S);
    const assistantCard=assistantDraft&&S.cards.find(c=>c.id===assistantDraft.cardId);
    const assistantCategory=assistantDraft&&CAT[assistantDraft.categoryId];
    const assistantAmount=assistantDraft?(assistantDraft.amount||(assistantDraft.intent==='card_payment'?cardResumen(assistantCard):0)):0;
    const assistantIsIncome=assistantDraft&&assistantDraft.transactionType==='ingreso';
    const assistantIsPayment=assistantDraft&&assistantDraft.intent==='card_payment';
    const assistantIsCardPurchase=assistantDraft&&assistantDraft.intent==='transaction'&&!!assistantDraft.cardId;
    const assistantIsCreateRecurring=assistantDraft&&assistantDraft.intent==='create_recurring';
    const assistantIsBudget=assistantDraft&&assistantDraft.intent==='create_budget';
    const assistantIsCategory=assistantDraft&&assistantDraft.intent==='create_category';
    const assistantIsTag=assistantDraft&&assistantDraft.intent==='create_tag';
    const assistantCurrency=(assistantIsPayment||assistantIsCardPurchase)?'ARS':((assistantAccount&&assistantAccount.currency)||(assistantDraft&&assistantDraft.currency)||'ARS');
    const assistantSecondLabel=assistantIsTransfer?'Destino':(assistantIsPayment||assistantIsCardPurchase)?(assistantIsPayment?'Tarjeta':'Categoría'):assistantIsCategory?'Tipo':assistantIsTag?'Uso':'Categoría';
    const assistantSecond=assistantIsTransfer?(assistantToAccount?assistantToAccount.name:'Sin definir'):assistantIsPayment?(assistantCard?(assistantCard.brand+' ·••• '+assistantCard.last4):'Sin definir'):assistantIsCardPurchase?(assistantCategory?assistantCategory.name:'Sin definir'):assistantIsCategory?(assistantDraft.transactionType==='ingreso'?'Ingreso':'Gasto'):assistantIsTag?'Movimientos y filtros':(assistantCategory?assistantCategory.name:'Sin definir');
    const assistantFirstLabel=(assistantIsBudget||assistantIsCategory||assistantIsTag)?'Acción':assistantIsTransfer?'Origen':assistantIsCardPurchase?'Tarjeta':'Cuenta';
    const assistantFirst=assistantIsBudget?'Límite mensual':assistantIsCategory?'Crear categoría':assistantIsTag?'Crear etiqueta':assistantIsCardPurchase?(assistantCard?(assistantCard.brand+' ·••• '+assistantCard.last4):'Sin definir'):(assistantAccount?assistantAccount.name:'Sin definir');
    const assistantDateLabel=assistantIsCreateRecurring?'Frecuencia':(assistantIsBudget||assistantIsCategory||assistantIsTag)?'Disponibilidad':'Fecha';
    const assistantDate=assistantIsCreateRecurring?('Día '+(assistantDraft.scheduleDay||1)+' de cada mes'):(assistantIsBudget?'Mes actual':(assistantIsCategory||assistantIsTag)?'Al confirmar':(assistantDraft?FD.fullDateLabel(assistantDraft.dateISO):''));
    const assistantGenericMerchant=assistantDraft&&(!assistantDraft.merchant||/^(gasto|ingreso|movimiento)$/i.test(assistantDraft.merchant));
    const assistantDisplayTitle=assistantDraft?(assistantGenericMerchant&&assistantCategory?assistantCategory.name:assistantDraft.merchant):'';
    const assistantHasCounterparty=!!(assistantDraft&&!assistantGenericMerchant&&['transaction','recurring','create_recurring'].includes(assistantDraft.intent));
    const assistantCounterpartyLabel=assistantIsIncome?'Origen':'Comercio';
    const assistantNeedsCategory=assistantMissing.indexOf('la categoría')>=0;
    const assistantCategoryOptions=assistantNeedsCategory?S.catOrder.filter(k=>CAT[k]&&!CAT[k].archived&&CAT[k].type===(assistantIsIncome?'ingreso':'gasto')).map(k=>({label:CAT[k].name,emoji:CAT[k].emoji||'🏷️',onPick:()=>this.setState({assistantDraft:{...assistantDraft,categoryId:k},assistantError:''})})):[];
    let assistantChoiceTitle='',assistantChoiceOptions=[];
    if(assistantDraft&&assistantMissing.indexOf('la cuenta de origen')>=0){assistantChoiceTitle='Elegí la cuenta de origen';assistantChoiceOptions=S.order.filter(id=>ACC[id]&&!S.archived[id]).map(id=>({label:ACC[id].name,emoji:ACC[id].emoji||'🏦',onPick:()=>this.setState({assistantDraft:{...assistantDraft,fromAccountId:id,accountId:id},assistantError:''})}));}
    else if(assistantDraft&&assistantMissing.indexOf('la cuenta de destino')>=0){assistantChoiceTitle='Elegí la cuenta de destino';assistantChoiceOptions=S.order.filter(id=>ACC[id]&&!S.archived[id]&&id!==assistantDraft.fromAccountId).map(id=>({label:ACC[id].name,emoji:ACC[id].emoji||'🏦',onPick:()=>this.setState({assistantDraft:{...assistantDraft,toAccountId:id},assistantError:''})}));}
    else if(assistantDraft&&assistantMissing.indexOf('la tarjeta')>=0){assistantChoiceTitle='Elegí la tarjeta';assistantChoiceOptions=S.cards.map(card=>({label:card.brand+' ·••• '+card.last4,emoji:'💳',onPick:()=>this.setState({assistantDraft:{...assistantDraft,cardId:card.id,cardExplicit:true},assistantError:''})}));}
    else if(assistantDraft&&assistantMissing.some(label=>label==='la cuenta'||label==='la cuenta de pago'||label==='la cuenta o tarjeta'||/^una cuenta en /.test(label))){const wantedCurrency=assistantDraft.currencyExplicit?assistantDraft.currency:null;assistantChoiceTitle=assistantDraft.intent==='card_payment'?'Elegí desde dónde pagar':'Elegí cómo se pagó';const canUseFci=assistantDraft.intent==='card_payment'||assistantDraft.transactionType==='gasto';const accountIds=canUseFci?[...LIQ,...FCI_SPEND.map(source=>source.id)]:LIQ;assistantChoiceOptions=accountIds.map(id=>this.spendSourceMeta(id,S)).filter(meta=>meta&&(!wantedCurrency||meta.currency===wantedCurrency)).map(meta=>({label:meta.name,emoji:meta.emoji||'🏦',onPick:()=>this.setState({assistantDraft:{...assistantDraft,accountId:meta.id,cardId:assistantDraft.intent==='card_payment'?assistantDraft.cardId:''},assistantError:''})}));if(assistantDraft.intent==='transaction'&&assistantDraft.transactionType==='gasto'&&wantedCurrency!=='USD')assistantChoiceOptions.push(...S.cards.map(card=>({label:card.brand+' ·••• '+card.last4,emoji:'💳',onPick:()=>this.setState({assistantDraft:{...assistantDraft,accountId:'',cardId:card.id,cardExplicit:true,currency:'ARS'},assistantError:''})})));}
    const assistantUsageText='Procesado en tu dispositivo · gratis · sin tokens';
    const assistantAnswer=S.assistantAnswer&&S.assistantAnswer.matched?S.assistantAnswer:null;
    const assistantSuggestions=[
      {icon:'🧾',title:'Gastos de ayer',copy:'Qué pagaste y dónde',prompt:'¿En qué gasté ayer?'},
      {icon:'↗️',title:'Comparar el mes',copy:'Qué explica el cambio',prompt:'¿Por qué gasté más este mes?'},
      {icon:'＋',title:'Registrar un gasto',copy:'Monto, comercio y categoría',prompt:'Gasté 10 mil en ropa'},
      {icon:'◎',title:'Mi patrimonio',copy:'Disponible, invertido y deudas',prompt:'¿Cuál es mi patrimonio?'},
    ].map(item=>({...item,onPick:()=>this.setState({assistantText:item.prompt,assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null},()=>this.submitAssistant())}));
    // detail
    let det={};
    if(S.detailId){const t=S.txns.find(x=>x.id===S.detailId);if(t){const C=CAT[t.cat]||{};const isPagoD=t.type==='pago';const isInc=t.amount>0&&!t.isTransfer;const accId=t.account||t.from;const txnCurrency=FD.transactionCurrency(t,ACC),txnSymbol=txnCurrency==='USD'?'US$':'$';const iso=t.dateISO||FD.isoFromLabel(t.dateLabel);det={dEmoji:isPagoD?'💳':C.emoji,dFillVar:isPagoD?'--cat-tarjetas-fill':cFill(t.cat),dMerchant:t.merchant,dAmountStr:(t.amount>=0?'+':'-')+txnSymbol+this.fmtNum(Math.abs(t.amount)),dAmtColor:isInc?'var(--pos)':'var(--text)',dCatName:isPagoD?'Pago de tarjeta':C.name,dAccountName:ACC[accId]?ACC[accId].name:'—',dDate:FD.fullDateLabel(iso),dNote:t.note||'Sin nota',dHasTags:(t.tags||[]).length>0,dTags:(t.tags||[]).map(x=>({label:x}))};}}
    // add form
    const typeNames={gasto:'Nuevo gasto',ingreso:'Nuevo ingreso',transfer:'Transferencia',inversion:'Inversión'};
    const mkType=(key,label)=>({label,onPick:()=>this.setState({addType:key,addCat:key==='ingreso'?'ingreso':'comida',addAmount:S.addAmount,addCatTouched:false,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false}),bg:S.addType===key?'var(--seg-active)':'var(--surface)',color:S.addType===key?'var(--text)':'var(--text-2)'});
    const typeTabs=[mkType('gasto','Gasto'),mkType('ingreso','Ingreso'),mkType('transfer','Transferencia')];
    const amtColorByType=S.addType==='gasto'?'var(--danger)':S.addType==='ingreso'?'var(--pos)':'var(--text)';
    const amtSign=S.addType==='gasto'?'-':S.addType==='ingreso'?'+':'';
    const accA=this.spendSourceMeta(S.addAccount,S)||{},accB=ACC[S.addTo]||{},catA=CAT[S.addCat]||{};
    const presetDates=['Hoy','Ayer','Anteayer'];
    const mkDate=(label)=>({label,custom:false,onPick:()=>this.setState({addDate:label,addDateISO:FD.isoFromLabel(label)}),bg:S.addDate===label?'var(--accent)':'var(--surface)',color:S.addDate===label?'var(--on-accent)':'var(--text)'});
    const customActive=presetDates.indexOf(S.addDate)<0;
    const dateOptions=[mkDate('Hoy'),mkDate('Ayer'),mkDate('Anteayer'),{label:customActive?S.addDate:'Otra…',custom:true,onPick:()=>this.setState({subsheet:'customDate',customDateText:S.addDateISO||FD.todayKey()}),bg:customActive?'var(--accent)':'var(--surface)',color:customActive?'var(--on-accent)':'var(--text-2)'}];
    const tagChips=S.tagSugg.map(tg=>{const on=S.addTags.indexOf(tg)>=0;return {label:tg,onToggle:()=>this.setState(s=>({addTags:on?s.addTags.filter(x=>x!==tg):[...s.addTags,tg]})),bg:on?'var(--cat-inversion-fill)':'var(--surface)',color:on?'var(--text)':'var(--text-2)',border:on?'var(--accent)':'transparent'};});
    const openNewTag=()=>this.setState({subsheet:'newTag'});
    // keypad
    const order=['1','2','3','4','5','6','7','8','9',',','0','back'];
    const keypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.backspace():()=>this.press(l)}));
    // picker
    let pickerTitle='',pickerOptions=[];const sub=S.subsheet;
    const accOpt=(k,onPick,selKey)=>{const meta=this.spendSourceMeta(k,S)||{};return{label:meta.name||'Fuente',emoji:meta.emoji||'◉',fillVar:meta.fillVar||'--cat-inversion-fill',selected:selKey===k,onPick};};
    if(sub==='pickAccount'){pickerTitle=S.addType==='gasto'?'Pagar con':(S.addType==='transfer'||S.addType==='inversion'?'Cuenta de origen':'Cuenta');const spendIds=LIQ.concat(FCI_SPEND.map(source=>source.id));const ids=(S.addType==='inversion')?LIQ:(S.addType==='transfer'?LIQ.concat(INV):(S.addType==='gasto'?spendIds:LIQ));pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addAccount:k,subsheet:null}),S.addAccount));}
    else if(sub==='pickTo'){pickerTitle='Cuenta de destino';const ids=(S.addType==='inversion')?INV:LIQ.concat(INV);pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addTo:k,subsheet:null}),S.addTo));}
    else if(sub==='pickCat'){pickerTitle='Categoría';const ids=S.addType==='ingreso'?S.catOrder.filter(k=>CAT[k]&&CAT[k].type==='ingreso'&&!CAT[k].archived):expKeys;pickerOptions=ids.map(k=>({label:CAT[k].name,emoji:CAT[k].emoji,fillVar:cFill(k),selected:S.addCat===k,onPick:()=>this.setState({addCat:k,subsheet:null,addCatTouched:true})}));}
    // quick
    const quickOptions=[
      {label:'Gasto',sub:'Registrar una salida',icon:'−',iconVar:'--cat-auto-icon',fillVar:'--cat-auto-fill',onPick:()=>this.openAdd('gasto')},
      {label:'Ingreso',sub:'Sumar dinero',icon:'+',iconVar:'--cat-tarjetas-icon',fillVar:'--cat-tarjetas-fill',onPick:()=>this.openAdd('ingreso')},
      {label:'Transferencia',sub:'Mover entre cuentas',icon:'⇄',iconVar:'--cat-transfer-icon',fillVar:'--cat-transfer-fill',onPick:()=>this.openAdd('transfer')},
      {label:'Comprar o vender activo',sub:'CEDEARs, cripto, renta fija',icon:'↗',iconVar:'--cat-inversion-icon',fillVar:'--cat-inversion-fill',onPick:()=>this.openAssetTrade('buy')},
      {label:'Compra con tarjeta',sub:'Gasto con crédito o cuotas',icon:'💳',iconVar:'--cat-tarjetas-icon',fillVar:'--cat-tarjetas-fill',onPick:()=>this.openCardPurchase(S.cardIdx)},
    ];
    // pay keypad
    const payKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.payPress('back'):()=>this.payPress(l)}));
    // settings segmented helpers
    const seg=(cur,val,on)=>({onPick:on,bg:cur===val?'var(--seg-active)':'transparent',shadow:cur===val?'var(--shadow-pill)':'none',color:cur===val?'var(--text)':'var(--text-2)'});
    const periodSeg=this.PERIODS.map((p,i)=>({label:p,...seg(S.periodIdx,i,()=>this.setState({periodIdx:i}))}));
    const reportPeriodTabs=['Mes','Semana','Año'].map((label,i)=>({label,onPick:()=>this.setState({periodIdx:i}),color:S.periodIdx===i?'var(--text)':'var(--text-3)',border:S.periodIdx===i?'var(--accent)':'transparent'}));
    const currencySeg=['ARS','USD'].map(c=>({label:c,...seg(S.currency,c,()=>this.setState({currency:c}))}));
    const themeSeg=['light','dark'].map(c=>({label:c==='light'?'Claro':'Oscuro',...seg(S.theme,c,()=>this.setState({theme:c}))}));
    const chartSeg=['bars','pills'].map(c=>({label:c==='bars'?'Barras':'Lista',...seg(S.chartStyle,c,()=>this.setState({chartStyle:c}))}));
    // add-account form
    const na=S.newAcc;
    const naTypes=this.ACCTYPES.map(t=>({label:t[0],emoji:t[2],sel:na.type===t[0],onPick:()=>this.setNewAcc({type:t[0],kind:t[1],liquid:t[1]==='liquid'}),bg:na.type===t[0]?'var(--accent)':'var(--surface)',color:na.type===t[0]?'var(--on-accent)':'var(--text)'}));
    const naCurrency=['ARS','USD'].map(c=>({label:c,...seg(na.currency,c,()=>this.setNewAcc({currency:c}))}));
    const naIsLiquidType=na.kind==='liquid';
    // account detail
    let acctD={};
    if(S.acctView&&ACC[S.acctView]){const k=S.acctView,a=ACC[k];const movs=sortedTxns.filter(t=>[t.account,t.from,t.to].indexOf(k)>=0).slice(0,8).map(t=>this.txView(t));
      const am=S.accMeta[k]||{};const fciAsset=((S.assets&&S.assets[k])||[]).find(x=>x.fci);const isFci=!!fciAsset;
      acctD={adName:a.name,adType:a.type,adEmoji:a.emoji,adFillVar:a.fillVar,adBalStr:accountBalanceStr(k),adKindLabel:a.kind==='liquid'?(a.liquid?'Cuenta · cuenta para gastar':'Cuenta'):a.kind==='invest'?'Inversión':'Deuda',adLiquid:!!a.liquid,adMovs:movs,adHasMovs:movs.length>0,
        adHasRend:isFci&&am.rend!=null,adRendStr:((am.rend||0)>=0?'+':'-')+sym+this.fmtNum(Math.abs(displayARS(am.rend||0))),adRendColor:(am.rend||0)>=0?'var(--pos)':'var(--danger)',adChgStr:am.chg||'',adRendPeriodStr:am.asOf?('Último rendimiento · '+FD.timelineLabelFromISO(String(am.asOf).slice(0,10))):'Último rendimiento',
        adHasUnits:!!(fciAsset&&fciAsset.units>0),adUnitsStr:(fciAsset&&fciAsset.units>0)?((fciAsset.unitsEstimated?'≈ ':'')+assetQty(fciAsset)+' cuotapartes'):'',
        adNoMovs:movs.length===0,adTransfer:()=>this.openAddPreset('transfer',k,LIQ.find(x=>x!==k)||INV[0]||k),adEdit:()=>this.openAddAccount(k),adArchive:()=>this.requestConfirm({title:'Archivar cuenta',msg:'La cuenta se ocultará de los selectores activos pero se conservará su historial.',confirmLabel:'Archivar',danger:false,onConfirm:()=>this.archiveAccount(k)}),adDelete:()=>this.requestConfirm({title:'Eliminar cuenta',msg:'Se eliminará la cuenta y dejará de contar en tus totales. Esta acción no se puede deshacer.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.deleteAccount(k)})};}
    // investment detail (per account)
    let invD={};
    if(S.investView&&ACC[S.investView]){const k=S.investView,a=ACC[k];
      const rawAssets=(S.assets&&S.assets[k])||[];
      const assets=rawAssets.map(as=>{const lp=as.lastPrice||as.avg;const value=FD.assetValueARS(as,S.usdRate);const performanceValue=FD.assetPerformanceValueARS(as,S.usdRate);const cost=FD.assetCostARS(as,S.usdRate);const gl=performanceValue-cost;const glPct=cost>0?(gl/cost*100):0;const unknown=!!as.costUnknown;const freshness=FD.quoteFreshness(as);return{name:as.name,ticker:as.ticker,emoji:as.emoji,qtyStr:assetQty(as)+(as.ticker?' '+as.ticker:' u'),avgStr:unknown?'Pendiente':assetNativePrice(as,as.avg),costStr:unknown?'Costo pendiente':money(cost),lastPriceStr:assetNativePrice(as,lp),valueStr:money(value),quoteStr:quoteMeta(as),glStr:unknown?'Sin calcular':((gl>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(gl)))),glPctStr:unknown?'Cargá el costo':((gl>=0?'+':'')+glPct.toFixed(1).replace('.',',')+'%'),glColor:unknown?'var(--text-3)':gl>=0?'var(--pos)':'var(--danger)',manual:freshness==='missing'||freshness==='stale'||freshness==='manual',onUpdatePrice:()=>this.setState({ivSub:'updatePrice',upTicker:as.ticker,atNewPrice:''})};});
      const ivUpKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.atNewPricePress('back'):()=>this.atNewPricePress(l)}));
      const totalValue=rawAssets.reduce((sum,as)=>sum+FD.assetValueARS(as,S.usdRate),0);
      const knownAssets=rawAssets.filter(as=>!as.costUnknown);const knownValue=knownAssets.reduce((sum,as)=>sum+FD.assetPerformanceValueARS(as,S.usdRate),0);
      const totalCost=knownAssets.reduce((sum,as)=>sum+FD.assetCostARS(as,S.usdRate),0);
      const totalGL=knownValue-totalCost;
      const totalGLPct=totalCost>0?(totalGL/totalCost*100):0;
      const ivLastUpdatedStr=S.pricesLastUpdated?('\u00b7 '+new Date(S.pricesLastUpdated).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})):'';
      invD={ivName:a.name,ivEmoji:a.emoji,ivFillVar:a.fillVar,ivBalStr:money(S.balances[k]),ivType:a.type,ivAssets:assets,ivHasAssets:assets.length>0,ivNoAssets:assets.length===0,
        ivHasTotalGL:knownAssets.length>0,ivHasUnknownCost:knownAssets.length<rawAssets.length,ivUnknownCostStr:(rawAssets.length-knownAssets.length)+' '+((rawAssets.length-knownAssets.length)===1?'activo sin costo':'activos sin costo'),ivTotalGLStr:(totalGL>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(totalGL))),ivTotalGLPctStr:(totalGL>=0?'+':'')+totalGLPct.toFixed(1).replace('.',',')+'%',ivTotalGLColor:totalGL>=0?'var(--pos)':'var(--danger)',
        ivCostStr:money(totalCost),ivResultWord:totalGL>=0?'Ganás':'Perdés',ivResultAbsStr:sym+this.fmtInt(Math.abs(displayARS(totalGL))),
        ivFetchPrices:()=>this.fetchPrices(),ivPricesLoading:S.pricesLoading||false,ivLoadingLabel:S.pricesLoading?'Actualizando…':'Actualizar precios',ivHasLastUpdated:!!S.pricesLastUpdated,ivLastUpdatedStr,
        ivBuy:()=>this.openAssetTrade('buy',k),ivSell:()=>this.openAssetTrade('sell',k),ivAdjust:()=>this.openAssetTrade('adjust',k),
        ivSubOpen:S.ivSub==='updatePrice',ivSubClose:()=>this.setState({ivSub:null}),ivUpTicker:S.upTicker,ivUpPriceStr:this.displayAmount(S.atNewPrice),ivUpKeypad,ivUpdatePrice:()=>this.updateAssetPrice(),ivUpSaveOpacity:S.atNewPrice?'1':'0.5'};}
    // ===== PORTFOLIO (all investment holdings combined) =====
    const PALCOLORS=['#0B63CE','#16815D','#6867D9','#1B8CAD','#B7791F','#9A5CC4','#3478A8','#708090'];
    let portAssets=[];
    INV.forEach(k=>{(S.assets[k]||[]).forEach(a=>{const lp=a.lastPrice||a.avg;const isCrypto=this.CRYPTOS.some(x=>x[0]===a.ticker);const isBond=this.BONOS.some(x=>x[0]===a.ticker)||a.unitDivisor===100;const kind=a.fci?'fci':isCrypto?'crypto':isBond?'bonds':'cedears';portAssets.push({account:k,id:a.id,ticker:a.ticker,name:a.name,emoji:a.emoji,qty:a.qty,avg:a.avg,lp,value:FD.assetValueARS(a,S.usdRate),performanceValue:FD.assetPerformanceValueARS(a,S.usdRate),cost:FD.assetCostARS(a,S.usdRate),costUnknown:!!a.costUnknown,kind});});});
    portAssets.sort((a,b)=>b.value-a.value);
    const portValue=portAssets.reduce((s2,a)=>s2+a.value,0);
    const knownPortAssets=portAssets.filter(a=>!a.costUnknown);const knownPortValue=knownPortAssets.reduce((s2,a)=>s2+a.performanceValue,0);
    const portCost=knownPortAssets.reduce((s2,a)=>s2+a.cost,0);
    const portGL=knownPortValue-portCost,portGLPct=portCost>0?portGL/portCost*100:0;
    portAssets.forEach((a,i)=>{a.color=PALCOLORS[i%PALCOLORS.length];a.pct=portValue>0?a.value/portValue*100:0;a.gl=a.costUnknown?null:a.performanceValue-a.cost;a.glPct=!a.costUnknown&&a.cost>0?a.gl/a.cost*100:0;});
    const portRend=S.portMode==='rendimiento';
    const portList=portAssets.map(a=>{const unknown=a.costUnknown;const glStr=unknown?'Cargá el costo':((a.gl>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(a.gl)))),glPctStr=unknown?'Tocá para completarlo':((a.gl>=0?'+':'')+a.glPct.toFixed(1).replace('.',',')+'%'),glColor=unknown?'var(--text-3)':a.gl>=0?'var(--pos)':'var(--danger)';
      return {name:a.name,ticker:a.ticker||'',emoji:a.emoji,color:a.color,pctStr:a.pct.toFixed(0)+'%',
        kind:a.kind,
        primaryStr:portRend?glStr:money(a.value),primaryColor:portRend?glColor:'var(--text)',
        secondaryStr:portRend?glPctStr:(unknown?'Falta costo de compra':(glStr+' · '+glPctStr)),secondaryColor:glColor,
        onOpen:()=>this.openAssetDetail(a.account,a.ticker)};});
    const portGroupMeta={cedears:{label:'CEDEARs y ETFs',icon:'◎'},crypto:{label:'Cripto',icon:'◇'},bonds:{label:'Bonos y ON',icon:'◫'},fci:{label:'Fondos comunes',icon:'◌'}};
    const portSections=['cedears','crypto','bonds','fci'].map(kind=>{const assets=portList.filter(a=>a.kind===kind);const total=portAssets.filter(a=>a.kind===kind).reduce((sum,a)=>sum+a.value,0);return{...portGroupMeta[kind],kind,count:assets.length,summary:assets.length+' '+(assets.length===1?'instrumento':'instrumentos')+' · '+money(total),assets};}).filter(section=>section.count>0);
    const portTools=[
      {label:'CEDEARs',icon:'◎',onOpen:()=>this.openAssetTrade('buy',null,'CEDEAR')},
      {label:'Cripto',icon:'◇',onOpen:()=>this.openAssetTrade('buy',null,'Cripto')},
      {label:'Bonos y ON',icon:'◫',onOpen:()=>this.openAssetTrade('buy',null,'Bono/ON')},
    ];
    // Allocation donut (conic-gradient), same pattern as the Reports donut.
    let portAcc=0;const portDonutN=portAssets.length;const portDonutGap=portDonutN>1?1.4:0;const portDonutSegs=[];
    portAssets.forEach((a,i)=>{const span=portValue>0?a.value/portValue*100:0;const a0=portAcc;const a1=portAcc+span;portAcc=a1;const g=i<portDonutN-1?Math.min(portDonutGap,span*0.4):0;portDonutSegs.push(a.color+' '+a0.toFixed(2)+'% '+(a1-g).toFixed(2)+'%');if(g>0)portDonutSegs.push('var(--bg) '+(a1-g).toFixed(2)+'% '+a1.toFixed(2)+'%');});
    const portDonutGradient=portAssets.length?'conic-gradient('+portDonutSegs.join(',')+')':'var(--surface-strong)';
    const usdRate=S.usdRate||0;const portValueUsd=usdRate>0?portValue/usdRate:0;
    const unknownPortCount=portAssets.length-knownPortAssets.length;const portfolio={portValueStr:money(portValue),portHasAssets:portAssets.length>0,
      portHasKnownCost:knownPortAssets.length>0,portHasUnknownCost:unknownPortCount>0,portUnknownCostStr:unknownPortCount+' '+(unknownPortCount===1?'activo necesita costo de compra':'activos necesitan costo de compra'),
      portResultWord:portGL>=0?'Ganás':'Perdés',portResultAbsStr:sym+this.fmtInt(Math.abs(displayARS(portGL))),portGLPctStr:(portGL>=0?'+':'')+portGLPct.toFixed(1).replace('.',',')+'%',portGLColor:portGL>=0?'var(--pos)':'var(--danger)',
      portHasUsd:usdRate>0&&!S.hideAmounts,portValueUsdStr:'US$ '+this.fmtInt(portValueUsd),portUsdRateStr:'$'+this.fmtInt(usdRate),
      portDonutGradient,portCount:portAssets.length,portList,portSections,portTools,portNoAssets:portAssets.length===0,
      setPortValor:()=>this.setState({portMode:'valor'}),setPortRend:()=>this.setState({portMode:'rendimiento'}),
      portValorBg:portRend?'transparent':'var(--card)',portValorColor:portRend?'var(--text-3)':'var(--text)',portRendBg:portRend?'var(--card)':'transparent',portRendColor:portRend?'var(--text)':'var(--text-3)'};
    // ===== ASSET DETAIL (single holding page) =====
    let assetD={};
    if(S.assetView){const av=S.assetView;const a=(S.assets[av.account]||[]).find(x=>x.ticker===av.ticker);
      if(a){const lp=a.lastPrice||a.avg,value=FD.assetValueARS(a,S.usdRate),performanceValue=FD.assetPerformanceValueARS(a,S.usdRate),cost=FD.assetCostARS(a,S.usdRate),gl=performanceValue-cost,glPct=cost>0?gl/cost*100:0;const accM=ACC[av.account]||{};const isCrypto=this.CRYPTOS.some(x=>x[0]===a.ticker),isBond=this.BONOS.some(x=>x[0]===a.ticker)||a.unitDivisor===100;const unitKind=a.fci?'cuotaparte':isCrypto?'unidad':isBond?'100 nominales':'CEDEAR';
        const fundUnits=Number(a.units||a.qty)||0;const latestFundReturn=a.fci?FD.fciPeriodChange({vcp:a.lastVcp||lp},{vcp:a.previousVcp},fundUnits):null;
        const fundReturnRows=a.fci&&a.fundReturns?[['7 días',a.fundReturns.sevenDays],['30 días',a.fundReturns.thirtyDays],['Este año',a.fundReturns.yearToDate]].filter(row=>row[1]).map(row=>{const period=row[1],percent=Number(period.percent)||0;let amount=Number(period.unitChange)*fundUnits;if(!Number.isFinite(amount)&&percent>-1)amount=value-(value/(1+percent));return{label:row[0],amountStr:signedARS(Number.isFinite(amount)?amount:0),pctStr:(percent>=0?'+':'')+(percent*100).toFixed(2).replace('.',',')+'%',color:percent>=0?'var(--pos)':'var(--danger)'};}):[];
        assetD={adAName:a.name,adATicker:a.ticker||'',adAEmoji:a.emoji,adAFillVar:accM.fillVar||'--cat-inversion-fill',
          adAUnitLabel:'1 '+unitKind,acChangeSuffix:'· '+unitKind,
          adAValueStr:money(value),adAHasUsd:(S.usdRate>0&&!S.hideAmounts),adAValueUsdStr:'≈ US$ '+this.fmtNum(value/(S.usdRate||1)),adAQtyStr:(a.unitsEstimated?'≈ ':'')+assetQty(a)+(a.ticker?' '+a.ticker:' u'),adAQuoteStr:quoteMeta(a),
          adAHasLastReturn:!!latestFundReturn,adALastReturnStr:latestFundReturn?signedARS(latestFundReturn.amount):'',adALastReturnPctStr:latestFundReturn?((latestFundReturn.percent>=0?'+':'')+(latestFundReturn.percent*100).toFixed(2).replace('.',',')+'%'):'',adALastReturnColor:latestFundReturn&&latestFundReturn.percent<0?'var(--danger)':'var(--pos)',adALastReturnDateStr:a.quoteAsOf?('CAFCI · hasta '+FD.timelineLabelFromISO(String(a.quoteAsOf).slice(0,10))):'Último VCP disponible',
          adAHasReturns:fundReturnRows.length>0,adAReturnRows:fundReturnRows,adAReturnsSourceStr:a.fundReturns&&a.fundReturns.sevenDays?('VCP oficial · hasta '+FD.timelineLabelFromISO(a.fundReturns.sevenDays.to)):'CAFCI oficial',
          adAHasRate:!!(a.fci&&Number(a.estimatedAnnualRate)>0),adARateStr:'≈ '+Number(a.estimatedAnnualRate||0).toFixed(2).replace('.',',')+'% TNA estimada',adARateSourceStr:(a.estimatedAnnualRateSource||'VCP del fondo')+(a.estimatedAnnualRateAsOf?(' · '+FD.timelineLabelFromISO(String(a.estimatedAnnualRateAsOf).slice(0,10))):'')+' · referencia, no rendimiento personal',
          adAHasCost:!a.costUnknown,adACostPending:!!a.costUnknown,adACostStr:money(cost),adAResultWord:gl>=0?'Ganás':'Perdés',adAGLPctStr:(gl>=0?'+':'')+glPct.toFixed(1).replace('.',',')+'%',adAGLColor:gl>=0?'var(--pos)':'var(--danger)',
          adACostOpen:S.ivSub==='assetCost',adACostPrefix:FD.assetQuoteCurrency(a)==='USD'?'US$':'$',adACostAmount:this.fmtThousands(S.assetCostAmount),setAdACostAmount:(e)=>this.setState({assetCostAmount:this.cleanNum(e.target.value)}),adAOpenCost:()=>this.openAssetCost(),adACloseCost:()=>this.setState({ivSub:null,assetCostAmount:''}),adASaveCost:()=>this.saveAssetCost(),
          adAAvgStr:assetNativePrice(a,a.avg),adALastStr:assetNativePrice(a,lp),
          adAResultSignStr:(gl>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(gl))),
          acHasPath:!!S.assetChart.path,acDim:S.assetChart.loading?'0.45':'1',acLoadingNoPath:S.assetChart.loading&&!S.assetChart.path,acFail:!S.assetChart.ok&&!S.assetChart.loading&&!S.assetChart.path,
          acPath:S.assetChart.path||'',acArea:S.assetChart.area||'',acColor:'#2E9BEA',acChartClass:(Number(S.assetChart.motion)||0)%2?'fa-chart-motion-a':'fa-chart-motion-b',acMaxStr:S.assetChart.maxStr||'',acMinStr:S.assetChart.minStr||'',acStartLabel:S.assetChart.startLabel||'',acEndLabel:S.assetChart.endLabel||'',
          acChangeStr:S.assetChart.changeStr||'',acChangeColor:S.assetChart.up?'var(--pos)':'var(--danger)',acHasChange:!!S.assetChart.changeStr,acNoChange:!S.assetChart.changeStr,
          acRanges:['1D','1S','1M','Máx'].map(r=>({label:r,onPick:()=>this.setAssetChartRange(r),bg:(S.assetChartRange===r)?'var(--text)':'var(--surface)',color:(S.assetChartRange===r)?'var(--bg)':'var(--text-2)'})),
          adABuy:()=>this.tradeAsset('buy',av.account,a),adASell:()=>this.tradeAsset('sell',av.account,a),adAAdjust:()=>this.tradeAsset('adjust',av.account,a),
          adABack:()=>this.popScreen('investments',{assetView:null})};
        const lots=sortedTxns.filter(t=>t.type==='inversion'&&t.ticker===av.ticker).map(t=>{const buy=(t.amount||0)<=0;const q=t.aqty;const tc=FD.normalizeCurrency(t.currency);return{date:FD.timelineLabelFromISO(t.dateISO||FD.isoFromLabel(t.dateLabel)),kind:buy?'Compraste':'Vendiste',qtyStr:q!=null?((q<1?Number(q).toFixed(6).replace(/\.?0+$/,''):this.fmtInt(q))+' '+av.ticker):'',amountStr:(tc==='USD'?'US$':'$')+this.fmtNum(Math.abs(t.amount||t.val||0)),color:buy?'var(--text)':'var(--pos)'};});
        assetD.adACompras=lots;assetD.adAHasCompras=lots.length>0;}}
    // card detail
    let cardD={};
    {const i=S.cardView,c=S.cards[i]||S.cards[0]||{limit:0,brand:'',bank:'',last4:'',grad:this.CARDGRADS[0],cierre:'—',vence:'—',compras:[],cuotas:[],pendientes:[],pagos:[]};const saldo=cardSaldo(i),pendingTotal=FD.cardPendingTotal(c);const hasLimit=Number(c.limit)>0,avail=hasLimit?Math.max(0,c.limit-saldo):0;
      cardD={cdBrand:c.brand,cdBank:c.bank,cdLast4:c.last4,cdGrad:c.grad,cdSaldoStr:money(saldo),cdResumenStr:money(cardResumen(c)),cdPendingTotalStr:money(pendingTotal),cdHasPending:pendingTotal>0.005,cdDeudaStr:money(saldo),cdHasLimit:hasLimit,cdLimitStr:hasLimit?moneyInt(c.limit):'No cargado',cdAvailStr:moneyInt(avail),cdAvailPct:hasLimit?Math.max(0,Math.min(100,Math.round(avail/c.limit*100)))+'%':'0%',cdCierre:c.cierre,cdVence:c.vence,cdHasPreviousCycle:!!(c.previousClose&&c.previousDue),cdPreviousCycleStr:c.previousClose&&c.previousDue?('Ciclo anterior · cerró '+c.previousClose+' · venció '+c.previousDue):'',
        cdCompras:(c.compras||[]).map((p,j,arr)=>({name:p.name,date:FD.timelineLabelFromISO(p.dateISO||FD.isoFromLabel(p.date)),montoStr:moneyInt(p.monto),divider:j===arr.length-1?'transparent':'var(--hairline)'})),
        cdPending:(c.pendientes||[]).map((p,j,arr)=>({name:p.name,date:FD.timelineLabelFromISO(p.dateISO||FD.isoFromLabel(p.date)),montoStr:moneyInt(p.monto),installmentStr:Number(p.installments)>1?('· '+p.installments+' cuotas'):'',canPost:p.txnId!=null,onPost:()=>this.postPendingPurchase(i,p.txnId),divider:j===arr.length-1?'transparent':'var(--hairline)'})),cdHasPendingRows:(c.pendientes||[]).length>0,cdPendingOnlyAdjustment:pendingTotal>0.005&&(c.pendientes||[]).length===0,
        cdCuotas:(c.cuotas||[]).map((q2,j,arr)=>({name:q2.name,frac:q2.cur+'/'+q2.tot,tot:q2.tot,montoStr:moneyInt(q2.monto),divider:j===arr.length-1?'transparent':'var(--hairline)'})),cdHasCuotas:(c.cuotas||[]).length>0,cdHasCompras:(c.compras||[]).length>0,cdNoCompras:(c.compras||[]).length===0,
        cdPagos:(c.pagos||[]).map((p,j,arr)=>({name:p.name,date:FD.timelineLabelFromISO(p.dateISO||FD.isoFromLabel(p.date)),montoStr:moneyInt(p.monto),divider:j===arr.length-1?'transparent':'var(--hairline)'})),cdHasPagos:(c.pagos||[]).length>0,cdNoPagos:(c.pagos||[]).length===0,
        cdPay:()=>this.setState({push:'payCard',payAmount:'',payAccount:this.paymentSourceIds(S)[0]||''}),cdAddPurchase:()=>this.openCardPurchase(i),cdEdit:()=>this.openAddCard(i),cdDelete:()=>this.requestConfirm({title:'Eliminar tarjeta',msg:'Se eliminará esta tarjeta. No se puede deshacer.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.deleteCard(i)}),
        cdCuotasTotalStr:moneyInt(window.FinanzDomain.cardInstallmentsRemaining(c)),cdCuotasMonthStr:moneyInt((c.cuotas||[]).reduce((a,q)=>a+q.monto,0))};}
    // loans
    let loanD={};
    {const loans=(S.loans||[]);
      const loanItems=loans.map(l=>{const pct=l.originalAmount>0?Math.round((1-l.remaining/l.originalAmount)*100):100;return{id:l.id,person:l.person,concept:l.concept||'',direction:l.direction,remainingStr:nativeMoney(l.remaining,l.currency,true),originalStr:nativeMoney(l.originalAmount,l.currency,true),pct:pct+'%',currency:l.currency,date:l.date,closed:l.remaining<=0,statusColor:l.remaining<=0?'var(--text-3)':l.direction==='me_deben'?'var(--pos)':'var(--danger)',statusLabel:l.remaining<=0?'Saldado':l.direction==='me_deben'?'Me deben':'Le debo',onOpen:()=>this.openLoanDetail(l.id)};});
      const curLoan=loans.find(l=>l.id===S.loanView)||{};
      const loanPayments=(curLoan.payments||[]).map((p,i,arr)=>({amountStr:nativeMoney(p.amount,curLoan.currency,true),date:p.date,note:p.note||'',divider:i===arr.length-1?'transparent':'var(--hairline)'}));
      const loanPayDir=curLoan.direction==='me_deben'?'Registrar cobro':'Registrar pago';
      const loanPayKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.loanPayPress('back'):()=>this.loanPayPress(l)}));
      loanD={isLoansScreen:S.push==='loansScreen',isAddLoan:S.push==='addLoan',isLoanDetail:S.push==='loanDetail',
        loanItems,loanHasItems:loanItems.length>0,loanEmpty:loanItems.length===0,openAddLoan:()=>this.openAddLoan(null),
        nlPerson:S.newLoan.person,setNlPerson:(e)=>this.setNewLoan({person:e.target.value}),
        nlConcept:S.newLoan.concept,setNlConcept:(e)=>this.setNewLoan({concept:e.target.value}),
        nlAmount:S.newLoan.amount,setNlAmount:(e)=>this.setNewLoan({amount:e.target.value}),
        nlDirSeg:[['me_deben','Me deben'],['le_debo','Le debo']].map(d=>({label:d[1],onPick:()=>this.setNewLoan({direction:d[0]}),bg:S.newLoan.direction===d[0]?'var(--seg-active)':'transparent',shadow:S.newLoan.direction===d[0]?'var(--shadow-pill)':'none',color:S.newLoan.direction===d[0]?'var(--text)':'var(--text-2)'})),
        nlCurrency:['ARS','USD'].map(c=>({label:c,...seg(S.newLoan.currency,c,()=>this.setNewLoan({currency:c}))})),
        nlIsEdit:S.newLoan.editId!=null,nlTitle:S.newLoan.editId!=null?'Editar préstamo':'Nuevo préstamo',nlSaveLabel:S.newLoan.editId!=null?'Guardar cambios':'Guardar',
        saveLoan:()=>this.saveLoan(),
        ldPerson:curLoan.person||'',ldConcept:curLoan.concept||'',ldHasConcept:!!(curLoan.concept),ldDirection:curLoan.direction||'me_deben',
        ldRemainingStr:nativeMoney(curLoan.remaining||0,curLoan.currency,true),ldOriginalStr:nativeMoney(curLoan.originalAmount||0,curLoan.currency,true),ldDate:curLoan.date||'',
        ldStatusLabel:curLoan.remaining<=0?'Saldado':curLoan.direction==='me_deben'?'Te deben':'Debés',
        ldStatusColor:curLoan.remaining<=0?'var(--text-2)':curLoan.direction==='me_deben'?'var(--pos)':'var(--danger)',
        ldClosed:!(curLoan.remaining>0),ldOpen:curLoan.remaining>0,
        ldPayments:loanPayments,ldHasPayments:loanPayments.length>0,
        ldPayKeypad:loanPayKeypad,ldPayAmtStr:this.displayAmount(S.loanPayAmount),ldPayDir:loanPayDir,
        ldAddPayment:()=>this.addLoanPayment(),ldPaySaveOpacity:S.loanPayAmount?'1':'0.5',
        ldEdit:()=>this.openAddLoan(S.loanView),ldDelete:()=>this.deleteLoan(S.loanView),ldClose:()=>this.closeLoan(S.loanView),
        ldBack:()=>this.popScreen('loansScreen'),addLoanBack:()=>this.popScreen(S.newLoan.editId!=null?'loanDetail':'loansScreen')};}
    // goals (savings)
    let goalD={};
    {const goals=(S.goals||[]);const GOALEMOJIS=['🎯','🏖️','🚗','🏠','✈️','🎓','💻','📱','💍','🎁'];
      const goalItems=goals.map(g=>{const pct=g.target>0?Math.min(100,Math.round(g.saved/g.target*100)):0;const done=g.target>0&&g.saved>=g.target;return{id:g.id,name:g.name,emoji:g.emoji||'🎯',savedStr:moneyInt(g.saved),targetStr:moneyInt(g.target),pct:pct+'%',barW:pct+'%',done,barColor:done?'var(--pos)':'var(--danger)',pctColor:done?'var(--pos)':'var(--text-2)',statusLabel:done?'¡Completada!':pct+'%',onOpen:()=>this.openGoalDetail(g.id)};});
      const curGoal=goals.find(g=>g.id===S.goalView)||{};
      const gTarget=curGoal.target||0,gSaved=curGoal.saved||0,gPct=gTarget>0?Math.min(100,Math.round(gSaved/gTarget*100)):0,gDone=gTarget>0&&gSaved>=gTarget;
      const goalEntries=(curGoal.entries||[]).map((e,i,arr)=>({amountStr:(e.amount>=0?'+':'-')+moneyInt(Math.abs(e.amount)),date:e.date,color:e.amount>=0?'var(--pos)':'var(--danger)',divider:i===arr.length-1?'transparent':'var(--hairline)'}));
      const goalKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.goalAmountPress('back'):()=>this.goalAmountPress(l)}));
      const ng=S.newGoal;
      goalD={isGoalsScreen:S.push==='goalsScreen',isAddGoal:S.push==='addGoal',isGoalDetail:S.push==='goalDetail',
        goalItems,goalHasItems:goalItems.length>0,goalEmpty:goalItems.length===0,openAddGoal:()=>this.openAddGoal(null),
        ngName:ng.name,setNgName:(e)=>this.setNewGoal({name:e.target.value}),
        ngTarget:ng.target,setNgTarget:(e)=>this.setNewGoal({target:e.target.value}),
        ngEmojiChips:GOALEMOJIS.map(em=>({emoji:em,onPick:()=>this.setNewGoal({emoji:em}),bg:ng.emoji===em?'var(--accent)':'var(--surface)'})),
        ngTitle:ng.editId!=null?'Editar meta':'Nueva meta',ngSaveLabel:ng.editId!=null?'Guardar cambios':'Crear meta',saveGoal:()=>this.saveGoal(),
        addGoalBack:()=>this.popScreen(ng.editId!=null?'goalDetail':'goalsScreen'),
        gdName:curGoal.name||'',gdEmoji:curGoal.emoji||'🎯',gdSavedStr:moneyInt(gSaved),gdTargetStr:moneyInt(gTarget),
        gdPct:gPct+'%',gdBarW:gPct+'%',gdDone:gDone,gdBarColor:gDone?'var(--pos)':'var(--danger)',
        gdRemainingStr:moneyInt(Math.max(0,gTarget-gSaved)),gdStatusLabel:gDone?'¡Meta cumplida!':'Te falta',
        gdAmtStr:this.displayAmount(S.goalAmount),gdKeypad:goalKeypad,gdSaveOpacity:S.goalAmount?'1':'0.5',
        gdAdd:()=>this.addGoalMoney('add'),gdTake:()=>this.addGoalMoney('take'),
        gdEntries:goalEntries,gdHasEntries:goalEntries.length>0,
        gdEdit:()=>this.openAddGoal(S.goalView),gdDelete:()=>this.deleteGoal(S.goalView),
        gdBack:()=>this.popScreen('goalsScreen')};}
    // budgets (monthly limit per category)
    let budgetD={};
    {const B=S.budgets||{};
      const budRows=expKeys.map(k=>{const spent=budgetMonthCat[k]||0;const lim=B[k]||0;const has=lim>0;const pct=has?Math.min(100,Math.round(spent/lim*100)):0;const over=has&&spent>lim;const rem=Math.max(0,lim-spent);
        return{cat:k,name:(CAT[k]||{}).name,emoji:(CAT[k]||{}).emoji,iconVar:cIcon(k),spentStr:moneyInt(spent),limitStr:has?moneyInt(lim):'',hasLimit:has,noLimit:!has,barW:pct+'%',barColor:over?'var(--danger)':(pct>=80?'#E8A13C':'var(--pos)'),statusStr:over?('Te pasaste '+moneyInt(spent-lim)):('Te queda '+moneyInt(rem)),statusColor:over?'var(--danger)':'var(--text-2)',onEdit:()=>this.openBudgetEdit(k)};});
      const withLimit=budRows.filter(r=>r.hasLimit);
      const totalBud=withLimit.reduce((a,r)=>a+((B[r.cat])||0),0);
      const totalSpent=withLimit.reduce((a,r)=>a+(budgetMonthCat[r.cat]||0),0);
      const totalPct=totalBud>0?Math.min(100,Math.round(totalSpent/totalBud*100)):0;
      const editCat=S.budgetCat;const editCatObj=editCat?(CAT[editCat]||{}):{};
      const budKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.budgetAmountPress('back'):()=>this.budgetAmountPress(l)}));
      budgetD={isBudgets:S.push==='budgetsScreen',budRows,budAnyLimit:withLimit.length>0,
        budTotalBudStr:moneyInt(totalBud),budTotalSpentStr:moneyInt(totalSpent),budTotalBarW:totalPct+'%',budTotalBarColor:totalSpent>totalBud?'var(--danger)':'var(--pos)',
        budEditOpen:!!editCat,budEditName:editCatObj.name||'',budEditEmoji:editCatObj.emoji||'',budEditIsSet:editCat?(B[editCat]>0):false,
        budAmtStr:this.displayAmount(S.budgetAmount),budKeypad,budSaveOpacity:S.budgetAmount?'1':'0.5',
        saveBudget:()=>this.saveBudget(),removeBudget:()=>this.removeBudget(),closeBudgetEdit:()=>this.closeBudgetEdit()};}
    // pay card
    const payAccMeta=this.spendSourceMeta(S.payAccount,S)||{},payAccName=payAccMeta.name||'Elegir origen',payAccEmoji=payAccMeta.emoji||'🏦';
    const payCardC=S.cards[S.cardView]||S.cards[0]||{brand:''};
    const payAccOpts=this.paymentSourceIds(S).map(k=>{const meta=this.spendSourceMeta(k,S)||{};return{label:meta.name||'Origen',emoji:meta.emoji||'🏦',fillVar:meta.fillVar||'--cat-inversion-fill',selected:S.payAccount===k,onPick:()=>this.setState({payAccount:k,subsheet:null})};});
    // advanced activity filters
    const fAccounts=[{label:'Todas',k:'todas'}].concat(LIQ.concat(INV).map(k=>({label:ACC[k].name,k}))).map(o=>({label:o.label,onPick:()=>this.setState({actAccount:o.k}),bg:S.actAccount===o.k?'var(--accent)':'var(--surface)',color:S.actAccount===o.k?'var(--on-accent)':'var(--text)'}));
    const fAmounts=[['todos','Cualquiera'],['lt5','< $5K'],['5to20','$5K–$20K'],['gt20','> $20K']].map(o=>({label:o[1],onPick:()=>this.setState({actAmount:o[0]}),bg:S.actAmount===o[0]?'var(--accent)':'var(--surface)',color:S.actAmount===o[0]?'var(--on-accent)':'var(--text)'}));
    const fRanges=[['todo','Todo'],['hoy','Hoy'],['recientes','Recientes']].map(o=>({label:o[1],onPick:()=>this.setState({actRange:o[0]}),bg:S.actRange===o[0]?'var(--accent)':'var(--surface)',color:S.actRange===o[0]?'var(--on-accent)':'var(--text)'}));
    const fTags=[{label:'Todas',k:'todos'}].concat(S.tagSugg.map(t=>({label:'#'+t,k:t}))).map(o=>({label:o.label,onPick:()=>this.setState({actTag:o.k}),bg:S.actTag===o.k?'var(--accent)':'var(--surface)',color:S.actTag===o.k?'var(--on-accent)':'var(--text)'}));
    // onboarding step flags  (0 welcome · 1 choose mode · 2 currency · 3 account · 4 extras)
    const onb={onbStep:S.onbStep,onb0:S.onbStep===0,onb1:S.onbStep===1,onb2:S.onbStep===2,onb3:S.onbStep===3,
      onbDots:[0,1,2,3].map(i=>({bg:i<=S.onbStep?'var(--accent)':'var(--surface-strong)'})),
      onbCardAdded:!!S.onbCard,onbInvestAdded:!!S.onbInvest,
      onbCardCheckBg:S.onbCard?'var(--pos)':'var(--surface)',onbInvestCheckBg:S.onbInvest?'var(--pos)':'var(--surface)',
      onbCardLabel:S.onbCard?'Tarjeta agregada':'Agregar una tarjeta',onbInvestLabel:S.onbInvest?'Inversi\u00f3n agregada':'Agregar una inversi\u00f3n',
      onbNext:()=>this.setState(s=>{const ns=s.onbStep+1;const patch={onbStep:ns};if(ns===2){patch.onbCard=false;patch.onbInvest=false;patch.newAcc={name:'',type:'Banco',kind:'liquid',balance:'',currency:s.currency,liquid:true,editId:null};}return patch;}),onbBack:()=>this.setState(s=>({onbStep:Math.max(0,s.onbStep-1)})),
      onbCreateAcc:()=>{const n=this.state.newAcc;if(!n.name.trim()){this.flashMsg('Pon\u00e9 un nombre');return;}this.addAccountSave(true);this.setState({onbStep:3});},
      onbAddCard:()=>this.setState(s=>({onbCard:!s.onbCard})),
      onbAddInvest:()=>this.setState(s=>({onbInvest:!s.onbInvest})),
      onbFinish:()=>this.finishOnboarding()};
    const periodScope=this.PERIODS[S.periodIdx];
    // card purchase flow
    const cpCardC=S.cards[S.cpCard]||S.cards[0]||{brand:'',last4:''};
    const cpVal=parseFloat((S.cpAmount||'').replace(',','.'))||0;
    const cpInstallChips=[1,3,6,12,18].map(n=>({label:n===1?'1 pago':n+' cuotas',n,onPick:()=>this.setState({cpInstall:n}),bg:S.cpInstall===n?'var(--accent)':'var(--surface)',color:S.cpInstall===n?'var(--on-accent)':'var(--text)'}));
    const cpStatusSeg=[['posted','Contabilizada'],['pending','Pendiente']].map(([value,label])=>({label,onPick:()=>this.setState({cpStatus:value}),bg:S.cpStatus===value?'var(--seg-active)':'transparent',shadow:S.cpStatus===value?'var(--shadow-pill)':'none',color:S.cpStatus===value?'var(--text)':'var(--text-2)'}));
    const cpInstallPreview=S.cpInstall>1&&cpVal>0?(S.cpInstall+' × '+sym+this.fmtInt(cpVal/S.cpInstall)):'';
    const cpKeypad=order.map(l=>({label:l,isBack:l==='back',isNum:l!=='back',onPress:l==='back'?()=>this.cpPress('back'):()=>this.cpPress(l)}));
    const cpCatC=CAT[S.cpCat]||{};
    let cpPickerTitle='',cpPickerOptions=[];
    if(S.cpSub==='card'){cpPickerTitle='Tarjeta';cpPickerOptions=S.cards.map((c,i)=>({label:c.brand+' ·••• '+c.last4,emoji:'💳',fillVar:'--cat-tarjetas-fill',selected:S.cpCard===i,onPick:()=>this.setState({cpCard:i,cpSub:null})}));}
    else if(S.cpSub==='cat'){cpPickerTitle='Categoría';cpPickerOptions=expKeys.map(k=>({label:CAT[k].name,emoji:CAT[k].emoji,fillVar:cFill(k),selected:S.cpCat===k,onPick:()=>this.setState({cpCat:k,cpSub:null})}));}
    // asset trade flow
    const atHeld=(S.assets[S.atAccount]||[]).find(a=>a.ticker===S.atTicker);
    const atTotalN=this.parseNum(S.atTotal);const atManualQty=this.parseNum(S.atQty);const atAutoQty=!!(S.atMode!=='adjust'&&atHeld&&atHeld.fci);const atMktUnitARS=atHeld?FD.assetUnitValueARS(atHeld,S.usdRate):0;const atQtyN=atAutoQty&&atTotalN>0&&atMktUnitARS>0?atTotalN/atMktUnitARS:atManualQty;
    const atDivisor=atHeld?FD.assetUnitDivisor(atHeld):(S.atType==='Bono/ON'?100:1);const atUnit=atQtyN>0?atTotalN/atQtyN*atDivisor:0;
    const atMktUnit=atHeld?(atHeld.lastPrice||atHeld.avg):0;const atTradeCurrency=atHeld?FD.assetQuoteCurrency(atHeld):(S.atType==='Cripto'?'USD':'ARS');
    const atModeSeg=[['buy','Comprar'],['sell','Vender'],['adjust','Conciliar']].map(m=>({label:m[1],onPick:()=>this.setState({atMode:m[0],atTicker:'',atName:'',atEmoji:'',atSearch:'',atQty:'',atTotal:''}),bg:S.atMode===m[0]?'var(--seg-active)':'transparent',shadow:S.atMode===m[0]?'var(--shadow-pill)':'none',color:S.atMode===m[0]?'var(--text)':'var(--text-2)'}));
    const atTypeChips=['CEDEAR','Cripto','Bono/ON','FCI'].map(t=>({label:t,onPick:()=>this.setAtType(t),bg:S.atType===t?'var(--accent)':'var(--surface)',color:S.atType===t?'var(--on-accent)':'var(--text)'}));
    // Asset pick-list: when selling, the assets you actually hold; when buying, a
    // curated list for the chosen type. Tapping fills the ticker (no typing needed).
    const atHeldPick=(S.assets[S.atAccount]||[]).filter(a=>S.atType==='FCI'?a.fci:S.atType==='Cripto'?this.CRYPTOS.some(x=>x[0]===a.ticker):S.atType==='Bono/ON'?(this.BONOS.some(x=>x[0]===a.ticker)||a.unitDivisor===100):(!a.fci&&!this.CRYPTOS.some(x=>x[0]===a.ticker)&&a.unitDivisor!==100)).map(a=>[a.ticker,a.name,a.emoji]);
    const atBuyPick=S.atType==='FCI' ? [...this.FCIS,...(S.assets[S.atAccount]||[]).filter(a=>a.fci&&!this.FCIS.some(row=>row[0]===a.ticker)).map(a=>[a.ticker,a.name,a.emoji])]
      : S.atType==='Cripto' ? this.CRYPTOS
      : S.atType==='Bono/ON' ? this.BONOS
      : this.CEDEARS;
    const atPickRaw=S.atMode==='sell'?atHeldPick:S.atMode==='adjust'?[...atHeldPick,...atBuyPick.filter(row=>!atHeldPick.some(held=>held[0]===row[0]))]:atBuyPick;
    const atQuery=(S.atSearch||'').trim().toLowerCase();const atSuggestions=atPickRaw.filter(x=>x&&x[0]&&(!atQuery||((x[0]+' '+(x[1]||'')).toLowerCase().indexOf(atQuery)>=0))).map(x=>({ticker:x[0],name:x[1]||x[0],emoji:x[2]||'📈',selected:S.atTicker===x[0],onPick:()=>this.pickAsset(x[0],x[1],x[2])}));
    const atHasSuggestions=atSuggestions.length>0;
    const atAccC=ACC[S.atAccount]||{},atSourceC=ACC[S.atSource]||{};
    let atPickerTitle='',atPickerOptions=[];
    if(S.atSub==='acc'){atPickerTitle='Cuenta de inversión';atPickerOptions=INV.map(k=>({label:ACC[k].name,emoji:ACC[k].emoji,fillVar:ACC[k].fillVar,selected:S.atAccount===k,onPick:()=>this.setState({atAccount:k,atTicker:'',atName:'',atEmoji:'',atSub:null})}));}
    else if(S.atSub==='src'){atPickerTitle=S.atMode==='buy'?'Pagar con':'Acreditar en';atPickerOptions=LIQ.map(k=>({label:ACC[k].name,emoji:ACC[k].emoji,fillVar:ACC[k].fillVar,selected:S.atSource===k,onPick:()=>this.setState({atSource:k,atSub:null})}));}
    // ===== REPORTS =====
    const repIncome=periodIE.income, repExpense=periodIE.expense, repNet=repIncome-repExpense;
    const previousSummary=convertedSummary(FD.comparablePreviousPeriodTxns(sortedTxns,S.periodIdx,new Date()));
    const previousExpense=previousSummary.expense;const comparisonNames=['mismo tramo del mes anterior','mismos días de la semana anterior','mismo tramo del año anterior'];
    let repComparisonStr='Sin gastos antes',repComparisonCopy='No hubo gastos en el '+comparisonNames[S.periodIdx]+'.',repComparisonColor='var(--text-2)';
    if(previousExpense>0){const change=(repExpense-previousExpense)/previousExpense*100;repComparisonStr=(change>=0?'+':'')+change.toFixed(0).replace('.',',')+'%';repComparisonCopy=change>0.5?'Gastaste más que en el '+comparisonNames[S.periodIdx]+'.':change<-.5?'Gastaste menos que en el '+comparisonNames[S.periodIdx]+'.':'Gastaste prácticamente lo mismo.';repComparisonColor=change>0.5?'var(--danger)':change<-.5?'var(--pos)':'var(--text-2)';}
    const repSavingsRate=repIncome>0?repNet/repIncome*100:null;
    const repIncPct=repIncome+repExpense>0?Math.round(repIncome/(repIncome+repExpense)*100):50;
    const repMovCount=periodTx.filter(t=>t.amount<0&&!t.isTransfer).length;
    const repByCat=expKeys.map(k=>({k,t:periodCat[k]||0})).filter(x=>x.t>0).sort((a,b)=>b.t-a.t);
    const repCatRows=repByCat.slice(0,5).map(x=>({name:(CAT[x.k]||{}).name,emoji:(CAT[x.k]||{}).emoji,fillVar:cFill(x.k),iconVar:cIcon(x.k),amountStr:money(x.t),pct:Math.max(3,Math.round(x.t/Math.max(repExpense,1)*100))+'%',pctOf:repExpense>0?Math.round(x.t/repExpense*100)+'%':'0%',onOpen:()=>this.navigateTab('actividad',{actCat:x.k,actFilter:'gastos',actSearch:''})}));
    const rawRhythm=FD.reportBuckets(sortedTxns,S.periodIdx,new Date(),t=>t.isTransfer||Number(t.amount)>=0?0:Math.abs(FD.transactionAmountARS(t,ACC,S.usdRate)));const rhythmMax=Math.max.apply(null,rawRhythm.map(row=>row.value).concat([1]));
    const repRhythmRows=rawRhythm.map(row=>({label:row.label,amountStr:row.value>0&&!S.hideAmounts?(sym+this.abbr(displayARS(row.value))):'',height:row.value>0?Math.max(6,Math.round(row.value/rhythmMax*100))+'%':'2px',dim:row.value>0?'1':'.28'}));
    const peakRhythm=rawRhythm.reduce((best,row)=>row.value>best.value?row:best,{label:'',value:0});
    const topCategory=repByCat[0];const repInsightTitle=topCategory?((CAT[topCategory.k]||{}).name+' fue tu mayor categoría'):'Todavía no hay una categoría principal';const repInsightCopy=topCategory?(money(topCategory.t)+' · '+Math.round(topCategory.t/Math.max(repExpense,1)*100)+'% de tus gastos del período'):'Registrá gastos para ver qué explica tus consumos.';
    // Net-worth trend (patrimonio over time) from daily snapshots.
    const hist=(S.history||[]);let trend={trendHas:false,trendSingle:hist.length===1};
    if(hist.length>=2){const vals=hist.map(h=>h.pat);const sp=this.sparkPath(vals,320,80,8);const first=vals[0],last=vals[vals.length-1];const up=last>=first;const chg=first!==0?(last-first)/Math.abs(first)*100:0;
      const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];const fmtD=(k)=>{const p=String(k).split('-');return p.length===3?(parseInt(p[2],10)+' '+MES[parseInt(p[1],10)-1]):k;};
      trend={trendHas:true,trendSingle:false,trendPath:sp.path,trendArea:sp.area,trendColor:up?'var(--pos)':'var(--danger)',trendMaxStr:money(sp.max),trendMinStr:money(sp.min),trendStartLabel:fmtD(hist[0].d),trendEndLabel:fmtD(hist[hist.length-1].d),trendChangeStr:(chg>=0?'+':'')+chg.toFixed(1).replace('.',',')+'%',trendChangeColor:up?'var(--pos)':'var(--danger)',trendCurrentStr:money(last)};}
    // Spending by account (cash/bank expenses, i.e. not card purchases).
    const acctSpend={};periodTx.forEach(t=>{if(t.amount<0&&!t.isTransfer&&!t.onCard){const a=t.account;if(a)acctSpend[a]=(acctSpend[a]||0)+Math.abs(FD.transactionAmountARS(t,ACC,S.usdRate));}});
    const repByAcct=Object.keys(acctSpend).filter(a=>ACC[a]).map(a=>({name:ACC[a].name,emoji:ACC[a].emoji,fillVar:ACC[a].fillVar,amountStr:money(acctSpend[a]),v:acctSpend[a]})).sort((a,b)=>b.v-a.v);
    const repHasByAcct=repByAcct.length>0;
    // Spending by card this period (real card purchases, not the running balance).
    const cardSpend={};periodTx.forEach(t=>{if(t.amount<0&&!t.isTransfer&&t.onCard&&t.card)cardSpend[t.card]=(cardSpend[t.card]||0)+Math.abs(FD.transactionAmountARS(t,ACC,S.usdRate));});
    const repByCard=S.cards.map(c=>({name:c.brand+' ·••• '+c.last4,v:cardSpend[c.id]||0,amountStr:money(cardSpend[c.id]||0)})).filter(c=>c.v>0).sort((a,b)=>b.v-a.v);
    const repHasByCard=repByCard.length>0;
    const merchSpend={};periodTx.forEach(t=>{if(t.amount<0&&!t.isTransfer){merchSpend[t.merchant]=(merchSpend[t.merchant]||0)+Math.abs(FD.transactionAmountARS(t,ACC,S.usdRate));}});
    const repTopMerch=Object.keys(merchSpend).map(m=>({name:m,amountStr:money(merchSpend[m]),v:merchSpend[m]})).sort((a,b)=>b.v-a.v).slice(0,5);
    const repHasMerch=repTopMerch.length>0;
    const futCuotas=S.cards.reduce((a,c)=>a+(c.cuotas||[]).reduce((s,q)=>s+q.monto*Math.max(0,q.tot-q.cur),0),0);
    // ===== MÁS entries =====
    // ===== RECURRING =====
    let recD={};
    {const nr=S.newRec||{};const recs=(S.recurring||[]);
      const tName=(r)=>r.targetKind==='card'?((S.cards.find(c=>c.id===r.targetId)||{}).brand||'Tarjeta'):((ACC[r.targetId]||{}).name||'Cuenta');
      const recItems=recs.map(r=>{const recCurrency=r.targetKind==='card'?'ARS':((ACC[r.targetId]||{}).currency||'ARS');const nextISO=r.nextDate&&!Number.isNaN(new Date(r.nextDate).getTime())?window.FinanzDomain.todayKey(new Date(r.nextDate)):'';return{id:r.id,concept:r.concept,emoji:r.type==='ingreso'?'💰':(CAT[r.cat]||{}).emoji||'🔁',amountStr:(r.type==='ingreso'?'+':'-')+nativeMoney(r.amount,recCurrency),amtColor:r.type==='ingreso'?'var(--pos)':'var(--text)',sub:(r.active&&nextISO?'Próximo '+window.FinanzDomain.labelFromISO(nextISO):'Día '+r.day)+' · '+tName(r),active:!!r.active,knobBg:r.active?'var(--pos)':'var(--surface-strong)',knobX:r.active?'22px':'2px',onToggle:()=>this.toggleRec(r.id),onOpen:()=>this.openAddRec(r.id),statusStr:r.active?'Automático':'Pausado'};});
      const nrIsIncome=nr.type==='ingreso';
      const targets=nr.targetKind==='card'?S.cards.map(c=>({id:c.id,label:c.brand+' ·••• '+c.last4,emoji:'💳'})):this.liquidIds().map(k=>({id:k,label:(ACC[k]||{}).name,emoji:(ACC[k]||{}).emoji}));
      recD={isRecScreen:S.push==='recScreen',isAddRec:S.push==='addRec',recItems,recHasItems:recItems.length>0,recEmpty:recItems.length===0,openAddRecBtn:()=>this.openAddRec(null),recBack:()=>this.popScreen(),addRecBack:()=>this.popScreen('recScreen'),
        nrTitle:nr.editId!=null?'Editar recurrente':'Nuevo recurrente',nrTypeSeg:[['gasto','Gasto'],['ingreso','Ingreso']].map(o=>({label:o[1],onPick:()=>this.setNewRec({type:o[0]}),bg:nr.type===o[0]?'var(--accent)':'var(--surface)',color:nr.type===o[0]?'var(--on-accent)':'var(--text)'})),
        nrConcept:nr.concept,setNrConcept:(e)=>this.setNewRec({concept:e.target.value}),nrAmountDisplay:this.fmtThousands(nr.amount),setNrAmount:(e)=>this.setNewRec({amount:this.cleanNum(e.target.value)}),
        nrShowCat:!nrIsIncome,nrCatChips:this.DEFAULT_CAT_ORDER.filter(k=>CAT[k]&&CAT[k].type==='gasto'&&!CAT[k].archived).map(k=>({label:CAT[k].name,emoji:CAT[k].emoji,onPick:()=>this.setNewRec({cat:k}),bg:nr.cat===k?'var(--accent)':'var(--surface)',color:nr.cat===k?'var(--on-accent)':'var(--text)'})),
        nrTargetSeg:(nrIsIncome?[['account','Cuenta']]:[['account','Cuenta'],['card','Tarjeta']]).map(o=>({label:o[1],onPick:()=>this.setNewRec({targetKind:o[0],targetId:''}),bg:nr.targetKind===o[0]?'var(--accent)':'var(--surface)',color:nr.targetKind===o[0]?'var(--on-accent)':'var(--text)'})),
        nrTargetChips:targets.map(t=>({label:t.label,emoji:t.emoji,onPick:()=>this.setNewRec({targetId:t.id}),bg:nr.targetId===t.id?'var(--accent)':'var(--surface)',color:nr.targetId===t.id?'var(--on-accent)':'var(--text)'})),
        nrDay:nr.day,setNrDay:(e)=>this.setNewRec({day:String(e.target.value).replace(/[^0-9]/g,'').slice(0,2)}),nrCardOnly:nr.targetKind==='card',nrDayLabel:nr.targetKind==='card'?'Día que carga':(nr.type==='ingreso'?'Día de cobro':'Día de débito'),
        nrSave:()=>this.saveRec(),nrSaveOpacity:(nr.concept&&nr.amount&&nr.targetId)?'1':'0.5',nrCanDelete:nr.editId!=null,nrDelete:()=>this.deleteRec(nr.editId)};}
    const cloudSub=S.cloud.status==='signed-in'?(S.cloud.conflict?'Elegí qué versión conservar':S.cloud.offline?'Offline · cambios seguros localmente':S.cloud.pending?'Cambios pendientes de subir':(S.cloud.email||'Sesión activa')):(S.cloud.status==='off'?'Datos guardados en este dispositivo':'Entrá para sincronizar y respaldar');
    const masItems=[
      {label:'Mi cuenta',sub:cloudSub,emoji:'☁️',fillVar:'--cat-inversion-fill',onPick:()=>this.pushScreen('cloudScreen')},
      {label:'Cuentas',sub:'Bancos, efectivo y billeteras',emoji:'🏦',fillVar:'--cat-transfer-fill',onPick:()=>this.navigateTab('cuentas')},
      {label:'Tarjetas',sub:'Crédito, cuotas y pagos',emoji:'💳',fillVar:'--cat-tarjetas-fill',onPick:()=>this.navigateTab('tarjetas')},
      {label:'Inversiones',sub:'CEDEARs, FCI, cripto, bonos y ON',emoji:'📈',fillVar:'--cat-inversion-fill',onPick:()=>this.pushScreen('investments')},
      {label:'Presupuestos',sub:'Límite mensual por categoría',emoji:'📊',fillVar:'--cat-compras-fill',onPick:()=>this.pushScreen('budgetsScreen')},
      {label:'Metas de ahorro',sub:'Objetivos y tu progreso',emoji:'🎯',fillVar:'--cat-inversion-fill',onPick:()=>this.pushScreen('goalsScreen')},
      {label:'Préstamos',sub:'Lo que te deben y lo que debés',emoji:'🤝',fillVar:'--cat-otros-fill',onPick:()=>this.pushScreen('loansScreen')},
      {label:'Recurrentes',sub:'Suscripciones, sueldo y pagos fijos',emoji:'🔁',fillVar:'--cat-ocio-fill',onPick:()=>this.openRecScreen()},
      {label:'Categorías',sub:'Gestionar categorías',emoji:'🏷️',fillVar:'--cat-comida-fill',onPick:()=>this.pushScreen('categories')},
      {label:'Etiquetas',sub:'Tus etiquetas',emoji:'#️⃣',fillVar:'--cat-ocio-fill',onPick:()=>this.pushScreen('tags')},
      {label:'Exportar / Importar',sub:'CSV y backup',emoji:'📤',fillVar:'--cat-compras-fill',onPick:()=>this.setState({sheet:'export'})},
      {label:'Ajustes',sub:'Período, moneda y tema',emoji:'⚙️',fillVar:'--cat-mascotas-fill',onPick:()=>this.pushScreen('settings')},
      {label:'Seguridad',sub:'Privacidad y datos',emoji:'🔒',fillVar:'--cat-otros-fill',onPick:()=>this.pushScreen('security')},
    ];
    const tabColor=(t)=>S.tab===t&&!S.push&&!S.sheet?'var(--text)':'var(--text-3)';
    return {
      theme:S.theme,isDark,accentVar,navState:S.navState,tabMotion:S.tabMotion,tabDirection:S.tabDirection,swipeState:S.swipeState,swipeOffset:S.swipeOffset,swipeLayer:(S.push||S.sheet==='assistant'||S.sheet==='add')?'overlay':'tab',beginBackSwipe:(e)=>this.beginBackSwipe(e),moveBackSwipe:(e)=>this.moveBackSwipe(e),endBackSwipe:()=>this.endBackSwipe(),showSun:isDark,showMoon:!isDark,
      toggleTheme:()=>this.setState({theme:isDark?'light':'dark'}),
      isInicio:S.tab==='inicio',isActividad:S.tab==='actividad',isCuentas:S.tab==='cuentas',isTarjetas:S.tab==='tarjetas',isReportes:S.tab==='reportes',isMas:S.tab==='mas',
      navInicio:()=>this.navigateTab('inicio'),navActividad:()=>this.navigateTab('actividad',{actCat:null}),
      navCuentas:()=>this.navigateTab('cuentas'),navTarjetas:()=>this.navigateTab('tarjetas'),
      navReportes:()=>this.navigateTab('reportes'),navMas:()=>this.navigateTab('mas'),
      cInicio:tabColor('inicio'),cActividad:tabColor('actividad'),cReportes:tabColor('reportes'),
      cMas:(['mas','cuentas','tarjetas'].indexOf(S.tab)>=0&&!S.push&&!S.sheet)?'var(--text)':'var(--text-3)',
      balanceMode:S.balanceMode,
      setDisponible:()=>this.setState({balanceMode:'disponible'}),setPatrimonio:()=>this.setState({balanceMode:'patrimonio'}),
      dispBg:S.balanceMode==='disponible'?'var(--seg-active)':'transparent',patBg:S.balanceMode==='patrimonio'?'var(--seg-active)':'transparent',
      dispShadow:S.balanceMode==='disponible'?'var(--shadow-pill)':'none',patShadow:S.balanceMode==='patrimonio'?'var(--shadow-pill)':'none',
      dispColor:S.balanceMode==='disponible'?'var(--text)':'var(--text-2)',patColor:S.balanceMode==='patrimonio'?'var(--text)':'var(--text-2)',
      heroSymbol:S.hideAmounts?'':heroSym,heroInt:S.hideAmounts?'••••':heroParts[0],heroDec:S.hideAmounts?'':(','+heroParts[1]),heroFont:(heroParts[0]||'').length<=7?'62px':(heroParts[0]||'').length<=9?'50px':(heroParts[0]||'').length<=11?'40px':'32px',
      heroSub:(unknownBalanceCount?('Total parcial · '+unknownBalanceCount+' saldo pendiente'):S.balanceMode==='disponible'?('Disponible para usar ahora'+(fciDisponible>0?' · incluye FCI rescatable':'')):'Neto · cuentas + inversiones − deudas')+(heroIsUsd?' · dólar cripto':'')+' · Tocá para ver en '+(heroIsUsd?'pesos':'dólares'),
      toggleHeroCurrency:()=>this.toggleHeroCurrency(),heroAnimName:heroIsUsd?'faMoneyUp':'faMoneyDown',heroToggleHint:heroIsUsd?'Ver en pesos':'Ver en dólares',
      ingresosStr:M('+'+sym+this.fmtInt(displayARS(homeIE.income))),gastosStr:M('-'+sym+this.fmtInt(displayARS(homeIE.expense))),
      periodLabel:this.PERIODS[S.periodIdx],periodScope,
      repExpenseLabel:['Gastos del mes','Gastos de la semana','Gastos del año'][S.periodIdx]||'Gastos del período',
      openSettings:()=>this.pushScreen('settings'),
      isBars:S.chartStyle==='bars',isPills:S.chartStyle==='pills',setBars:()=>this.setState({chartStyle:'bars'}),setPills:()=>this.setState({chartStyle:'pills'}),
      barsBg:S.chartStyle==='bars'?'var(--seg-active)':'transparent',pillsBg:S.chartStyle==='pills'?'var(--seg-active)':'transparent',
      barsColor:S.chartStyle==='bars'?'var(--text)':'var(--text-3)',pillsColor:S.chartStyle==='pills'?'var(--text)':'var(--text-3)',
      chartItems,homeGroups,actGroups,actFilters,actSearch:S.actSearch,setSearch:(e)=>this.setState({actSearch:e.target.value}),
      showBackupBanner,backupBannerTitle,doBackupNow:()=>this.doBackup(),dismissBackup:()=>this.setState({backupDismissedAt:Date.now()}),
      actEmpty:filtered.length===0&&S.txns.length>0,
      openGasto:()=>this.openAdd('gasto'),openIngreso:()=>this.openAdd('ingreso'),openTransfer:()=>this.openAdd('transfer'),openInversion:()=>this.openAdd('inversion'),
      openQuick:()=>this.setState({sheet:'quick'}),closeSheet:()=>this.popScreen(),
      isQuick:S.sheet==='quick',quickOptions,
      isAssistant:S.sheet==='assistant',assistantLegacy:false,openAssistant:()=>this.openAssistant(),closeAssistant:()=>this.closeAssistant(),
      assistantText:S.assistantText,setAssistantText:(e)=>this.setAssistantText(e),toggleAssistantListening:()=>this.toggleAssistantListening(),
      assistantKeyDown:(e)=>this.assistantKeyDown(e),assistantPrompt:S.assistantPrompt,assistantHasPrompt:!!S.assistantPrompt,
      assistantWelcome:!S.assistantPrompt&&!assistantDraft&&!assistantAnswer&&!S.assistantError,assistantSuggestions,
      assistantHasAnswer:!!assistantAnswer,assistantAnswerTitle:assistantAnswer?assistantAnswer.title:'',assistantAnswerText:assistantAnswer?assistantAnswer.text:'',assistantAnswerLines:assistantAnswer&&Array.isArray(assistantAnswer.lines)?assistantAnswer.lines:[],assistantAnswerHasLines:!!(assistantAnswer&&assistantAnswer.lines&&assistantAnswer.lines.length),
      resetAssistantConversation:()=>this.setState({assistantText:'',assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null}),assistantComposerClass:S.assistantListening?'fa-composer-listening':'',
      assistantListenClass:S.assistantListening?'fa-listening':'',assistantHeadline:S.assistantListening?'Te escucho…':'Contame qué pasó',
      assistantMicBg:S.assistantListening?'var(--accent-soft)':'var(--surface)',assistantMicColor:S.assistantListening?'var(--accent)':'var(--text-2)',assistantMicLabel:S.assistantListening?'Detener':'Dictar',assistantLiveCopy:S.assistantListening?'Se está escribiendo mientras hablás…':'Procesado en tu dispositivo · nada se guarda sin confirmar',
      assistantNoDraft:!assistantDraft,assistantHasDraft:!!assistantDraft,assistantHasError:!!S.assistantError,assistantError:S.assistantError,
      assistantExamples:['Me ingresaron 25 mil de un cliente en Galicia','Gasté 25 mil en comida','Creá un presupuesto de 80 mil para comida','Creá un recurrente de gimnasio por 25 mil'].map(label=>({label,onPick:()=>this.setState({assistantText:label,assistantDraft:null,assistantError:'',assistantUsage:null})})),
      submitAssistant:()=>this.submitAssistant(),assistantSubmitOpacity:S.assistantText.trim()&&!S.assistantLoading?'1':'.5',assistantSubmitLabel:S.assistantLoading?'Interpretando…':'Preparar acción',
      assistantDraftTitle:assistantDraft?(assistantIsTag?('#'+assistantDraft.merchant):assistantIsBudget?('Presupuesto · '+(assistantCategory?assistantCategory.name:'categoría')):(assistantDisplayTitle||(assistantIsTransfer?'Transferencia':assistantIsPayment?'Pago de tarjeta':assistantIsIncome?'Ingreso':'Gasto'))):'',
      assistantDraftKind:assistantDraft?(assistantIsTransfer?'Transferencia':assistantIsCardPurchase?'Compra con tarjeta':assistantIsPayment?'Pago de tarjeta':assistantDraft.intent==='recurring'?'Recurrente guardado':assistantIsCreateRecurring?'Nuevo recurrente':assistantIsBudget?'Nuevo presupuesto':assistantIsCategory?'Nueva categoría':assistantIsTag?'Nueva etiqueta':assistantIsIncome?'Ingreso':'Gasto'):'',
      assistantHasCounterparty,assistantCounterpartyLabel,assistantCounterparty:assistantDraft?assistantDraft.merchant:'',
      assistantDraftEmoji:assistantIsTransfer?'🔁':(assistantIsPayment||assistantIsCardPurchase)?'💳':assistantIsBudget?'📊':assistantIsCategory?'🏷️':assistantIsTag?'#️⃣':assistantIsCreateRecurring?'↻':assistantCategory?(assistantCategory.emoji||'✨'):assistantIsIncome?'💰':'✨',
      assistantDraftFill:(assistantIsPayment||assistantIsCardPurchase)?'var(--cat-tarjetas-fill)':assistantCategory?('var('+cFill(assistantDraft.categoryId)+')'):'var(--surface)',
      assistantDraftAmount:assistantDraft?(assistantIsCategory||assistantIsTag?'':(S.hideAmounts?'••••':((assistantIsBudget||assistantIsTransfer?'':assistantIsIncome?'+':'-')+(assistantCurrency==='USD'?'US$':'$')+this.fmtNum(assistantAmount)))):'',assistantDraftColor:assistantIsIncome?'var(--pos)':'var(--text)',
      assistantDraftFirstLabel:assistantFirstLabel,assistantDraftAccount:assistantFirst,assistantDraftSecondLabel:assistantSecondLabel,assistantDraftSecond:assistantSecond,
      assistantDraftDateLabel:assistantDateLabel,assistantDraftDate:assistantDate,assistantHasNote:!!(assistantDraft&&assistantDraft.note),assistantDraftNote:assistantDraft?assistantDraft.note:'',assistantDraftExplanation:assistantDraft?assistantDraft.explanation:'',assistantDraftSource:assistantUsageText,
      assistantDraftIncomplete:assistantMissing.length>0,assistantMissingText:assistantMissing.length?('Falta '+assistantMissing.join(', ')+'. Tocá Editar y completalo antes de guardar.'):'',assistantNeedsCategory,assistantCategoryOptions,
      assistantHasChoices:assistantChoiceOptions.length>0,assistantChoiceTitle,assistantChoiceOptions,
      resetAssistantDraft:()=>this.setState({assistantText:S.assistantPrompt||'',assistantPrompt:'',assistantDraft:null,assistantAnswer:null,assistantError:'',assistantUsage:null}),editAssistantDraft:()=>this.editAssistantDraft(),confirmAssistantDraft:()=>this.confirmAssistantDraft(),assistantConfirmOpacity:assistantMissing.length?'0.45':'1',assistantConfirmLabel:assistantMissing.length?'Faltan datos':'Confirmar',
      patrimonioStr:money(patrimonioNeto),patrimonioBrutoStr:money(patrimonioBruto),disponibleStr:money(disponible),liquidDisponibleStr:money(liquidDisponible),fciDisponibleStr:money(fciDisponible),hasFciDisponible:fciDisponible>0.005,invertidoStr:money(invertido),cardDebtStr:money(cardDebt),debtAccStr:money(debtAcc),hasDebt:(cardDebt+debtAcc)>0,hasCardDebt:cardDebt>0,
      liquidAccounts,investAccounts,debtAccounts,hasDebtAccounts:debtAccounts.length>0,openAddAccount:()=>this.openAddAccount(null),
      cards,cardDots,carouselRef:this.carouselRef,mainScrollRef:this.mainScrollRef,onCardScroll:(e)=>this.onCardScroll(e),
      selSaldoStr:money(selSaldo),selResumenStr:money(cardResumen(selC)),selPendingStr:money(FD.cardPendingTotal(selC)),selHasPending:FD.cardPendingTotal(selC)>0.005,selDeudaStr:money(selSaldo),selVence:selC.vence,selBrand:selC.brand,openCardDetail,
      selCuotas,selHasCuotas:selCuotas.length>0,selNoCuotas:selCuotas.length===0,
      hasCatFilter:!!S.actCat,catFilterName:catF?catF.name:'',catFilterEmoji:catF?catF.emoji:'',catFilterFill:S.actCat?cFill(S.actCat):'--surface',
      clearCatFilter:()=>this.setState({actCat:null}),
      openInvestments:()=>this.pushScreen('investments'),isInvest:S.push==='investments',popScreen:()=>this.popScreen(),
      isDetail:S.push==='txnDetail',editTxn:()=>this.editTxn(),deleteTxn:()=>this.requestConfirm({title:'Eliminar movimiento',msg:'Se eliminará este movimiento y se revertirá su impacto en los saldos. No se puede deshacer.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.deleteTxn()}),duplicateTxn:()=>this.duplicateTxn(),
      isAdd:S.sheet==='add',addTitleText:typeNames[S.addType],scCapture:S.sheet==='add'&&S.shortcutCapture,
      addAmtDisplay:this.displayAmount(S.addAmount),addAmtColor:amtColorByType,addAmtSign:amtSign,
      typeTabs,showCategory:S.addType==='gasto'||S.addType==='ingreso',showFromTo:S.addType==='transfer'||S.addType==='inversion',
      accName:accA.name,accEmoji:accA.emoji,accFillVar:accA.fillVar,toName:accB.name,toEmoji:accB.emoji,toFillVar:accB.fillVar,
      catName:catA.name,catEmoji:catA.emoji,catFillVar:cFill(S.addCat),
      pickAccount:()=>this.setState({subsheet:'pickAccount'}),pickTo:()=>this.setState({subsheet:'pickTo'}),pickCat:()=>this.setState({subsheet:'pickCat'}),
      dateOptions,addTitle:S.addTitle,addMerchantLabel:S.addType==='ingreso'?'Origen':'Comercio',addMerchantPlaceholder:S.addType==='ingreso'?'Ej: Cliente, Juan o regalo':'Ej: Café Martínez',setTitle:(e)=>this.setAddTitle(e.target.value),addNote:S.addNote,setNote:(e)=>this.setState({addNote:e.target.value}),tagChips,
      openKeypad:()=>this.setState({subsheet:'keypad'}),isKeypad:S.subsheet==='keypad',keypad,closeSub:()=>this.setState({subsheet:null}),
      isPicker:sub==='pickAccount'||sub==='pickTo'||sub==='pickCat',pickerTitle,pickerOptions,
      save:()=>this.save(),saveReady:!!S.addAmount,saveOpacity:S.addAmount?'1':'0.5',saveLabel:!S.addAmount?'Ingresá un monto':(S.editId?'Guardar cambios':'Guardar'),
      openNewTag,isCustomDate:sub==='customDate',customDateText:S.customDateText,customDateMax:FD.todayKey(),setCustomDate:(e)=>this.setState({customDateText:e.target.value}),applyCustomDate:()=>this.applyCustomDate(),
      isNewTag:sub==='newTag',newTagText:S.newTagText,setNewTagText:(e)=>this.setState({newTagText:e.target.value}),addCustomTag:()=>this.addCustomTag(),
      activeFilterCount,hasActiveFilters:activeFilterCount>0,openFilters:()=>this.setState({sheet:'filters'}),isFilters:S.sheet==='filters',
      fAccounts,fAmounts,fRanges,fTags,filteredCount:filtered.length,clearFilters:()=>this.setState({actAccount:'todas',actAmount:'todos',actTag:'todos',actRange:'todo'}),
      isSettings:S.push==='settings',periodSeg,reportPeriodTabs,currencySeg,themeSeg,chartSeg,
      hideAmounts:S.hideAmounts,toggleHide:()=>this.setState(s=>({hideAmounts:!s.hideAmounts})),
      hideKnobBg:S.hideAmounts?'var(--accent)':'var(--surface-strong)',hideKnobX:S.hideAmounts?'22px':'2px',
      doExport:()=>this.doExport(),doBackup:()=>this.doBackup(),doImport:()=>this.askImport(),openExportSheet:()=>this.setState({sheet:'export'}),
      isAddAccount:S.push==='addAccount',na,naTypes,naCurrency,naIsLiquidType,
      naSetName:(e)=>this.setNewAcc({name:e.target.value}),naSetBalance:(e)=>this.setNewAcc({balance:e.target.value}),
      naToggleLiquid:()=>this.setNewAcc({liquid:!na.liquid}),naLiquidKnobBg:na.liquid?'var(--pos)':'var(--surface-strong)',naLiquidKnobX:na.liquid?'22px':'2px',
      naSave:()=>this.addAccountSave(false),naTitle:na.editId?'Editar cuenta':'Nueva cuenta',naSaveLabel:na.editId?'Guardar cambios':'Crear cuenta',
      isPayCard:S.push==='payCard',payKeypad,payAmtStr:this.displayAmount(S.payAmount),payAccName,payAccEmoji,payCardBrand:payCardC.brand,payCardSaldoStr:money(cardResumen(payCardC)),
      payTotal:()=>this.setState({payAmount:String(Math.round(cardResumen(payCardC)))}),payMin:()=>this.setState({payAmount:String(Math.round(cardResumen(payCardC)*0.1))}),payDeuda:()=>this.setState({payAmount:String(Math.round(cardSaldo(S.cardView)))}),
      payTotalBg:(S.payAmount&&parseFloat(S.payAmount.replace(',','.'))===Math.round(cardResumen(payCardC)))?'var(--accent)':'var(--surface)',
      payTotalColor:(S.payAmount&&parseFloat(S.payAmount.replace(',','.'))===Math.round(cardResumen(payCardC)))?'var(--on-accent)':'var(--text)',
      pickPayAccount:()=>this.setState({subsheet:'pickPay'}),isPickPay:sub==='pickPay',payAccOpts,paySave:()=>this.payCardSave(),paySaveOpacity:S.payAmount?'1':'0.5',
      isAcctDetail:S.push==='accountDetail',isInvestDetail:S.push==='investDetail',isCardDetail:S.push==='cardDetail',isAssetDetail:S.push==='assetDetail',
      isCardPurchase:S.push==='cardPurchase',cpTitle:S.cpEditId!=null?'Editar compra':'Compra con tarjeta',cpSaveLabel:S.cpEditId!=null?'Guardar cambios':'Registrar compra',cpAmtStr:this.displayAmount(S.cpAmount),cpCardLabel:cpCardC.brand+' ·••• '+cpCardC.last4,
      cpMerchant:S.cpMerchant,setCpMerchant:(e)=>this.setState({cpMerchant:e.target.value}),
      cpCatName:cpCatC.name,cpCatEmoji:cpCatC.emoji,cpCatFillVar:cFill(S.cpCat),
      pickCpCard:()=>this.setState({cpSub:'card'}),pickCpCat:()=>this.setState({cpSub:'cat'}),
      cpInstallChips,cpStatusSeg,cpStatusHelp:S.cpStatus==='pending'?'Todavía figura en Actividad; suma a la deuda, pero no al resumen a pagar.':'Ya figura en Movimientos y forma parte del resumen actual.',cpInstallPreview,cpHasPreview:!!cpInstallPreview,cpDateISO:S.cpDateISO,cpDateMax:FD.todayKey(),setCpDate:(e)=>this.setState({cpDateISO:e.target.value,cpDate:FD.labelFromISO(e.target.value)}),cpKeypad,
      cpOpenKeypad:()=>this.setState({cpSub:'keypad'}),cpIsKeypad:S.cpSub==='keypad',cpCloseSub:()=>this.setState({cpSub:null}),
      cpIsPicker:S.cpSub==='card'||S.cpSub==='cat',cpPickerTitle,cpPickerOptions,
      savePurchase:()=>this.savePurchase(),cpSaveOpacity:S.cpAmount?'1':'0.5',
      isAssetTrade:S.push==='assetTrade',atModeSeg,atTitle:S.atMode==='adjust'?'Conciliar tenencia':S.atMode==='buy'?'Comprar':'Vender',
      atTypeChips,atSuggestions,atHasSuggestions,atCanSearch:atPickRaw.length>0,atNoSuggestions:atPickRaw.length>0&&atSuggestions.length===0,atSearch:S.atSearch,setAtSearch:(e)=>this.setState({atSearch:e.target.value}),atAccName:atAccC.name||'Elegir portafolio',atAccEmoji:atAccC.emoji||'📈',atAccFillVar:atAccC.fillVar||'--cat-inversion-fill',openAtAccount:()=>this.setState({atSub:'acc'}),
      atShowSource:S.atMode!=='adjust',atSourceLabel:S.atMode==='buy'?'Pagar con':'Acreditar en',atSourceName:atSourceC.name||'Elegir cuenta',atSourceEmoji:atSourceC.emoji||'🏦',atSourceFillVar:atSourceC.fillVar||'--cat-transfer-fill',openAtSource:()=>this.setState({atSub:'src'}),
      atTicker:S.atTicker,setAtTicker:(e)=>this.setState({atTicker:e.target.value}),atHasAsset:!!S.atTicker,
      atQtyDisplay:atAutoQty?(atQtyN>0?atQtyN.toFixed(6).replace(/\.?0+$/,''):'Se calcula con el VCP'):this.fmtThousands(S.atQty),atAutoQty,atManualQty:!atAutoQty,atQtyLabel:S.atMode==='adjust'?'Tenencia real':atAutoQty?'Cuotapartes':'Cantidad',setAtQty:(e)=>this.setState({atQty:this.cleanNum(e.target.value)}),atDateISO:S.atDateISO,atDateMax:FD.todayKey(),setAtDate:(e)=>this.setState({atDateISO:e.target.value}),
      atPaidLabel:S.atMode==='adjust'?'Valor actual total':S.atMode==='buy'?'Cuánto pagué':'Cuánto recibí',
      atTotalPrefix:atTradeCurrency==='USD'?'US$':'$',atTotalDisplay:this.fmtThousands(S.atTotal),setAtTotal:(e)=>this.setState({atTotal:this.cleanNum(e.target.value)}),
      atHasUnit:atUnit>0,atUnitStr:(atTradeCurrency==='USD'?'US$':'$')+this.fmtNum(atUnit),atHasMkt:atMktUnit>0,atMktStr:(atTradeCurrency==='USD'?'US$':'$')+this.fmtNum(atMktUnit),
      atSaveLabel:S.atMode==='adjust'?'Conciliar sin mover efectivo':S.atMode==='buy'?'Registrar compra':'Registrar venta',atSaveOpacity:(S.atTicker&&(S.atMode==='adjust'?S.atQty!==''&&S.atTotal!=='':atQtyN&&atTotalN&&S.atSource))?'1':'0.5',
      atIsPicker:!!S.atSub,atPickerTitle,atPickerOptions,atCloseSub:()=>this.setState({atSub:null}),
      saveAssetTrade:()=>this.saveAssetTrade(),
      repIncomeStr:money(repIncome),repExpenseStr:money(repExpense),repNetStr:(repNet>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(repNet))),repNetColor:repNet>=0?'var(--pos)':'var(--danger)',
      repIncPct:repIncPct+'%',repExpPct:(100-repIncPct)+'%',repMovCount,
      repHasSavings:repSavingsRate!=null,repSavingsStr:repSavingsRate==null?'—':((repSavingsRate>=0?'+':'')+repSavingsRate.toFixed(0).replace('.',',')+'%'),repSavingsColor:repSavingsRate!=null&&repSavingsRate>=0?'var(--pos)':'var(--danger)',repAverageStr:repMovCount>0?money(repExpense/repMovCount):'—',repComparisonStr,repComparisonCopy,repComparisonColor,
      repHasRhythm:repExpense>0,repRhythmRows,repPeakStr:peakRhythm.value>0?('Pico '+peakRhythm.label+' · '+money(peakRhythm.value)):'',repInsightTitle,repInsightCopy,
      repCatRows,repHasCategories:repCatRows.length>0,repNoCategories:repCatRows.length===0,repByAcct,repHasByAcct,repByCard,repHasByCard,repTopMerch,repHasMerch,repExpanded:S.reportsExpanded,repBreakdownLabel:S.reportsExpanded?'Ocultar desglose':'Ver desglose',repBreakdownIcon:S.reportsExpanded?'↑':'↓',toggleReportBreakdown:()=>this.setState(s=>({reportsExpanded:!s.reportsExpanded})),...trend,futCuotasStr:money(futCuotas),futHasCuotas:futCuotas>0,
      masItems,
      isCloudScreen:S.push==='cloudScreen',cloudOff:S.cloud.status==='off',cloudSignedIn:S.cloud.status==='signed-in',cloudSignedOut:S.cloud.status==='signed-out',
      cloudEmail:S.cloud.email,cloudPassword:S.cloud.password,cloudSyncing:S.cloud.syncing,cloudSyncOpacity:S.cloud.syncing?'0.5':'1',cloudUserEmail:S.cloud.user?S.cloud.user.email:'',
      cloudConflict:!!S.cloud.conflict,cloudHasError:!!S.cloud.error&&!S.cloud.conflict,cloudError:S.cloud.error,cloudPending:!!S.cloud.pending,cloudOffline:!!S.cloud.offline,
      cloudLastSyncStr:S.cloud.conflict?'Necesita tu decisión':S.cloud.offline?'Sin conexión · trabajando localmente':S.cloud.syncing?'Sincronizando…':S.cloud.pending?'Guardado local · pendiente de subir':S.cloud.lastSync?('Sincronizado '+new Date(S.cloud.lastSync).toLocaleString('es-AR',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})):'Sin sincronizar todavía',
      setCloudEmail:(e)=>this.setCloudEmail(e),setCloudPassword:(e)=>this.setCloudPassword(e),cloudSignUp:()=>this.cloudSignUp(),cloudSignIn:()=>this.cloudSignIn(),cloudSignOut:()=>this.cloudSignOut(),cloudSyncNow:()=>this.cloudSyncNow(),cloudKeepLocal:()=>this.cloudKeepLocal(),cloudUseRemote:()=>this.cloudUseRemote(),cloudBack:()=>this.popScreen(),
      flash:S.flash,hasFlash:!!S.flash,
      hasConfirm:!!S.confirm,confirmTitle:S.confirm?S.confirm.title:'',confirmMsg:S.confirm?S.confirm.msg:'',confirmLabel:S.confirm?S.confirm.confirmLabel:'Confirmar',cancelLabel:(S.confirm&&S.confirm.cancelLabel)?S.confirm.cancelLabel:'Cancelar',
      confirmBtnBg:(S.confirm&&S.confirm.danger)?'var(--danger)':'var(--text)',confirmBtnColor:(S.confirm&&S.confirm.danger)?'#fff':'var(--bg)',
      doConfirm:()=>this.doConfirm(),cancelConfirm:()=>this.cancelConfirm(),noop:(e)=>{if(e&&e.stopPropagation)e.stopPropagation();},
      isExport:S.sheet==='export',askImport:()=>this.askImport(),askImportCsv:()=>this.requestConfirm({title:'Importar CSV',msg:'Seleccioná un CSV con movimientos. Se validará antes de agregarlo a tus datos actuales.',confirmLabel:'Importar CSV',danger:false,onConfirm:()=>this.pickCsvFile()}),
      isSecurity:S.push==='security',
      askReset:()=>this.requestConfirm({title:'Reiniciar datos',msg:'Se borrarán todas tus cuentas, movimientos y tarjetas. Empezás de cero. No se puede deshacer.',confirmLabel:'Reiniciar',danger:true,onConfirm:()=>this.resetData()}),
      // ---- empty states ----
      homeNoAccounts:S.order.filter(k=>!S.archived[k]).length===0, homeHasAccounts:S.order.filter(k=>!S.archived[k]).length>0,
      homeNoMovs:homeTx.length===0, chartEmpty:chartItems.length===0,
      chartShowBars:(S.chartStyle==='bars')&&chartItems.length>0, chartShowPills:(S.chartStyle==='pills')&&chartItems.length>0,
      createFirstAccount:()=>this.openAddAccount(null),
      actNoData:S.txns.length===0, actHasData:S.txns.length>0, addMovementCTA:()=>this.setState({sheet:'quick'}),
      acctEmpty:S.order.filter(k=>!S.archived[k]).length===0, acctHasAny:S.order.filter(k=>!S.archived[k]).length>0,
      cardsEmpty:S.cards.length===0, cardsHasAny:S.cards.length>0,
      repEmpty:(repIncome+repExpense)<=0, repHasData:(repIncome+repExpense)>0,
      investEmpty:INV.length===0, investHasAny:INV.length>0, addInvestment:()=>this.openAssetTrade('buy',null,'CEDEAR'),
      openAddCard:()=>this.openAddCard(null),
      askClearAll:()=>this.requestConfirm({title:'Borrar todo',msg:'Se eliminarán todas las cuentas, movimientos, tarjetas e inversiones. Empezás de cero. No se puede deshacer.',confirmLabel:'Borrar todo',danger:true,onConfirm:()=>this.clearAll()}),
      // ---- category editor ----
      isCatEditor:S.push==='catEditor', ncIsEdit:!!S.newCat.editId,
      ncTitle:S.newCat.editId?'Editar categoría':'Nueva categoría', ncSaveLabel:S.newCat.editId?'Guardar cambios':'Crear categoría',
      ncName:S.newCat.name, ncSetName:(e)=>this.setNewCat({name:e.target.value}),
      ncEmoji:S.newCat.emoji,
      ncEmojis:this.CATEMOJIS.map(em=>({emoji:em,onPick:()=>this.setNewCat({emoji:em}),bg:S.newCat.emoji===em?'var(--accent)':'var(--surface)'})),
      ncTypes:this.CATTYPES.map(t=>({label:t[1],onPick:()=>this.setNewCat({type:t[0]}),bg:S.newCat.type===t[0]?'var(--accent)':'var(--surface)',color:S.newCat.type===t[0]?'var(--on-accent)':'var(--text)'})),
      ncColors:this.CATCOLORS.map((p,i)=>({iconVar:p[0],onPick:()=>this.setNewCat({colorIdx:i}),ring:S.newCat.colorIdx===i?'0 0 0 3px var(--accent)':'0 0 0 1px var(--hairline)'})),
      ncParents:[{label:'Sin categoría madre',k:''}].concat(S.catOrder.filter(k=>CAT[k]&&!CAT[k].archived&&k!==S.newCat.editId&&!CAT[k].parent).map(k=>({label:CAT[k].emoji+' '+CAT[k].name,k}))).map(o=>({label:o.label,onPick:()=>this.setNewCat({parent:o.k}),bg:S.newCat.parent===o.k?'var(--accent)':'var(--surface)',color:S.newCat.parent===o.k?'var(--on-accent)':'var(--text)'})),
      saveCategory:()=>this.saveCategory(),
      catIsArchived:!!(S.newCat.editId&&CAT[S.newCat.editId]&&CAT[S.newCat.editId].archived),
      archiveCatLabel:(S.newCat.editId&&CAT[S.newCat.editId]&&CAT[S.newCat.editId].archived)?'Restaurar':'Archivar',
      archiveCatBtn:()=>{const id=S.newCat.editId;if(!id)return;const arch=CAT[id]&&CAT[id].archived;this.requestConfirm({title:arch?'Restaurar categoría':'Archivar categoría',msg:arch?'La categoría volverá a estar disponible en los selectores.':'La categoría se ocultará de los selectores pero se conserva su historial.',confirmLabel:arch?'Restaurar':'Archivar',danger:false,onConfirm:()=>this.archiveCategory(id)});},
      deleteCatBtn:()=>{const id=S.newCat.editId;if(!id)return;this.requestConfirm({title:'Eliminar categoría',msg:'Sólo se eliminará si no tiene movimientos, presupuestos, reglas ni subcategorías. Si tiene historial, podés archivarla.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.deleteCategory(id)});},
      // ---- tag management ----
      tagsEmpty:S.tagSugg.length===0, tagsHasAny:S.tagSugg.length>0,
      openNewTagScreen:()=>this.openTagEditor(null),
      isTagEditor:S.sheet==='tagEditor', teTitle:S.tagEdit.orig?'Editar etiqueta':'Nueva etiqueta', teIsEdit:!!S.tagEdit.orig,
      teName:S.tagEdit.name, setTeName:(e)=>this.setState(s=>({tagEdit:{...s.tagEdit,name:e.target.value}})), saveTag:()=>this.saveTag(),
      deleteTagBtn:()=>{const t=S.tagEdit.orig;if(!t)return;this.setState({sheet:null});this.requestConfirm({title:'Eliminar etiqueta',msg:'Se quitará #'+t+' de todos los movimientos.',confirmLabel:'Eliminar',danger:true,onConfirm:()=>this.deleteTag(t)});},
      // ---- card add ----
      isAddCard:S.push==='addCard', ncardIsEdit:S.newCard.editId!=null,
      ncardTitle:S.newCard.editId!=null?'Editar tarjeta':'Nueva tarjeta', ncardSaveLabel:S.newCard.editId!=null?'Guardar cambios':'Crear tarjeta',
      ncardBrandSeg:this.CARDBRANDS.map(b=>({label:b,onPick:()=>this.setNewCard({brand:b}),bg:S.newCard.brand===b?'var(--seg-active)':'transparent',shadow:S.newCard.brand===b?'var(--shadow-pill)':'none',color:S.newCard.brand===b?'var(--text)':'var(--text-2)'})),
      ncardBank:S.newCard.bank,setNcardBank:(e)=>this.setNewCard({bank:e.target.value}),
      ncardLast4:S.newCard.last4,setNcardLast4:(e)=>this.setNewCard({last4:e.target.value}),
      ncardLimit:S.newCard.limit,setNcardLimit:(e)=>this.setNewCard({limit:e.target.value}),
      ncardDebt:S.newCard.debt,setNcardDebt:(e)=>this.setNewCard({debt:e.target.value}),
      ncardStatement:S.newCard.statement,setNcardStatement:(e)=>this.setNewCard({statement:e.target.value}),
      ncardPending:S.newCard.pending,setNcardPending:(e)=>this.setNewCard({pending:e.target.value}),
      ncardCierre:S.newCard.cierre,setNcardCierre:(e)=>this.setNewCard({cierre:e.target.value}),
      ncardVence:S.newCard.vence,setNcardVence:(e)=>this.setNewCard({vence:e.target.value}),
      ncardAutopayOn:!!S.newCard.autopay,ncardToggleAutopay:()=>this.setNewCard({autopay:!S.newCard.autopay,autopayAccount:S.newCard.autopayAccount||this.paymentSourceIds(S)[0]||''}),ncardAutopayBg:S.newCard.autopay?'var(--pos)':'var(--surface-strong)',ncardAutopayX:S.newCard.autopay?'22px':'2px',
      ncardAutopayAccounts:this.paymentSourceIds(S).map(k=>{const meta=this.spendSourceMeta(k,S)||{};return{label:meta.name||'Origen',emoji:meta.emoji||'🏦',onPick:()=>this.setNewCard({autopayAccount:k}),bg:S.newCard.autopayAccount===k?'var(--accent)':'var(--surface)',color:S.newCard.autopayAccount===k?'var(--on-accent)':'var(--text)'};}),
      ncardGrads:this.CARDGRADS.map((g,i)=>({grad:g,onPick:()=>this.setNewCard({gradIdx:i}),ring:S.newCard.gradIdx===i?'0 0 0 3px var(--accent)':'0 0 0 1px var(--hairline)'})),
      ncardPreviewGrad:this.CARDGRADS[S.newCard.gradIdx]||this.CARDGRADS[0], ncardPreviewBrand:S.newCard.brand, ncardPreviewBank:S.newCard.bank||'Banco', ncardPreviewLast4:(S.newCard.last4||'').replace(/\D/g,'').slice(-4)||'0000',
      saveCard:()=>this.saveCard(),
      isCategories:S.push==='categories',
      catScreenEmpty:S.catOrder.filter(k=>CAT[k]&&!CAT[k].archived).length===0,
      catScreenHasAny:S.catOrder.filter(k=>CAT[k]).length>0,
      catList:S.catOrder.filter(k=>CAT[k]).map(k=>{const c=CAT[k];const tn=(this.CATTYPES.find(t=>t[0]===c.type)||['','Gasto'])[1];return {id:k,name:c.name,emoji:c.emoji,fillVar:c.fillVar,typeLabel:tn,archived:!!c.archived,rowOpacity:c.archived?'0.55':'1',subLabel:(c.archived?'Archivada · ':'')+tn+(c.parent&&CAT[c.parent]?(' · '+CAT[c.parent].name):''),nameColor:c.archived?'var(--text-3)':'var(--text)',onPick:()=>this.openCatEditor(k)};}),
      addCategory:()=>this.openCatEditor(null),
      isTags:S.push==='tags',tagList:S.tagSugg.map(t=>({label:t,onEdit:()=>this.openTagEditor(t)})),
      ...acctD,...invD,...cardD,...onb,...loanD,...goalD,...budgetD,...portfolio,...assetD,...recD,
      showOnboarding:S.showOnboarding,showTabBar:!S.showOnboarding&&!S.sheet&&!S.confirm&&!S.push,finishOnboarding:()=>this.setState({showOnboarding:false,onbStep:0}),
      ...det,
    };
  }
}

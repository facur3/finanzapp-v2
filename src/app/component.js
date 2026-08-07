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
    this.CEDEARS=[['QQQ','Nasdaq 100','📊'],['SPY','S&P 500','📈'],['AAPL','Apple','🍎'],['AMZN','Amazon','📦'],['MSFT','Microsoft','🪟'],['GOOGL','Google','🔎'],['META','Meta','📘'],['TSLA','Tesla','🚗'],['NVDA','Nvidia','🎮'],['MELI','Mercado Libre','🛒'],['KO','Coca-Cola','🥤'],['DIS','Disney','🏰'],['COIN','Coinbase','🪙'],['BABA','Alibaba','🛍️']];
    this.CRYPTOS=[['BTC','Bitcoin','🪙'],['ETH','Ethereum','💎'],['SOL','Solana','🌅'],['ADA','Cardano','🔷'],['MATIC','Polygon','🟣'],['DOT','Polkadot','⚫']];
    this.BONOS=[['AL30','Bono soberano AL30','🏛️'],['GD30','Global 2030','🏛️'],['AL35','Bono soberano AL35','🏛️'],['GD35','Global 2035','🏛️'],['GD38','Global 2038','🏛️'],['AE38','Bono soberano AE38','🏛️'],['TZX27','Bono CER 2027','🛡️'],['TZX28','Bono CER 2028','🛡️']];
    this._MONTHS=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    this.CATTYPES=[['gasto','Gasto'],['ingreso','Ingreso'],['transfer','Transferencia'],['inversion','Inversión']];
    this.CARDBRANDS=['Visa','Mastercard','Amex'];
    this.STORAGE_KEY='finanzapp:v2:state';
    this.LEGACY_STORAGE_KEY='finanzapp.v2.state';
    // Supabase cloud sync (optional). Fill url + anonKey to enable accounts.
    // Empty = app stays 100% local. The anon key is public/safe to ship (RLS protects rows).
    this.SUPA={url:'https://mtijtrdltfyfvnvcdxbx.supabase.co',anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10aWp0cmRsdGZ5ZnZudmNkeGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NTUwNDEsImV4cCI6MjA5ODQzMTA0MX0.Q8iyn9c5DNThMCojTuQy38I4ffkLnefghru4OBO5Ohk'};
    // Local "last data change" timestamp — drives last-write-wins cloud sync.
    this._localMod=Number((typeof localStorage!=='undefined'&&localStorage.getItem('finanzapp:mod'))||0)||0;
    this.carouselRef=React.createRef();
    this.mainScrollRef=React.createRef();
    this.PALETTE=[['--cat-transfer-icon','--cat-transfer-fill'],['--cat-comida-icon','--cat-comida-fill'],['--cat-ocio-icon','--cat-ocio-fill'],['--cat-compras-icon','--cat-compras-fill'],['--cat-mascotas-icon','--cat-mascotas-fill'],['--cat-auto-icon','--cat-auto-fill']];
    this.PERIODS=['Este mes','Esta semana','Este año'];
    this.SCOPES=['Todas las cuentas','Lista privada','Compartida'];
    this.ACCTYPES=[['Banco','liquid','🏦'],['Efectivo','liquid','💵'],['Billetera','liquid','📲'],['Inversión','invest','📈'],['Tarjeta','debt','💳'],['Deuda','debt','📉']];
    this.state=Object.assign({
      theme:props.defaultTheme||'light', chartStyle:props.defaultChart||'bars',
      tab:'inicio', push:null, sheet:null, subsheet:null, navState:'idle',tabMotion:'idle',tabDirection:'next',reportsExpanded:false,
      balanceMode:'disponible', heroCurrency:'ARS', periodIdx:0, scopeIdx:0, currency:'ARS', hideAmounts:false,
      actFilter:'todos', actSearch:'', actCat:null, actAccount:'todas', actAmount:'todos', actTag:'todos', actRange:'todo',
      cardIdx:0, detailId:null, editId:null, acctView:null, investView:null, assetView:null, cardView:0,
      assetChartRange:'1M', assetChart:{loading:false,ok:false,range:'1M'}, portMode:'valor',
      addType:'gasto', addAmount:'', addTitle:'', addNote:'', addCat:'comida', addAccount:'banco', addTo:'cedears', addDate:'Hoy', addDateISO:window.FinanzDomain.todayKey(), addTags:[], addCatTouched:false, addSuggestedKey:null, addSuggestedTags:[],
      newTagText:'', customDateText:'',
      newAcc:{name:'',type:'Banco',kind:'liquid',balance:'',currency:'ARS',liquid:true,editId:null},
      newCat:{name:'',emoji:'🍔',type:'gasto',colorIdx:0,parent:'',editId:null},
      newCard:{brand:'Visa',bank:'',last4:'',limit:'',cierre:'',vence:'',gradIdx:0,autopay:false,autopayAccount:'',editId:null},
      tagEdit:{name:'',orig:null},
      payAccount:'banco', payAmount:'',
      cpCard:0, cpAmount:'', cpMerchant:'', cpCat:'compras', cpDate:'Hoy', cpDateISO:window.FinanzDomain.todayKey(), cpInstall:1, cpSub:null,
      atMode:'buy', atAccount:'cedears', atType:'CEDEAR', atTicker:'', atName:'', atEmoji:'', atSearch:'', atQty:'', atTotal:'', atDateISO:window.FinanzDomain.todayKey(), atPrice:'', atFees:'', atSource:'banco', atSub:null,
      loanView:null, newLoan:{person:'',direction:'me_deben',concept:'',amount:'',currency:'ARS',editId:null}, loanPayAmount:'', goalView:null, newGoal:{name:'',emoji:'🎯',target:'',editId:null}, goalAmount:'', budgetCat:null, budgetAmount:'', ivSub:null, upTicker:'', atNewPrice:'', pricesLoading:false, pricesLastUpdated:null,
      newRec:{type:'gasto',concept:'',amount:'',cat:'otros',targetKind:'account',targetId:'',day:'1',editId:null},
      onbStep:0, onbCard:false, onbInvest:false, flash:'', confirm:null,
      showOnboarding:true,
      shortcutCapture:false, // true only when source=shortcut opened the add-expense sheet
      assistantText:'',assistantListening:false,assistantLoading:false,assistantDraft:null,assistantError:'',assistantUsage:null,
      cloud:{status:'off',email:'',password:'',user:null,syncing:false,lastSync:null},
    }, this.emptyData());
    // Load persisted local state synchronously so the very first render already
    // shows the real saved data. This avoids the default/"Patrimonio total: 0"
    // flicker that happens if saved state is only applied later in componentDidMount.
    const persisted=this.readPersistedState();
    if(persisted){
      Object.assign(this.state, persisted, {push:null,sheet:null,subs
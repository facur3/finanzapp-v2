#!/usr/bin/env python3
from pathlib import Path
import subprocess

COMPONENT = Path('src/app/component.js')
TEMPLATE = Path('src/app/template.html')


def from_master(path: str) -> str:
    return subprocess.check_output(['git', 'show', f'origin/master:{path}'], text=True)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, got {count}')
    return text.replace(old, new, 1)


def replace_between(text: str, start: str, end: str, replacement: str, label: str) -> str:
    a = text.find(start)
    if a < 0:
        raise RuntimeError(f'{label}: start marker not found')
    b = text.find(end, a + len(start))
    if b < 0:
        raise RuntimeError(f'{label}: end marker not found')
    return text[:a] + replacement + text[b:]


c = from_master('src/app/component.js')
t = from_master('src/app/template.html')

# Keep push-screen scroll positions separate from the tab scroll underneath them.
c = replace_once(
    c,
    '    this.mainScrollRef=React.createRef();',
    '    this.mainScrollRef=React.createRef();\n    this._pushScroll={};',
    'push scroll storage',
)

nav_block = '''  rememberPushScroll(key=this.state.push){
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
    clearTimeout(this._navTimer);
    this.setState({navState:'leaving'});
    this._navTimer=setTimeout(()=>{
      this.setState({...patch,push:target,detailId:target?this.state.detailId:null,navState:'back-settle'},()=>this.restorePushScroll(target));
    },180);
  }
'''
c = replace_between(c, '  popScreen(target=null,patch={}){', '  navigateTab(tab,patch={}){', nav_block, 'back navigation')

assistant_context_old = "  assistantContext(){return{accounts:this.state.accounts,categories:this.state.categories,cards:this.state.cards,recurring:this.state.recurring,transactions:this.state.txns,archived:this.state.archived};}"
assistant_context_new = '''  fciSpendSources(s=this.state){
    return window.FinanzDomain.spendableFciSources(s,s.usdRate).filter(source=>source.valueARS>0.005);
  }
  spendSourceMeta(id,s=this.state){
    const account=s.accounts[id];
    if(account)return{id,name:account.name,type:account.type,emoji:account.emoji,fillVar:account.fillVar,currency:account.currency||'ARS',accountId:id,fci:false};
    const source=window.FinanzDomain.findFciSpendSource(s,id,s.usdRate);
    if(!source)return null;
    return{id:source.id,name:source.name,type:'FCI · '+(source.ticker||'Fondo común'),emoji:source.emoji||'◉',fillVar:'--cat-inversion-fill',currency:'ARS',accountId:source.accountId,fci:true,valueARS:source.valueARS};
  }
  assistantContext(){
    const accounts={...this.state.accounts};
    this.fciSpendSources().forEach(source=>{accounts[source.id]={name:source.name,type:'FCI '+(source.ticker||''),currency:'ARS',kind:'spendable-investment',fci:true,sourceAccountId:source.accountId};});
    return{accounts,categories:this.state.categories,cards:this.state.cards,recurring:this.state.recurring,transactions:this.state.txns,archived:this.state.archived};
  }'''
c = replace_once(c, assistant_context_old, assistant_context_new, 'assistant FCI context')

# Do not let virtual FCI funding IDs leak into workflows that require a real account.
c = replace_once(
    c,
    "    if(d.intent==='transaction'&&d.transactionType==='ingreso'&&!d.categoryId&&S.categories.ingreso)d.categoryId='ingreso';\n    return window.FinanzDomain.normalizeAssistantDraft(d,ctx);",
    "    if(d.intent==='transaction'&&d.transactionType==='ingreso'&&!d.categoryId&&S.categories.ingreso)d.categoryId='ingreso';\n    const virtualFci=window.FinanzDomain.parseFciSpendSourceId(d.accountId);\n    const canSpendFci=(d.intent==='transaction'||d.intent==='recurring')&&d.transactionType==='gasto';\n    if(virtualFci&&!canSpendFci)d.accountId='';\n    return window.FinanzDomain.normalizeAssistantDraft(d,ctx);",
    'assistant virtual source safety',
)

assistant_txn = '''    const type=d.transactionType,amount=d.amount;
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
'''
c = replace_between(c, '    const type=d.transactionType,amount=d.amount;', '  componentDidUpdate(prevProps,prevState){', assistant_txn, 'assistant expense funding')

old_back_settle = '''    // A back action only animates the screen that leaves. Keep the revealed
    // screen still, then re-enable its normal forward animation on the next
    // actual navigation. This avoids the doubled/jumping close animation.
    if(prevState&&prevState.navState==='back-settle'&&this.state.navState==='back-settle'&&(prevState.push!==this.state.push||prevState.sheet!==this.state.sheet||prevState.tab!==this.state.tab)){
      this.setState({navState:'idle'});
    }'''
new_back_settle = '''    // The outgoing screen owns the back animation. As soon as the target screen
    // is revealed, settle to idle without replaying a forward animation.
    if(prevState&&prevState.navState==='leaving'&&this.state.navState==='back-settle'){
      clearTimeout(this._navSettleTimer);
      this._navSettleTimer=setTimeout(()=>{if(this.state.navState==='back-settle')this.setState({navState:'idle'});},34);
    }'''
c = replace_once(c, old_back_settle, new_back_settle, 'back settle state')

old_scroll_reset = '''    // Reset the shared tab scroll container to the top whenever the user opens
    // a different tab or push-screen, so every new section starts from the top
    // instead of inheriting the previous section's scroll position.
    if(prevState && (prevState.tab!==this.state.tab || prevState.push!==this.state.push)){
      const el=this.mainScrollRef.current;
      if(el) el.scrollTop=0;
    }'''
new_scroll_reset = '''    // Push screens are overlays. Resetting the tab underneath them caused the
    // visible jump-to-top when the user came back from an investment detail.
    if(prevState && prevState.tab!==this.state.tab){
      const el=this.mainScrollRef.current;
      if(el) el.scrollTop=0;
    }'''
c = replace_once(c, old_scroll_reset, new_scroll_reset, 'underlying tab scroll')
c = replace_once(c, '    clearTimeout(this._navTimer);\n    clearTimeout(this._tabTimer);', '    clearTimeout(this._navTimer);\n    clearTimeout(this._navSettleTimer);\n    clearTimeout(this._tabTimer);', 'navigation timer cleanup')

c = replace_once(
    c,
    "  computeNetWorth(){const s=this.state,FD=window.FinanzDomain;const disp=FD.sumAccountsARS(this.liquidIds(s),s.balances,s.accounts,s.usdRate,s.assets),inv=FD.sumAccountsARS(this.investIds(s),s.balances,s.accounts,s.usdRate,s.assets),debt=FD.sumAccountsARS(this.debtIds(s),s.balances,s.accounts,s.usdRate,s.assets)+this.cardDebt(s);return{disp,inv,debt,pat:disp+inv-debt};}",
    "  computeNetWorth(){const s=this.state,FD=window.FinanzDomain;const liquid=FD.sumAccountsARS(this.liquidIds(s),s.balances,s.accounts,s.usdRate,s.assets),fci=FD.spendableFciValueARS(s,s.usdRate),disp=liquid+fci,inv=FD.sumAccountsARS(this.investIds(s),s.balances,s.accounts,s.usdRate,s.assets),debt=FD.sumAccountsARS(this.debtIds(s),s.balances,s.accounts,s.usdRate,s.assets)+this.cardDebt(s);return{disp,inv,debt,pat:liquid+inv-debt};}",
    'net worth without FCI double count',
)

c = replace_once(
    c,
    "  openAssetDetail(account,ticker){const r=this.state.assetChartRange||'1M';const asset=(this.state.assets[account]||[]).find(a=>a.ticker===ticker);this.setState({push:'assetDetail',assetView:{account,ticker},assetChart:{loading:true,ok:false,range:r}});setTimeout(()=>this.fetchAssetChart(asset,r),60);}",
    "  openAssetDetail(account,ticker){this.rememberPushScroll('investments');const r=this.state.assetChartRange||'1M';const asset=(this.state.assets[account]||[]).find(a=>a.ticker===ticker);this.setState({push:'assetDetail',assetView:{account,ticker},assetChart:{loading:true,ok:false,range:r}});setTimeout(()=>this.fetchAssetChart(asset,r),60);}",
    'remember investment list scroll',
)

save_block = '''  save(){
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
    this.setState(s=>{const assets=t.fciRedemption?window.FinanzDomain.restoreFciUnits(s.assets,t.fciRedemption):s.assets;const r=this._rev(t,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{txns:s.txns.filter(x=>x.id!==t.id),assets,balances:r.b,categoryTotals:r.ct,monthIncome:r.mi,monthExpense:r.me,push:null,detailId:null};});
  }
  duplicateTxn(){
    const S=this.state,t=S.txns.find(x=>x.id===S.detailId);if(!t)return;
    this.setState(s=>{
      const id=s._next;let assets=s.assets;let nt={...t,id,dateLabel:'Hoy',dateISO:this._todayKey(),tags:[...(t.tags||[])]};
      if(t.fciRedemption){
        const redeemed=window.FinanzDomain.redeemFciUnits(assets,t.fciRedemption.sourceId,t.val,s.usdRate);
        if(!redeemed.ok)return{flash:'El FCI no tiene suficiente disponible para duplicar este gasto.'};
        assets=redeemed.assets;nt={...nt,fciRedemption:redeemed.redemption,account:redeemed.redemption.accountId,fundingLabel:'FCI · '+redeemed.redemption.name};
      }
      const a=this._apply(nt,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);
      return{txns:[nt,...s.txns],assets,balances:a.b,categoryTotals:a.ct,monthIncome:a.mi,monthExpense:a.me,_next:id+1,push:null,detailId:null};
    });
  }
  editTxn(){
    const S=this.state,t=S.txns.find(x=>x.id===S.detailId);if(!t)return;
    const liq=this.liquidIds(),inv=this.investIds();const iso=t.dateISO||window.FinanzDomain.isoFromLabel(t.dateLabel);
    this.setState({sheet:'add',push:null,subsheet:null,editId:t.id,addType:t.type,addAmount:String(t.val).replace('.',','),addTitle:t.merchant||'',addNote:t.note||'',addCat:(t.cat==='transfer'||t.cat==='inversion'||!S.categories[t.cat])?'comida':t.cat,addAccount:(t.fciRedemption&&t.fciRedemption.sourceId)||t.account||t.from||liq[0]||'',addTo:t.to||inv[0]||liq[0]||'',addDate:window.FinanzDomain.labelFromISO(iso),addDateISO:iso,addTags:[...(t.tags||[])],addCatTouched:true,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false});
  }
'''
c = replace_between(c, '  save(){', '  renderVals(){', save_block, 'expense save/edit/delete')

c = replace_once(
    c,
    "    const LIQ=this.liquidIds(S),INV=this.investIds(S),DEBTACC=this.debtIds(S);\n    const unknownBalanceCount=LIQ.filter(id=>ACC[id]&&ACC[id].balanceKnown===false).length;\n    const sumARS=(ids)=>FD.sumAccountsARS(ids,S.balances,ACC,S.usdRate,S.assets);\n    const disponible=sumARS(LIQ), invertido=sumARS(INV);\n    const cardDebt=this.cardDebt(S), debtAcc=sumARS(DEBTACC);\n    const patrimonioBruto=disponible+invertido;",
    "    const LIQ=this.liquidIds(S),INV=this.investIds(S),DEBTACC=this.debtIds(S);\n    const FCI_SPEND=FD.spendableFciSources(S,S.usdRate).filter(source=>source.valueARS>0.005);\n    const unknownBalanceCount=LIQ.filter(id=>ACC[id]&&ACC[id].balanceKnown===false).length;\n    const sumARS=(ids)=>FD.sumAccountsARS(ids,S.balances,ACC,S.usdRate,S.assets);\n    const liquidDisponible=sumARS(LIQ),fciDisponible=FCI_SPEND.reduce((sum,source)=>sum+source.valueARS,0);\n    const disponible=liquidDisponible+fciDisponible, invertido=sumARS(INV);\n    const cardDebt=this.cardDebt(S), debtAcc=sumARS(DEBTACC);\n    const patrimonioBruto=liquidDisponible+invertido;",
    'available includes spendable FCI',
)
c = replace_once(c, "    const homeGroups=this.groupByDate(homeTx.filter(t=>t.type==='gasto'||t.type==='ingreso'||t.type==='pago').slice(0,6)).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));", "    const homeGroups=this.groupByDate(homeTx.slice(0,6)).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));", 'home movements include investments')
c = replace_once(c, '    const assistantAccount=assistantDraft&&ACC[assistantDraft.accountId];', '    const assistantAccount=assistantDraft&&this.spendSourceMeta(assistantDraft.accountId,S);', 'assistant source display')
c = replace_once(c, '    const accA=ACC[S.addAccount]||{},accB=ACC[S.addTo]||{},catA=CAT[S.addCat]||{};', '    const accA=this.spendSourceMeta(S.addAccount,S)||{},accB=ACC[S.addTo]||{},catA=CAT[S.addCat]||{};', 'add form source metadata')
c = replace_once(
    c,
    "    const accOpt=(k,onPick,selKey)=>({label:ACC[k].name,emoji:ACC[k].emoji,fillVar:ACC[k].fillVar,selected:selKey===k,onPick});\n    if(sub==='pickAccount'){pickerTitle=S.addType==='transfer'||S.addType==='inversion'?'Cuenta de origen':'Cuenta';const ids=(S.addType==='inversion')?LIQ:(S.addType==='transfer'?LIQ.concat(INV):LIQ);pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addAccount:k,subsheet:null}),S.addAccount));}",
    "    const accOpt=(k,onPick,selKey)=>{const meta=this.spendSourceMeta(k,S)||{};return{label:meta.name||'Fuente',emoji:meta.emoji||'◉',fillVar:meta.fillVar||'--cat-inversion-fill',selected:selKey===k,onPick};};\n    if(sub==='pickAccount'){pickerTitle=S.addType==='gasto'?'Pagar con':(S.addType==='transfer'||S.addType==='inversion'?'Cuenta de origen':'Cuenta');const spendIds=LIQ.concat(FCI_SPEND.map(source=>source.id));const ids=(S.addType==='inversion')?LIQ:(S.addType==='transfer'?LIQ.concat(INV):(S.addType==='gasto'?spendIds:LIQ));pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addAccount:k,subsheet:null}),S.addAccount));}",
    'expense funding picker',
)
c = replace_once(c, "    const context=[isPago?'Pago de tarjeta':C.name,accName].filter(Boolean).join(' · ');const note=t.note&&!/^(Registrado con el asistente|Cargado por voz o texto)$/i.test(t.note)?t.note:'';const sub=[context,note].filter(Boolean).join(' · ');", "    const context=[isPago?'Pago de tarjeta':C.name,t.fundingLabel||accName].filter(Boolean).join(' · ');const note=t.note&&!/^(Registrado con el asistente|Cargado por voz o texto)$/i.test(t.note)?t.note:'';const sub=[context,note].filter(Boolean).join(' · ');", 'activity FCI funding label')

c = replace_once(c, "S.balanceMode==='disponible'?'Disponible para usar ahora':'Neto · cuentas + inversiones − deudas'", "S.balanceMode==='disponible'?('Disponible para usar ahora'+(fciDisponible>0?' · incluye FCI rescatable':'')):'Neto · cuentas + inversiones − deudas'", 'available subtitle')

c = replace_once(c, "const portList=portAssets.map(a=>{const unknown=a.costUnknown;const glStr=unknown?'Costo pendiente':", "const portList=portAssets.map(a=>{const unknown=a.costUnknown;const glStr=unknown?'Costo de compra no cargado':", 'portfolio cost wording')
c = replace_once(c, "glPctStr=unknown?'Sin rendimiento':", "glPctStr=unknown?'Rendimiento personal oculto':", 'portfolio return wording')
c = replace_once(c, "secondaryStr:portRend?glPctStr:(unknown?'Costo pendiente':", "secondaryStr:portRend?glPctStr:(unknown?'Valor actual válido · falta costo de compra':", 'portfolio cost subtitle')

warning_old = 'Falta el costo de compra. El valor actual es válido, pero el rendimiento queda oculto para no mostrar un resultado falso.'
warning_new = 'El valor actual y los rendimientos oficiales del fondo son válidos. Falta tu costo de compra inicial, por eso FinanzApp oculta únicamente tu ganancia o pérdida personal.'
t = replace_once(t, warning_old, warning_new, 'FCI cost-basis explanation')

COMPONENT.write_text(c)
TEMPLATE.write_text(t)
print('Rebuilt clean FCI/navigation hotfix from master sources.')

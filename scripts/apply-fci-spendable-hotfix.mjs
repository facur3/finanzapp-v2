#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const componentPath = 'src/app/component.js';
const templatePath = 'src/app/template.html';
let component = readFileSync(componentPath, 'utf8');
let template = readFileSync(templatePath, 'utf8');

function replaceOnce(text, search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error('Patch target not found: ' + label);
  const second = text.indexOf(search, first + search.length);
  if (second >= 0) throw new Error('Patch target is ambiguous: ' + label);
  return text.slice(0, first) + replacement + text.slice(first + search.length);
}

function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error('Patch regex not found: ' + label);
  return text.replace(regex, replacement);
}

component = replaceOnce(
  component,
  '    this.mainScrollRef=React.createRef();',
  "    this.mainScrollRef=React.createRef();\n    this._pushScroll={};",
  'push scroll storage',
);

component = replaceRegex(
  component,
  /  popScreen\(target=null,patch=\{\}\)\{[\s\S]*?\n  \}\n  navigateTab\(tab,patch=\{\}\)\{/,
  `  rememberPushScroll(key=this.state.push){
    if(!key||typeof document==='undefined')return;
    const el=document.querySelector('.fa-frame > .fa-screen');
    if(el)this._pushScroll[key]=el.scrollTop||0;
  }
  restorePushScroll(key){
    if(!key||typeof document==='undefined')return;
    const top=Number(this._pushScroll[key]);
    if(!Number.isFinite(top))return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{const el=document.querySelector('.fa-frame > .fa-screen');if(el)el.scrollTop=top;}));
  }
  popScreen(target=null,patch={}){
    if(this.state.navState==='leaving')return;
    this.rememberPushScroll();
    clearTimeout(this._navTimer);
    this.setState({navState:'leaving'});
    this._navTimer=setTimeout(()=>{
      this.setState({...patch,push:target,detailId:target?this.state.detailId:null,navState:'back-settle'});
      this.restorePushScroll(target);
    },180);
  }
  navigateTab(tab,patch={){`,
  'back navigation scroll preservation',
);
// Fix the replacement delimiter above without relying on a second broad regex.
component = component.replace('navigateTab(tab,patch={){', 'navigateTab(tab,patch={}){');

component = replaceOnce(
  component,
  "  assistantContext(){return{accounts:this.state.accounts,categories:this.state.categories,cards:this.state.cards,recurring:this.state.recurring,transactions:this.state.txns,archived:this.state.archived};}",
  `  fciSpendSources(s=this.state){return window.FinanzDomain.spendableFciSources(s,s.usdRate).filter(source=>source.valueARS>0.005);}
  spendSourceMeta(id,s=this.state){const account=s.accounts[id];if(account)return{id,name:account.name,type:account.type,emoji:account.emoji,fillVar:account.fillVar,currency:account.currency||'ARS',accountId:id,fci:false};const source=window.FinanzDomain.findFciSpendSource(s,id,s.usdRate);if(!source)return null;return{id:source.id,name:source.name,type:'FCI · '+(source.ticker||'Fondo común'),emoji:source.emoji||'◉',fillVar:'--cat-inversion-fill',currency:'ARS',accountId:source.accountId,fci:true,valueARS:source.valueARS};}
  assistantContext(){const accounts={...this.state.accounts};this.fciSpendSources().forEach(source=>{accounts[source.id]={name:source.name,type:'FCI '+(source.ticker||''),currency:'ARS',kind:'spendable-investment',fci:true,sourceAccountId:source.accountId};});return{accounts,categories:this.state.categories,cards:this.state.cards,recurring:this.state.recurring,transactions:this.state.txns,archived:this.state.archived};}`,
  'assistant FCI context',
);

component = replaceRegex(
  component,
  /    const type=d\.transactionType,amount=d\.amount;[\s\S]*?\n  componentDidUpdate\(prevProps,prevState\)\{/,
  `    const type=d.transactionType,amount=d.amount;const category=this.state.categories[d.categoryId]||{};const genericMerchant=!d.merchant||/^(gasto|ingreso|movimiento)$/i.test(d.merchant);const source=type==='gasto'?window.FinanzDomain.findFciSpendSource(this.state,d.accountId,this.state.usdRate):null;const txn={id:this.state._next,type,merchant:genericMerchant?(category.name||(type==='ingreso'?'Ingreso':'Gasto')):d.merchant,cat:d.categoryId,amount:type==='ingreso'?amount:-amount,val:amount,currency:source?'ARS':((this.state.accounts[d.accountId]||{}).currency||d.currency||'ARS'),account:source?source.accountId:d.accountId,dateLabel,dateISO:d.dateISO,note:d.note||(d.intent==='recurring'?'Recurrente':'Cargado por voz o texto'),tags:d.tags};
    this.setState(s=>{let assets=s.assets;let finalTxn={...txn};if(source){const redeemed=window.FinanzDomain.redeemFciUnits(assets,d.accountId,amount,s.usdRate);if(!redeemed.ok){const msg=redeemed.error==='insufficient'?'El FCI no tiene suficiente disponible para ese gasto.':redeemed.error==='missing-price'?'No tengo un valor de cuotaparte válido para calcular el rescate.':'No pude usar ese FCI como medio de pago.';return{assistantError:msg};}assets=redeemed.assets;finalTxn.fciRedemption=redeemed.redemption;finalTxn.fundingLabel='FCI · '+redeemed.redemption.name;finalTxn.account=redeemed.redemption.accountId;}const applied=this._apply(finalTxn,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{assets,balances:applied.b,categoryTotals:applied.ct,monthIncome:applied.mi,monthExpense:applied.me,txns:[finalTxn,...s.txns],tagSugg:window.FinanzDomain.uniqueTags([...(s.tagSugg||[]),...(d.tags||[])]),_next:s._next+1,sheet:null,assistantDraft:null,assistantText:'',assistantError:'',flash:d.intent==='recurring'?'Recurrente registrado':'Movimiento guardado'};});
  }
  componentDidUpdate(prevProps,prevState){`,
  'assistant transaction funding',
);

component = replaceRegex(
  component,
  /    \/\/ A back action only animates[\s\S]*?\n    \}\n    \/\/ Track local data changes/,
  `    // Back navigation settles immediately after the outgoing screen finishes.
    // Leaving the frame in "back-settle" disabled the next forward animation.
    if(prevState&&prevState.navState==='leaving'&&this.state.navState==='back-settle'){
      clearTimeout(this._navSettleTimer);
      this._navSettleTimer=setTimeout(()=>{if(this.state.navState==='back-settle')this.setState({navState:'idle'});},34);
    }
    // Track local data changes`,
  'navigation settle state',
);

component = replaceRegex(
  component,
  /    \/\/ Reset the shared tab scroll container[\s\S]*?\n    \}\n    \/\/ Centralised toast lifecycle/,
  `    // A push screen is an overlay. Never reset the tab underneath it: doing so
    // made the portfolio visibly jump to the top while the back animation ended.
    if(prevState && prevState.tab!==this.state.tab){
      const el=this.mainScrollRef.current;
      if(el) el.scrollTop=0;
    }
    // Centralised toast lifecycle`,
  'underlying tab scroll reset',
);

component = replaceOnce(
  component,
  '    clearTimeout(this._navTimer);\n    clearTimeout(this._tabTimer);',
  '    clearTimeout(this._navTimer);\n    clearTimeout(this._navSettleTimer);\n    clearTimeout(this._tabTimer);',
  'navigation timer cleanup',
);

component = replaceOnce(
  component,
  "  computeNetWorth(){const s=this.state,FD=window.FinanzDomain;const disp=FD.sumAccountsARS(this.liquidIds(s),s.balances,s.accounts,s.usdRate,s.assets),inv=FD.sumAccountsARS(this.investIds(s),s.balances,s.accounts,s.usdRate,s.assets),debt=FD.sumAccountsARS(this.debtIds(s),s.balances,s.accounts,s.usdRate,s.assets)+this.cardDebt(s);return{disp,inv,debt,pat:disp+inv-debt};}",
  "  computeNetWorth(){const s=this.state,FD=window.FinanzDomain;const liquid=FD.sumAccountsARS(this.liquidIds(s),s.balances,s.accounts,s.usdRate,s.assets),fci=FD.spendableFciValueARS(s,s.usdRate),disp=liquid+fci,inv=FD.sumAccountsARS(this.investIds(s),s.balances,s.accounts,s.usdRate,s.assets),debt=FD.sumAccountsARS(this.debtIds(s),s.balances,s.accounts,s.usdRate,s.assets)+this.cardDebt(s);return{disp,inv,debt,pat:liquid+inv-debt};}",
  'net worth without FCI double counting',
);

component = replaceOnce(
  component,
  "  openAssetDetail(account,ticker){const r=this.state.assetChartRange||'1M';const asset=(this.state.assets[account]||[]).find(a=>a.ticker===ticker);this.setState({push:'assetDetail',assetView:{account,ticker},assetChart:{loading:true,ok:false,range:r}});setTimeout(()=>this.fetchAssetChart(asset,r),60);}",
  "  openAssetDetail(account,ticker){this.rememberPushScroll('investments');const r=this.state.assetChartRange||'1M';const asset=(this.state.assets[account]||[]).find(a=>a.ticker===ticker);this.setState({push:'assetDetail',assetView:{account,ticker},assetChart:{loading:true,ok:false,range:r}});setTimeout(()=>this.fetchAssetChart(asset,r),60);}",
  'remember portfolio scroll before asset detail',
);

component = replaceRegex(
  component,
  /  save\(\)\{[\s\S]*?\n  editTxn\(\)\{[\s\S]*?\n\n  renderVals\(\)\{/,
  `  save(){
    const S=this.state;if(!S.addAmount)return;const val=parseFloat(S.addAmount.replace(',','.'))||0;if(!val)return;const type=S.addType;const FD=window.FinanzDomain;const fciSource=type==='gasto'?FD.findFciSpendSource(S,S.addAccount,S.usdRate):null;const dateISO=S.addDateISO||FD.isoFromLabel(S.addDate);const t={type,val,dateLabel:FD.labelFromISO(dateISO),dateISO,tags:[...S.addTags]};const C=S.categories[S.addCat]||{};
    t.merchant=S.addTitle.trim()||(type==='transfer'?'Transferencia':type==='inversion'?'Inversión':C.name||'Movimiento');
    if(type==='gasto'||type==='ingreso'){if(!S.accounts[S.addAccount]&&!fciSource){this.flashMsg(type==='gasto'?'Elegí con qué pagar':'Elegí una cuenta');return;}if(!S.categories[S.addCat]){this.flashMsg('Elegí una categoría');return;}}
    else if(!S.accounts[S.addAccount]||!S.accounts[S.addTo]){this.flashMsg('Elegí cuentas válidas');return;}else if(S.addAccount===S.addTo){this.flashMsg('Origen y destino deben ser distintos');return;}
    t.currency=fciSource?'ARS':((S.accounts[S.addAccount]||{}).currency||'ARS');
    if(type==='gasto'){t.cat=S.addCat;t.account=fciSource?fciSource.accountId:S.addAccount;t.amount=-val;t.note=S.addNote.trim();if(fciSource)t.fciSourceId=S.addAccount;}
    else if(type==='ingreso'){t.cat=S.addCat;t.account=S.addAccount;t.amount=val;t.note=S.addNote.trim();}
    else{const toCurrency=(S.accounts[S.addTo]||{}).currency||'ARS';if(t.currency!==toCurrency&&!S.usdRate){this.flashMsg('Actualizá la cotización antes de convertir monedas');this.fetchPrices(true);return;}t.cat=type==='transfer'?'transfer':'inversion';t.from=S.addAccount;t.to=S.addTo;t.amount=-val;t.isTransfer=true;t.toCurrency=toCurrency;t.toVal=FD.convertCurrency(val,t.currency,toCurrency,S.usdRate);t.note='→ '+(S.accounts[S.addTo]?S.accounts[S.addTo].name:'')+(S.addNote.trim()?(' · '+S.addNote.trim()):'')+(t.currency!==toCurrency?(' · '+(toCurrency==='USD'?'US$':'$')+this.fmtNum(t.toVal)):'');}
    this.setState(s=>{let b={...s.balances},ct={...s.categoryTotals},mi=s.monthIncome,me=s.monthExpense,txns=s.txns,assets=s.assets;if(s.editId){const old=s.txns.find(x=>x.id===s.editId);if(old){if(old.fciRedemption)assets=FD.restoreFciUnits(assets,old.fciRedemption);const r=this._rev(old,b,ct,mi,me);b=r.b;ct=r.ct;mi=r.mi;me=r.me;txns=txns.filter(x=>x.id!==s.editId);}}
      if(t.fciSourceId){const redeemed=FD.redeemFciUnits(assets,t.fciSourceId,val,s.usdRate);if(!redeemed.ok){const msg=redeemed.error==='insufficient'?'El FCI no tiene suficiente disponible para ese gasto.':redeemed.error==='missing-price'?'Actualizá el valor de la cuotaparte antes de pagar con el FCI.':'No pude usar ese FCI como medio de pago.';return{flash:msg};}assets=redeemed.assets;t.fciRedemption=redeemed.redemption;t.account=redeemed.redemption.accountId;t.fundingLabel='FCI · '+redeemed.redemption.name;}
      const id=s.editId||s._next;t.id=id;const a=this._apply(t,b,ct,mi,me);return{txns:[t,...txns],assets,balances:a.b,categoryTotals:a.ct,monthIncome:a.mi,monthExpense:a.me,_next:s.editId?s._next:id+1,sheet:null,subsheet:null,editId:null,addAmount:'',addTitle:'',addNote:'',addTags:[],addCatTouched:false,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false,flash:s.editId?'Movimiento actualizado':'Movimiento guardado'};});
  }
  deleteTxn(){const S=this.state;const t=S.txns.find(x=>x.id===S.detailId);if(!t)return;this.setState(s=>{const assets=t.fciRedemption?window.FinanzDomain.restoreFciUnits(s.assets,t.fciRedemption):s.assets;const r=this._rev(t,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{txns:s.txns.filter(x=>x.id!==t.id),assets,balances:r.b,categoryTotals:r.ct,monthIncome:r.mi,monthExpense:r.me,push:null,detailId:null};});}
  duplicateTxn(){const S=this.state;const t=S.txns.find(x=>x.id===S.detailId);if(!t)return;this.setState(s=>{const id=s._next;let assets=s.assets;let nt={...t,id,dateLabel:'Hoy',dateISO:this._todayKey(),tags:[...(t.tags||[])]};if(t.fciRedemption){const redeemed=window.FinanzDomain.redeemFciUnits(assets,t.fciRedemption.sourceId,t.val,s.usdRate);if(!redeemed.ok)return{flash:'El FCI no tiene suficiente disponible para duplicar este gasto.'};assets=redeemed.assets;nt={...nt,fciRedemption:redeemed.redemption,account:redeemed.redemption.accountId,fundingLabel:'FCI · '+redeemed.redemption.name};}const a=this._apply(nt,s.balances,s.categoryTotals,s.monthIncome,s.monthExpense);return{txns:[nt,...s.txns],assets,balances:a.b,categoryTotals:a.ct,monthIncome:a.mi,monthExpense:a.me,_next:id+1,push:null,detailId:null};});}
  editTxn(){const S=this.state;const t=S.txns.find(x=>x.id===S.detailId);if(!t)return;const liq=this.liquidIds(),inv=this.investIds();const iso=t.dateISO||window.FinanzDomain.isoFromLabel(t.dateLabel);this.setState({sheet:'add',push:null,subsheet:null,editId:t.id,addType:t.type,addAmount:String(t.val).replace('.',','),addTitle:t.merchant||'',addNote:t.note||'',addCat:(t.cat==='transfer'||t.cat==='inversion'||!S.categories[t.cat])?'comida':t.cat,addAccount:(t.fciRedemption&&t.fciRedemption.sourceId)||t.account||t.from||liq[0]||'',addTo:t.to||inv[0]||liq[0]||'',addDate:window.FinanzDomain.labelFromISO(iso),addDateISO:iso,addTags:[...(t.tags||[])],addCatTouched:true,addSuggestedKey:null,addSuggestedTags:[],shortcutCapture:false});}

  renderVals(){`,
  'expense save/edit/delete with FCI redemption',
);

component = replaceOnce(
  component,
  "    const LIQ=this.liquidIds(S),INV=this.investIds(S),DEBTACC=this.debtIds(S);\n    const unknownBalanceCount=LIQ.filter(id=>ACC[id]&&ACC[id].balanceKnown===false).length;\n    const sumARS=(ids)=>FD.sumAccountsARS(ids,S.balances,ACC,S.usdRate,S.assets);\n    const disponible=sumARS(LIQ), invertido=sumARS(INV);\n    const cardDebt=this.cardDebt(S), debtAcc=sumARS(DEBTACC);\n    const patrimonioBruto=disponible+invertido;",
  "    const LIQ=this.liquidIds(S),INV=this.investIds(S),DEBTACC=this.debtIds(S);\n    const FCI_SPEND=FD.spendableFciSources(S,S.usdRate).filter(source=>source.valueARS>0.005);\n    const unknownBalanceCount=LIQ.filter(id=>ACC[id]&&ACC[id].balanceKnown===false).length;\n    const sumARS=(ids)=>FD.sumAccountsARS(ids,S.balances,ACC,S.usdRate,S.assets);\n    const liquidDisponible=sumARS(LIQ),fciDisponible=FCI_SPEND.reduce((sum,source)=>sum+source.valueARS,0);\n    const disponible=liquidDisponible+fciDisponible, invertido=sumARS(INV);\n    const cardDebt=this.cardDebt(S), debtAcc=sumARS(DEBTACC);\n    const patrimonioBruto=liquidDisponible+invertido;",
  'available balance includes FCI without double count',
);

component = replaceOnce(
  component,
  "    const homeGroups=this.groupByDate(homeTx.filter(t=>t.type==='gasto'||t.type==='ingreso'||t.type==='pago').slice(0,6)).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));",
  "    const homeGroups=this.groupByDate(homeTx.slice(0,6)).map(g=>({day:g.day,totalStr:signedARS(g.total),items:g.items.map(t=>this.txView(t))}));",
  'home movement preview includes investments',
);

component = replaceOnce(
  component,
  "    const assistantAccount=assistantDraft&&ACC[assistantDraft.accountId];",
  "    const assistantAccount=assistantDraft&&this.spendSourceMeta(assistantDraft.accountId,S);",
  'assistant virtual source display',
);

component = replaceOnce(
  component,
  "    const accA=ACC[S.addAccount]||{},accB=ACC[S.addTo]||{},catA=CAT[S.addCat]||{};",
  "    const accA=this.spendSourceMeta(S.addAccount,S)||{},accB=ACC[S.addTo]||{},catA=CAT[S.addCat]||{};",
  'add form virtual FCI source metadata',
);

component = replaceOnce(
  component,
  "    const accOpt=(k,onPick,selKey)=>({label:ACC[k].name,emoji:ACC[k].emoji,fillVar:ACC[k].fillVar,selected:selKey===k,onPick});\n    if(sub==='pickAccount'){pickerTitle=S.addType==='transfer'||S.addType==='inversion'?'Cuenta de origen':'Cuenta';const ids=(S.addType==='inversion')?LIQ:(S.addType==='transfer'?LIQ.concat(INV):LIQ);pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addAccount:k,subsheet:null}),S.addAccount));}",
  "    const accOpt=(k,onPick,selKey)=>{const meta=this.spendSourceMeta(k,S)||{};return{label:meta.name||'Fuente',emoji:meta.emoji||'◉',fillVar:meta.fillVar||'--cat-inversion-fill',selected:selKey===k,onPick};};\n    if(sub==='pickAccount'){pickerTitle=S.addType==='gasto'?'Pagar con':(S.addType==='transfer'||S.addType==='inversion'?'Cuenta de origen':'Cuenta');const spendIds=LIQ.concat(FCI_SPEND.map(source=>source.id));const ids=(S.addType==='inversion')?LIQ:(S.addType==='transfer'?LIQ.concat(INV):(S.addType==='gasto'?spendIds:LIQ));pickerOptions=ids.map(k=>accOpt(k,()=>this.setState({addAccount:k,subsheet:null}),S.addAccount));}",
  'expense funding picker includes FCI',
);

component = replaceOnce(
  component,
  "    const context=[isPago?'Pago de tarjeta':C.name,accName].filter(Boolean).join(' · ');const note=t.note&&!/^(Registrado con el asistente|Cargado por voz o texto)$/i.test(t.note)?t.note:'';const sub=[context,note].filter(Boolean).join(' · ');",
  "    const context=[isPago?'Pago de tarjeta':C.name,t.fundingLabel||accName].filter(Boolean).join(' · ');const note=t.note&&!/^(Registrado con el asistente|Cargado por voz o texto)$/i.test(t.note)?t.note:'';const sub=[context,note].filter(Boolean).join(' · ');",
  'activity funding label',
);

component = replaceOnce(
  component,
  "      heroSub:(unknownBalanceCount?('Total parcial · '+unknownBalanceCount+' saldo pendiente'):S.balanceMode==='disponible'?'Disponible para usar ahora':'Neto · cuentas + inversiones − deudas')+(heroIsUsd?' · dólar cripto':'')+' · Tocá para ver en '+(heroIsUsd?'pesos':'dólares'),",
  "      heroSub:(unknownBalanceCount?('Total parcial · '+unknownBalanceCount+' saldo pendiente'):S.balanceMode==='disponible'?('Disponible para usar ahora'+(fciDisponible>0?' · incluye FCI rescatable':'')):'Neto · cuentas + inversiones − deudas')+(heroIsUsd?' · dólar cripto':'')+' · Tocá para ver en '+(heroIsUsd?'pesos':'dólares'),",
  'available balance explanation',
);

component = replaceOnce(
  component,
  "    const portList=portAssets.map(a=>{const unknown=a.costUnknown;const glStr=unknown?'Costo pendiente':((a.gl>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(a.gl)))),glPctStr=unknown?'Sin rendimiento':((a.gl>=0?'+':'')+a.glPct.toFixed(1).replace('.',',')+'%'),glColor=unknown?'var(--text-3)':a.gl>=0?'var(--pos)':'var(--danger)';",
  "    const portList=portAssets.map(a=>{const unknown=a.costUnknown;const glStr=unknown?'Costo de compra no cargado':((a.gl>=0?'+':'-')+sym+this.fmtInt(Math.abs(displayARS(a.gl)))),glPctStr=unknown?'Rendimiento personal oculto':((a.gl>=0?'+':'')+a.glPct.toFixed(1).replace('.',',')+'%'),glColor=unknown?'var(--text-3)':a.gl>=0?'var(--pos)':'var(--danger)';",
  'clearer unknown cost wording',
);
component = replaceOnce(
  component,
  "        secondaryStr:portRend?glPctStr:(unknown?'Costo pendiente':(glStr+' · '+glPctStr)),secondaryColor:glColor,",
  "        secondaryStr:portRend?glPctStr:(unknown?'Valor actual válido · falta costo de compra':(glStr+' · '+glPctStr)),secondaryColor:glColor,",
  'clearer portfolio cost subtitle',
);

template = replaceOnce(
  template,
  'Falta el costo de compra. El valor actual es válido, pero el rendimiento queda oculto para no mostrar un resultado falso.',
  'El valor actual y los rendimientos oficiales del fondo son válidos. Falta tu costo de compra inicial, por eso FinanzApp oculta únicamente tu ganancia o pérdida personal.',
  'FCI cost-basis explanation',
);

writeFileSync(componentPath, component);
writeFileSync(templatePath, template);
console.log('Applied FCI spendable + navigation hotfix source patches.');

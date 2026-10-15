// Work Order Builder — Alexander Matthews workroom.
// Drop-in page for Production Manager (React + Ant Design 5). See README.md.
import React, {createElement as h, Fragment, useState, useReducer, useEffect} from 'react';
import {ConfigProvider, theme as antTheme, Steps, Card, Form, Input, InputNumber, Select, Checkbox, Button, Alert, Descriptions, Table, Tag, Drawer, Slider, Segmented, Typography, Row, Col, Space, Divider, message, Grid} from 'antd';
import './work-order-builder.css';

/* ---------- reference data ---------- */
const HEADERS={
  pinch:{n:'3-Finger Pinch Pleat',g:'pleat',d:'The classic three-finger pleat. Formal; traverses well.'},
  tfpinch:{n:'2-Finger Pinch Pleat',g:'pleat',d:'Two fingers, modern and lighter than three.'},
  crown:{n:'3-Finger Crown Pleat',g:'pleat',d:'Pinched at the top; opens into a fan. Traditional.'},
  tfcrown:{n:'2-Finger Crown Pleat',g:'pleat',d:'Two-finger version of the crown.'},
  goblet:{n:'Goblet Pleat',g:'pleat',d:'Round cup at the top. Formal, stationary-leaning.'},
  cartridge:{n:'Cartridge Pleat',g:'pleat',d:'Round, unpinched tube. Clean and modern.'},
  box:{n:'Box Pleat',g:'pleat',d:'Flat box folds. Tailored; best stationary.'},
  inverted:{n:'Inverted Pleat',g:'pleat',d:'Pleat folded to the back; flat, tailored face. Stationary panels only.',stat:true},
  rodpocket:{n:'Rod Pocket',g:'rod',d:'The rod runs through a sewn pocket. Casual; stationary. Give the rod size.'},
  dblpocket:{n:'Double Rod Pocket',g:'rod',d:'A pocket at the top hem and another at the bottom hem, so the panel is stretched between two rods. Doors, sidelights, sash curtains. Give both rod sizes.',stat:true},
  grommet:{n:'Grommet',g:'rod',d:'Metal rings over a pole. Modern; wave look. Give the pole size and grommet finish.'},
  flat:{n:'Flat',g:'rod',d:'Flat panel on a rod or clips. Casual.'},
  flowing:{n:'Flowing',g:'rod',d:'Soft, ungathered top. Casual.'},
  gtab:{n:'Gathered Tab Top',g:'rod',d:'Gathered tabs over a pole.'},
  ttab:{n:'Traditional Tab Top',g:'rod',d:'Flat tabs over a pole. Casual.'},
  backtab:{n:'Back Tab',g:'rod',d:'Tabs hidden behind the header; the pole disappears.'},
  ripplefold:{n:'Ripplefold',g:'ripple',d:'Snap tape on a carrier track. Even waves; the standard for modern traversing drapery.'},
};
const HW={
  'pole':{n:'Decorative pole and rings',d:'Stationary or hand-drawn on a pole we supply. Pin setting ½" on rings.',for:['pleat','rod'],kind:'pole',proj:3.5},
  'forest':{n:'Forest track',d:'Our standard track. Colours and options; ripplefold carriers at 60/80/100/120%.',for:['pleat','ripple'],kind:'track',proj:3.5,ext:true},
  'united':{n:'United Supply track',d:'Alternative track vendor.',for:['pleat','ripple'],kind:'track',proj:3.5,ext:true},
  'orion':{n:'Iron Art by Orion pole',d:'Hand-forged decorative rods. Brackets project 3" standard. Rod lengths include finials; pieces cut ~4⅜" under.',for:['pleat','rod'],kind:'pole',proj:3,ext:true},
  'existing':{n:'Client’s existing hardware',d:'Measure the rod, not the window: bracket to bracket (J) and top of rod to floor.',for:['pleat','rod','ripple'],kind:'existing',proj:3.5},
  'board':{n:'Fabric-wrapped board',d:'Board Mounted Side Panel. No visible hardware.',for:['pleat','rod'],kind:'board',proj:4},
};
const LININGS=[
  ['Premium Lining','Standard. Protects the face fabric; filters light.'],
  ['Blackout Lining','Coated blackout. Room darkening; needle holes show as pinholes of light.'],
  ['Black Backed Blackout','The upgraded blackout that conceals the needle holes. True blackout jobs.'],
  ['Interlining','Flannel layer between face and lining. Body, insulation, sound. Over 49 sq ft needs the Premium rod.'],
  ['Dual Lining','Lining plus interlining in one.'],
  ['Self Lining','Lined in the face fabric. Not double-sided.'],
  ['Contrasting Lining','A second decorative fabric on the back (C.O.M. line).'],
  ['Unlined','Sheers; or a divider. Unlined non-sheer fabric has no sun protection; sun damage is excluded from the warranty.'],
];
const STEPS_D=[['job','Job'],['product','Product'],['header','Header'],['fullness','Fullness'],['hardware','Hardware'],['measure','Measure'],['draw','Draw'],['lining','Lining'],['fabric','Fabric'],['extras','Extras'],['order','Order'],['price','Price']];

/* ---------- state ---------- */
const DEFAULT={client:'',project:'',room:'',windowId:'',qty:1,product:'',spWindowW:'',spWidths:'1',spCount:'2',bmspReturn:'Both Returns',header:'',fabricType:'',fullness:'',rfFullness:'',sheer2x:false,hardware:'',mountSurface:'wall',mount:'OM',projection:'',trackH:'',rodType:'',rodType2:'',looseRings:false,
  A:'',extL:'',extR:'',J:'',openW:'',G:'',H:'',topRef:'',M:'',openH:'',finish:'float',puddleIn:2,level:'ok',linen:false,draw:'',offL:'',offR:'',masters:'',motor:false,motorSide:'left',lining:'',liningColor:'Workroom matches',hem:'',fabricSource:'',fabVendor:'',fabPattern:'',fabColor:'',fabWidth:54,vr:0,hr:0,fabPrice:'',gromSize:'Small Round (poles to 1⅜")',gromFinish:'Antique Brass',gromalink:false,banding:false,trim:false,duo:false,tiebacks:false,decoNotes:'',notes:'',clSource:'ours',clVendor:'',clPattern:'',clColor:'',clWidth:54,clVr:0,clPrice:'',clNotes:'',bandPlacement:'Leading edge',bandWidth:2.5,bandInset:2,bandSource:'ours',bandVendor:'',bandPattern:'',bandColor:'',bandFabW:54,bandPrice:'',bandNotes:'',
  pAdj:'',hw:[{n:'',q:1,p:''}],hwShip:'',hwTariff:'',consult:150,instHrs:3};

/* ---------- fractions ---------- */
const FR={0:'',0.125:'⅛',0.25:'¼',0.375:'⅜',0.5:'½',0.625:'⅝',0.75:'¾',0.875:'⅞'};
function frac(x,dec){ if(x==null||!isFinite(x)) return '—'; const s=x<0?'-':''; x=Math.abs(x); let w=Math.floor(x), r=Math.round((x-w)*8)/8; if(r===1){w++;r=0;} const f=FR[r]; return s+(w||!f?w:'')+(f||'')+'"'+(dec?'':''); }
const money=x=>(x==null||!isFinite(x))?'—':'$'+x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});

/* ---------- derived ---------- */
function hdrGroup(){return S.header?HEADERS[S.header].g:''}
function isRF(){return S.header==='ripplefold'}
function hwKind(){return S.hardware?HW[S.hardware].kind:''}
function onRings(){return (hwKind()==='pole'&&hdrGroup()==='pleat')||(hwKind()==='existing'&&hdrGroup()==='pleat'&&S.looseRings)}
function pinSetting(){ if(hdrGroup()!=='pleat') return null; if(S.mount==='UT') return '1½" (under treatment)'; if(hwKind()==='dtr'||onRings()) return '½" (Decorative Traverse Rod / rings)'; return '1¾" (standard)'; }
function fullnessLabel(){ if(isRF()) return S.rfFullness?S.rfFullness+'%':''; return S.fullness?S.fullness+'×':''; }
function fullnessFactor(){ if(isRF()) return S.rfFullness?1+(+S.rfFullness)/100:2; return S.fullness?+S.fullness:2; }

function rodWidth(){
  if(S.product!=='drapery') return null;
  if(S.mount==='IM') return num(S.openW);
  if(hwKind()==='existing'&&num(S.J)!=null) return num(S.J);
  const A=num(S.A),l=num(S.extL)||0,r=num(S.extR)||0; return A==null?null:A+l+r;
}
function womCount(W){ const ff=fullnessFactor(); const ret=(hdrGroup()==='rod')?0:(num(S.projection)||3.5); const fw=(num(S.fabWidth)||54)<=60?(num(S.fabWidth)||54):54; let cov=[]; if(S.draw==='split'||S.draw==='stationary'||!S.draw) cov=[W/2,W/2]; else if(S.draw==='offset') cov=[num(S.offL)||W/2,num(S.offR)||W/2]; else cov=[W]; let n=0; for(const c of cov) n+=Math.ceil((c*ff+ret+6+(S.masters==='overlap'?3.5:0))/fw); return n; }
function widthCalcD(){
  const rows=[]; const W=rodWidth(); if(W==null) return {rows,order:null};
  if(S.mount==='IM') rows.push(['Opening width, smallest of three',W,'The workroom makes IM to the exact opening']);
  else if(hwKind()==='existing'&&num(S.J)!=null) rows.push(['J · existing rod, bracket to bracket',W,'']);
  else rows.push(['A + extension left + extension right',W,`${frac(num(S.A))} + ${frac(num(S.extL)||0)} + ${frac(num(S.extR)||0)}`]);
  let order=W;
  if(onRings()&&S.looseRings||(onRings()&&hwKind()==='pole')){ const wom=womCount(W); order=W+wom; rows.push([`Loose rings: + 1" per width of material (${wom} widths)`,order,`${frac(W)} + ${wom}" (rod stays ${frac(W)})`]); }
  return {rows,order};
}
function heightCalcD(){
  const rows=[]; const g=hdrGroup(); const k=hwKind(); let h=null, basis='';
  if(S.mount==='IM'){ const o=num(S.openH); if(o==null) return {rows,order:null}; rows.push(['Opening height, shortest of three',o,'The workroom deducts ¾" on IM. Give the opening.']); return {rows,order:o,basis:'opening'}; }
  if(g==='ripple'){ const t=num(S.topRef); if(t==null) return {rows,order:null}; const th=num(S.trackH); if(th==null) return {rows:[['Mounting point to floor',t,'']],order:null,need:'trackH'};
    rows.push(['Mounting point to floor',t,'']); rows.push([`− track height (measured)`,t-th,`${frac(t)} − ${frac(th)}`]); h=t-th; basis='Fabric height only; the track sits above it.'; }
  else if(g==='pleat'){ if(onRings()||k==='dtr'){ const m=num(S.M); if(m==null) return {rows,order:null,need:'M'}; rows.push(['M · bottom of ring to floor',m,'Pin setting ½": the panel hangs from the ring']); h=m; }
    else { const t=num(S.topRef); if(t==null) return {rows,order:null}; rows.push(['Top of track to floor',t,'Pin setting 1¾" hides the track']); h=t; } }
  else if(S.header==='dblpocket'){ const t=num(S.topRef); if(t==null) return {rows,order:null}; rows.push(['Top rod to bottom rod, centre to centre',t,'Finished length between the rods; the workroom adds the take-up for both pockets']); return {rows,order:t,basis:'rod to rod; two pockets'}; }
  else if(g==='rod'){ const t=num(S.topRef); if(t==null) return {rows,order:null}; rows.push(['Top of rod to floor',t,'The workroom adds the take-up for the rod you name']); h=t;
    if(S.header==='grommet'){ rows.push(['Grommet: ½" of fabric above the rod = the ½" float',h,'Order rod-to-floor as the finished length']); } }
  else return {rows,order:null};
  if(!(g==='rod'&&S.header==='grommet')){ if(S.finish==='float'){h-=0.5; rows.push(['− ½" float (house standard)',h,'']);} else if(S.finish==='kiss'){rows.push(['Kiss: no float',h,'Needs a level floor']);} else {const p=num(S.puddleIn)||2; h+=p; rows.push([`+ ${frac(p)} puddle`,h,'Stationary panels only']);} }
  else if(S.finish==='puddle'){const p=num(S.puddleIn)||2; h+=p; rows.push([`+ ${frac(p)} puddle`,h,'']);}
  if(S.linen){ const d=0.5*0.03*h; const h2=h-d; rows.push([`Linen: − ½ × (3% × ${frac(h)})`,h2,`${frac(h)} − ${d.toFixed(2)}" → rounded to ⅛"`]); h=Math.round(h2*8)/8; }
  return {rows,order:h,basis};
}
function panels(){ // list of {cover} widths each panel covers
  const W=widthCalc().order; if(W==null) return [];
  if(S.product!=='drapery') return [];
  if(S.draw==='split') return [W/2,W/2];
  if(S.draw==='offset') return [num(S.offL)||0,num(S.offR)||0];
  if(S.draw==='stationary') return [W/2,W/2];
  return [W];
}
function yardageD(){
  /* Reverse-engineered from calculator.horizonshades.com (C.O.M. Yardage Calculator), Oct 2026.
     Pleated / grommet / flat: widths = ceil( sum over panels (cover x F + 4.75 + return) / roll ), F = 2.75 (3-finger & others), 2.0 (2-finger).
     Rod pocket & gathered tab: F 2.5, +3.5. Traditional tab: F 2.0, +3. Cut = H + 21 (pleated family), H + 16.5 + rod take-up (pocket), H + 46.5 (tab), H + 72 (gathered tab); rounded up to the repeat.
     Yards = widths x cut / 36 to the nearest 1/4 yd. Ripplefold uses Horizons' width tables per roll width. Sheer on wide goods (roll >= cut) is railroaded. */
  const H=heightCalc().order; const fw=num(S.fabWidth)||54; const vr=num(S.vr)||0; const out={}; const g=hdrGroup(); const hd=S.header;
  const q4=x=>Math.round(x*4+1e-9)/4;
  const RF={54:{1.8:[22,51,84,112,141,174],2:[20,45,75,101,126,156,181],2.2:[19,40,66,89,111,138,160,183]},60:{2:[24,54,84,113,143,173]},110:{2:[50,105,156]},118:{1.8:[60,122,188],2:[54,109,168],2.2:[48,96,149]}};
  function rfWidths(cover,roll,F){ const rolls=Object.keys(RF).map(Number); let base=rolls.reduce((a,b)=>Math.abs(b-roll)<Math.abs(a-roll)?b:a); let tab=RF[base][F]||RF[54][F]||RF[54][2]; const baseRoll=RF[base][F]?base:54; const k=roll/baseRoll; const t=tab.map(x=>x*k); for(let i=0;i<t.length;i++) if(cover<=t[i]) return i+1; const step=(t[t.length-1]-t[0])/(t.length-1); return t.length+Math.ceil((cover-t[t.length-1])/step); }
  function calc(fabW){
    if(H==null) return null;
    let cut=H+21, F=2.75, a=4.75+(num(S.projection)||0), kind='pleat';
    if(hd==='tfpinch'||hd==='tfcrown') F=2.0;
    if(g==='rod'){ const take=num((S.rodType||'').match(/[\d.]+/)?.[0])||1.5;
      if(hd==='rodpocket'||hd==='backtab'){F=2.5;a=3.5;cut=H+16.5+take;}
      else if(hd==='dblpocket'){F=2.5;a=3.5;cut=H+15+take+(num((S.rodType2||'').match(/[\d.]+/)?.[0])||1.5);}
      else if(hd==='gtab'){F=2.5;a=3.5;cut=H+72;}
      else if(hd==='ttab'){F=2.0;a=3;cut=H+46.5;}
      else {F=2.75;a=4.75+(num(S.projection)||0);} }
    if(isRF()){ kind='ripple'; F=S.rfFullness==='120'?2.2:S.rfFullness==='80'?1.8:S.rfFullness==='60'?1.8:2; }
    if(vr>0) cut=Math.ceil(cut/vr)*vr;
    const sheer=S.fabricType==='sheer';
    if(S.product!=='drapery'){ const w=Math.ceil(+S.spWidths)*(+S.spCount); return {widths:w,cut,yds:q4(w*cut/36)}; }
    const cov=panels(); if(!cov.length) return null;
    if(sheer&&fabW>=cut){ let yds=0; for(const c of cov){ yds+= kind==='ripple'?Math.ceil((c*(F+0.2)+6)/36):q4((c*3+15)/36); } return {widths:'railroaded',cut:Math.round(cov.reduce((s,c)=>s+c*(kind==='ripple'?F+0.2:3),0)),yds,rail:true}; }
    let widths=0, yds=0;
    if(kind==='ripple'){ for(const c of cov){ const w=rfWidths(c,fabW,F); widths+=w; yds+=q4(w*cut/36); } }
    else if(S.draw==='offset'){ for(const c of cov){ const w=Math.ceil((c*F+a)/fabW-1e-9); widths+=w; yds+=q4(w*cut/36); } }
    else { let flat=0; for(const c of cov) flat+=c*F+a; widths=Math.ceil(flat/fabW-1e-9); yds=q4(widths*cut/36); }
    return {widths,cut,yds};
  }
  out.a=calc(fw); if(fw<100) out.b=calc(118); return out;
}

function liningYards(){ if(S.lining!=='Contrasting Lining') return null; if(isRoman()){ const Y=yardage(); return Y.a?{widths:Y.a.widths,cut:Y.a.cut,yds:Y.a.yds}:null; } const fw=num(S.clWidth)||54; const vr=num(S.clVr)||0; const H=heightCalc().order; if(H==null) return null; const ff=fullnessFactor(); const ret=(hdrGroup()==='rod')?0:(num(S.projection)||3.5); let widths=0; if(S.product!=='drapery') widths=(+S.spWidths)*(+S.spCount); else for(const c of panels()){ widths+=Math.ceil((c*ff+ret+6+(S.masters==='overlap'?3.5:0))/fw); } let cut=H+22; if(vr>0) cut=Math.ceil(cut/vr)*vr; return {widths,cut,yds:Math.ceil(widths*cut/36*4)/4}; }
function bandYards(){ if(!S.banding) return null; if(isRoman()){ const H=heightCalc().order,W=widthCalc().order; if(H==null||W==null) return null; const bw=num(S.bandWidth)||2.5; const strip=bw*2+1; const fw=num(S.bandFabW)||54; const perW=Math.max(1,Math.floor(fw/strip)); const wh=S.rBandWhere; const strips=(wh==='Sides Only'?2:wh==='Bottom Only'?1:wh==='Inset'?4:3); const runV=H+10; const yds=Math.ceil(Math.ceil(strips/perW)*runV/36*4)/4; return {strips,perW,yds,inches:strips*runV,lengths:Math.ceil(strips/perW)}; } const H=heightCalc().order; if(H==null) return null; const W=rodWidth()||0; const bw=num(S.bandWidth)||2.5; const strip=bw*2+1; const fw=num(S.bandFabW)||54; const perW=Math.max(1,Math.floor(fw/strip)); const np=S.product==='drapery'?(panels().length||1):(+S.spCount); const pl=S.bandPlacement; let edges=0, runV=H+10, runH=0; if(pl==='Leading edge'||pl==='Stationary edge') edges=np; else if(pl==='Leading and stationary edges') edges=np*2; else if(pl==='Leading edge and bottom hem'){ edges=np; runH=W+10; } else if(pl==='All four sides'){ edges=np*2; runH=(W+10)*2; } else if(pl==='Inset from the edge') edges=np; const inches=edges*runV+runH; const strips=Math.ceil(inches/runV); const lengths=Math.ceil(strips/perW); const yds=Math.ceil(lengths*runV/36*4)/4; return {strips,perW,yds,inches,lengths}; }
/* ---------- validation / flags ---------- */
function flagsD(){
  const f=[]; const g=hdrGroup(); const k=hwKind();
  if(S.header&&S.hardware&&!HW[S.hardware].for.includes(g)) f.push(['Hardware mismatch',`${HEADERS[S.header].n} can't hang from ${HW[S.hardware].n}.`]);
  if(S.fabricType==='sheer'&&S.hem==='std') f.push(['House rule','Every sheer gets a Bead Weighted Bottom Hem.']);
  if(isRF()&&S.hem==='std') f.push(['House rule','Every ripplefold gets a Bead Weighted Bottom Hem.']);
  if(S.fabricType==='sheer'&&S.fullness&&+S.fullness<3&&!isRF()) f.push(['Sheer at '+S.fullness+'×',`Below the 3× house standard for sheers. Sew as a regular unlined panel; note it on the order.`,'note']);
  if(S.header&&HEADERS[S.header].stat&&S.draw&&S.draw!=='stationary') f.push(['Stationary header',`${HEADERS[S.header].n} is for stationary panels. Change the draw or the header.`]);
  if(S.draw==='offset'){const W=widthCalc().order; const l=num(S.offL),r=num(S.offR); if(W!=null&&l!=null&&r!=null&&Math.abs(l+r-W)>0.0625) f.push(['Offset split',`Left ${frac(l)} + right ${frac(r)} = ${frac(l+r)}, but the rod is ${frac(W)}.`]);}
  if((S.draw==='split'||S.draw==='offset')&&S.masters==='butt'&&!(S.lining==='Unlined'&&S.notes.toLowerCase().includes('divider'))) f.push(['Butt masters','Only where there is no light behind the drapery. Overlap otherwise.']);
  if(S.lining==='Interlining'||S.lining==='Dual Lining'){const W=widthCalc().order,H=heightCalc().order; if(W&&H&&W*H/144>49) f.push(['Over 49 sq ft interlined',`${(W*H/144).toFixed(0)} sq ft. Spec heavy-duty track and brackets.`]);}
  if(S.lining==='Unlined'&&S.fabricType==='drapery'&&S.fabricSource==='com') f.push(['Warranty','Unlined non-sheer fabric has no protection from the sun. Our warranty excludes sun damage on it; tell the client in writing.']);
  if(S.finish==='kiss'&&S.level==='off') f.push(['Out of level','A kiss length on an out-of-level floor kisses at one end and floats at the other. Float instead.']);
  if(S.finish==='puddle'&&S.draw&&S.draw!=='stationary') f.push(['Puddle on a traversing panel','Collects dust and drags. Puddles are for stationary panels.']);
  if(S.motor&&!S.room) f.push(['Motor needs a room name','No room name, no remote programming.']);
  if(g==='rod'&&!S.rodType) f.push(['Rod type missing','The workroom adds the take-up from the rod you name. Required.']);
  if(S.header==='dblpocket'&&!S.rodType2) f.push(['Bottom rod missing','A double rod pocket needs both rod sizes.']);
  if(num(S.projection)!=null&&(num(S.projection)<0||num(S.projection)>7.5)) f.push(['Return out of range','Returns run from 0" to 7½".']);
  if(k&&HW[S.hardware].ext) f.push(['Separate line',`${HW[S.hardware].n}: order the track/rod from the vendor as its own line; it is not sewn.`,'note']);
  if(S.linen) f.push(['Linen terms','Attach the linen terms to the estimate for signature. The height on this order is already short by half the 3% tolerance.','note']);
  if(S.fabricSource==='com') f.push(['C.O.M.','Tell the client: rolled on a tube, face and direction marked, delivered to us with the job name on it. Yardage above is the estimate; the workroom confirms before they buy.','note']);
  if(S.header==='grommet'&&!S.gromalink&&S.draw&&S.draw!=='stationary') f.push(['Wand?','A traversing grommet panel pulled by a wand needs Grom-A-Link.','note']);
  return f;
}
function stepStatusD(id){
  const W=widthCalc().order,H=heightCalc().order;
  switch(id){
    case 'job': return S.room?'done':'';
    case 'product': return S.product?(S.product==='drapery'||num(S.spWindowW)!=null?'done':''):'';
    case 'header': return S.header?'done':'';
    case 'fullness': return S.fabricType&&fullnessLabel()?'done':'';
    case 'hardware': { if(!S.hardware) return ''; const bad=!HW[S.hardware].for.includes(hdrGroup())||(hdrGroup()==='rod'&&!S.rodType)||(hdrGroup()!=='rod'&&num(S.projection)==null)||(isRF()&&num(S.trackH)==null); return bad?'warn':'done'; }
    case 'measure': { if(S.product!=='drapery') return H!=null?'done':''; return (W!=null&&H!=null)?'done':(num(S.A)!=null||num(S.topRef)!=null?'warn':''); }
    case 'draw': { if(S.product!=='drapery') return 'done'; if(!S.draw) return ''; if((S.draw==='split'||S.draw==='offset')&&!S.masters) return 'warn'; return 'done'; }
    case 'lining': return S.lining&&S.hem?'done':'';
    case 'fabric': return S.fabricSource?'done':'';
    case 'extras': return 'done';
    case 'order': return STEPS_D.slice(0,10).every(s=>stepStatus(s[0])==='done')?'done':'';
    case 'price': return priceCalc()?'done':'';
  }
}

/* ---------- order lines ---------- */
function orderLinesD(){
  const L=[]; const sec=t=>L.push({sec:t}); const row=(k,v,n,small)=>L.push({k,v,n,small});
  const W=widthCalc(),H=heightCalc(); const g=hdrGroup();
  sec('Identification');
  row('Client',S.client); row('Project',S.project); row('Room / window',[S.room,S.windowId].filter(Boolean).join(' · '));
  row('Quantity',S.qty?String(S.qty):'' ,true);
  sec('Product');
  if(S.product==='drapery') row('Product','Drapery');
  else if(S.product==='sidepanel') row('Product',`Side Panel · ${{'1':'1 width','1.5':'1½ width','2':'2 width'}[S.spWidths]} × ${S.spCount==='2'?'pair':'single'}`);
  else if(S.product==='bmsp') row('Product',`Board Mounted Side Panel · ${{'1':'1 width','1.5':'1½ width','2':'2 width'}[S.spWidths]} × ${S.spCount==='2'?'pair':'single'} · ${S.bmspReturn}`);
  else row('Product','');
  row('Header style',S.header?HEADERS[S.header].n:'');
  row('Fullness',fullnessLabel()+(S.fabricType==='sheer'&&!isRF()&&S.fullness&&+S.fullness<3?' (sheer below standard, per client)':''));
  if(S.fabricType==='sheer') row('Sheer','Yes');
  sec('Size');
  if(S.product==='drapery') row('Width',W.order!=null?frac(W.order):'',true,W.order!=null&&onRings()?'rod '+frac(rodWidth())+' + 1" per width of material':'= rod width; the workroom applies fullness');
  row('Height',H.order!=null?frac(H.order):'',true,H.order!=null?(S.linen?'linen: short by ½ × 3%':H.basis||''):'');
  row('Mount',{OM:'OM',IM:'IM',UT:'Under Treatment'}[S.mount]+' · '+(S.mountSurface==='ceiling'?'Ceiling Mount':'Wall Mount'));
  if(S.product==='drapery'){ row('Draw',{split:'Split',offset:`Offset Split · L ${frac(num(S.offL))} / R ${frac(num(S.offR))}`,oneL:'One Way – stack left',oneR:'One Way – stack right',stationary:'Stationary'}[S.draw]||'');
    if(S.draw==='split'||S.draw==='offset') row('Master carriers',S.masters?(S.masters==='overlap'?'Overlap':'Butt'):''); }
  if(g!=='rod') row('Return',num(S.projection)!=null?frac(num(S.projection)):'',true);
  if(g==='pleat') row('Pin setting',pinSetting()||'');
  if(S.header==='dblpocket') row('Rods',`top ${S.rodType||'—'} · bottom ${S.rodType2||'—'}`); else if(g==='rod') row('Rod type',S.rodType);
  if(S.header==='grommet') row('Grommet',`${S.gromSize.replace(/ \(.*\)/,'')} · ${S.gromFinish.replace(/ \(.*\)/,'')}${S.gromalink?' · Grom-A-Link':''}`);
  sec('Construction');
  row('Lining',S.lining?(S.lining+(['Premium Lining','Blackout Lining'].includes(S.lining)?' · '+S.liningColor:'')):'');
  row('Hem',S.hem?(S.hem==='bead'?'Bead Weighted Bottom Hem':'Standard corner weights'):'');
  const deco=[S.banding&&'Edge Accents Banding',S.trim&&'Decorative Trimmings',S.duo&&'Duo-Drape',S.tiebacks&&'Tie Backs'].filter(Boolean).join(', ');
  if(S.lining==='Contrasting Lining'){ const ly=liningYards(); row('Contrast lining fabric',`${S.clSource==='com'?'C.O.M.':'Our fabric'} · ${[S.clVendor,S.clPattern,S.clColor].filter(Boolean).join(' / ')||'not set'} · ${frac(num(S.clWidth)||54)} wide · V ${frac(num(S.clVr)||0)}`,false,[ly?`${ly.widths} widths, ${ly.yds} yd (est.)`:'',S.clNotes].filter(Boolean).join(' · ')); }
  row('Decoration',[deco,S.decoNotes].filter(Boolean).join(' · '));
  if(S.banding){ const by=bandYards(); row('Banding',`${S.bandPlacement}${S.bandPlacement==='Inset from the edge'?' '+frac(num(S.bandInset)||2):''} · ${frac(num(S.bandWidth)||2.5)} finished`,false,S.bandNotes); row('Banding fabric',`${S.bandSource==='com'?'C.O.M.':'Our fabric'} · ${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'not set'} · ${frac(num(S.bandFabW)||54)} wide`,false,by?`${by.strips} strip${by.strips>1?'s':''} of ~${frac((num(S.bandWidth)||2.5)*2+1)} × ${frac(by.inches/by.strips)}, ${by.perW} per width · ${by.yds} yd (est.)`:''); }
  sec('Fabric');
  row('Fabric',S.fabricSource?(S.fabricSource==='com'?'C.O.M.':'Our fabric')+' · '+[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / '):'');
  row('Width / repeats',S.fabricSource?`${frac(num(S.fabWidth))} wide · V ${frac(num(S.vr)||0)} · H ${frac(num(S.hr)||0)}`:'',true);
  const Y=yardage(); if(H.order!=null&&S.fabricSource) row('Yardage (est.)',`${Y.a.yds} yd of ${frac(num(S.fabWidth))}`+(Y.b?` · or ${Y.b.yds} yd of 118"`:''),true,'per the Horizons C.O.M. calculator rules');
  sec('Hardware');
  row('Hardware',S.hardware?HW[S.hardware].n+(HW[S.hardware].ext?' (separate order)':''):'');
  if(isRF()) row('Track height',num(S.trackH)!=null?frac(num(S.trackH)):'',true);
  if(S.motor) row('Motor',`A/C plug-in · motor ${S.motorSide}`);
  if(S.notes) {sec('Notes'); row('Notes',S.notes);}
  return L;
}
function orderTextD(){
  const W=widthCalc(),H=heightCalc(); const g=hdrGroup(); const dr=S.product==='drapery'; const q=Math.max(1,num(S.qty)||1);
  const L=[]; const sec=t=>{L.push('',''+'#### '+t+':');}; const b=(k,v)=>{ if(v==null||v==='') return; L.push(`* **${k}:** ${v}`); };
  const clientW=dr?rodWidth():null; const clientL=num(S.topRef)||num(S.M)||num(S.openH)||H.order;
  const prodName=S.product==='drapery'?'Drapery':S.product==='sidepanel'?'Side Panels':S.product==='bmsp'?'Board Mounted Side Panels':'Drapery';
  const drawTxt={split:'Split draw',offset:`Offset split, L ${frac(num(S.offL))} / R ${frac(num(S.offR))}`,oneL:'One way, stack left',oneR:'One way, stack right',stationary:'Stationary'}[S.draw]||'';
  L.push('<center> _According To Design Specifications_</center>','','____');
  sec('Plan');
  L.push(`* **Custom Sewn ${prodName}**`);
  b('Dimensions',`${clientW!=null?frac(clientW)+'W x ':''}${clientL!=null?frac(clientL)+'L':''} Not Confirmed Confirmed`);
  b('Quantity',`${q} ${dr?(S.draw==='split'||S.draw==='offset'||S.draw==='stationary'?'pair':'panel'):(S.spCount==='2'?'pair':'panel')}${q>1?'s':''}`);
  b('Room / Window',[S.room,S.windowId].filter(Boolean).join(' · '));
  sec('Style');
  b('Header',(S.header?HEADERS[S.header].n:'')+(fullnessLabel()?', '+fullnessLabel()+' fullness':'')+(S.fabricType==='sheer'?' (sheer)':''));
  if(dr) b('Draw',drawTxt+((S.draw==='split'||S.draw==='offset')&&S.masters?`, ${S.masters} master carriers`:''));
  if(!dr) b('Widths of material',`${{'1':'1 width','1.5':'1½ widths','2':'2 widths'}[S.spWidths]} per panel${S.product==='bmsp'?', '+S.bmspReturn:''}`);
  b('Mount',`${{OM:'Outside mount',IM:'Inside mount',UT:'Under treatment'}[S.mount]}, ${S.mountSurface}${g!=='rod'&&num(S.projection)!=null?`, ${frac(num(S.projection))} return`:''}`);
  if(S.header!=='dblpocket') b('Finish at floor',S.finish==='float'?'Float ½"':S.finish==='kiss'?'Kiss length':`Puddle ${frac(num(S.puddleIn)||2)}`);
  sec('Construction');
  if(dr) b('Finished Width',W.order!=null?`${frac(W.order)}${onRings()?' (rod '+frac(rodWidth())+' + 1" per width of material)':' (= rod width; workroom applies fullness)'}`:'');
  b('Finished Length',H.order!=null?`${frac(H.order)}${S.linen?' (linen: short by ½ × 3%)':''}${H.basis?' ('+H.basis+')':''}`:'');
  b('Lining',S.lining?(S.lining+(['Premium Lining','Blackout Lining'].includes(S.lining)?', '+S.liningColor:'')):'');
  b('Hem',S.hem?(S.hem==='bead'?'Bead weighted bottom hem':'Standard corner weights'):'');
  if(g==='pleat') b('Pin setting',pinSetting()||'');
  if(S.header==='dblpocket') b('Rods',`top ${S.rodType||'—'} / bottom ${S.rodType2||'—'}`); else if(g==='rod') b('Rod type',S.rodType);
  if(S.header==='grommet') b('Grommets',`${S.gromSize.replace(/ \(.*\)/,'')}, ${S.gromFinish.replace(/ \(.*\)/,'')}${S.gromalink?', Grom-A-Link':''}`);
  if(S.banding) b('Banding',`${frac(num(S.bandWidth)||2.5)} finished, ${S.bandPlacement.toLowerCase()}${S.bandPlacement==='Inset from the edge'?' '+frac(num(S.bandInset)||2):''}${S.bandNotes?'. '+S.bandNotes:''}`);
  const deco=[S.trim&&'Decorative trimmings',S.duo&&'Duo-Drape',S.tiebacks&&'Tie backs'].filter(Boolean).join(', '); b('Decoration',[deco,S.decoNotes].filter(Boolean).join('. '));
  sec('Hardware');
  b('Hardware',S.hardware?HW[S.hardware].n+(HW[S.hardware].ext?' (ordered separately)':''):'');
  if(isRF()) b('Track height',num(S.trackH)!=null?frac(num(S.trackH)):'');
  if(S.motor) b('Motor',`A/C plug-in, motor ${S.motorSide}`);
  sec('Fabric');
  const Y=yardage(); const yPer=(H.order!=null&&S.fabricSource&&Y.a)?Y.a.yds:null;
  b('Body Yardage',yPer!=null?`${yPer*q} Yards of Fabric Required in TOTAL (${yPer} Yards Per)${Y.b?` — or ${Y.b.yds*q} yards of 118" wide`:''}`:'To Be Determined');
  const fabDesc=[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / ');
  b('Body Fabric',S.fabricSource==='com'?`C.O.M. ${fabDesc||'To Be Determined'}, ${frac(num(S.fabWidth))} wide (Price Not Included)`:(fabDesc||'To Be Determined')+`, ${frac(num(S.fabWidth))} wide`+((num(S.fabPrice)||0)>0?'':'  (Price Not Included)'));
  b('Repeats',`V ${frac(num(S.vr)||0)} / H ${frac(num(S.hr)||0)}`);
  b('Fabric Direction/Center','To Be Determined');
  if(S.lining==='Contrasting Lining'){ const ly=liningYards(); b('Contrast Lining Yardage',ly?`${ly.yds*q} Yards in TOTAL (${ly.yds} Yards Per, ${ly.widths} widths)`:'To Be Determined'); b('Contrast Lining Fabric',`${S.clSource==='com'?'C.O.M. ':''}${[S.clVendor,S.clPattern,S.clColor].filter(Boolean).join(' / ')||'To Be Determined'}, ${frac(num(S.clWidth)||54)} wide, V ${frac(num(S.clVr)||0)}${S.clSource==='com'?' (Price Not Included)':''}${S.clNotes?'. '+S.clNotes:''}`); }
  if(S.banding){ const by=bandYards(); b('Banding Yardage',by?`${by.yds*q} Yards in TOTAL (${by.yds} Yards Per: ${by.strips} strips of ~${frac((num(S.bandWidth)||2.5)*2+1)})`:'To Be Determined'); b('Banding Fabric',`${S.bandSource==='com'?'C.O.M. ':''}${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'To Be Determined'}, ${frac(num(S.bandFabW)||54)} wide${S.bandSource==='com'?' (Price Not Included)':''}`); }
  if(S.notes){ sec('Notes'); L.push(`* ${S.notes}`); }
  const math=[]; for(const r of W.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); for(const r of H.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`);
  if(math.length){ sec('Workroom math'); L.push(...math); }
  const fl=flags().filter(f=>f[2]!=='note'); if(fl.length){ sec('Open flags'); L.push(...fl.map(f=>`* **${f[0]}:** ${f[1]}`)); }
  return L.join('\n').trim();
}

/* ---------- house price book (labor, fabric supplied separately) ---------- */
const PB={
  drapery:{widths:[30,52,74,96,117,139,160],heights:[48,60,72,84,96,120,144],addW:200,
    grid:{48:[486,608,813,1007,1200,1393,1850],60:[496,620,830,1028,1224,1421,1888],72:[518,647,852,1056,1263,1474,1945],84:[530,662,868,1075,1288,1500,1973],96:[542,678,888,1101,1314,1530,2008],120:[552,690,904,1116,1332,1552,2035],144:[559,699,931,1142,1342,1564,2039]},
    sur:{bead:42,gtab:210,grommet:124,gromalink:25,blackout:253,bbb:253,comPrivacy:29,comBlackout:99,interlining:288,self:51,contrast:72,dual:190,duo:105,banding:213,inset:261,trim:213,tieback:48,offset:127},
    },
  rodpocket:{widths:[12,36,48],heights:[36,48,60,72,84],grid:{36:[181,244,290],48:[224,264,319],60:[230,280,329],72:[239,291,346],84:[242,300,356]},addH:[14,28,30],
    sur:{blackout:117,bbb:117,interlining:133,dual:88,self:29,contrast:39,tieback:48,sash:57}},
  sidepanel:{heights:[60,84,120,192,240],grid:{1:{60:218,84:274,120:303,192:356,240:389},2:{60:315,84:369,120:420,192:495,240:556}},
    sur:{bead:19,board:69,gtab:105,grommet:48,blackout:117,bbb:117,comPrivacy:29,comBlackout:49,interlining:133,self:29,contrast:39,dual:88,duo:52,banding:106,inset:131,trim:106,tieback:48},
    },
};
function bucket(list,v){ for(const b of list) if(v<=b) return b; return null; }
function laborBaseD(){
  const H=heightCalc().order; if(H==null) return null; const rows=[];
  if(S.product==='drapery'&&S.header==='dblpocket'){
    const W=rodWidth(); if(W==null) return null; const pb=PB.rodpocket; const np=Math.max(1,Math.ceil(W/48)); const pw=W/np; const wb=bucket(pb.widths,pw); const wi=pb.widths.indexOf(wb);
    const hb=bucket(pb.heights,H)||84; const extraH=hb===84&&H>84?Math.ceil((H-84)/12):0; let each=pb.grid[hb][wi]+extraH*pb.addH[wi];
    rows.push([`Double rod pocket panel, per panel × ${np}`,each*np,`width to ${wb}" × height to ${hb}"${extraH?` + ${extraH} × $${pb.addH[wi]} per add'l 12"`:''}${np>1?`; ${frac(W)} split into ${np} panels`:''}`]); return {rows,base:each*np,per:'per unit'};
  }
  if(S.product==='drapery'){
    const W=rodWidth(); if(W==null) return null; const pb=PB.drapery;
    const hb=bucket(pb.heights,H)||144; const extraH=hb===144&&H>144?Math.ceil((H-144)/12):0;
    const wb=bucket(pb.widths,W); let base,note;
    if(wb){ base=pb.grid[hb][pb.widths.indexOf(wb)]; note=`width to ${wb}" × height to ${hb}"`; }
    else { const n=Math.ceil((W-160)/12); base=pb.grid[hb][6]+n*pb.addW; note=`width to 160" × height to ${hb}", + ${n} × $${pb.addW} per add'l 12"`; }
    if(extraH){ base+=extraH*pb.addW; note+=`, + ${extraH} × $${pb.addW} per add'l 12" of height (not in chart; assumed)`; }
    rows.push(['Drapery labor, C.O.M. group',base,note]); return {rows,base,per:'per drapery'};
  } else {
    const pb=PB.sidepanel; const hb=bucket(pb.heights,H)||240; const w=+S.spWidths; const n=+S.spCount; let each,note;
    if(w===1.5){ each=(pb.grid[1][hb]+pb.grid[2][hb])/2; note=`1½ widths: midpoint of the 1- and 2-width columns, height to ${hb}" `; }
    else { each=pb.grid[w][hb]; note=`${w} width${w>1?'s':''}, height to ${hb}"`; }
    rows.push([`Side panel labor, C.O.M. group, ${n===2?'per panel × 2':'single'}`,each*n,note]); return {rows,base:each*n,per:'per unit ('+n+' panel'+(n>1?'s':'')+')'};
  }
}
function surchargesD(){
  if(!S.product) return []; const dr=S.product==='drapery'; const dbl=S.header==='dblpocket'; const pb=dbl?PB.rodpocket:dr?PB.drapery:PB.sidepanel; const n=dbl?Math.max(1,Math.ceil((rodWidth()||1)/48)):dr?1:(+S.spCount); const u=dr?'':' × '+n+' panels'; const out=[];
  const add=(lab,amt,note)=>{ if(amt==null||isNaN(amt)) return; out.push([lab,amt,note||'']); };
  if(S.product==='bmsp') add('Board Mounted Side Panel',pb.sur.board*n,'per panel'+u);
  if(S.hem==='bead') add('Bead Weighted Bottom Hem',pb.sur.bead*n,dr?'':'per panel'+u);
  if(S.header==='gtab') add('Gathered Tab Top',pb.sur.gtab*n);
  if(S.header==='grommet'){ add('Grommets',pb.sur.grommet*n); if(S.gromalink){ const links=dr?panels().length||1:n; add('Grom-A-Link',(dr?PB.drapery.sur.gromalink:25)*links,`$25 per link × ${links}`);} }
  if(dr&&S.draw==='offset') add('Offset split',pb.sur.offset,'');
  const L=S.lining;
  if(L==='Blackout Lining'||L==='Black Backed Blackout') add(L,pb.sur.blackout*n);
  if(L==='Interlining') add('Interlining',pb.sur.interlining*n);
  if(L==='Dual Lining') add('Dual Lining',pb.sur.dual*n);
  if(L==='Self Lining') add('Self lining',pb.sur.self*n);
  if(L==='Contrasting Lining') add('Contrasting lining',pb.sur.contrast*n);
  if(S.fabricType==='sheer'&&L==='Premium Lining') add('Sheer with Premium Lining',dr?159:49*n,'privacy lining only');
  if(S.duo) add('Duo-Drape',pb.sur.duo*n);
  if(S.banding) add(S.bandPlacement==='Inset from the edge'?'Inset banding':'Edge banding',(S.bandPlacement==='Inset from the edge'?pb.sur.inset:pb.sur.banding)*n,S.bandPlacement);
  if(S.trim) add('Decorative Trimmings',pb.sur.trim*n,'any configuration');
  if(S.tiebacks) add('Tie backs',pb.sur.tieback*(dr?2:n),'$48 each');
  if(S.fabricType==='sheer'&&!(isRF())&&+S.fullness>=4) add('4× fullness',105,'sheers only');
  return out;
}
function rodPrice(){ return null; }
function priceCalc(){
  const lb=laborBase(); if(!lb) return null; const q=Math.max(1,num(S.qty)||1);
  const r={}; r.base=lb.base; r.baseRows=lb.rows; r.sur=surcharges(); r.surTotal=r.sur.reduce((a,x)=>a+x[1],0); r.adj=num(S.pAdj)||0;
  r.retail=r.base+r.surTotal+r.adj;
  r.freight=0; r.tariff=0;
  r.labor=r.retail+r.freight+r.tariff;
  let hwRetail=0; S.hw.forEach(h=>{hwRetail+=(num(h.q)||0)*(num(h.p)||0)}); const rp=rodPrice(); r.rod=rp; if(rp) hwRetail+=rp.p; const hwShip=num(S.hwShip)||0,hwTar=num(S.hwTariff)||0;
  r.hwRetail=hwRetail; r.hardware=hwRetail+hwShip+hwTar;
  const Y=yardage(); const yds=Y.a?Y.a.yds*q:0; const fp=num(S.fabPrice)||0; r.yds=yds; r.fabric=S.fabricSource==='com'?yds*15:yds*fp; r.fabricNote=S.fabricSource==='com'?`C.O.M. handling $15 × ${yds} yd`:`${yds} yd × ${money(fp)}`; if(typeof isRoller==='function'&&isRoller()){ r.fabric=0; r.fabricNote='vendor fabric, in the shade price'; }
  const ly=liningYards(); if(ly){ const y=ly.yds*q; const c=S.clSource==='com'?y*15:y*(num(S.clPrice)||0); r.fabric+=c; r.fabricNote+=`; contrast lining ${y} yd ${S.clSource==='com'?'C.O.M. handling':'× '+money(num(S.clPrice)||0)}`; }
  const by=bandYards(); if(by){ const y=by.yds*q; const c=S.bandSource==='com'?y*15:y*(num(S.bandPrice)||0); r.fabric+=c; r.fabricNote+=`; banding ${y} yd ${S.bandSource==='com'?'C.O.M. handling':'× '+money(num(S.bandPrice)||0)}`; }
  r.consult=num(S.consult)||0; if(typeof isRoman==='function'&&(isRoman()||isRoller())){ r.instHrs=0; r.installPer=95; r.install=95*q; r.installNote=`${q} window${q>1?'s':''} × $95`; } else { const hrs=Math.max(3,num(S.instHrs)||0); r.instHrs=hrs; r.install=hrs*200; r.installNote=`${hrs} hr × $200 (3-hour minimum)`; }
  r.total=r.labor*q+r.hardware+r.fabric+r.consult+r.install; r.q=q;
  return r;
}
function erLinesD(){
  const r=priceCalc(); if(!r) return []; const W=rodWidth(),Hc=heightCalc().order; const unitQ=r.q;
  const where=[S.room,S.windowId].filter(Boolean).join(' · ');
  const spec=[S.product==='drapery'?'Drapery':S.product==='sidepanel'?'Side panel':'Board mounted side panel',S.header&&HEADERS[S.header].n,fullnessLabel()&&fullnessLabel()+' fullness',S.draw&&({split:'split draw',offset:'offset split',oneL:'one way, stack left',oneR:'one way, stack right',stationary:'stationary'}[S.draw]),S.masters&&(S.draw==='split'||S.draw==='offset')?S.masters+' master carriers':'',S.lining,S.hem==='bead'?'bead-weighted hem':'',S.banding?`${frac(num(S.bandWidth)||2.5)} banding, ${S.bandPlacement.toLowerCase()}`:'',W!=null?`${frac(W)} W`:'',Hc!=null?`${frac(num(S.topRef)||num(S.M)||num(S.openH)||Hc)} L`:'',S.finish==='puddle'?'puddle':S.finish==='kiss'?'kiss length':''].filter(Boolean).join(', ');
  const rows=[];
  rows.push({item:'Fabrication labor',desc:`${where}: ${spec}`,qty:unitQ,unit:r.labor});
  if(r.hwRetail>0||num(S.hwShip)||num(S.hwTariff)) rows.push({item:'Hardware',desc:`${S.hardware?HW[S.hardware].n.replace(/ \(.*\)/,''):'Hardware'}: `+[r.rod?r.rod.note:''].concat(S.hw.filter(h=>h.n).map(h=>`${h.n}${(num(h.q)||1)>1?' ×'+h.q:''}`)).filter(Boolean).join(', '),qty:1,unit:r.hardware});
  if(liningYards()||bandYards()) rows.push({item:'Fabric',desc:r.fabricNote,qty:1,unit:r.fabric}); else rows.push({item:'Fabric',desc:S.fabricSource==='com'?`C.O.M. ${[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / ')}: ${r.yds} yd of ${frac(num(S.fabWidth))} (handling $15/yd)`:`${[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / ')}: ${r.yds} yd of ${frac(num(S.fabWidth))}`,qty:r.yds,unit:S.fabricSource==='com'?15:(num(S.fabPrice)||0)});
  rows.push({item:'On-site consultation',desc:'Measure and design visit',qty:1,unit:r.consult});
  rows.push({item:'Installation',desc:`${r.instHrs} hr at $200/hr (3-hour minimum)`,qty:r.instHrs,unit:200});
  return rows;
}
function estText(){
  const rows=erLines(); if(!rows.length) return '';
  const r=priceCalc();
  const out=['Item\tDescription\tQty\tUnit price\tTotal'];
  rows.forEach(x=>out.push([x.item,x.desc,x.qty,x.unit.toFixed(2),(x.qty*x.unit).toFixed(2)].join('\t')));
  out.push(`\t\t\tTotal\t${r.total.toFixed(2)}`);
  out.push('','Terms: 50% non-refundable deposit; balance on completion. 3% on card payments. Rush 20–50%. C.O.M. handling $15/yd. Workmanship guaranteed 180 days. 10% late fee; 50% cancellation once work has started. Good for 30 days.'+(S.linen?' Linen terms attached for signature.':'')+(S.fabricSource==='com'?' Fabric performance disclaimer applies.':''));
  return out.join('\n');
}

const EXAMPLE={client:'EXAMPLE · Estimate 2519',project:'2519',room:'Primary bedroom',windowId:'Corner window',qty:1,product:'drapery',header:'grommet',fabricType:'sheer',fullness:'2',hardware:'orion',mountSurface:'wall',mount:'OM',projection:'',trackH:'',rodType:'1¼" round iron rod',A:'112',extL:'0',extR:'0',openW:'',G:'',H:'',topRef:'103',M:'',openH:'',finish:'float',puddleIn:2,level:'ok',linen:false,draw:'offset',offL:'69',offR:'43',masters:'overlap',motor:false,motorSide:'left',lining:'Unlined',liningColor:'Workroom matches',hem:'bead',fabricSource:'com',fabVendor:'Carole',fabPattern:'Flat Out',fabColor:'Ecru',fabWidth:118,vr:0,hr:0,fabPrice:0,gromSize:'Small Round (poles to 1⅜")',gromFinish:'Oil Rubbed Bronze (small round & square only)',gromalink:true,banding:false,trim:false,duo:false,tiebacks:false,decoNotes:'',notes:'Sheer at 2× per designer.',pAdj:'',hw:[{n:'Rod 11 ft @ $28',q:1,p:308},{n:'Finials 9704',q:2,p:30},{n:'Brackets 1028 HP',q:4,p:31},{n:'Wands 36"',q:2,p:64},{n:'Miter charge',q:2,p:32},{n:'Elbow 315',q:1,p:63},{n:'Misc.',q:1,p:10}],hwShip:60,hwTariff:56.03,consult:150,instHrs:3};

/* ---------- roman shades ---------- */
const RSTYLES={
  classic:{n:'Classic Flat',d:'Flat face; the folds stack at the bottom. Takes a pattern. The default.',fam:'classic'},
  hobbled:{n:'Hobbled',d:'Soft, overlapping folds down the whole face; about 1½× the fabric. Solids and textures.',fam:'hobbled'},
  knife:{n:'Knife Pleat',d:'Sharp pressed pleats. The fabric has to pleat; big patterns break at the pleat.',fam:'classic'},
  ribbed:{n:'Ribbed Pleat',d:'Rounded ribs. Same fabric rules as knife pleat.',fam:'classic'},
  relaxed:{n:'Relaxed',d:'Soft smile at the bottom. A stationary look; measure height to the short point. Not for inside mount or multi-on-one.',fam:'classic',stat:true},
  london:{n:'Pleated London',d:'Inverted pleats and tails with a relaxed smile. Stationary look; height to the short point.',fam:'classic',stat:true},
};
const RSTEPS=[['job','Job'],['product','Product'],['rstyle','Style'],['rcontrol','Control'],['measure','Measure'],['rvalance','Valance'],['lining','Lining'],['fabric','Fabric'],['extras','Extras'],['order','Order'],['price','Price']];
const RDEF={rStyle:'',rControl:'',rSide:'right',rTassel:'White',rChainColor:'Stainless steel',rMotor:'battery',rRail:'1.5',rTurned:false,rOverlap:3,rHtTo:'apron',rAbove:2,rOpenW:'',rOpenH:'',rB:'',rI:'',rJ:'',rK:'',rDepth:'',rTrimProj:'',rValance:'none',rValH:6,rValReturns:false,rScallop:'None',rAlign:'bottom',rMulti:'1',rW1:'',rW2:'',rW3:'',rBandWhere:'Sides & Bottom',rHoldDowns:false};
Object.assign(DEFAULT,RDEF);
function isRoman(){ return S.product==='roman'; }

function rFam(){ return S.rStyle?RSTYLES[S.rStyle].fam:'classic'; }
function rShadeWidths(W){ const n=+S.rMulti||1; if(n===1) return [W]; const ws=[num(S.rW1),num(S.rW2),num(S.rW3)].slice(0,n); return ws; }
function widthCalcR(){ const rows=[]; let W=null;
  if(S.mount==='IM'){ W=num(S.rOpenW); if(W==null) return {rows,order:null}; rows.push(['A · opening width, smallest of three',W,'Give the opening; the workroom deducts the operating clearance']); }
  else { const B=num(S.rB); if(B==null) return {rows,order:null}; const o=num(S.rOverlap)||0; W=B+2*o; rows.push(['B · outside of frame',B,'']); rows.push([`+ ${frac(o)} overlap each side`,W,'3" minimum each side to close the light gap and clear the trim']); }
  if((+S.rMulti||1)>1){ const ws=rShadeWidths(W); const sum=ws.reduce((a,b)=>a+(b||0),0); rows.push([`${S.rMulti} shades on one headrail: ${ws.map(x=>frac(x)).join(' + ')}`,sum,`= headrail width; the workroom takes ⅜" at each gap${Math.abs(sum-W)>0.0625?' (does not add up to '+frac(W)+')':''}`]); }
  return {rows,order:W}; }
function heightCalcR(){ const rows=[]; let H=null; const stat=S.rStyle&&RSTYLES[S.rStyle].stat;
  if(S.mount==='IM'){ H=num(S.rOpenH); if(H==null) return {rows,order:null}; rows.push(['H · opening height, shortest of three',H,stat?'To the short point of the smile':'']); }
  else { const base=S.rHtTo==='sill'?num(S.rI):num(S.rJ); if(base==null) return {rows,order:null,need:'rIJ'}; const ab=num(S.rAbove)||0; rows.push([S.rHtTo==='sill'?'I · top of frame to sill':'J · top of frame to bottom of apron',base,'']); H=base+ab; rows.push([`+ ${frac(ab)} mounted above the frame`,H,'Hides the stack above the glass; needs room under the ceiling or crown'+(stat?'. Height is to the short point of the smile':'')]); }
  return {rows,order:H,basis:S.mount==='IM'?'inside mount, exact opening':'outside mount, finished size'}; }
function rRailAuto(){ const W=widthCalc().order,H=heightCalc().order; if(W==null||H==null) return null; return (W<=60&&H<=60)?'1.5':'2.5'; }
function yardageR(){
  /* Horizons C.O.M. calculator, fabric roman shades: 1 width to (roll − 6"), else 2; London 1 width to 36", 2 to 90" on 54" goods.
     Cut: Classic H+24 (+3), Hobbled 1.5H+36 (+4.5), Knife/Ribbed 1.125H+36 (+4.5), Relaxed/London H+48 (+3); house rule adds 8" to every cut for the permanent pleat; nearest ¼ yd. Sheer on wide goods railroaded, (W+9)/36. */
  const H=heightCalc().order, W=widthCalc().order; if(H==null||W==null) return {}; const q4=x=>Math.round(x*4+1e-9)/4; const vr=num(S.vr)||0;
  function one(fabW){ let widths=0, yds=0, cut=0; for(const w of rShadeWidths(W)){ if(w==null) continue; let nw, c, extra; const st=S.rStyle||'classic';
      if(st==='london') nw=Math.ceil((w+18)/fabW); else nw=Math.ceil(w/(fabW-6));
      if(st==='hobbled'){c=1.5*H+36;extra=4.5;} else if(st==='knife'||st==='ribbed'){c=1.125*H+36;extra=4.5;} else if(st==='relaxed'||st==='london'){c=H+48;extra=3;} else {c=H+24;extra=3;}
      c+=8; /* house rule: permanent pleat, +8" on every roman */
      if(vr>0) c=Math.ceil(c/vr)*vr;
      if(S.fabricType==='sheer'&&fabW>=c){ yds+=q4((w+9)/36); widths+='rail'; cut=c; continue; }
      widths+=nw; cut=c; yds+=q4((nw*c+extra)/36); }
    return {widths:typeof widths==='string'?'railroaded':widths,cut,yds}; }
  const fw=num(S.fabWidth)||54; const out={a:one(fw)}; if(fw<100) out.b=one(118); return out; }
function flagsR(){ const f=[]; const W=widthCalc().order,H=heightCalc().order; const stat=S.rStyle&&RSTYLES[S.rStyle].stat; const n=+S.rMulti||1;
  if(stat&&S.mount==='IM') f.push(['Not recommended',`${RSTYLES[S.rStyle].n} toes in at the bottom; inside mount shows a gap. Mount outside.`]);
  if(S.rControl==='cordless'&&W!=null&&W<18) f.push(['Too narrow for cordless','Cordless lift needs a shade at least 18" wide.']);
  if(S.rControl==='motor'&&!S.room) f.push(['Motor needs a room name','No room name, no remote programming.']);
  if(stat&&n>1) f.push(['Not recommended',`${RSTYLES[S.rStyle].n} on a multi-on-one headrail.`]);
  if(n>1&&W!=null&&W>144) f.push(['Over 144"','Multi-on-one headrails run to 144" total.']);
  if(W!=null&&n===1&&W>120) f.push(['Wide shade',`${frac(W)} on one headrail. Over about 96" consider 2-on-1.`,'note']);
  if(S.mount==='IM'){ const d=num(S.rDepth); const rail=S.rRail||rRailAuto(); if(d!=null&&rail){ const min=rail==='2.5'?1.25:0.75, flush=rail==='2.5'?3:2; if(d<min) f.push(['Not enough depth',`${frac(d)} jamb; a ${rail==='2.5'?'2½':'1½'}" headrail needs ${frac(min)} minimum. Mount outside or change the rail.`]); else if(d<flush) f.push(['Rail will stand proud',`${frac(d)} jamb; the ${rail==='2.5'?'2½':'1½'}" headrail sits flush only at ${frac(flush)}.`,'note']); } }
  if(S.mount==='OM'&&(num(S.rOverlap)||0)<3) f.push(['Overlap under 3"','Outside mounts overlap the frame at least 3" each side to close the light gap.']);
  if(S.mount==='IM'&&S.rValReturns) f.push(['Valance returns on an inside mount','The returns take room at the ends of the headrail; check the opening has it.','note']);
  if(S.rValance==='classic'&&(num(S.rValH)||6)>16) f.push(['Valance too tall','Classic valance runs to 16" maximum.']);
  if((S.rStyle==='knife'||S.rStyle==='ribbed')&&(num(S.vr)||0)>6) f.push(['Pattern on a pleated shade',`A ${frac(num(S.vr))} repeat will break at every pleat. Check the fabric is pleat-able.`,'note']);
  if(S.fabricType==='sheer'&&S.lining!=='Unlined') f.push(['Sheer shade','Sheers are unlined (privacy lining optional, premium only).','note']);
  if(S.lining==='Unlined'&&S.fabricType!=='sheer'&&S.fabricSource==='com') f.push(['Warranty','Unlined non-sheer fabric: sun damage excluded from the warranty. Tell the client in writing.']);
  if(H!=null&&H<=38&&(num(S.fabWidth)||54)>=100) f.push(['Could railroad',`Shade is ${frac(H)} tall: wide goods can be railroaded to avoid a seam.`,'note']);
  if(S.fabricSource==='com') f.push(['C.O.M.','Rolled on a tube, face and direction marked, delivered to us with the job name on it. Yardage above is per the Horizons calculator rules; the workroom confirms.','note']);
  if(n>1){ const ws=rShadeWidths(W); if(ws.some(x=>x==null)) f.push(['Shade widths',`Give the width of each of the ${n} shades.`]); }
  return f; }
function stepStatusR(id){ const W=widthCalc().order,H=heightCalc().order;
  switch(id){ case 'job': return S.room?'done':''; case 'product': return 'done'; case 'rstyle': return S.rStyle?'done':'';
    case 'rcontrol': return S.rControl?'done':''; case 'measure': return (W!=null&&H!=null)?(flags().some(f=>f[0]==='Not enough depth'||f[0]==='Shade widths')?'warn':'done'):''; case 'rvalance': return 'done';
    case 'lining': return S.lining?'done':''; case 'fabric': return S.fabricSource?'done':''; case 'extras': return 'done';
    case 'order': return ['job','rstyle','rcontrol','measure','lining','fabric'].every(k=>stepStatus(k)==='done')?'done':''; case 'price': return priceCalc()?'done':''; } }
function rControlText(){ if(S.rControl==='cordless') return 'Cordless lift'; if(S.rControl==='motor') return `Motorized, ${S.rMotor==='ac'?'A/C plug-in':'battery'}, motor ${S.rSide}`; if(S.rControl==='cordlock') return `Cordlock, ${S.rSide} side, ${(S.rTassel||'White').toLowerCase()} tassel`; if(S.rControl==='chain') return `Continuous chain, ${S.rSide} side, ${(S.rChainColor||'Stainless steel').toLowerCase()} chain`; return ''; }
function rValText(){ if(S.rValance==='none') return 'None: fabric waterfalls off the front, back valance of lining hides the hardware'; return `${frac(num(S.rValH)||6)} classic valance${S.rValReturns?', with returns':''}${S.rScallop&&S.rScallop!=='None'?', '+S.rScallop:''}`; }
function orderLinesR(){ const L=[]; const sec=t=>L.push({sec:t}); const row=(k,v,n,small)=>L.push({k,v,n,small});
  const W=widthCalc(),H=heightCalc(); const n=+S.rMulti||1;
  sec('Identification'); row('Client',S.client); row('Project',S.project); row('Room / window',[S.room,S.windowId].filter(Boolean).join(' · ')); row('Quantity',S.qty?String(S.qty):'',true);
  sec('Product'); row('Product','Fabric roman shade'); row('Style',S.rStyle?RSTYLES[S.rStyle].n:''); if(n>1) row('Headrail','%s-on-1'.replace('%s',S.rMulti)+' · '+rShadeWidths(W.order).map(x=>frac(x)).join(' + '));
  sec('Size'); row('Width',W.order!=null?frac(W.order):'',true,S.mount==='IM'?'exact opening; workroom deducts ½"':'finished width incl. overlap'); row('Height',H.order!=null?frac(H.order):'',true,H.basis||'');
  row('Mount',S.mount==='IM'?'IM (inside mount)':'OM (outside mount)'); if(S.mount==='IM') row('Jamb depth',num(S.rDepth)!=null?frac(num(S.rDepth)):'',true);
  row('Headrail',(S.rRail||rRailAuto()||'')&&((S.rRail||rRailAuto())==='2.5'?'2½"':'1½"')+(S.rTurned?' · turned':''));
  row('Control',rControlText()); row('Alignment',S.rAlign==='top'?'Alignment at the top':'Alignment at the bottom (standard)');
  sec('Construction'); row('Valance',rValText()); row('Lining',S.lining?(S.lining+(['Premium Lining','Blackout Lining'].includes(S.lining)?' · '+S.liningColor:'')):'');
  if(S.lining==='Contrasting Lining'){ const ly=liningYards(); row('Contrast lining fabric',`${S.clSource==='com'?'C.O.M.':'Our fabric'} · ${[S.clVendor,S.clPattern,S.clColor].filter(Boolean).join(' / ')||'not set'}`,false,S.clNotes); }
  const deco=[S.banding&&('Edge Accents, '+S.rBandWhere),S.trim&&'Decorative trimmings',S.rHoldDowns&&'Hold downs'].filter(Boolean).join(', '); row('Decoration',[deco,S.decoNotes].filter(Boolean).join(' · '));
  if(S.banding) row('Banding fabric',`${S.bandSource==='com'?'C.O.M.':'Our fabric'} · ${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'not set'} · ${frac(num(S.bandWidth)||2.5)} finished`,false,S.bandNotes);
  sec('Fabric'); row('Fabric',S.fabricSource?(S.fabricSource==='com'?'C.O.M.':'Our fabric')+' · '+[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / '):'');
  row('Width / repeats',S.fabricSource?`${frac(num(S.fabWidth))} wide · V ${frac(num(S.vr)||0)} · H ${frac(num(S.hr)||0)}`:'',true);
  const Y=yardage(); if(Y.a&&S.fabricSource) row('Yardage',`${Y.a.yds} yd of ${frac(num(S.fabWidth))}`+(Y.b?` · or ${Y.b.yds} yd of 118"`:''),true,'per the Horizons C.O.M. calculator rules');
  if(S.notes){ sec('Notes'); row('Notes',S.notes); }
  return L; }
function orderTextR(){ const W=widthCalc(),H=heightCalc(); const q=Math.max(1,num(S.qty)||1); const n=+S.rMulti||1;
  const L=[]; const sec=t=>{L.push('','#### '+t+':');}; const b=(k,v)=>{ if(v==null||v==='') return; L.push(`* **${k}:** ${v}`); };
  L.push('<center> _According To Design Specifications_</center>','','____');
  sec('Plan'); L.push(`* **Custom Sewn Roman Shade${n>1?'s, '+n+'-on-1':''}**`);
  b('Dimensions',`${W.order!=null?frac(W.order)+'W x ':''}${H.order!=null?frac(H.order)+'H':''} Not Confirmed Confirmed`); b('Quantity',`${q} shade${q>1?'s':''}`); b('Room / Window',[S.room,S.windowId].filter(Boolean).join(' · '));
  sec('Style'); b('Style',S.rStyle?RSTYLES[S.rStyle].n:''); b('Mount',S.mount==='IM'?'Inside mount':`Outside mount, ${frac(num(S.rOverlap)||0)} overlap each side, ${frac(num(S.rAbove)||0)} above the frame`); b('Control',rControlText()); b('Headrail',((S.rRail||rRailAuto())==='2.5'?'2½"':'1½"')+(S.rTurned?', turned':'')); if(n>1) b('Shades on the headrail',rShadeWidths(W.order).map(x=>frac(x)).join(' + ')); b('Alignment',S.rAlign==='top'?'Top':'Bottom (standard)');
  sec('Construction'); b('Finished Width',W.order!=null?`${frac(W.order)}${S.mount==='IM'?' (exact opening; deduct ½" for operating clearance'+')':''}`:''); b('Finished Height',H.order!=null?`${frac(H.order)}${S.rStyle&&RSTYLES[S.rStyle].stat?' to the short point of the smile':''}`:''); b('Valance',rValText()); b('Lining',S.lining?(S.lining+(['Premium Lining','Blackout Lining'].includes(S.lining)?', '+S.liningColor:'')):'');
  if(S.banding) b('Edge Accents',`${S.rBandWhere}, ${frac(num(S.bandWidth)||2.5)} finished${S.bandNotes?'. '+S.bandNotes:''}`); const deco=[S.trim&&'Decorative trimmings',S.rHoldDowns&&'Hold downs'].filter(Boolean).join(', '); b('Decoration',[deco,S.decoNotes].filter(Boolean).join('. '));
  sec('Fabric'); const Y=yardage(); const yPer=Y.a?Y.a.yds:null; b('Body Yardage',yPer!=null?`${yPer*q} Yards of Fabric Required in TOTAL (${yPer} Yards Per)${Y.b?` — or ${Y.b.yds*q} yards of 118" wide`:''}`:'To Be Determined');
  const fabDesc=[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / '); b('Body Fabric',S.fabricSource==='com'?`C.O.M. ${fabDesc||'To Be Determined'}, ${frac(num(S.fabWidth))} wide (Price Not Included)`:(fabDesc||'To Be Determined')+`, ${frac(num(S.fabWidth))} wide`+((num(S.fabPrice)||0)>0?'':' (Price Not Included)')); b('Repeats',`V ${frac(num(S.vr)||0)} / H ${frac(num(S.hr)||0)}`); b('Fabric Direction/Center','To Be Determined');
  if(S.lining==='Contrasting Lining') b('Contrast Lining Fabric',`${S.clSource==='com'?'C.O.M. ':''}${[S.clVendor,S.clPattern,S.clColor].filter(Boolean).join(' / ')||'To Be Determined'}${S.clNotes?'. '+S.clNotes:''}`);
  if(S.banding) b('Banding Fabric',`${S.bandSource==='com'?'C.O.M. ':''}${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'To Be Determined'}, ${frac(num(S.bandFabW)||54)} wide`);
  if(S.notes){ sec('Notes'); L.push(`* ${S.notes}`); }
  const math=[]; for(const r of W.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); for(const r of H.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); if(math.length){ sec('Workroom math'); L.push(...math); }
  const fl=flags().filter(f=>f[2]!=='note'); if(fl.length){ sec('Open flags'); L.push(...fl.map(f=>`* **${f[0]}:** ${f[1]}`)); }
  return L.join('\n').trim(); }
/* price book: fabric roman shades, C.O.M. labor only */
PB.roman={widths:[24,36,48,60,72,84,96],heights:[36,48,60,72,84,96,108],
  classic:{add:199,grid:{36:[420,539,600,691,790,1130,1141],48:[457,598,657,747,842,1193,1205],60:[500,661,705,828,922,1278,1295],72:[522,690,790,937,1031,1392,1405],84:[539,719,801,1034,1141,1402,1414],96:[558,733,805,1071,1164,1404,1426],108:[574,761,832,1153,1255,1418,1432]}},
  hobbled:{add:245,grid:{36:[601,752,811,938,1026,1291,1311],48:[653,832,922,1043,1128,1370,1398],60:[694,898,999,1138,1229,1456,1488],72:[734,963,1076,1278,1385,1593,1626],84:[765,1011,1137,1424,1548,1615,1671],96:[800,1051,1170,1497,1606,1674,1689],108:[832,1103,1233,1622,1702,1707,1724]}},
  valance:[58,72,80,120,132,146,158],valAdd:46,
  sur:{valTall:49,holdDowns:16,chainSS:10,oversize:53,customRail:99,two:47,three:70,miter:76,interlining:127,self:51,dual:105,blackout:182,tail:19,trim:159,edge:159,inset:209,double:309}};
function laborBaseR(){ const H=heightCalc().order, W=widthCalc().order; if(H==null||W==null) return null; const pb=PB.roman; const fam=rFam(); const g=pb[fam]; const rows=[]; let total=0;
  const hb=bucket(pb.heights,H)||108; const extraH=hb===108&&H>108?Math.ceil((H-108)/12):0;
  for(const w of rShadeWidths(W)){ if(w==null) continue; const wb=bucket(pb.widths,w); let base,note; if(wb){ base=g.grid[hb][pb.widths.indexOf(wb)]; note=`width to ${wb}" × height to ${hb}"`; } else { const n=Math.ceil((w-96)/12); base=g.grid[hb][6]+n*g.add; note=`width to 96" × height to ${hb}" + ${n} × $${g.add} per add'l 12"`; }
    if(extraH){ base+=extraH*g.add; note+=`, + ${extraH} × $${g.add} per add'l 12" of height`; }
    rows.push([`${RSTYLES[S.rStyle||'classic'].n} shade labor, C.O.M. group${rShadeWidths(W).length>1?' ('+frac(w)+')':''}`,base,note]); total+=base;
    if(S.rValance==='classic'){ let v; if(wb) v=pb.valance[pb.widths.indexOf(wb)]; else v=pb.valance[6]+Math.ceil((w-96)/12)*pb.valAdd; rows.push(['6" classic valance',v,'by shade width']); total+=v; } }
  return {rows,base:total,per:'per unit'}; }
function surchargesR(){ const pb=PB.roman.sur; const out=[]; const add=(l,a,n)=>{ if(a==null) return; out.push([l,a,n||'']); }; const ns=rShadeWidths(widthCalc().order||0).length;
  if(S.rValance==='classic'&&(num(S.rValH)||6)>10) add('Classic valance over 10"',pb.valTall*ns,'per valance');
  if(S.rHoldDowns) add('Hold downs',pb.holdDowns*ns,'per shade');
  if(S.rMulti==='2') add('2-on-1 headrail',pb.two); if(S.rMulti==='3') add('3-on-1 headrail',pb.three);
  const L=S.lining; if(L==='Blackout Lining'||L==='Black Backed Blackout') add(L,pb.blackout*ns,'per shade'); if(L==='Interlining') add('Interlining',pb.interlining*ns,'per shade'); if(L==='Dual Lining') add('Dual Lining',pb.dual*ns,'per shade'); if(L==='Self Lining') add('Self lining',pb.self*ns,'per shade');
  if(S.banding&&S.trim) add('Edge Accents + trim',(S.rBandWhere==='Inset'?pb.inset:pb.edge)*ns+pb.trim*ns,'per shade, incl. valance');
  else if(S.banding) add(S.rBandWhere==='Inset'?'Inset Edge Accents':'Edge Accents',(S.rBandWhere==='Inset'?pb.inset:pb.edge)*ns,'per shade, incl. valance');
  else if(S.trim) add('Decorative trimmings',pb.trim*ns,'per shade, incl. valance');
  return out; }
function erLinesR(){ const r=priceCalc(); if(!r) return []; const W=widthCalc().order,H=heightCalc().order; const where=[S.room,S.windowId].filter(Boolean).join(' · ');
  const spec=['Roman shade',S.rStyle&&RSTYLES[S.rStyle].n,S.mount==='IM'?'inside mount':'outside mount',rControlText(),S.rValance==='classic'?frac(num(S.rValH)||6)+' valance':'',S.lining,S.banding?'edge accents '+S.rBandWhere.toLowerCase():'',W!=null?`${frac(W)} W`:'',H!=null?`${frac(H)} H`:'',(+S.rMulti||1)>1?S.rMulti+'-on-1':''].filter(Boolean).join(', ');
  const rows=[{item:'Fabrication labor',desc:`${where}: ${spec}`,qty:r.q,unit:r.labor}];
  if(r.hwRetail>0||num(S.hwShip)||num(S.hwTariff)) rows.push({item:'Hardware',desc:S.hw.filter(h=>h.n).map(h=>`${h.n}${(num(h.q)||1)>1?' ×'+h.q:''}`).join(', '),qty:1,unit:r.hardware});
  rows.push({item:'Fabric',desc:r.fabricNote,qty:1,unit:r.fabric});
  rows.push({item:'On-site consultation',desc:'Measure and design visit',qty:1,unit:r.consult});
  rows.push({item:'Installation',desc:'Shade installation, $95 per window',qty:r.q,unit:95});
  return rows; }

/* ---------- top treatments: cornices, board-mounted valances, rod-mounted casual valances ---------- */
const TTYPES={cornice:{n:'Upholstered cornice',d:'Fabric over padded board. Rigid, crisp, the firmest light seal at the top. Blackout-lined on the back.'},board:{n:'Board-mounted valance',d:'Soft valance on a fabric-wrapped board: flat and pleated styles, or swags, cascades and jabots.'},casual:{n:'Rod-mounted casual valance',d:'Sleeve or skirt valance gathered on a rod. 2½× fullness; the rod shows or is covered by the sleeve.'}};
const TSTYLES={
  c1:{n:'Linear',t:'cornice',code:'C1',d:'Straight bottom. The only style that takes a bottom band.'},c2:{n:'Arch',t:'cornice',code:'C2',d:'Arched bottom; finishes 2½–3" shorter at the short point.'},c3:{n:'Casual',t:'cornice',code:'C3',d:'Soft shaped bottom.'},c4:{n:'Deco',t:'cornice',code:'C4',d:'Stepped art-deco profile.'},c5:{n:'Wide Scallop',t:'cornice',code:'C5',d:'Few wide scallops.'},c6:{n:'Scallop',t:'cornice',code:'C6',d:'Repeating scallops.'},c7:{n:'Partial Arch',t:'cornice',code:'C7',d:'Arch that stops short of the ends.'},
  v5:{n:'Classic Straight',t:'board',g:'flat',code:'V5',d:'Flat, straight hem. The plainest valance; lets the fabric do the talking.',h:[10,14,18]},
  v23:{n:'Tailored Flat',t:'board',g:'flat',code:'V23',d:'Flat with tailored returns and corners.',h:[14,18]},
  v22:{n:'Inverted Box Pleat',t:'board',g:'flat',code:'V22',d:'Flat panels between inverted pleats; pleat count runs by width. Contrast fabric can show in the pleats.',h:[14,18]},
  v24:{n:'Roman Pleat',t:'board',g:'flat',code:'V24',d:'Folds like a roman shade, fixed. Contrast in the fold optional.',h:[10,14,18]},
  v31:{n:'Soft Pleat',t:'board',g:'flat',code:'V31',d:'Soft, unpressed pleats.',h:[14,18]},
  v32:{n:'Curved Pleat',t:'board',g:'flat',code:'V32',d:'Pleats with a curved hem line.',h:[14,18]},
  v33:{n:'Low Wave',t:'board',g:'flat',code:'V33',d:'Gentle scalloped hem, flat body.',h:[14,18]},
  v34:{n:'Tailored Scallop',t:'board',g:'flat',code:'V34',d:'Tailored body with scalloped hem.',h:[14,18]},
  v7:{n:'Soft Fold',t:'board',g:'flat',code:'V7',d:'Soft horizontal folds held with ties (with or without tails).',h:[14,18]},
  v14:{n:'Soft Tiers',t:'board',g:'flat',code:'V14',d:'Layered tiers of fabric.',h:[14,18]},
  v9:{n:'Traditional Swag & Cascade',t:'board',g:'swag',code:'V9',d:'Draped swags with cascades at the ends; swag count by width. The Empire and Kingston looks in Chapter 4 are built on this.',jabot:true},
  v10:{n:'Pole Swag',t:'board',g:'swag',code:'V10',d:'Swags thrown over a pole with cascades; the scarf-swag look, made and fixed.',jabot:true},
  v15:{n:'Stacked Cascade',t:'board',g:'swag',code:'V15',d:'Overlapping cascades across the width.',jabot:true},
  v6:{n:'Flat Cascade',t:'board',g:'swag',code:'V6',d:'Flat body with cascades; a kerchief can be contrast.'},
  v13:{n:'Flat Jabot',t:'board',g:'swag',code:'V13',d:'Flat body with jabots.'},
  v3:{n:'Scalloped Bells',t:'board',g:'swag',code:'V3',d:'Bell-shaped pleats across the width.'},
  v4:{n:'Shawl',t:'board',g:'swag',code:'V4',d:'One draped shawl across the width; to 100" wide.'},
  v17:{n:'Split Shawl',t:'board',g:'swag',code:'V17',d:'Shawl split at centre; body and swoop can be two fabrics.'},
  v11:{n:'Crossover',t:'board',g:'swag',code:'V11',d:'Two panels crossing at centre; front and back fabrics.'},
  v29:{n:'Moreland',t:'board',g:'swag',code:'V29',d:'Soft, full draped valance.'},
  v26:{n:'Stagecoach',t:'board',g:'swag',code:'V26',d:'Rolled hem held with ties; tie count by width.'},
  v20:{n:'Tailored Arch',t:'board',g:'swag',code:'V20',d:'Arched, tailored body; the fullest of the flat styles.',h:[14,18]},
  l2:{n:'Rod Sleeve',t:'casual',code:'L2',d:'Fabric sleeve gathered on a 4½" rod pocket; 5"–8" tall.'},l3:{n:'Flair Sleeve',t:'casual',code:'L3',d:'Sleeve with a flared header; 2½" pocket.'},l4:{n:'Elegant Sleeve',t:'casual',code:'L4',d:'Deeper sleeve, 4½" pocket.'},
  k1:{n:'Straight Skirt',t:'casual',code:'K1',d:'16" skirt below the rod, 2" header, 3½" pocket. Self-lined.'},k2:{n:'Tapered Skirt',t:'casual',code:'K2',d:'26" at the ends tapering to 14".'},k4:{n:'Waterfall Skirt',t:'casual',code:'K4',d:'18" at the ends to 12" at centre.'},
};
const TSTEPS=[['job','Job'],['product','Product'],['ttype','Type'],['tstyle','Style'],['measure','Size'],['tdetail','Details'],['fabric','Fabric'],['extras','Extras'],['order','Order'],['price','Price']];
const TDEF={tType:'',tStyle:'',tUnder:'',tUnderW:'',tAddSide:3,tFaceW:'',tH:'',tReturn:5.5,tMiters:0,tWelt:'¼" welt',tNail:'none',tBand:false,tLining:'',tJabot:36,tTies:2,tKerchief:'same',tPleatContrast:false,tRodW:'',tSleeveH:6,tFlat:'railroad'};
Object.assign(DEFAULT,TDEF);
function tStyle(){ return S.tStyle?TSTYLES[S.tStyle]:null; }
function tSwags(W){ const st=S.tStyle; if(st==='v10') return bucketCount([44,66,92,118,144,170,192],W); return bucketCount([66,92,118,144,170,192],W); }
function bucketCount(th,W){ for(let i=0;i<th.length;i++) if(W<=th[i]) return i+1; return th.length+Math.ceil((W-th[th.length-1])/26); }
function widthCalcT(){ const rows=[]; const st=tStyle(); if(!st) return {rows,order:null};
  if(st.t==='casual'){ const W=num(S.tRodW); if(W==null) return {rows,order:null}; rows.push(['Rod width, finial to finial',W,'The sleeve is gathered to the rod; 2½× fullness is in the labor']); return {rows,order:W}; }
  if(S.tUnder==='none'){ const W=num(S.tFaceW); if(W==null) return {rows,order:null}; rows.push(['Face width',W,'Outside mount on L brackets']); return {rows,order:W}; }
  const u=num(S.tUnderW); if(u==null) return {rows,order:null}; const a=num(S.tAddSide)||0; const W=u+2*a;
  rows.push([S.tUnder==='rod'?'Hardware underneath, bracket to bracket':S.tUnder==='shade'?'Shade or headrail underneath':'Window or frame it covers',u,'']);
  rows.push([`+ ${frac(a)} each side`,W,'Face width. The inside comes back about 2" narrower than the face, so add at least 3" to what it has to clear']);
  return {rows,order:W}; }
function heightCalcT(){ const rows=[]; const st=tStyle(); if(!st) return {rows,order:null};
  if(st.t==='casual'){ const h=st.code.startsWith('K')?({K1:16,K2:26,K4:18}[st.code]):(num(S.tSleeveH)||6); rows.push([st.code.startsWith('K')?'Skirt length, fixed by the style':'Sleeve height',h,'']); return {rows,order:h}; }
  const H=num(S.tH); if(H==null) return {rows,order:null};
  if(st.t==='cornice'){ rows.push(['Cornice height at the long point',H,'8"–30"; shaped styles finish 2½–3" shorter at the short point']); if(H>20) rows.push(['Over 20"',H,'Priced per inch over 20"']); }
  else { rows.push(['Body height',H,[st.h?'Standard heights '+st.h.join('" / ')+'"; custom to 36"':'',st.g==='swag'?'House rule: swag drop about ⅕ of the window height, never more than ¼':''].filter(Boolean).join('. ')]); if(st.jabot) rows.push(['Jabot / cascade length',num(S.tJabot)||36,'36" standard; custom to 108"']); }
  return {rows,order:H}; }
function yardageT(){
  /* calculator.horizonshades.com rules (Oct 2026), 54" goods, railroaded flat styles: see TY. Yards to nearest ¼. Repeats add one repeat. */
  const W=widthCalc().order; if(W==null) return {}; const q4=x=>Math.round(x*4+1e-9)/4; const st=tStyle(); if(!st) return {}; const vr=num(S.vr)||0; const H=heightCalc().order||14;
  const lin=(a,b)=>(a*W+b)/36; let y=0, parts=[];
  const interp=(pts)=>{ const xs=[24,48,96,144,200]; if(W<=24) return pts[0]; for(let i=1;i<xs.length;i++){ if(W<=xs[i]){ const t=(W-xs[i-1])/(xs[i]-xs[i-1]); return pts[i-1]+t*(pts[i]-pts[i-1]); } } return pts[4]+(W-200)/56*(pts[4]-pts[3]); };
  switch(S.tStyle){
    case 'c1':case 'c2':case 'c3':case 'c4':case 'c5':case 'c6':case 'c7': y=lin(0.96,31+3.6*((num(S.tReturn)||5.5)-3.5)); if(H>24) y*=2; parts.push('face + returns'+(H>24?', two cuts over 24" tall':'')); break;
    case 'v5':case 'v24':case 'v31':case 'v32': y=lin(1,21); break;
    case 'v23':case 'v33':case 'v13': y=lin(1,48); break;
    case 'v14': y=lin(1,39); break;
    case 'v22':case 'v34': y=lin(2.04,50); break;
    case 'v26': y=lin(2,42); break;
    case 'v20': y=lin(3.96,67); break;
    case 'v3': y=lin(2,105); break;
    case 'v6': y=lin(0.96,175); break;
    case 'v15': y=lin(1.125,198)+((num(S.tJabot)||36)-36)*4/36; parts.push('jabots at '+frac(num(S.tJabot)||36)); break;
    case 'v29': y=lin(2,177); break;
    case 'v4': y=lin(2,87); break;
    case 'v7': y=lin(1,21)+1; parts.push('+1 yd ties'); break;
    case 'v11': y=2*lin(1,30); parts.push('front + back'); break;
    case 'v17': y=2*lin(0.96,58); parts.push('body + swoop'); break;
    case 'v9': { const n=tSwags(W); y=7.75+1.5*(n-1)+((num(S.tJabot)||36)-36)*4/36; parts.push(`${n} swag${n>1?'s':''}, cascades at ${frac(num(S.tJabot)||36)}`); break; }
    case 'v10': { const n=tSwags(W); y=6.25+1.5*(n-1)+((num(S.tJabot)||36)-36)*4/36; parts.push(`${n} swag${n>1?'s':''}, cascades at ${frac(num(S.tJabot)||36)}`); break; }
    case 'l2': y=interp([0.75,1.25,2,3,3.75]); break; case 'l3': y=interp([1,1.25,2.25,3.5,4.25]); break; case 'l4': y=interp([1.25,1.75,2.75,4.25,5.5]); break;
    case 'k1': y=interp([1,1.5,2.5,4,5]); break; case 'k2': y=interp([1.75,2.5,4,6.25,8]); break; case 'k4': y=interp([1.25,1.75,3,4.5,5.75]); break;
    default: y=lin(1,21);
  }
  if(vr>0){ y+=vr/36; parts.push('+1 repeat'); }
  return {a:{widths:'railroaded',cut:Math.round(y*36),yds:q4(y),note:parts.join(', ')}}; }
function flagsT(){ const f=[]; const st=tStyle(); const W=widthCalc().order,H=heightCalc().order; if(!st) return f;
  if(st.t==='cornice'&&H!=null&&(H<8||H>30)) f.push(['Cornice height','Cornices run 8" to 30" tall.']);
  if(st.t==='board'&&H!=null&&H>36) f.push(['Valance height','Board-mounted valances run to 36" tall.']);
  if(W!=null&&W<24&&st.t!=='casual') f.push(['Too narrow','Minimum width is 24".']);
  if(S.tStyle==='v4'&&W!=null&&W>100) f.push(['Shawl width','The shawl runs to 100" wide. Split Shawl goes wider.']);
  if(W!=null&&W>192&&st.t!=='casual') f.push(['Over 192"','Maximum width is 192" (120" on some styles); split into sections or miter.']);
  if(st.t==='casual'&&W!=null&&(W<18||W>200)) f.push(['Casual valance width','18" to 200".']);
  if(S.tUnder!=='none'&&S.tUnder&&(num(S.tAddSide)||0)<3&&st.t!=='casual') f.push(['Clearance','Add at least 3" each side to what the treatment has to clear: the inside comes back about 2" narrower than the face.']);
  if(st.t==='cornice'&&W!=null&&W>96) f.push(['Hinged','Cornices over 96" are hinged at centre to ship and carry.','note']);
  if(+S.tMiters>0) f.push(['Miters','Any angle other than 90° needs a template or exact drawing, plus the measurement from the corner to where the treatment ends.','note']);
  if(S.fabricType==='sheer'&&st.t==='cornice') f.push(['Sheer on a cornice','Cornices are non-sheer only.']);
  if(st.g==='flat'&&S.tFlat==='seam') f.push(['Seamed, not railroaded','A fabric with a vertical direction is cut and seamed; seams land between pleats where they can.','note']);
  if(S.fabricSource==='com') f.push(['C.O.M.','Rolled on a tube, face and direction marked, delivered to us with the job name on it.','note']);
  return f; }
function stepStatusT(id){ const W=widthCalc().order,H=heightCalc().order;
  switch(id){ case 'job': return S.room?'done':''; case 'product': return 'done'; case 'ttype': return S.tType?'done':''; case 'tstyle': return S.tStyle?'done':'';
    case 'measure': return (W!=null&&H!=null)?(flags().some(f=>f[2]!=='note'&&/width|height|narrow|Clearance/.test(f[0]))?'warn':'done'):''; case 'tdetail': return 'done'; case 'fabric': return S.fabricSource?'done':''; case 'extras': return 'done';
    case 'order': return ['job','ttype','tstyle','measure','fabric'].every(k=>stepStatus(k)==='done')?'done':''; case 'price': return priceCalc()?'done':''; } }
function tDetailText(){ const st=tStyle(); if(!st) return ''; const o=[];
  if(st.t==='cornice'){ o.push(S.tWelt); if(S.tNail!=='none') o.push('nailheads '+S.tNail); if(S.tBand&&S.tStyle==='c1') o.push('bottom band'); o.push('blackout-lined back'); }
  else if(st.t==='board'){ if(S.tLining) o.push(S.tLining); if(S.tStyle==='v22'&&S.tPleatContrast) o.push('contrast fabric in the pleats'); if(S.tStyle==='v7'||S.tStyle==='v26') o.push(`${S.tTies} ties`); if(S.tStyle==='v6') o.push('kerchief '+S.tKerchief); if(st.g==='flat') o.push(S.tFlat==='seam'?'cut and seamed':'railroaded'); }
  else { o.push(st.code.startsWith('K')?'self-lined':'unlined sleeve'); o.push('2½× fullness'); }
  return o.join(', '); }
function orderLinesT(){ const L=[]; const sec=t=>L.push({sec:t}); const row=(k,v,n,small)=>L.push({k,v,n,small}); const st=tStyle(); const W=widthCalc(),H=heightCalc();
  sec('Identification'); row('Client',S.client); row('Project',S.project); row('Room / window',[S.room,S.windowId].filter(Boolean).join(' · ')); row('Quantity',S.qty?String(S.qty):'',true);
  sec('Product'); row('Product',S.tType?TTYPES[S.tType].n:''); row('Style',st?st.n+' ('+st.code+')':'');
  sec('Size'); row(st&&st.t==='casual'?'Rod width':'Face width',W.order!=null?frac(W.order):'',true,st&&st.t!=='casual'?'outside mount; inside ~2" narrower':''); row('Height',H.order!=null?frac(H.order):'',true,st&&st.g==='swag'?'body / drop':'');
  if(st&&st.jabot) row('Cascades',frac(num(S.tJabot)||36),true); if(st&&st.g==='swag'&&(S.tStyle==='v9'||S.tStyle==='v10')&&W.order) row('Swags',String(tSwags(W.order)),true,'by width');
  if(st&&st.t!=='casual'){ row('Returns',frac(num(S.tReturn)||5.5),true,'match the stack underneath'); if(+S.tMiters>0) row('Miters',String(S.tMiters),true,'template or drawing required'); row('Mount','Outside mount, L brackets, 40" apart max, top of iron 1" above the rod'); }
  sec('Construction'); row('Details',tDetailText());
  const deco=[S.banding&&'Edge Accents banding',S.trim&&'Decorative trimmings'].filter(Boolean).join(', '); row('Decoration',[deco,S.decoNotes].filter(Boolean).join(' · '));
  if(S.banding) row('Banding fabric',`${S.bandSource==='com'?'C.O.M.':'Our fabric'} · ${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'not set'}`,false,S.bandNotes);
  sec('Fabric'); row('Fabric',S.fabricSource?(S.fabricSource==='com'?'C.O.M.':'Our fabric')+' · '+[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / '):''); row('Width / repeats',S.fabricSource?`${frac(num(S.fabWidth))} wide · V ${frac(num(S.vr)||0)} · H ${frac(num(S.hr)||0)}`:'',true);
  const Y=yardage(); if(Y.a&&S.fabricSource) row('Yardage',`${Y.a.yds} yd`,true,'per the Horizons C.O.M. calculator rules'+(Y.a.note?' · '+Y.a.note:''));
  if(S.notes){ sec('Notes'); row('Notes',S.notes); }
  return L; }
function orderTextT(){ const st=tStyle(); const W=widthCalc(),H=heightCalc(); const q=Math.max(1,num(S.qty)||1);
  const L=[]; const sec=t=>{L.push('','#### '+t+':');}; const b=(k,v)=>{ if(v==null||v==='') return; L.push(`* **${k}:** ${v}`); };
  L.push('<center> _According To Design Specifications_</center>','','____');
  sec('Plan'); L.push(`* **Custom Sewn ${S.tType?TTYPES[S.tType].n:'Top Treatment'}**`); b('Dimensions',`${W.order!=null?frac(W.order)+'W x ':''}${H.order!=null?frac(H.order)+'H':''} Not Confirmed Confirmed`); b('Quantity',`${q}`); b('Room / Window',[S.room,S.windowId].filter(Boolean).join(' · '));
  sec('Style'); b('Style',st?st.n+' ('+st.code+')':''); if(st&&st.t!=='casual'){ b('Mount','Outside mount on L brackets'); b('Returns',frac(num(S.tReturn)||5.5)); if(+S.tMiters>0) b('Miters',String(S.tMiters)); } if(st&&st.jabot) b('Cascade length',frac(num(S.tJabot)||36)); if(st&&(S.tStyle==='v9'||S.tStyle==='v10')&&W.order) b('Swags',String(tSwags(W.order)));
  sec('Construction'); b(st&&st.t==='casual'?'Rod Width':'Face Width',W.order!=null?frac(W.order)+(st&&st.t!=='casual'?' (inside comes back ~2" narrower)':''):''); b('Height',H.order!=null?frac(H.order):''); b('Details',tDetailText()); const deco=[S.trim&&'Decorative trimmings'].filter(Boolean).join(', '); b('Decoration',[deco,S.decoNotes].filter(Boolean).join('. ')); if(S.banding) b('Edge Accents',`${frac(num(S.bandWidth)||2.5)} finished${S.bandNotes?'. '+S.bandNotes:''}`);
  sec('Fabric'); const Y=yardage(); const yPer=Y.a?Y.a.yds:null; b('Body Yardage',yPer!=null?`${yPer*q} Yards of Fabric Required in TOTAL (${yPer} Yards Per)${Y.a.note?' — '+Y.a.note:''}`:'To Be Determined');
  const fabDesc=[S.fabVendor,S.fabPattern,S.fabColor].filter(Boolean).join(' / '); b('Body Fabric',S.fabricSource==='com'?`C.O.M. ${fabDesc||'To Be Determined'}, ${frac(num(S.fabWidth))} wide (Price Not Included)`:(fabDesc||'To Be Determined')+`, ${frac(num(S.fabWidth))} wide`+((num(S.fabPrice)||0)>0?'':' (Price Not Included)')); b('Repeats',`V ${frac(num(S.vr)||0)} / H ${frac(num(S.hr)||0)}`); b('Fabric Direction/Center',st&&st.g==='flat'?(S.tFlat==='seam'?'Cut and seamed, pattern vertical':'Railroaded'):'To Be Determined');
  if(S.banding) b('Banding Fabric',`${S.bandSource==='com'?'C.O.M. ':''}${[S.bandVendor,S.bandPattern,S.bandColor].filter(Boolean).join(' / ')||'To Be Determined'}`);
  if(S.notes){ sec('Notes'); L.push(`* ${S.notes}`); }
  const math=[]; for(const r of W.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); for(const r of H.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); if(math.length){ sec('Workroom math'); L.push(...math); }
  const fl=flags().filter(f=>f[2]!=='note'); if(fl.length){ sec('Open flags'); L.push(...fl.map(f=>`* **${f[0]}:** ${f[1]}`)); }
  return L.join('\n').trim(); }
/* price book: C.O.M. labor only, widths to 48/60/72/84/96 (+ each add'l 12"); casual 24/48/72/96/120 */
PB.top={widths:[48,60,72,84,96],
  c1:[459,557,626,736,868,329],c:[632,731,802,914,1047,333],
  v3:[375,423,464,506,556,376],v4:[476,527,581,627,679,720],v5:[393,451,504,563,616,292],v6:[647,719,783,844,916,307],v7:[527,594,648,705,771,307],v9:[602,634,691,720,782,424],v10:[566,588,624,644,684,391],v11:[573,619,671,713,763,385],v13:[547,601,651,700,753,376],v14:[561,599,634,674,713,300],v15:[644,692,734,779,825,298],v17:[456,505,557,603,656,343],v20:[492,541,597,647,708,375],v22:[468,509,546,592,629,347],v23:[393,432,472,504,544,303],v24:[502,545,598,644,692,317],v26:[483,556,592,622,662,503],v29:[478,505,525,545,566,394],v31:[503,547,600,646,695,318],v32:[502,545,598,644,692,317],v33:[409,448,489,525,566,346],v34:[465,506,545,588,626,346],
  casW:[24,48,72,96,120],l2:[124,152,177,203,230,69],l3:[132,159,179,203,229,69],l4:[132,159,185,208,231,82],k1:[305,347,389,433,478,177],k2:[334,378,426,476,525,199],k4:[305,347,389,433,478,199],
  trim:[89,112,135,156,180,32],sur:{heightIn:45,miter:83,bigReturn:95,band:159,interlining:133,dual:74,edge:159,pleatContrast:239,ties2:42,tieExtra:49,jabotFt:86}};
function tGrid(key,W,ws){ const g=PB.top[key]; if(!g) return null; const widths=ws||PB.top.widths; const n=widths.length; let base,note; const wb=bucket(widths,W); if(wb){ base=g[widths.indexOf(wb)]; note=`width to ${wb}"`; } else if(g.length>n){ const k=Math.ceil((W-widths[n-1])/12); base=g[n-1]+k*g[n]; note=`width to ${widths[n-1]}" + ${k} × $${g[n]} per add'l 12"`; } else { base=g[n-1]; note=`width to ${widths[n-1]}" (max)`; } return {base,note}; }
function laborBaseT(){ const st=tStyle(); const W=widthCalc().order,H=heightCalc().order; if(!st||W==null||H==null) return null; const rows=[]; let total=0;
  if(st.t==='cornice'){ const g=tGrid(S.tStyle==='c1'?'c1':'c',W); rows.push([`${st.n} cornice labor, C.O.M.`,g.base,g.note+', height to 20"']); total+=g.base; if(H>20){ const n=Math.ceil(H-20); rows.push([`+ ${n}" over 20" tall`,n*PB.top.sur.heightIn,'$45 per inch']); total+=n*PB.top.sur.heightIn; } }
  else if(st.t==='board'){ const g=tGrid(S.tStyle,W); rows.push([`${st.n} labor, C.O.M.`,g.base,g.note]); total+=g.base; }
  else { const g=tGrid(S.tStyle,W,PB.top.casW); rows.push([`${st.n} labor, C.O.M.`,g.base,g.note]); total+=g.base; }
  return {rows,base:total,per:'per unit'}; }
function surchargesT(){ const st=tStyle(); const W=widthCalc().order||0; const pb=PB.top.sur; const out=[]; const add=(l,a,n)=>{ if(a==null) return; out.push([l,a,n||'']); }; if(!st) return out;
  if(st.t!=='casual'){ if(+S.tMiters>0) add('Miters',pb.miter*(+S.tMiters),'$83 each'); if([7.25,9.25].includes(num(S.tReturn))) add('7¼" / 9¼" returns',pb.bigReturn); }
  if(st.t==='cornice'){ if(S.tBand&&S.tStyle==='c1') add('Bottom band',pb.band); if(S.tNail!=='none'){ const g=tGrid('trim',W); add('Decorative nailheads',g.base*(S.tNail==='both'?2:1),g.note+(S.tNail==='both'?', top and bottom':'')); } }
  if(st.t==='board'){ if(S.tLining==='Interlining') add('Interlining',pb.interlining); if(S.tLining==='Dual Lining') add('Dual Lining',pb.dual); if(S.banding) add('Edge Accents banding',pb.edge); if(S.tStyle==='v22'&&S.tPleatContrast) add('Contrast fabric in the pleats',pb.pleatContrast); if(S.tStyle==='v7'||S.tStyle==='v26'){ add('Ties',pb.ties2,'2 ties'); if(+S.tTies>2) add('Additional ties',pb.tieExtra*(+S.tTies-2),'$49 each'); } if(st.jabot&&(num(S.tJabot)||36)>36){ const ft=Math.ceil(((num(S.tJabot)||36)-36)/12); add('Longer cascades',pb.jabotFt*ft,`$86 per foot over 36"`); } }
  if(S.trim){ const g=tGrid('trim',W); add('Decorative trimmings',g.base,g.note); }
  return out; }
function erLinesT(){ const r=priceCalc(); if(!r) return []; const st=tStyle(); const W=widthCalc().order,H=heightCalc().order; const where=[S.room,S.windowId].filter(Boolean).join(' · ');
  const spec=[S.tType&&TTYPES[S.tType].n,st&&st.n,W!=null?`${frac(W)} W`:'',H!=null?`${frac(H)} H`:'',st&&st.t!=='casual'?frac(num(S.tReturn)||5.5)+' returns':'',tDetailText()].filter(Boolean).join(', ');
  const rows=[{item:'Fabrication labor',desc:`${where}: ${spec}`,qty:r.q,unit:r.labor}];
  if(r.hwRetail>0||num(S.hwShip)||num(S.hwTariff)) rows.push({item:'Hardware',desc:S.hw.filter(h=>h.n).map(h=>`${h.n}${(num(h.q)||1)>1?' ×'+h.q:''}`).join(', '),qty:1,unit:r.hardware});
  rows.push({item:'Fabric',desc:r.fabricNote,qty:1,unit:r.fabric}); rows.push({item:'On-site consultation',desc:'Measure and design visit',qty:1,unit:r.consult}); rows.push({item:'Installation',desc:r.installNote,qty:1,unit:r.install});
  return rows; }

/* ---------- roller & solar shades (Insolroll, vendor order) ---------- */
const LFAB={solar:{n:'Solar screen',d:'Woven with holes; the openness factor sets the view and the glare control. Private by day only.'},lf:{n:'Light-filtering',d:'Passes light but not images; privacy both ways; a soft glow.'},bo:{n:'Blackout',d:'Passes no light through the fabric. The edges still leak unless side channels close them.'}};
const LOPS={r8:{n:'Clutch & chain, R8',d:'10–72" wide. Continuous loop with tension device; brake holds any position.',ded:1.25,min:10,max:72},r16:{n:'Clutch & chain, R16',d:'10–96" wide. The everyday clutch.',ded:1.25,min:10,max:96},r24:{n:'Clutch & chain, R24',d:'14–120" wide. Larger shades.',ded:1.25,min:14,max:120},sa:{n:'Spring assist, R24 SA / G200 SA',d:'32–144" wide. Clutch plus a spring that carries the weight.',ded:1.25,min:32,max:144},qsr:{n:'Cordless spring, QSR',d:'17½–96" wide. Tug the hem bar; stays where you leave it. Child-safe; reachable windows only.',ded:1.5,min:17.5,max:96},select:{n:'Cordless SELECT',d:'22¾–96" wide. Adjustable speed and upper limit. Takes an extra ⅛".',ded:1.625,min:22.75,max:96},twin:{n:'Twin Pull SELECT',d:'15½–96" wide. Two retractable wands instead of a chain. Takes an extra ⅛".',ded:1.625,min:15.5,max:96},motor:{n:'Motor (Somfy in the tube)',d:'16½–192" wide. Battery, DC or AC. High windows, big glass, automation.',ded:1.5,min:16.5,max:192}};
const LCOV={exposed:{n:'Exposed tube',d:'Tube on brackets. Cheapest; fine behind drapery or a cornice.',extra:0},fascia:{n:'Fascia',d:'Flat aluminum face, 3" or 4", covers the front and bottom of the roll. ¾" return. The architectural default.',extra:0},cassette:{n:'Cassette',d:'Curved 3" or 4" housing, painted or fabric-inserted. Cannot reverse roll. Takes an extra ⅛".',extra:0.125},peak:{n:'Peak valance',d:'Fabric-wrapped or painted valance over the tube, 4" or 4¾" coverage. Retrofits over an existing shade.',extra:0},val6:{n:'6" valance',d:'Extruded aluminum, white, bronze or clear anodized; returns and end plates. Dual shades or a larger scale. Takes an extra ⅛".',extra:0.125},pocket:{n:'Pocket',d:'5" × 5½" aluminum box or a site-built ceiling pocket. New construction; the shade disappears.',extra:0}};
const LSTEPS=[['job','Job'],['product','Product'],['lfabric','Fabric'],['loperator','Operator'],['lcover','Cover'],['measure','Measure'],['extras','Extras'],['order','Order'],['price','Price']];
const LDEF={lFab:'',lOpen:'3',lColl:'',lColor:'',lRollW:'',lRail:false,lRoll:'regular',lOp:'',lSide:'right',lChain:'plastic',lChainColor:'white',lMotorPow:'battery',lCover:'',lCovSize:'3',lCovColor:'white',lHem:'sealed',lDual:false,lAV:false,lOpenW:'',lOpenH:'',lB:'',lOverlap:2,lHtTo:'apron',lI:'',lJ:'',lAbove:2,lDepth:'',lList:'',lOptions:'',lFreight:'',lItems:1,lTariff:''};
Object.assign(DEFAULT,LDEF);
function isRoller(){ return S.product==='roller'; }
function lDeduction(){ const op=S.lOp?LOPS[S.lOp]:null; const cv=S.lCover?LCOV[S.lCover]:null; if(!op) return null; let d=op.ded; if(S.lOp==='motor'&&S.lMotorPow==='ac') d=2.25; if(cv) d+=cv.extra; return d; }
function widthCalcL(){ const rows=[]; let W=null;
  if(S.mount==='IM'){ W=num(S.lOpenW); if(W==null) return {rows,order:null}; const d=lDeduction(); rows.push(['A · opening width, smallest of three',W,'Order the opening; the factory deducts for the operator']); if(d!=null) rows.push([`Factory deduction for ${LOPS[S.lOp].n.split(',')[0]}${S.lCover&&LCOV[S.lCover].extra?' + '+LCOV[S.lCover].n:''}`,W-d,`fabric about ${frac(W-d)}; ${frac(d/2)} of light each side`]); }
  else { const B=num(S.lB); if(B==null) return {rows,order:null}; const o=num(S.lOverlap)||0; W=B+2*o; rows.push(['B · outside of frame',B,'']); rows.push([`+ ${frac(o)} overlap each side`,W,'Bracket-to-bracket width you want; the factory makes it to this']); }
  return {rows,order:W}; }
function heightCalcL(){ const rows=[]; let H=null;
  if(S.mount==='IM'){ H=num(S.lOpenH); if(H==null) return {rows,order:null}; rows.push(['H · opening height, shortest of three',H,'']); }
  else { const base=S.lHtTo==='sill'?num(S.lI):num(S.lJ); if(base==null) return {rows,order:null}; const ab=num(S.lAbove)||0; rows.push([S.lHtTo==='sill'?'I · top of frame to sill':'J · top of frame to bottom of apron',base,'']); H=base+ab; rows.push([`+ ${frac(ab)} mounted above the frame`,H,'']); }
  if(S.lOp&&S.lOp!=='qsr'&&S.lOp!=='select'&&S.lOp!=='twin'&&S.lOp!=='motor') rows.push(['Chain drop',Math.max(Math.ceil(H*7/8),H-3),'standard about 3" less than the shade height, never shorter than ⅞ of it']);
  return {rows,order:H,basis:S.mount==='IM'?'inside mount, exact opening':'outside mount, finished size'}; }
function yardageL(){ return {}; }
function flagsL(){ const f=[]; const W=widthCalc().order,H=heightCalc().order; const op=S.lOp?LOPS[S.lOp]:null;
  if(op&&W!=null&&(W<op.min||W>op.max)) f.push(['Operator range',`${op.n} runs ${frac(op.min)} to ${frac(op.max)} wide.`]);
  if(S.lRoll==='reverse'&&S.lCover==='cassette') f.push(['No reverse roll in a cassette','Use the 4" reverse-roll fascia instead.']);
  const rw=num(S.lRollW); if(rw&&W!=null&&!S.lRail&&W>rw) f.push(['Wider than the roll',`${frac(W)} shade on ${frac(rw)} fabric: railroad it (height then limited to ${frac(rw)}) or split the window.`]);
  if(rw&&H!=null&&S.lRail&&H>rw) f.push(['Too tall railroaded',`Railroaded fabric limits the height to the roll width, ${frac(rw)}.`]);
  if(S.lRail&&/elements/i.test(S.lColl||'')) f.push(['Elements fabrics cannot railroad','They curl. Choose another fabric or split the window.']);
  if(S.lRail&&S.lDual) f.push(['Railroaded on a dual','Coupled and multi-panel shades must be non-railroaded.']);
  if(S.lFab==='solar'&&/bed|bath/i.test(S.room||'')) f.push(['Night privacy','A screen shade is on display at night with the lights on. Ask the night question.','note']);
  if(S.mount==='IM'){ const d=num(S.lDepth); if(d==null) f.push(['Depth not checked','Measure the jamb to the first obstruction before promising an inside mount.','note']); else if(d<2) f.push(['Shallow jamb',`${frac(d)} to the first obstruction. A fascia or cassette needs 2¼"–2⅞"; consider reverse roll or an outside mount.`]); }
  if((S.lOp==='qsr'||S.lOp==='select')&&H!=null&&H>84) f.push(['Cordless on a tall window','A cordless spring works by tugging the hem bar. High windows get a chain or a motor.','note']);
  if(S.lOp==='motor'&&!S.room) f.push(['Motor needs a room name','No room name, no remote programming.']);
  if(S.lFab==='bo'&&!S.lAV) f.push(['Blackout fabric, not a blackout window','It is room-darkening until the edges are handled: side channels (AV), drapery over it, or a cornice.','note']);
  if(S.mount==='OM'&&(num(S.lOverlap)||0)<1.5) f.push(['Overlap','Outside mounts overlap the frame at least 1½"–2" each side.','note']);
  return f; }
function stepStatusL(id){ const W=widthCalc().order,H=heightCalc().order;
  switch(id){ case 'job': return S.room?'done':''; case 'product': return 'done'; case 'lfabric': return S.lFab?'done':''; case 'loperator': return S.lOp?'done':''; case 'lcover': return S.lCover?'done':'';
    case 'measure': return (W!=null&&H!=null)?(flags().some(f=>f[2]!=='note'&&/range|roll|tall|Shallow/.test(f[0]))?'warn':'done'):''; case 'extras': return 'done';
    case 'order': return ['job','lfabric','loperator','lcover','measure'].every(k=>stepStatus(k)==='done')?'done':''; case 'price': return priceCalc()?'done':''; } }
function lOpText(){ const op=S.lOp?LOPS[S.lOp]:null; if(!op) return ''; if(S.lOp==='motor') return `Motor, ${S.lMotorPow.toUpperCase()==='AC'?'A/C':S.lMotorPow}, motor ${S.lSide}`; if(S.lOp==='qsr'||S.lOp==='select') return op.n; if(S.lOp==='twin') return `${op.n}, wands ${S.lSide}`; return `${op.n}, ${S.lChain} ${S.lChainColor} chain, ${S.lSide} side`; }
function lCovText(){ const cv=S.lCover?LCOV[S.lCover]:null; if(!cv) return ''; if(S.lCover==='fascia'||S.lCover==='cassette') return `${cv.n} ${S.lCovSize}", ${S.lCovColor}`; if(S.lCover==='peak') return `Peak valance, ${S.lCovSize==='4'?'medium 4"':'large 4¾"'}, ${S.lCovColor}`; if(S.lCover==='val6') return `6" valance, ${S.lCovColor}`; return cv.n; }
function lFabText(){ if(!S.lFab) return ''; return `${LFAB[S.lFab].n}${S.lFab==='solar'?' '+S.lOpen+'% openness':''}${S.lColl?', '+S.lColl:''}${S.lColor?' / '+S.lColor:''}${S.lRail?', railroaded':''}`; }
function orderLinesL(){ const L=[]; const sec=t=>L.push({sec:t}); const row=(k,v,n,small)=>L.push({k,v,n,small}); const W=widthCalc(),H=heightCalc();
  sec('Identification'); row('Client',S.client); row('Project',S.project); row('Room / window',[S.room,S.windowId].filter(Boolean).join(' · ')); row('Quantity',S.qty?String(S.qty):'',true);
  sec('Product'); row('Product','Roller shade (Insolroll)'+(S.lDual?' · dual':'')+(S.lAV?' · AV side channels + sill channel':'')); row('Fabric',lFabText()); row('Roll',S.lRoll==='reverse'?'Reverse roll':'Regular roll (fabric to the glass)');
  sec('Size'); row('Width',W.order!=null?frac(W.order):'',true,S.mount==='IM'?'opening; factory deducts '+(lDeduction()!=null?frac(lDeduction()):'for the operator'):'bracket to bracket'); row('Height',H.order!=null?frac(H.order):'',true,H.basis||''); row('Mount',S.mount==='IM'?'IM (inside mount)':'OM (outside mount)'); if(S.mount==='IM') row('Jamb depth',num(S.lDepth)!=null?frac(num(S.lDepth)):'',true);
  sec('Hardware'); row('Operator',lOpText()); row('Cover',lCovText()); row('Hem bar',S.lHem==='sealed'?'Sealed in fabric':'Exposed aluminum, '+S.lHem);
  const deco=[S.decoNotes].filter(Boolean).join(' · '); if(deco) { sec('Decoration'); row('Decoration',deco); }
  if(S.notes){ sec('Notes'); row('Notes',S.notes); }
  return L; }
function orderTextL(){ const W=widthCalc(),H=heightCalc(); const q=Math.max(1,num(S.qty)||1);
  const L=[]; const sec=t=>{L.push('','#### '+t+':');}; const b=(k,v)=>{ if(v==null||v==='') return; L.push(`* **${k}:** ${v}`); };
  L.push('<center> _According To Design Specifications_</center>','','____');
  sec('Plan'); L.push(`* **Roller Shade${S.lDual?', Dual':''} (Insolroll)**`); b('Dimensions',`${W.order!=null?frac(W.order)+'W x ':''}${H.order!=null?frac(H.order)+'H':''} Not Confirmed Confirmed`); b('Quantity',`${q} shade${q>1?'s':''}`); b('Room / Window',[S.room,S.windowId].filter(Boolean).join(' · '));
  sec('Style'); b('Fabric',lFabText()); b('Mount',S.mount==='IM'?'Inside mount, order the exact opening':`Outside mount, ${frac(num(S.lOverlap)||0)} overlap each side, ${frac(num(S.lAbove)||0)} above the frame`); b('Roll direction',S.lRoll==='reverse'?'Reverse roll':'Regular roll'); b('Operator',lOpText()); b('Cover',lCovText()); b('Hem bar',S.lHem==='sealed'?'Sealed in fabric':'Exposed aluminum, '+S.lHem); if(S.lAV) b('AV system','Side channels with brush seal and sill channel');
  sec('Construction'); b('Ordered Width',W.order!=null?`${frac(W.order)}${S.mount==='IM'&&lDeduction()!=null?' (factory deducts '+frac(lDeduction())+' for the operator; do not deduct it yourself)':''}`:''); b('Ordered Height',H.order!=null?frac(H.order):'');
  b('Decoration',S.decoNotes||''); if(S.notes){ sec('Notes'); L.push(`* ${S.notes}`); }
  const math=[]; for(const r of W.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); for(const r of H.rows) math.push(`* ${r[0]} → **${frac(r[1])}**${r[2]?' _('+r[2]+')_':''}`); if(math.length){ sec('Workroom math'); L.push(...math); }
  const fl=flags().filter(f=>f[2]!=='note'); if(fl.length){ sec('Open flags'); L.push(...fl.map(f=>`* **${f[0]}:** ${f[1]}`)); }
  return L.join('\n').trim(); }
function laborBaseL(){ const list=num(S.lList); if(list==null) return null; const rows=[['Insolroll shade, retail list (from the quote)',list,'per shade']]; let total=list; const opt=num(S.lOptions)||0; if(opt){ rows.push(['Options and surcharges',opt,'from the quote']); total+=opt; } const items=Math.max(1,num(S.lItems)||1); const fr=(num(S.lFreight)||0)/items; if(fr){ rows.push(['Freight share',fr,`$${num(S.lFreight)} ÷ ${items} items`]); total+=fr; } const tar=num(S.lTariff)||0; if(tar){ rows.push(['Tariff',tar,'per item']); total+=tar; } return {rows,base:total,per:'per shade'}; }
function surchargesL(){ return []; }
function erLinesL(){ const r=priceCalc(); if(!r) return []; const W=widthCalc().order,H=heightCalc().order; const where=[S.room,S.windowId].filter(Boolean).join(' · ');
  const spec=['Roller shade',lFabText(),S.mount==='IM'?'inside mount':'outside mount',lOpText(),lCovText(),W!=null?`${frac(W)} W`:'',H!=null?`${frac(H)} H`:''].filter(Boolean).join(', ');
  const rows=[{item:'Roller shade',desc:`${where}: ${spec}`,qty:r.q,unit:r.labor}];
  if(r.hwRetail>0||num(S.hwShip)||num(S.hwTariff)) rows.push({item:'Hardware',desc:S.hw.filter(h=>h.n).map(h=>`${h.n}${(num(h.q)||1)>1?' ×'+h.q:''}`).join(', '),qty:1,unit:r.hardware});
  rows.push({item:'On-site consultation',desc:'Measure and design visit',qty:1,unit:r.consult}); rows.push({item:'Installation',desc:'Shade installation, $95 per window',qty:r.q,unit:95});
  return rows; }

/* ---------- product dispatch ---------- */
function isTop(){ return S.product==='top'; }
function steps(){ return isRoller()?LSTEPS:isTop()?TSTEPS:isRoman()?RSTEPS:STEPS_D; }
function widthCalc(){ return isRoller()?widthCalcL():isTop()?widthCalcT():isRoman()?widthCalcR():widthCalcD(); }
function heightCalc(){ return isRoller()?heightCalcL():isTop()?heightCalcT():isRoman()?heightCalcR():heightCalcD(); }
function yardage(){ return isRoller()?yardageL():isTop()?yardageT():isRoman()?yardageR():yardageD(); }
function flags(){ return isRoller()?flagsL():isTop()?flagsT():isRoman()?flagsR():flagsD(); }
function stepStatus(id){ return isRoller()?stepStatusL(id):isTop()?stepStatusT(id):isRoman()?stepStatusR(id):stepStatusD(id); }
function orderLines(){ return isRoller()?orderLinesL():isTop()?orderLinesT():isRoman()?orderLinesR():orderLinesD(); }
function orderText(){ return isRoller()?orderTextL():isTop()?orderTextT():isRoman()?orderTextR():orderTextD(); }
function laborBase(){ return isRoller()?laborBaseL():isTop()?laborBaseT():isRoman()?laborBaseR():laborBaseD(); }
function surcharges(){ return isRoller()?surchargesL():isTop()?surchargesT():isRoman()?surchargesR():surchargesD(); }
function erLines(){ return isRoller()?erLinesL():isTop()?erLinesT():isRoman()?erLinesR():erLinesD(); }

/* Roller flow is built but parked: rollers are ordered direct from Horizons for now. Flip to true to show the tile. */
const SHOW_ROLLER=false;
/* ---------- state ---------- */
const num=v=>{const n=parseFloat(v);return isFinite(n)?n:null};
let S={...DEFAULT,hw:[{n:'',q:1,p:''}]};
let hadDraft=false; try{const s=localStorage.getItem('wo2-draft'); if(s){S={...DEFAULT,...JSON.parse(s)}; hadDraft=true; if(!Array.isArray(S.hw)||!S.hw.length) S.hw=[{n:'',q:1,p:''}];}}catch(e){}

function save(){try{localStorage.setItem('wo2-draft',JSON.stringify(S));}catch(e){}}
let forceRender=()=>{};
function setRaw(k,v){ S[k]=v; save(); forceRender(); }
function set(k,v){
  S[k]=v;
  if(k==='header'){ const g=HEADERS[v].g; if(S.hardware&&!HW[S.hardware].for.includes(g)) S.hardware=''; if(g==='ripple'){S.hem='bead'; if(!S.rfFullness) S.rfFullness=S.fabricType==='sheer'?'120':'100'; if(['orion'].includes(S.hardware)) S.hardware='';} if(HEADERS[v].stat) S.draw='stationary'; if(g==='rod'){S.projection='';} else if(S.projection===''){S.projection=S.product==='drapery'?3.5:4;} }
  if(k==='fabricType'){ if(v==='sheer'){S.fullness='3';S.rfFullness='120';S.hem='bead';S.lining='Unlined';} else {S.fullness='2';S.rfFullness='100'; if(S.lining==='Unlined')S.lining='Premium Lining'; if(S.hem===''||(!isRF()&&S.hem==='bead'))S.hem=isRF()?'bead':'std';} }
  if(k==='product'){ if(v==='roller'){ S.hardware=''; S.header=''; S.draw='stationary'; if(!S.mount||S.mount==='UT') S.mount='IM'; S.fabricSource='hz'; } else if(v==='top'){ S.hardware=''; S.header=''; S.draw='stationary'; S.mount='OM'; if(!S.fabricType) S.fabricType='drapery'; } else if(v==='roman'){ S.hardware=''; S.header=''; S.draw='stationary'; if(!S.mount||S.mount==='UT') S.mount='IM'; if(!S.lining||S.lining==='Unlined'&&S.fabricType!=='sheer') S.lining='Premium Lining'; if(!S.fabricType) S.fabricType='drapery'; } else if(v==='bmsp'){S.hardware='board';S.projection=4;S.draw='stationary';} else if(v==='sidepanel'){S.draw='stationary'; if(S.hardware==='board')S.hardware=''; S.projection=4;} else {if(S.hardware==='board')S.hardware=''; if(S.projection===4||S.projection==='')S.projection=3.5; if(S.draw==='stationary'&&!(S.header&&HEADERS[S.header].stat))S.draw='';} }
  if(k==='hardware'){ const h=HW[v]; if(h.proj&&(S.projection===''||S.projection===3.5||S.projection===3)) S.projection=h.proj; }
  if(k==='draw'&&(v==='split'||v==='offset')&&!S.masters) S.masters='overlap';
  if(k==='fabricSource'&&v==='com'&&S.fabPrice==='') S.fabPrice=0;
  save(); forceRender();
}

/* ---------- React / antd ---------- */

const {Title,Text,Paragraph}=Typography;

const TOK={
  light:{colorPrimary:'#1F4E79',colorInfo:'#1F4E79',colorError:'#A8321F',colorSuccess:'#1F6B3A',colorWarning:'#1B1F26',colorText:'#151A21',colorTextSecondary:'#3E4754',colorBorder:'#C9D1DB',colorBgLayout:'#F5F7FA',colorBgContainer:'#FFFFFF'},
  dark:{colorPrimary:'#7FB2E5',colorInfo:'#7FB2E5',colorError:'#F08A78',colorSuccess:'#7FD39A',colorWarning:'#EEF1F5',colorText:'#EEF1F5',colorTextSecondary:'#C3CAD4',colorBorder:'#3A424D',colorBgLayout:'#14181E',colorBgContainer:'#1D2229'},
};
const DISP_DEF={fs:17,lh:1.55,font:'source',contrast:'normal',theme:'auto'};
function loadDisp(){ try{const s=localStorage.getItem('dtw-display'); if(s) return {...DISP_DEF,...JSON.parse(s)};}catch(e){} return {...DISP_DEF}; }

/* small helpers */
const FONTS={source:'"Source Sans 3", system-ui, sans-serif',inter:'"Inter", system-ui, sans-serif',atkinson:'"Atkinson Hyperlegible", system-ui, sans-serif'};
function Callout(kind,label,body){ return h(Alert,{className:'co co-'+kind,type:{why:'info',wrong:'error',ask:'warning',rule:'success'}[kind],showIcon:false,message:h('span',{className:'co-tag'},label),description:body}); }
function UL(items){ return h('ul',{className:'co-ul'},items.map((t,i)=>h('li',{key:i},t))); }
function Item(label,ctrl,hint,err){ return h(Form.Item,{label,help:err||hint,validateStatus:err?'error':undefined,className:'fi'},ctrl); }
function Inch(k,opt){ opt=opt||{}; return h(InputNumber,{id:k,formatter:(v,i)=>i&&i.userTyping?i.input:(v==null||v===''?'':String(parseFloat(v))),value:num(S[k]),onChange:v=>setRaw(k,v==null?'':v),step:opt.step||0.125,min:opt.min==null?0:opt.min,max:opt.max,addonAfter:'in',size:'large',style:{width:'100%'},className:'num',controls:false}); }
function Num(k,opt){ opt=opt||{}; return h(InputNumber,{id:k,formatter:(v,i)=>i&&i.userTyping?i.input:(v==null||v===''?'':String(parseFloat(v))),value:num(S[k]),onChange:v=>setRaw(k,v==null?'':v),step:opt.step||1,min:opt.min==null?0:opt.min,prefix:opt.prefix,size:'large',style:{width:'100%'},className:'num',controls:false}); }
function Txt(k,placeholder){ return h(Input,{id:k,value:S[k]||'',onChange:e=>setRaw(k,e.target.value),placeholder,size:'large'}); }
function Sel(k,options,withDefaults){ return h(Select,{id:k,value:S[k],onChange:v=>withDefaults?set(k,v):setRaw(k,v),options:options.map(o=>Array.isArray(o)?{value:o[0],label:o[1]}:{value:o,label:o}),size:'large',style:{width:'100%'}}); }
function Tiles(k,items,wide){ return h(Row,{gutter:[10,10],className:'tiles'},items.map(it=>h(Col,{key:it.v,xs:24,sm:wide?24:12,lg:wide?12:8},h(Card,{size:'small',hoverable:!it.off,className:'tile'+(S[k]===it.v?' on':'')+(it.off?' off':''),onClick:()=>{if(!it.off)set(k,it.v)},tabIndex:it.off?-1:0,onKeyDown:e=>{if(!it.off&&(e.key==='Enter'||e.key===' ')){e.preventDefault();set(k,it.v)}},role:'radio','aria-checked':S[k]===it.v},
  h('div',{className:'tile-t'},h('span',null,it.n), it.tag?h(Tag,{className:'tile-tag'},it.tag):null),
  it.d?h('div',{className:'tile-d'},it.d):null)))); }
function Chk(k,label,small,withDefaults){ return h('label',{className:'chk'+(S[k]?' on':'')},h(Checkbox,{checked:!!S[k],onChange:e=>withDefaults?set(k,e.target.checked):setRaw(k,e.target.checked)}),h('span',null,h('b',null,label),small?h('small',null,small):null)); }
function H3(t){ return h('h3',{className:'h3'},t); }
function H4(t){ return h('h4',{className:'h4'},t); }
function CalcTable(title,rows,total){ if(!rows||!rows.length) return null; const data=rows.map((r,i)=>({key:i,a:r[0],b:frac(r[1]),c:r[2]||''})); if(total!=null) data.push({key:'t',a:h('b',null,'Write on the order'),b:h('b',null,frac(total)),c:''});
  return h(Table,{className:'calc',size:'small',pagination:false,dataSource:data,columns:[{title,dataIndex:'a'},{title:'Result',dataIndex:'b',align:'right',className:'num'},{title:'Note',dataIndex:'c'}]}); }
function Nav(prev,next,extra){ return h('div',{className:'nav'},prev?h(Button,{size:'large',onClick:()=>go(prev)},'Back'):h('span'),h(Space,null,extra,next?h(Button,{type:'primary',size:'large',onClick:()=>go(next)},'Next: '+steps().find(s=>s[0]===next)[1].toLowerCase()):null)); }
let goFn=()=>{}; function go(id){ goFn(id); }
function copyText(txt){ try{ navigator.clipboard.writeText(txt).then(()=>message.success('Copied'),()=>{ go('order'); message.info('Select the text in the order step and copy it'); }); }catch(e){ go('order'); message.info('Select the text in the order step and copy it'); } }

/* ---------- step content ---------- */
const STEP_TITLE={lfabric:'Fabric and roll direction',loperator:'Operator',lcover:'What covers the tube',ttype:'What kind of top treatment?',tstyle:'Style',tdetail:'Details',rstyle:'Shade style',rcontrol:'Mount, control and headrail',rvalance:'Valance',job:'Job and window',product:'Drapery or side panel?',header:'Header style',fullness:'Fabric type and fullness',hardware:'Hardware and mount',measure:'Measurements',draw:'Draw and stack',lining:'Lining and hem',fabric:'Fabric',extras:'Decoration and notes',order:'The work order',price:'Price it'};
const STEP_LEDE={lfabric:'The fabric decides what the shade does: screen for glare and view, light-filtering for privacy with a glow, blackout for dark. Then which way it rolls.',loperator:'Who lifts it and how. The operator also sets the factory deduction on an inside mount.',lcover:'The tube wants covering. Exposed, fascia, cassette, a valance or a pocket; none of them seals the top of the window.',ttype:'A top treatment closes the top of the window and covers the hardware. Rigid or soft, on a board or on a rod: decide that first, then the style.',tstyle:'Pick the style by the room and the fabric. Flat styles show the fabric; pleats and swags add fullness and shadow; cornices add weight.',tdetail:'Welting, lining, ties, cascades: the small decisions that change the price and the look.',rstyle:'Pattern or texture, operable every day or a stationary look: the style decides the fabric rules, the mount options and how the height is measured.',rcontrol:'Inside or outside, cordlock or continuous chain and which side, and how deep the headrail is. The jamb depth from the site survey decides most of it.',rvalance:'Hide the headrail with a valance, or let the fabric waterfall over it. Every style can have a classic valance.',job:'The room name is how the workroom labels the panels, the installer matches them to windows, and a motor gets programmed. It goes on every line.',product:'The workroom prices and sews these differently. A drapery covers the window and is made to an exact width. A side panel frames it and is ordered in widths of material.',header:'The header decides what hardware it can hang from, where the pin sits, and how the height is measured. Pick it before the hardware.',fullness:'Fullness is where drapery gets its weight, its shadows and most of its light control. The house standard is written on every order.',hardware:'The drapery is made to the hardware, so decide the hardware now. Its projection sets the return and its height sets the length.',measure:'Metal tape, to ⅛", three points. Enter the sheet letters and the tool writes the workroom width and height with every deduction shown.',draw:'Say "stack left" or "stack right", never just "left". Installers read "left to right" as stacking left.',lining:'The lining does the light job and protects the face fabric. Standard coated blackout has pinholes; true blackout needs the black-backed version.',fabric:'Fabric we supply, or C.O.M. from the client or designer. The yardage below is a planning estimate; the workroom confirms the cut before fabric is ordered.',extras:'Contrast fabrics are their own line. Anything the form can\'t say goes in the notes.',order:'This is what the workroom sews to. The deductions are already applied and the math is written on it so the sewer can check you.',price:'Labor is priced from the house price book using the spec you already built. Add the hardware parts and the fabric price; the tool writes the estimate lines.'};

function stepJob(){ return [
  h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:12},Item('Client',Txt('client'))),
    h(Col,{xs:24,md:12},Item('Project / estimate no.',Txt('project'))),
    h(Col,{xs:24,md:12},Item('Room',Txt('room'),null,!S.room?'Required. The workroom and the installer both need it.':null)),
    h(Col,{xs:24,md:12},Item('Window ID',Txt('windowId'),'Match the elevation sketch: "W1", "North pair", "Slider".')),
    h(Col,{xs:24,md:12},Item('Quantity of units',Num('qty',{min:1}),'Identical windows to the same spec. One pair or one panel = 1.'))),
  Nav(null,'product',h(Button,{size:'large',onClick:()=>{S={...DEFAULT,...EXAMPLE,hw:EXAMPLE.hw.map(h=>({...h}))}; save(); forceRender(); message.success('Example loaded');}},'Load a worked example'))]; }

function stepProduct(){ const sw=num(S.spWindowW); const sp=S.product==='sidepanel'||S.product==='bmsp'; return [
  Tiles('product',[{v:'drapery',n:'Drapery',d:'Custom width and height. Traversing or stationary. Made to the rod width you give; the workroom applies the fullness.'},{v:'sidepanel',n:'Side Panel',d:'Stationary panel at the side of a window, ordered as 1, 1½ or 2 widths. Standardised, so cheaper; judged on how plump it looks at rest.'},{v:'bmsp',n:'Board Mounted Side Panel',d:'Same idea on a fabric-wrapped board. No visible hardware. Ordered as Left Return, Right Return, Both Returns or Both Mitered.'},{v:'roman',n:'Roman Shade',d:'Fabric shade on a headrail: classic flat, hobbled, knife or ribbed pleat, relaxed, or London. The working layer of the window.'},{v:'top',n:'Top Treatment',d:'Cornice, board-mounted valance or swag, or a rod-mounted casual valance. The layer that closes the top of the window.'},].concat(SHOW_ROLLER?[{v:'roller',n:'Roller / Solar Shade',d:'Insolroll roller: a tube, a fabric, an operator and a cover. Ordered from the vendor, not sewn.'}]:[]),true),
  isRoman()?Callout('why','Why','A roman shade is the working layer: it goes up and down every day and does most of the light and privacy control. It can never seal its own edges, so the mount decides how much light gets round it.'):null,
  sp?h(Fragment,null,H3('Widths of material'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:12},Item('Window width the panels frame',Inch('spWindowW'),'Outside of trim (letter A on the sheet).')),
    h(Col,{xs:24,md:12},Item('Suggested',h('div',{className:'readout'},sw==null?'—':(sw<=48?'1 width per panel (window ≤ 48")':sw<=96?'1½ widths per panel (48–96")':'2 widths per panel (over 8 ft)')))),
    h(Col,{xs:24,md:12},Item('Order each panel as',Sel('spWidths',[['1','1 width (~20" at fullness)'],['1.5','1½ width (~30")'],['2','2 width (~40")']]))),
    h(Col,{xs:24,md:12},Item('Panels',Sel('spCount',[['2','Pair (one each side)'],['1','Single']]))),
    S.product==='bmsp'?h(Col,{xs:24,md:12},Item('Board returns',Sel('bmspReturn',['Both Returns','Left Return','Right Return','Both Mitered']))):null),
    Callout('rule','House rule','Window to 48" wide: 1 width per panel. 48–96": 1½ widths (half width on the return side, seam in the stack). Over 8 feet: 2 widths, so the panels don\'t look stingy beside all that glass.')):null,
  isRoman()?null:Callout('why','Why','Side panels are priced and sewn to a standard, so the workroom only needs the width count and the height. A drapery has to cover the glass when closed, so it needs the real rod width and the draw.'),
  Nav('job',isRoller()?'lfabric':isTop()?'ttype':isRoman()?'rstyle':'header')]; }

function stepHeader(){ const grp=g=>Object.entries(HEADERS).filter(([k,x])=>x.g===g).map(([k,x])=>({v:k,n:x.n,d:x.d,tag:x.stat?'stationary':''})); return [
  H4('Pleated (hangs from pin hooks)'),Tiles('header',grp('pleat')),
  H4('Rod goes through or over the header (give the rod size)'),Tiles('header',grp('rod')),
  H4('Snap tape on a track'),Tiles('header',grp('ripple')),
  Callout('ask','Ask',UL(['"Will you open and close these every day, or are they framing the window?"','"Do you want to see the hardware?" (pole and rings vs. a track hidden behind the header)','"Formal or relaxed?" Pinch and goblet read formal; inverted, two-finger and ripplefold read modern; rod pocket and tabs read casual.'])),
  Callout('wrong','What goes wrong',UL(['Inverted pleat on a panel that has to traverse. It is a stationary header.','Grommet or ring panels across a centre support: the panel stops at the bracket.','Embroidered fabric with grommets: the metal frays the stitching.'])),
  Nav('product','fullness')]; }

function stepFullness(){ const std=S.fabricType==='sheer'?'3':'2', rstd=S.fabricType==='sheer'?'120':'100'; return [
  Tiles('fabricType',[{v:'drapery',n:'Drapery fabric',d:'Any non-sheer face fabric. House standard 2×.'},{v:'sheer',n:'Sheer',d:'House standard 3×. Bead-weighted hem, always.'}]),
  isRF()?h(Fragment,null,H3('Ripplefold fullness (set by the carrier spacing)'),Tiles('rfFullness',[['60','60%','Utility curtains only.'],['80','80%','Bulky fabrics.'],['100','100%','Drapery standard.'],['120','120%','Sheer standard.']].map(x=>({v:x[0],n:x[1],d:x[2],tag:x[0]===rstd?'house std':''}))))
       :h(Fragment,null,H3('Fullness'),Tiles('fullness',[['2','2×','House standard on drapery.'],['2.2','2.2×',''],['2.5','2½×',''],['3','3×','House standard on sheers.']].map(x=>({v:x[0],n:x[1],d:x[2],tag:x[0]===std?'house std':''})))),
  Callout('rule','House rule','2× on drapery, 3× on sheers. Ripplefold: 100% on drapery, 120% on sheers, 80% for bulky fabrics, 60% for utility curtains only. A sheer the client specifically wants at 2× is sewn as a regular unlined panel; say so on the order.'),
  Nav('header','hardware')]; }

function stepHardware(){ const g=hdrGroup(),k=hwKind(); const items=Object.entries(HW).filter(([key])=>S.product==='bmsp'?key==='board':key!=='board').map(([key,x])=>({v:key,n:x.n,d:x.d,off:g&&!x.for.includes(g),tag:x.ext?'vendor':''}));
  const proj=num(S.projection); const projErr=proj!=null&&(proj<0||proj>7.5)?'Return must be 0–7½".':null; const dbl=S.header==='dblpocket';
  return [
  Tiles('hardware',items,true),
  S.hardware?Callout('why','Spec',HW[S.hardware].d+(HW[S.hardware].ext?' Order it from the vendor as its own line; it is priced on the hardware rows in step 12.':'')):null,
  H3('Mount'),
  h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:12},Item('Hardware mounts to',Sel('mountSurface',[['wall','Wall'],['ceiling','Ceiling']]))),
    h(Col,{xs:24},Item('Mount',Sel('mount',[['OM','OM (outside mount): made to the exact numbers'],['IM','IM (inside mount): the workroom deducts ¾" height'],['UT','Under Treatment: the workroom deducts ½" height']],true),'Give the raw number; never deduct what the workroom deducts.')),
    g!=='rod'?h(Col,{xs:24,md:12},Item('Bracket projection (= return)',Inch('projection',{max:7.5}),'Letter L. Standard 3½" pleated, 4" side panel. Range 0–7½". A double track or a shade underneath needs more.',projErr)):null,
    isRF()?h(Col,{xs:24,md:12},Item('Track height',Inch('trackH'),'Ripplefold only: the track sits above the fabric. Measure the track you are actually installing.',num(S.trackH)==null?'Required to compute the ripplefold height.':null)):null,
    g==='rod'?h(Col,{xs:24,md:12},Item(dbl?'Top rod type and size':'Rod type and size (the workroom adds the take-up)',Txt('rodType','e.g. 1⅜" pole, 2½" flat rod'),null,!S.rodType?'Required for pocket, tab and grommet headers.':null)):null,
    dbl?h(Col,{xs:24,md:12},Item('Bottom rod type and size',Txt('rodType2','e.g. ⅜" sash rod'),'Usually a sash rod. Both pockets get the take-up for their own rod.',!S.rodType2?'A double rod pocket needs both rod sizes.':null)):null),
  (g==='pleat'&&k==='existing')?Chk('looseRings','Loose rings on a pole','Pleated panel hung from rings that slide on the pole. House rule: add 1" to the drapery width for every width of material so the pair still meets after it springs back.'):null,
  Callout('wrong','What goes wrong',UL(['Interlining over 49 sq ft is heavy. Spec a heavy-duty track and brackets, not a light rod.','Return doesn\'t match the bracket: the panel either stands off the wall or binds on it.'])),
  Nav('fullness','measure')]; }

function stepMeasure(){ if(isRoller()) return stepLMeasure(); if(isTop()) return stepTMeasure(); if(isRoman()) return stepRMeasure(); const g=hdrGroup(),k=hwKind(); const im=S.mount==='IM',dr=S.product==='drapery',ex=k==='existing'; const ringsNow=(onRings()||k==='dtr')&&g==='pleat'; const dbl=S.header==='dblpocket';
  const W=widthCalc(),Hc=heightCalc(); const topLab=g==='ripple'?'Mounting point (ceiling or bracket) to floor':dbl?'Top rod to bottom rod, centre to centre':g==='rod'?'Top of rod to floor':'Top of track to floor';
  const topHint=g==='ripple'?'Where the track mounts, to the floor. The tool subtracts the track and the float.':dbl?'Measure between the two rods where they will actually mount. No float; the panel is stretched taut.':g==='rod'?(S.header==='grommet'?'For grommets this number is the finished length.':'The tool subtracts the float; the workroom adds the take-up.'):'Mount the track as high as the room allows. The pin setting does the rest.';
  const yd=yardage(); const canY=Hc.order!=null&&(S.product!=='drapery'||W.order!=null);
  return [
  H3('Width'),
  h(Row,{gutter:[18,0]},
    dr&&!im&&!ex?h(Col,{xs:24,md:8},Item('A · Outside width of frame, trim included',Inch('A'))):null,
    dr&&!im&&!ex?h(Col,{xs:24,md:8},Item('Extension past frame, left',Inch('extL'),'6–15" each side is the rule of thumb; more for full or heavy panels.')):null,
    dr&&!im&&!ex?h(Col,{xs:24,md:8},Item('Extension past frame, right',Inch('extR'))):null,
    dr&&!im&&ex?h(Col,{xs:24,md:12},Item('J · Existing rod, bracket to bracket',Inch('J'),'Reusing hardware: measure the rod, not the window.')):null,
    dr&&im?h(Col,{xs:24,md:12},Item('Opening width (smallest of three)',Inch('openW'),'Inside mount: give the exact opening.')):null,
    !dr?h(Col,{xs:24},h(Text,{type:'secondary'},'Side panels are ordered by widths of material (step 2); only the height is needed here.')):null),
  H3('Height'),
  h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('G · Top of frame to floor',Inch('G'),'Reference only, for the sketch.')),
    h(Col,{xs:24,md:8},Item('H · Top of frame to ceiling',Inch('H'),'How high the rod can go.')),
    !im&&!ringsNow?h(Col,{xs:24,md:8},Item(topLab,Inch('topRef'),topHint,num(S.topRef)==null&&S.header&&S.hardware?'Required to compute the height.':null)):null,
    !im&&ringsNow?h(Col,{xs:24,md:8},Item('M · Bottom of ring to floor',Inch('M'),'Pole and rings: the panel hangs from the ring.',num(S.M)==null?'Required for rings.':null)):null,
    im?h(Col,{xs:24,md:8},Item('Opening height (shortest of three)',Inch('openH'),'Inside mount only. The workroom takes ¾" off.')):null,
    !dbl?h(Col,{xs:24,md:12},Item('Finish at the floor',Sel('finish',[['float','Float ½" off the floor (house standard)'],['kiss','Kiss / break: just touches'],['puddle','Puddle on the floor (stationary only)']]))):null,
    !dbl&&S.finish==='puddle'?h(Col,{xs:24,md:8},Item('Puddle amount',Inch('puddleIn',{step:0.5,min:1,max:6}),'2–4" is usual.')):null,
    !dbl?h(Col,{xs:24,md:12},Item('Floor and ceiling',Sel('level',[['ok','Parallel, within ¼"'],['off','Out of level by more than ¼"']]),'Measure length at both ends and the middle. If they differ, float.')):null),
  Chk('linen','100% linen (or a linen blend the client has accepted linen terms for)','House rule: order the height short by half the 3% movement tolerance. The math is written on the order. Linen terms go on the estimate with the client\'s signature.'),
  (!S.header||!S.hardware)?Callout('ask','First','Pick the header (step 3) and the hardware (step 5) so the tool knows which height rule applies.'):null,
  dr?CalcTable('Order width',W.rows,W.order):null,
  CalcTable('Order height',Hc.rows,Hc.order),
  Hc.need==='trackH'?Callout('wrong','Missing','Enter the track height in step 5. The fabric is ordered to the height below the track.'):null,
  Hc.need==='M'?Callout('wrong','Missing','On rings the panel hangs from the ring: enter M, bottom of ring to floor.'):null,
  Nav('hardware','draw')]; }

function stepDraw(){ const W=widthCalc().order; const l=num(S.offL),r=num(S.offR); const offErr=S.draw==='offset'&&W!=null&&l!=null&&r!=null&&Math.abs(l+r-W)>0.0625?'Left + right must equal the rod width.':null; return [
  S.product!=='drapery'?Callout('why','Side panels','Side panels are stationary. Nothing to choose here.'):null,
  Tiles('draw',[{v:'split',n:'Split',d:'Two equal panels meeting at centre.'},{v:'offset',n:'Offset Split',d:'Two unequal panels. Window off-centre, or a corner where each panel clears its own glass.'},{v:'oneL',n:'One Way · stack left',d:'Single panel, opens to the left.'},{v:'oneR',n:'One Way · stack right',d:'Single panel, opens to the right.'},{v:'stationary',n:'Stationary',d:'Doesn\'t traverse. Frames the window.'}]),
  S.draw==='offset'?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:12},Item('Left panel covers',Inch('offL'))),h(Col,{xs:24,md:12},Item('Right panel covers',Inch('offR'),W!=null?`Rod width is ${frac(W)}.`:'',offErr))):null,
  (S.draw==='split'||S.draw==='offset')?h(Fragment,null,H3('Master carriers at centre'),Tiles('masters',[{v:'overlap',n:'Overlap',d:'Panels cross by several inches. Whenever there\'s light behind.'},{v:'butt',n:'Butt',d:'Panels just meet. Only with no light behind (a closet, a room divider).'}])):null,
  H3('Motor'),
  Chk('motor','Motorised (A/C plug-in)','Give the motor side on a split, the room name, and list units left to right as you face the windows.'),
  S.motor?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:12},Item('Motor side',Sel('motorSide',[['left','Left'],['right','Right']])))):null,
  Callout('ask','Ask',UL(['"Where will you stand when you open these?" The control and the stack go where the hand is.','"What\'s beside the window?" A door, a bed, a sconce, a return wall. The stack has to land somewhere.'])),
  Nav('measure','lining')]; }

function stepLining(){ const rm=isRoman(); return [
  rm?Callout('why','Why','The lining does the light job and protects the face. A lined roman still leaks at the edges; blackout fabric does not make a blackout window.'):null,
  Tiles('lining',LININGS.map(l=>({v:l[0],n:l[0],d:l[1],tag:l[0]==='Premium Lining'?'standard':''}))),
  ['Premium Lining','Blackout Lining'].includes(S.lining)?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:12},Item('Lining colour',Sel('liningColor',['Workroom matches','White','Ivory','Black'])))):null,
  S.lining==='Contrasting Lining'?h(Fragment,null,H4('Contrasting lining fabric'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('Supplied by',Sel('clSource',[['ours','We supply'],['com','C.O.M.']]))),
    h(Col,{xs:24,md:8},Item('Vendor / book',Txt('clVendor'))),h(Col,{xs:24,md:8},Item('Pattern',Txt('clPattern'))),h(Col,{xs:24,md:8},Item('Colour',Txt('clColor'))),
    h(Col,{xs:24,md:8},Item('Fabric width',Inch('clWidth',{step:0.5,min:36}))),h(Col,{xs:24,md:8},Item('Vertical repeat',Inch('clVr'))),h(Col,{xs:24,md:8},Item('Price per yard',Num('clPrice',{step:0.01,prefix:'$'}))),
    h(Col,{xs:24},Item('Instructions to the fabricator',Txt('clNotes','e.g. pattern runs vertical, match at seams, show 1" of lining at the leading edge')))),
    Callout('why','Why','A contrasting lining is a second face fabric: it is cut to the same widths as the face, so it needs its own yardage and its own repeat. Tell the sewer which way the pattern runs and whether any of it is meant to show from the room side.')):null,
  rm?h(Fragment,null,H3('Alignment'),Tiles('rAlign',[{v:'bottom',n:'Alignment at the bottom',d:'Standard. Folds set from the hem.'},{v:'top',n:'Alignment at the top',d:'Side-by-side windows of different heights: the folds line up across the room.'}])):null,
  rm?null:H3('Hem weight'),
  rm?null:Tiles('hem',[{v:'std',n:'Standard corner weights',d:'Weights at the corners and every seam.'},{v:'bead',n:'Bead Weighted Bottom Hem',d:'A continuous chain of weights. House rule on every sheer and every ripplefold.'}]),
  Callout('wrong','What goes wrong',UL(['Unlined non-sheer fabric has no protection from the sun. Our warranty excludes sun damage on it; tell the client in writing.','"Self-lined" is not double-sided. For a divider seen from both sides, order unlined at about twice the width and finish in-house.'])),
  Nav(rm?'rvalance':'draw','fabric')]; }

function stepFabric(){ const Hc=heightCalc(); const W=widthCalc(); const Y=yardage(); const canY=Hc.order!=null&&(S.product!=='drapery'||W.order!=null);
  const yrow=(lab,y)=>({key:lab,a:lab,b:y.widths==='railroaded'?'railroaded':y.widths+' w',c:frac(y.cut),d:y.yds+' yd'});
  return [
  Tiles('fabricSource',[{v:'hz',n:'We supply the fabric',d:'Sourced by us. Enter the price per yard.'},{v:'com',n:'C.O.M.',d:'Customer\'s own material. Arrives rolled on a tube, face and direction marked, and is logged to the job.'}]),
  h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('Vendor / book',Txt('fabVendor'))),h(Col,{xs:24,md:8},Item('Pattern',Txt('fabPattern'))),h(Col,{xs:24,md:8},Item('Colour',Txt('fabColor'))),
    h(Col,{xs:24,md:8},Item('Fabric width',Inch('fabWidth',{step:0.5,min:36}),'54" standard; 108–128" wide-width can railroad.')),
    h(Col,{xs:24,md:8},Item('Vertical repeat',Inch('vr'))),h(Col,{xs:24,md:8},Item('Horizontal repeat',Inch('hr'))),
    h(Col,{xs:24,md:8},Item('Fabric price per yard',Num('fabPrice',{step:0.01,prefix:'$'}),'C.O.M. is charged $15/yd handling.'))),
  !isRoman()&&S.header==='grommet'?h(Fragment,null,H3('Grommets'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:12},Item('Size',Sel('gromSize',['Small Round (poles to 1⅜")','Square (poles to 1⅜")','Large Round (poles to 2")']))),
    h(Col,{xs:24,md:12},Item('Finish',Sel('gromFinish',['Antique Brass','Antique Copper','Black','Brass','Matte','Nickel','Brushed Steel (small round & square only)','Oil Rubbed Bronze (small round & square only)','Satin Smoke (small round & square only)'])))),
    Chk('gromalink','Grom-A-Link','Adds a hook behind the grommet so a wand has something to pull. Order it whenever a wand will be used.')):null,
  H3('Yardage estimate (per unit)'),
  canY?h(Fragment,null,h(Table,{className:'calc',size:'small',pagination:false,dataSource:[yrow(frac(num(S.fabWidth)||54),Y.a)].concat(Y.b?[yrow('118" wide-width',Y.b)]:[]),columns:[{title:'Fabric width',dataIndex:'a'},{title:'Widths',dataIndex:'b',align:'right',className:'num'},{title:'Cut length',dataIndex:'c',align:'right',className:'num'},{title:'Yards',dataIndex:'d',align:'right',className:'num'}]}),
    Callout('ask','Check',`Figured the way the Horizons C.O.M. calculator does it: ${isTop()?((tStyle()?tStyle().n:'')+': railroaded along the width, '+(Y.a&&Y.a.note?Y.a.note+', ':'')+'plus one repeat if the fabric has one'):isRoman()?(RSTYLES[S.rStyle||'classic'].n+' shade: one width to '+frac((num(S.fabWidth)||54)-6)+', cut length '+(S.rStyle==='hobbled'?'1½ × height + 36"':(S.rStyle==='knife'||S.rStyle==='ribbed')?'1⅛ × height + 36"':(S.rStyle==='relaxed'||S.rStyle==='london')?'height + 48"':'height + 24"')+', plus the house 8" for the permanent pleat'):isRF()?'ripplefold width table for '+frac(num(S.fabWidth)||54)+' goods at '+(S.rfFullness||'100')+'%':(hdrGroup()==='rod'?'rod-header fullness and take-up':'2¾× cutting fullness (2× for two-finger), 4¾" plus the return per panel')}, cut length ${(num(S.vr)||0)>0?'rounded up to the '+frac(num(S.vr))+' repeat, ':''}to the nearest ¼ yard. Sheers on wide goods are railroaded. The workroom still confirms the cut before fabric is ordered.`))
    :Callout('ask','Yardage','Appears once width and height are known (step 6).'),
  Nav(isTop()?'tdetail':'lining','extras')]; }

function stepExtras(){ const by=bandYards(); const rm=isRoman(); const tp=isTop(); if(isRoller()) return [h(Row,{gutter:[18,0]},h(Col,{xs:24},Item('Extras from the Insolroll quote',Txt('decoNotes','e.g. top/back cover on the fascia, 40" wands, extension brackets'))),h(Col,{xs:24},Item('Notes',h(Input.TextArea,{value:S.notes,onChange:e=>setRaw('notes',e.target.value),autoSize:{minRows:3}})))),Nav('measure','order')]; return [
  tp?h(Row,{gutter:[10,10]},h(Col,{xs:24,md:12},Chk('banding','Edge Accents banding','Contrast band along the hem. A separate fabric.')),h(Col,{xs:24,md:12},Chk('trim','Decorative trimmings','Trim on the bottom edge; priced by width.'))):rm?h(Row,{gutter:[10,10]},h(Col,{xs:24,md:12},Chk('banding','Edge Accents banding','Contrast band on the shade (and the valance). A separate fabric.')),h(Col,{xs:24,md:12},Chk('trim','Decorative trimmings','Trim on the shade and valance.')),h(Col,{xs:24,md:12},Chk('rHoldDowns','Hold downs','Clips at the bottom for a door or a tilt-in sash.'))):h(Row,{gutter:[10,10]},
    h(Col,{xs:24,md:12},Chk('banding','Edge Accents banding','Leading edge, stationary edge, or inset. A separate fabric.')),
    h(Col,{xs:24,md:12},Chk('trim','Decorative trimmings','Give the trim and where it goes.')),
    h(Col,{xs:24,md:12},Chk('duo','Duo-Drape','Two fabrics in one panel. Give the seam location.')),
    h(Col,{xs:24,md:12},Chk('tiebacks','Tie backs'))),
  S.banding?h(Fragment,null,H4('Banding fabric and placement'),h(Row,{gutter:[18,0]},
    tp?null:rm?h(Col,{xs:24,md:8},Item('Placement',Sel('rBandWhere',['Sides & Bottom','Sides Only','Bottom Only','Inset']))):h(Col,{xs:24,md:8},Item('Placement',Sel('bandPlacement',['Leading edge','Stationary edge','Leading and stationary edges','Leading edge and bottom hem','All four sides','Inset from the edge']))),
    h(Col,{xs:24,md:8},Item('Finished band width',Inch('bandWidth',{min:0.5}),'2½" is the house standard.')),
    !rm&&!tp&&S.bandPlacement==='Inset from the edge'?h(Col,{xs:24,md:8},Item('Inset from the edge',Inch('bandInset'))):null,
    h(Col,{xs:24,md:8},Item('Supplied by',Sel('bandSource',[['ours','We supply'],['com','C.O.M.']]))),
    h(Col,{xs:24,md:8},Item('Vendor / book',Txt('bandVendor'))),h(Col,{xs:24,md:8},Item('Pattern',Txt('bandPattern'))),h(Col,{xs:24,md:8},Item('Colour',Txt('bandColor'))),
    h(Col,{xs:24,md:8},Item('Fabric width',Inch('bandFabW',{step:0.5,min:36}))),h(Col,{xs:24,md:8},Item('Price per yard',Num('bandPrice',{step:0.01,prefix:'$'}))),
    h(Col,{xs:24},Item('Instructions to the fabricator',Txt('bandNotes','e.g. cut on the straight grain, mitre the corner at the hem, band on the face only')))),
    (rm||tp)?null:Callout('why','Why','Banding is cut in strips, so its yardage depends on the length of the edge and how many strips a width of the band fabric gives, not on the panel width. '+(by?`Estimate: ${by.strips} strip${by.strips>1?'s':''} of ~${frac((num(S.bandWidth)||2.5)*2+1)} × ${frac(by.inches/by.strips)}, ${by.perW} per width, ${by.yds} yd.`:''))):null,
  h(Row,{gutter:[18,0]},h(Col,{xs:24},Item('Decoration detail',Txt('decoNotes','e.g. trim on the leading edge: Samuel & Sons 977-xxxx'))),h(Col,{xs:24},Item('Notes to the workroom',h(Input.TextArea,{value:S.notes,onChange:e=>setRaw('notes',e.target.value),autoSize:{minRows:3}})))),
  Nav('fabric','order')]; }

function OrderDesc(lines,cols){ const groups=[]; let cur=null; for(const l of lines){ if(l.sec){cur={title:l.sec,items:[]};groups.push(cur);} else if(cur) cur.items.push(l); }
  return groups.map(g=>h(Descriptions,{key:g.title,title:g.title,bordered:true,size:'small',column:cols||1,className:'od',items:g.items.map((l,i)=>({key:i,label:l.k,children:h('span',{className:(l.n?'num ':'')+(l.v?'':'empty')},l.v||'not set',l.small?h('small',{className:'od-small'},l.small):null)}))})); }

function stepOrder(){ const L=orderLines(); const id=[S.client,S.project].filter(Boolean).join(' · '); return [
  h(Card,{className:'sheet',title:h('span',{className:'sheet-t'},isRoller()?'Roller shade order':isTop()?'Top treatment work order':isRoman()?'Roman shade work order':'Drapery work order'),extra:h(Text,{type:'secondary',className:'num'},(id||'unnamed job')+(S.room?' · '+S.room:'')+(S.windowId?' · '+S.windowId:''))},OrderDesc(L,1)),
  H3('Plain text for the job folder or an email'),
  h('pre',{className:'txt'},orderText()),
  h('div',{className:'nav'},h(Space,{wrap:true},h(Button,{type:'primary',size:'large',onClick:()=>copyText(orderText())},'Copy order text'),h(Button,{size:'large',onClick:saveJob},'Save window to job'),h(Button,{size:'large',onClick:()=>go('price')},'Next: price it')))]; }

function stepPrice(){ const r=priceCalc();
  const hwCols=[{title:'Part',dataIndex:'n',render:(v,row,i)=>h(Input,{value:S.hw[i].n,placeholder:'e.g. Rod 7 ft @ $28',onChange:e=>{S.hw[i].n=e.target.value;save();forceRender();}})},
    {title:'Qty',dataIndex:'q',width:90,render:(v,row,i)=>h(InputNumber,{value:num(S.hw[i].q),min:0,className:'num',controls:false,onChange:x=>{S.hw[i].q=x==null?'':x;save();forceRender();}})},
    {title:'Each (retail)',dataIndex:'p',width:130,render:(v,row,i)=>h(InputNumber,{value:num(S.hw[i].p),min:0,step:0.01,prefix:'$',className:'num',controls:false,onChange:x=>{S.hw[i].p=x==null?'':x;save();forceRender();}})},
    {title:'Retail',dataIndex:'t',align:'right',className:'num',render:(v,row,i)=>money((num(S.hw[i].q)||0)*(num(S.hw[i].p)||0))},
    {title:'',dataIndex:'x',width:50,render:(v,row,i)=>h(Button,{size:'small',type:'text',danger:true,'aria-label':'Remove',onClick:()=>{S.hw.splice(i,1); if(!S.hw.length)S.hw.push({n:'',q:1,p:''}); save(); forceRender();}},'×')}];
  const pbRows=r?r.baseRows.concat(r.sur).concat(r.adj?[['Adjustment',r.adj,'']]:[]):[];
  return [
  isRoller()?h(Fragment,null,H3('Insolroll quote, per shade'),h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Retail list (per shade)',Num('lList',{step:0.01,prefix:'$'}),'From the Insolroll quote. The client pays retail.')),h(Col,{xs:24,md:8},Item('Options and surcharges',Num('lOptions',{step:0.01,prefix:'$'}))),h(Col,{xs:24,md:8},Item('Tariff (per item)',Num('lTariff',{step:0.01,prefix:'$'}))),h(Col,{xs:24,md:8},Item('Freight, whole order',Num('lFreight',{step:0.01,prefix:'$'}))),h(Col,{xs:24,md:8},Item('Items on the order',Num('lItems',{min:1}),'Freight is split evenly across them.')))):H3('Fabrication labor from the price book'),
  r?h(Table,{className:'calc',size:'small',pagination:false,dataSource:pbRows.map((x,i)=>({key:i,a:x[0],b:money(x[1]),c:x[2]||''})).concat([{key:'t',a:h('b',null,'Labor retail, per unit'),b:h('b',null,money(r.retail)),c:r.q>1?'× '+r.q+' units':''}]),columns:[{title:'Line',dataIndex:'a'},{title:'Retail',dataIndex:'b',align:'right',className:'num'},{title:'Basis',dataIndex:'c'}]})
   :Callout('ask','Waiting','Labor prices once the product, width and height are known (steps 2 and 6).'),
  h(Row,{gutter:[18,0]},h(Col,{xs:24,md:12},Item('Labor adjustment (+ / −) per unit',h(InputNumber,{value:num(S.pAdj),onChange:v=>setRaw('pAdj',v==null?'':v),step:1,prefix:'$',size:'large',className:'num',controls:false,style:{width:'100%'}}),'For anything the price book doesn\'t cover. Say why in the notes.'))),
  H3('Hardware (one row per part)'),
  h(Text,{type:'secondary'},isRoman()?'Headrail, brackets and lift are in the labor price. Add only extras bought separately: motor and remote, extension brackets.':isRoller()?'Brackets, cover and operator are in the shade price. Add only parts bought separately.':isTop()?'Board and L brackets are in the labor price. Add only a rod bought separately for a casual valance.':'One row per part from the hardware quote: track or rod, carriers, finials, brackets, wands, elbows, miters.'),
  h(Table,{className:'hwt',size:'small',pagination:false,dataSource:S.hw.map((x,i)=>({key:i,...x})),columns:hwCols,scroll:{x:620}}),
  h(Row,{gutter:[18,0],style:{marginTop:12}},
    h(Col,{xs:24,md:8},Item('Hardware shipping',Num('hwShip',{step:0.01,prefix:'$'}))),
    h(Col,{xs:24,md:8},Item('Hardware tariff',Num('hwTariff',{step:0.01,prefix:'$'}),'Forest: a dollar line. Orion: 15% on wholesale.')),
    h(Col,{xs:24,md:8},h(Form.Item,{label:' ',className:'fi'},h(Button,{size:'large',onClick:()=>{S.hw.push({n:'',q:1,p:''});save();forceRender();}},'+ Add part')))),
  Callout('rule','House rule','Rod by the foot, rounded up (a 74" rod is 7 ft). One price for everyone: no trade or designer discount. The price book is the house price list; adjust a line only with a reason. Café curtains: $225 per width plus $95 to install each. Roman and roller shades: $95 per window to install.'),
  H3('Our lines'),
  h(Row,{gutter:[18,0]},h(Col,{xs:24,md:12},Item('On-site consultation',Num('consult',{step:0.01,prefix:'$'}))),(isRoman()||isRoller())?h(Col,{xs:24,md:12},Item('Installation',h('div',{className:'readout'},'$95 per window (shades)'),'House rule for roman and roller shades; multiplied by the quantity.')):h(Col,{xs:24,md:12},Item('Installation hours',Num('instHrs',{step:0.5}),'$200/hr, 3-hour minimum. The minimum goes on the estimate even for a one-hour hang.'))),
  r?h(Fragment,null,
    H3('Price-out'),
    h(Table,{className:'calc',size:'small',pagination:false,dataSource:[
      {key:1,a:'Fabrication labor'+(r.q>1?` × ${r.q}`:''),b:'labor retail '+money(r.retail),c:money(r.labor*r.q)},
      {key:2,a:'Hardware',b:`parts ${money(r.hwRetail)} + shipping ${money(num(S.hwShip)||0)} + tariff ${money(num(S.hwTariff)||0)}`,c:money(r.hardware)},
      {key:3,a:'Fabric',b:r.fabricNote,c:money(r.fabric)},
      {key:4,a:'On-site consultation',b:'flat',c:money(r.consult)},
      {key:5,a:'Installation',b:r.installNote,c:money(r.install)},
      {key:6,a:h('b',null,'Total'),b:'',c:h('b',null,money(r.total))}],columns:[{title:'Line',dataIndex:'a'},{title:'How',dataIndex:'b'},{title:'Price',dataIndex:'c',align:'right',className:'num'}]}),
    H3('Estimate Rocket line items'),
    h(Table,{className:'calc',size:'small',pagination:false,scroll:{x:700},dataSource:erLines().map((x,i)=>({key:i,a:h('b',null,x.item),b:x.desc,c:x.qty,d:money(x.unit),e:money(x.qty*x.unit)})).concat([{key:'t',a:h('b',null,'Total'),b:'',c:'',d:'',e:h('b',null,money(r.total))}]),columns:[{title:'Item',dataIndex:'a'},{title:'Description',dataIndex:'b'},{title:'Qty',dataIndex:'c',align:'right',className:'num'},{title:'Unit price',dataIndex:'d',align:'right',className:'num'},{title:'Total',dataIndex:'e',align:'right',className:'num'}]}),
    Callout('ask','Paste','"Copy estimate lines" puts these rows on the clipboard as tab-separated text (Item, Description, Qty, Unit price, Total) with the terms underneath, so each row pastes straight into an Estimate Rocket line item.'),
    Callout('why','On the estimate',`The client's dimensions go on the estimate (the ${frac(rodWidth())||'rod'} width and the ${frac(num(S.topRef)||num(S.M)||num(S.openH))} they gave); the deducted ones stay on the order. Hardware is never inside the labor line.`)):null,
  h('div',{className:'nav'},h(Button,{size:'large',onClick:()=>go('order')},'Back'),h(Button,{type:'primary',size:'large',onClick:()=>copyText(estText()||'Enter the spec first.')},'Copy estimate lines'))]; }


function stepRStyle(){ return [
  Tiles('rStyle',Object.entries(RSTYLES).map(([k,x])=>({v:k,n:x.n,d:x.d,tag:x.stat?'stationary look':''})),true),
  Callout('ask','Ask',UL(['"Will you raise and lower this every day, or does it mostly stay put?" Relaxed and London are a look, not a daily shade.','"Is the fabric patterned?" Classic takes a pattern; knife and ribbed pleats break it; hobbled wants a solid or texture.','"Does it need to be dark?" A lined roman still leaks at both edges: outside mount, or drapery over it.'])),
  Callout('wrong','What goes wrong',UL(['Relaxed or London as an inside mount: it toes in at the bottom and shows a gap.','Knife pleat in a big floral: the motif is cut at every pleat.','Hobbled in a heavy fabric on a wide window: the stack gets deep and the lift gets hard.'])),
  Nav('product','rcontrol')]; }
function stepRControl(){ const auto=rRailAuto(); const d=num(S.rDepth); return [
  H3('Mount'),
  Tiles('mount',[{v:'IM',n:'Inside mount',d:'Clean, shows the trim. Give the exact opening; the workroom deducts the operating clearance. Leaks light at both sides.'},{v:'OM',n:'Outside mount',d:'Covers the frame, hides the stack above the glass, closes most of the side gap. Overlap at least 3" each side.'}]),
  S.mount==='IM'?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('F · Jamb depth to the first obstruction',Inch('rDepth'),'Glass, crank, lock, sash handle, sensor. 1½" rail: ¾" minimum, 2" flush. 2½" rail: 1¼" minimum, 3" flush.',d!=null&&d<0.75?'Too shallow for any headrail. Mount outside.':null))):null,
  H3('Control'),
  Tiles('rControl',[{v:'cordlock',n:'Cordlock',d:'Lift cords through a lock at the headrail; pull to the side to lock. Tassel on the cord ends.'},{v:'chain',n:'Continuous chain',d:'Continuous loop on one side, chain through a clutch. Tall or heavy shades; windows out of reach.'},{v:'cordless',n:'Cordless lift',d:'No cords or chains; lift by hand. Children in the home. Minimum width 18".',tag:'child safe'},{v:'motor',n:'Motorized',d:'Battery or plug-in. Needs a room name for the remote.'}]),
  (S.rControl==='cordlock'||S.rControl==='chain')?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Control side (facing the window)',Sel('rSide',[['right','Right'],['left','Left']]))),
    S.rControl==='cordlock'?h(Col,{xs:24,md:8},Item('Tassel colour',Sel('rTassel',['Walnut','Natural','Offwhite','White']))):h(Col,{xs:24,md:8},Item('Chain colour',Sel('rChainColor',['Stainless steel','Gold'])))):null,
  S.rControl==='motor'?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Power',Sel('rMotor',[['battery','Battery'],['ac','A/C plug-in']]))),h(Col,{xs:24,md:8},Item('Motor side',Sel('rSide',[['right','Right'],['left','Left']])))):null,
  H3('Headrail'),
  h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Headrail depth',Sel('rRail',[['1.5','1½" (shades to 60 × 60)'],['2.5','2½" (larger, or to match a room)']]),auto?`Suggested from the size: ${auto==='2.5'?'2½"':'1½"'}. Match all the shades in one room.`:'Fill in the measurements and the tool suggests one.')),S.mount==='IM'?h(Col,{xs:24,md:8},h(Form.Item,{label:' ',className:'fi'},Chk('rTurned','Turned headrail','Rail rotated so the shallow side faces the glass; for tight jambs.'))):null),
  h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Multiple shades on one headrail',Sel('rMulti',[['1','One shade'],['2','2-on-1'],['3','3-on-1']]),'Side-by-side shades that must line up. 144" maximum total; ⅜" taken at each gap.'))),
  Callout('ask','Check on site',UL(['Where will the chain or cord hang, and can the client reach it?','Does the sash open inward? A shade in the frame will block a casement.','For motors: an outlet within cord reach, or the charging plan.','Tile, stone, metal or plaster where the brackets go.'])),
  Nav('rstyle','measure')]; }
function stepRMeasure(){ const W=widthCalc(),Hc=heightCalc(); const n=+S.rMulti||1; const stat=S.rStyle&&RSTYLES[S.rStyle].stat; return [
  S.mount==='IM'?h(Fragment,null,H3('Inside mount: the opening'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('A · Inside width, smallest of three',Inch('rOpenW'),'Top, middle and bottom. Frames are not square.',num(S.rOpenW)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('H · Inside height, shortest of three',Inch('rOpenH'),stat?'Relaxed and London: to the short point of the smile.':'Left, centre and right.',num(S.rOpenH)==null?'Required.':null)),
))
  :h(Fragment,null,H3('Outside mount: the frame'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('B · Outside width of frame',Inch('rB'),'Trim included.',num(S.rB)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('Overlap each side',Inch('rOverlap'),'3" minimum each side closes the light gap and clears the trim.')),
    h(Col,{xs:24,md:8},Item('G · Trim projection from the wall',Inch('rTrimProj'),'Brackets have to clear it; extension brackets otherwise.')),
    h(Col,{xs:24,md:8},Item('Height covers',Sel('rHtTo',[['apron','To the bottom of the apron (hides the frame)'],['sill','To the sill']]))),
    S.rHtTo==='sill'?h(Col,{xs:24,md:8},Item('I · Top of frame to sill',Inch('rI'),null,num(S.rI)==null?'Required.':null)):h(Col,{xs:24,md:8},Item('J · Top of frame to bottom of apron',Inch('rJ'),null,num(S.rJ)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('Mounted above the frame',Inch('rAbove'),'Raises the stack off the glass; make sure the room above the frame is there.')))),
  n>1?h(Fragment,null,H3('Each shade on the headrail'),h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Shade 1 width',Inch('rW1'))),h(Col,{xs:24,md:8},Item('Shade 2 width',Inch('rW2'))),n>2?h(Col,{xs:24,md:8},Item('Shade 3 width',Inch('rW3'))):null)):null,
  CalcTable('Order width',W.rows,W.order), CalcTable('Order height',Hc.rows,Hc.order),
  Callout('rule','House rule','Inside mount: give the exact opening, smallest of three; the workroom takes the operating clearance (expect ¼"–½" of light per side). Outside mount: the finished size, largest of three plus the overlap. Mark IM or OM on every shade line.'),
  Nav('rcontrol','rvalance')]; }
function stepRValance(){ return [
  Tiles('rValance',[{v:'none',n:'No valance (waterfall)',d:'The fabric comes over the front of the headrail; a back valance of lining hides the hardware from outside.'},{v:'classic',n:'Classic valance',d:'A flat valance over the headrail, 6" standard, custom to 16". Hides the rail and the stack.'}]),
  S.rValance==='classic'?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Valance height',Inch('rValH',{step:0.5,min:4,max:16}),'6" standard; to 10" at no charge; to 16" with a surcharge. 8" on a motorized shade.')),h(Col,{xs:24,md:8},Item('Scallop',Sel('rScallop',['None','Contempo #101','Contempo #202','Contempo #303','Contempo #505','Contempo #606']))),h(Col,{xs:24,md:8},h(Form.Item,{label:' ',className:'fi'},Chk('rValReturns','Valance returns','Wrap the ends of the headrail.')))):null,
  Callout('why','Why','The headrail is the one part of a roman that is not fabric. A valance covers it and the folded stack; a waterfall leaves the fabric to do it. Either is fine; the client should choose on purpose.'),
  Nav('measure','lining')]; }

function stepTType(){ return [
  Tiles('tType',Object.entries(TTYPES).map(([k,x])=>({v:k,n:x.n,d:x.d})),true),
  Callout('why','Why','Drapery hangs below its track and a shade below its headrail, so light always comes in across the top. A cornice or valance is what finishes the light-blocking system; a soffit the track recesses into is the other answer.'),
  Callout('ask','Ask',UL(['"What is underneath?" The return has to clear the stack of whatever hangs behind it.','"Does it need to be dark?" A cornice seals best; a swag seals least.','"Formal or relaxed?" Swags and cornices read formal; a tailored flat valance or a sleeve reads casual.'])),
  Nav('product','tstyle')]; }
function stepTStyle(){ const t=S.tType; const items=g=>Object.entries(TSTYLES).filter(([k,x])=>x.t===t&&(g?x.g===g:true)).map(([k,x])=>({v:k,n:x.n,d:x.d,tag:x.code}));
  return [
  !t?Callout('ask','First','Pick the type in step 3.'):null,
  t==='cornice'?Tiles('tStyle',items()):null,
  t==='board'?h(Fragment,null,H4('Flat and pleated'),Tiles('tStyle',items('flat')),H4('Swags, cascades and tied'),Tiles('tStyle',items('swag'))):null,
  t==='casual'?Tiles('tStyle',items()):null,
  t==='board'?Callout('why','Vocabulary','The Empire and Kingston valances in Chapter 4 are swag-and-cascade arrangements: order them as Traditional Swag & Cascade and describe the arrangement in the notes. A scarf swag made and fixed is the Pole Swag. Balloon and London valances are built like the shades of the same name; say so in the notes until they get their own style.'):null,
  Nav('ttype','measure')]; }
function stepTMeasure(){ const st=tStyle(); const W=widthCalc(),Hc=heightCalc(); if(!st) return [Callout('ask','First','Pick the style in step 4.'),Nav('tstyle','tdetail')];
  const cas=st.t==='casual';
  return [
  H3(cas?'Rod':'Width'),
  cas?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:8},Item('Rod width, finial to finial',Inch('tRodW'),'The sleeve is gathered on this rod; the workroom allows two 4" returns on an outside mount.',num(S.tRodW)==null?'Required.':null)),
    st.code.startsWith('L')?h(Col,{xs:24,md:8},Item('Sleeve height',Sel('tSleeveH',[['5','5"'],['6','6"'],['8','8"']]))):null)
  :h(Fragment,null,
    Tiles('tUnder',[{v:'rod',n:'Over a rod or track',d:'Give the hardware width bracket to bracket; the face adds clearance each side.'},{v:'shade',n:'Over a shade',d:'Give the headrail or shade width; the face adds clearance each side.'},{v:'window',n:'Over the window alone',d:'Give the outside of the frame; the face adds the overlap each side.'},{v:'none',n:'Face width known',d:'Enter the finished face width directly.'}]),
    h(Row,{gutter:[18,0]},
      S.tUnder&&S.tUnder!=='none'?h(Col,{xs:24,md:8},Item(S.tUnder==='rod'?'Hardware width, bracket to bracket':S.tUnder==='shade'?'Shade or headrail width':'B · Outside width of frame',Inch('tUnderW'),null,num(S.tUnderW)==null?'Required.':null)):null,
      S.tUnder&&S.tUnder!=='none'?h(Col,{xs:24,md:8},Item('Add each side',Inch('tAddSide'),'3" minimum: the inside of the treatment comes back about 2" narrower than its face.')):null,
      S.tUnder==='none'?h(Col,{xs:24,md:8},Item('Face width',Inch('tFaceW'),null,num(S.tFaceW)==null?'Required.':null)):null)),
  !cas?h(Fragment,null,H3('Height and returns'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item(st.t==='cornice'?'Height at the long point':'Body height',st.h?Sel('tH',st.h.map(x=>[String(x),x+'" standard']).concat([['12','12"'],['16','16"'],['20','20"'],['24','24"'],['30','30"'],['36','36"']]).filter((x,i,arr)=>arr.findIndex(y=>y[0]===x[0])===i).sort((p,q)=>+p[0]-+q[0])):Inch('tH',{min:4,max:36}),st.t==='cornice'?'8"–30". Shaped styles finish 2½–3" shorter at the short point.':'House rule: the drop is about ⅕ of the window height, never more than ¼.',num(S.tH)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('Returns',Sel('tReturn',[['1.5','1½"'],['2.5','2½"'],['3.5','3½"'],['5.5','5½" house standard'],['7.25','7¼"'],['9.25','9¼"']]),'Deep enough to clear the stack underneath: a double track or a roman headrail needs more.')),
    st.jabot?h(Col,{xs:24,md:8},Item('Cascade / jabot length',Inch('tJabot',{min:36,max:108}),'36" standard; longer is priced per foot.')):null,
    h(Col,{xs:24,md:8},Item('Miters (corners that are not 90°)',Sel('tMiters',[['0','None'],['1','1'],['2','2'],['3','3'],['4','4']]),'Bay windows and corners. Each needs a template or exact drawing.')))):null,
  CalcTable(cas?'Rod width':'Face width',W.rows,W.order), CalcTable('Height',Hc.rows,Hc.order),
  Callout('rule','House rule','Top treatments are outside mount, ordered by face width. Add at least 3" to the hardware or shade it has to clear. Mount the rod under it so the drapery hangs clear: finished length + ½" + 1¾" to the top of the bracket.'),
  Nav('tstyle','tdetail')]; }
function stepTDetail(){ const st=tStyle(); if(!st) return [Callout('ask','First','Pick the style in step 4.'),Nav('measure','fabric')];
  return [
  st.t==='cornice'?h(Fragment,null,H3('Cornice construction'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('Welting',Sel('tWelt',['¼" welt','½" welt','Contrast welt','No welt top','No welt bottom','No welt']),'¼" top and bottom is standard; contrast welt is a second fabric.')),
    h(Col,{xs:24,md:8},Item('Decorative nailheads',Sel('tNail',[['none','None'],['bottom','Bottom edge'],['top','Top edge'],['both','Top and bottom']]))),
    S.tStyle==='c1'?h(Col,{xs:24,md:8},h(Form.Item,{label:' ',className:'fi'},Chk('tBand','Bottom band','A contrast band along the bottom. Linear only.'))):null),
    Callout('why','Construction','7/16" board, 10 oz batting, face fabric wrapped around fabric-covered legs, blackout-lined on the back. Most fabrics are railroaded so there are no seams; a fabric with a vertical direction is cut and seamed.')):null,
  st.t==='board'?h(Fragment,null,H3('Valance construction'),h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('Lining',Sel('tLining',['Blackout Lining','Light-filtering lining','Interlining','Dual Lining','Self lining','Contrasting lining']),st.g==='swag'?'Swags and cascades are light-filtering lined as standard.':'Flat and pleated valances are blackout-lined as standard.')),
    st.g==='flat'?h(Col,{xs:24,md:8},Item('Fabric direction',Sel('tFlat',[['railroad','Railroaded (no seams)'],['seam','Cut and seamed (pattern runs vertical)']]))):null,
    (S.tStyle==='v7'||S.tStyle==='v26')?h(Col,{xs:24,md:8},Item('Ties',Sel('tTies',[['2','2'],['3','3'],['4','4'],['5','5'],['6','6']]),'Stagecoach: 2 ties to 59", up to 6 at 192".')):null,
    S.tStyle==='v6'?h(Col,{xs:24,md:8},Item('Kerchief',Sel('tKerchief',[['same','Same fabric'],['contrast','Contrast fabric']]))):null,
    S.tStyle==='v22'?h(Col,{xs:24,md:8},h(Form.Item,{label:' ',className:'fi'},Chk('tPleatContrast','Contrast fabric in the pleats','A second fabric shows inside each inverted pleat.'))):null),
    (S.tStyle==='v11'||S.tStyle==='v17')?Callout('why','Two fabrics','This style uses two fabrics (front and back, or body and swoop). The yardage shown is for both from the same fabric; name the second fabric in the notes if it differs.'):null):null,
  st.t==='casual'?Callout('why','Construction',st.code.startsWith('K')?'Skirt valances: 2" header, 3½" rod pocket, self-lined, 2½× fullness, 18"–200" wide. Specify the rod width.':'Sleeve valances: 2½× fullness, 18"–200" wide. Rod pocket 5½" (Rod), 2½" (Flair), 4½" (Elegant). Inside mount needs 1" of depth, 3" to sit flush.'):null,
  Nav('measure','fabric')]; }

function stepLFabric(){ return [
  Tiles('lFab',Object.entries(LFAB).map(([k,x])=>({v:k,n:x.n,d:x.d}))),
  h(Row,{gutter:[18,0]},
    S.lFab==='solar'?h(Col,{xs:24,md:6},Item('Openness',Sel('lOpen',[['1','1% nearly opaque, faint view'],['3','3% the usual balance'],['5','5% more view, more glare'],['10','10% mostly view']]),'Lower = better glare and heat control, more daytime privacy. Darker colours see out more clearly.')):null,
    h(Col,{xs:24,md:6},Item('Collection',Txt('lColl','e.g. Elements, Solar screen 3%'))),h(Col,{xs:24,md:6},Item('Colour',Txt('lColor'))),
    h(Col,{xs:24,md:6},Item('Fabric roll width',Inch('lRollW'),'From the fabric card. A shade can\'t be wider than the roll unless it is railroaded.'))),
  Chk('lRail','Railroaded','Fabric turned sideways for a wider shade; the height is then limited to the roll width. Elements fabrics and coupled shades can\'t be railroaded.'),
  H3('Roll direction'),
  Tiles('lRoll',[{v:'regular',n:'Regular roll',d:'Fabric off the back of the tube, closest to the glass. The default; the smallest light gap.'},{v:'reverse',n:'Reverse roll',d:'Fabric off the front. For a crank, a handle or a mullion in the way; hides the tube, bigger gap behind the fabric.'}]),
  Callout('ask','Ask',UL(['"Is this for the view, the glare, or to sleep?" Screen, light-filtering, blackout.','"Who looks in at night?" A screen shade is on display after dark.','"Is there anything in the way?" A crank or a handle means reverse roll or outside mount.'])),
  Nav('product','loperator')]; }
function stepLOperator(){ const chain=S.lOp&&['r8','r16','r24','sa'].includes(S.lOp); return [
  Tiles('lOp',Object.entries(LOPS).map(([k,x])=>({v:k,n:x.n,d:x.d,tag:(k==='qsr'||k==='select')?'child safe':''})),true),
  S.lOp?h(Row,{gutter:[18,0]},
    S.lOp!=='qsr'&&S.lOp!=='select'?h(Col,{xs:24,md:6},Item(S.lOp==='motor'?'Motor side':S.lOp==='twin'?'Wand side':'Control side (facing the window)',Sel('lSide',[['right','Right'],['left','Left']]))):null,
    chain?h(Col,{xs:24,md:6},Item('Chain',Sel('lChain',[['plastic','Plastic bead chain'],['steel','Steel chain']]),true)):null,
    chain?h(Col,{xs:24,md:6},Item('Chain colour',Sel('lChainColor',S.lChain==='steel'?['nickel','stainless','bronze','brass','black']:['white','black','brown','grey','off-white']))):null,
    S.lOp==='motor'?h(Col,{xs:24,md:6},Item('Power',Sel('lMotorPow',[['battery','Battery'],['dc','DC plug-in'],['ac','A/C hardwired']]),'A/C and ultra-quiet motors take up to 2¼" on an inside mount.')):null):null,
  Callout('why','Chain details',UL(['The tension device mounts 1" less than the shade height; every corded shade meets ANSI/WCMA A100.1-2022.','The chain drop is about 3" less than the shade height and can\'t be shorter than ⅞ of it; the order shows the drop.'])),
  Callout('wrong','What goes wrong',UL(['A cordless spring on a window nobody can reach. It works by tugging the hem.','Clutch size by habit: the clutch follows the shade size and weight; a big shade on an R8 fights the user.'])),
  Nav('lfabric','lcover')]; }
function stepLCover(){ const cv=S.lCover; return [
  Tiles('lCover',Object.entries(LCOV).map(([k,x])=>({v:k,n:x.n,d:x.d})),true),
  (cv==='fascia'||cv==='cassette'||cv==='peak')?h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:6},Item('Size',Sel('lCovSize',cv==='peak'?[['4','Medium, 4" coverage'],['4.75','Large, 4¾" coverage']]:[['3','3"'],['4','4"']]))),
    h(Col,{xs:24,md:6},Item('Finish',Sel('lCovColor',cv==='peak'?['fabric-wrapped','white','black','bronze','clear anodized']:cv==='cassette'?['white','black','bronze','clear anodized','vanilla','fabric-inserted']:['white','black','bronze','clear anodized','vanilla'])))):null,
  cv==='val6'?h(Row,{gutter:[18,0]},h(Col,{xs:24,md:6},Item('Finish',Sel('lCovColor',['white','bronze','clear anodized'])))):null,
  H3('Hem bar and extras'),
  h(Row,{gutter:[18,0]},h(Col,{xs:24,md:6},Item('Hem bar',Sel('lHem',[['sealed','Sealed in fabric (standard)'],['white','Exposed aluminum, white'],['black','Exposed aluminum, black'],['bronze','Exposed aluminum, bronze'],['clear','Exposed aluminum, clear anodized']])))),
  h(Row,{gutter:[10,10]},h(Col,{xs:24,md:12},Chk('lDual','Dual shade','Two rollers in one bracket set: screen in front, blackout behind. Needs a dual fascia or the 6" valance.')),h(Col,{xs:24,md:12},Chk('lAV','AV system','Side channels with brush seal and a sill channel. The only way a roller alone gets close to dark.'))),
  Callout('why','Why','Fascia and cassette are the tight options: they close the gap over the roll. A valance sits in front and covers the mechanism without sealing it. None of them closes the top of the window the way a cornice over drapery does.'),
  Nav('loperator','measure')]; }
function stepLMeasure(){ const W=widthCalc(),Hc=heightCalc(); return [
  H3('Mount'),
  Tiles('mount',[{v:'IM',n:'Inside mount',d:'Give the exact opening; the factory deducts for the operator. Light at both sides.'},{v:'OM',n:'Outside mount',d:'Give the bracket-to-bracket width you want. Covers the frame; hides the roll above the glass.'}]),
  S.mount==='IM'?h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('A · Inside width, smallest of three',Inch('lOpenW'),null,num(S.lOpenW)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('H · Inside height, shortest of three',Inch('lOpenH'),null,num(S.lOpenH)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('F · Jamb depth to the first obstruction',Inch('lDepth'),'Fascia or cassette needs 2¼"–2⅞" to sit inside; a crank or lock in the way means reverse roll or outside mount.')))
  :h(Row,{gutter:[18,0]},
    h(Col,{xs:24,md:8},Item('B · Outside width of frame',Inch('lB'),null,num(S.lB)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('Overlap each side',Inch('lOverlap'),'1½"–2" each side; more if the frame is out of square.')),
    h(Col,{xs:24,md:8},Item('Height covers',Sel('lHtTo',[['apron','To the bottom of the apron'],['sill','To the sill']]))),
    S.lHtTo==='sill'?h(Col,{xs:24,md:8},Item('I · Top of frame to sill',Inch('lI'),null,num(S.lI)==null?'Required.':null)):h(Col,{xs:24,md:8},Item('J · Top of frame to bottom of apron',Inch('lJ'),null,num(S.lJ)==null?'Required.':null)),
    h(Col,{xs:24,md:8},Item('Mounted above the frame',Inch('lAbove'),'Raises the roll off the glass.'))),
  CalcTable('Order width',W.rows,W.order), CalcTable('Order height',Hc.rows,Hc.order),
  Callout('rule','House rule','Inside mount: order the exact opening, smallest of three, and never deduct what the factory deducts (1¼" for a clutch, ⅝" of light each side; more for cordless and motors; cassettes, 6" valances and the Select family take an extra ⅛"). Outside mount: the bracket-to-bracket width you want.'),
  Nav('lcover','extras')]; }
const STEP_FN={lfabric:stepLFabric,loperator:stepLOperator,lcover:stepLCover,ttype:stepTType,tstyle:stepTStyle,tdetail:stepTDetail,rstyle:stepRStyle,rcontrol:stepRControl,rvalance:stepRValance,job:stepJob,product:stepProduct,header:stepHeader,fullness:stepFullness,hardware:stepHardware,measure:stepMeasure,draw:stepDraw,lining:stepLining,fabric:stepFabric,extras:stepExtras,order:stepOrder,price:stepPrice};

/* ---------- jobs (this browser) ---------- */
function loadJobs(){ try{return JSON.parse(localStorage.getItem('wo2-jobs')||'[]')}catch(e){return []} }
function saveJob(){ const jobs=loadJobs(); const W=widthCalc().order,H=heightCalc().order; jobs.unshift({client:S.client,project:S.project,room:S.room,windowId:S.windowId,spec:[S.header&&HEADERS[S.header].n,fullnessLabel(),S.lining].filter(Boolean).join(' · '),wh:`${W!=null?frac(W):'—'} × ${H!=null?frac(H):'—'}`,text:orderText(),state:{...S}}); try{localStorage.setItem('wo2-jobs',JSON.stringify(jobs.slice(0,40)));message.success('Saved in this browser')}catch(e){message.error('Could not save here')} forceRender(); }
function Jobs(){ const jobs=loadJobs(); if(!jobs.length) return null;
  return h(Card,{className:'jobs',title:h('span',{className:'sheet-t'},'Saved windows (this browser)')},h(Table,{size:'small',pagination:false,scroll:{x:700},dataSource:jobs.map((j,i)=>({key:i,...j})),columns:[
    {title:'Client · project',render:(v,j)=>[j.client,j.project].filter(Boolean).join(' · ')||'—'},{title:'Room · window',render:(v,j)=>[j.room,j.windowId].filter(Boolean).join(' · ')},{title:'Spec',dataIndex:'spec'},{title:'W × H',dataIndex:'wh',className:'num'},
    {title:'',render:(v,j,i)=>h(Space,null,h(Button,{size:'small',onClick:()=>{S={...DEFAULT,...j.state}; save(); forceRender(); go('order'); message.success('Window loaded')}},'Open'),h(Button,{size:'small',onClick:()=>copyText(j.text)},'Copy'),h(Button,{size:'small',danger:true,onClick:()=>{jobs.splice(i,1); try{localStorage.setItem('wo2-jobs',JSON.stringify(jobs))}catch(e){} forceRender();}},'Remove'))}]})); }

/* ---------- app ---------- */
function App(){
  const [,force]=useReducer(x=>x+1,0); forceRender=force;
  const [cur,setCur]=useState(()=>{ try{const s=localStorage.getItem('wo2-step'); if(s&&steps().some(x=>x[0]===s)) return s;}catch(e){} return 'job'; });
  goFn=id=>{ setCur(id); try{localStorage.setItem('wo2-step',id)}catch(e){} window.scrollTo({top:0}); };
  const [disp,setDispState]=useState(loadDisp); const [dispOpen,setDispOpen]=useState(false);
  const setDisp=p=>{ const d={...disp,...p}; setDispState(d); try{localStorage.setItem('dtw-display',JSON.stringify(d))}catch(e){} };
  const sysDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches; const dark=disp.theme==='dark'||(disp.theme==='auto'&&sysDark);
  const rootRef=React.useRef(null); useEffect(()=>{ const R=rootRef.current; if(!R) return; R.setAttribute('data-theme',dark?'dark':'light'); R.setAttribute('data-contrast',disp.contrast); R.style.setProperty('--lh',disp.lh); R.style.setProperty('--fs',disp.fs+'px'); R.style.fontFamily=FONTS[disp.font]; },[disp,dark]);
  const tok={...(dark?TOK.dark:TOK.light),borderRadius:4,fontFamily:FONTS[disp.font],fontSize:disp.fs,lineHeight:disp.lh,controlHeight:40,controlHeightLG:46,fontSizeHeading3:16};
  if(disp.contrast==='high'){ if(dark){tok.colorText='#fff';tok.colorTextSecondary='#F2F2F2';tok.colorBorder='#8A93A0';tok.colorBgLayout='#000';tok.colorBgContainer='#0E1116';} else {tok.colorText='#000';tok.colorTextSecondary='#111';tok.colorBorder='#8A93A0';tok.colorBgLayout='#fff';} }
  const screens=Grid.useBreakpoint(); const wide=screens.lg;
  const fl=flags(); const hard=fl.some(f=>f[2]!=='note'); const ready=stepStatus('order')==='done';
  const items=steps().map((s,i)=>{ const st=stepStatus(s[0]); return {title:s[1],status:s[0]===cur?'process':st==='done'?'finish':st==='warn'?'error':'wait'}; });
  const idx=steps().findIndex(s=>s[0]===cur);
  return h(ConfigProvider,{theme:{algorithm:dark?antTheme.darkAlgorithm:antTheme.defaultAlgorithm,token:tok,components:{Steps:{iconSize:28},Descriptions:{labelBg:dark?'#22344A':'#E3EDF7'}}}},
    h('div',{className:'wob',ref:rootRef},h('div',{className:'wrap'},
      h('header',{className:'mast'},h('div',null,h('h1',null,'Work ',h('em',null,'Order Builder')),h('p',{className:'sub'},'Walk one window from the measure sheet to a finished work order for our workroom, with the price. Drapery, side panels, roman shades and top treatments; every house rule and deduction is applied for you and written on the order.')),
        h('div',{className:'meta'},h('span',null,'Drapery · side panels · roman shades · top treatments'),h('span',null,'Alexander Matthews workroom'),h('span',null,'Draft for review'))),
      h(Row,{gutter:[24,24]},
        h(Col,{xs:24,lg:5},h('div',{className:'rail'},h(Steps,{direction:wide?'vertical':'horizontal',size:'small',current:idx,items,onChange:i=>go(steps()[i][0]),responsive:false,progressDot:!wide}),wide?h(Text,{type:'secondary',className:'tip'},'Green = complete. Red = something to fix. Click any step to jump. Nothing is sent anywhere: the finished work order is text you copy into Estimate Rocket or the job folder.'):null)),
        h(Col,{xs:24,lg:12},h(Card,{className:'step'},h(Tag,{className:'kicker'},'Step '+(idx+1)),h('h2',{className:'h2'},STEP_TITLE[cur]),h(Paragraph,{className:'lede'},STEP_LEDE[cur]),h(Form,{layout:'vertical',component:'div'},STEP_FN[cur]())), h(Jobs)),
        h(Col,{xs:24,lg:7},h('div',{className:'ordercol'},h(Card,{className:'order',title:h('span',{className:'order-t'},'Work order'),extra:h(Tag,{className:'st st-'+(hard?'warn':ready?'ok':'draft')},hard?'Flags to clear':ready?'Ready to send':'Draft')},
          h(Space,{wrap:true,className:'acts'},h(Button,{size:'small',type:'primary',onClick:()=>copyText(orderText())},'Copy order text'),h(Button,{size:'small',onClick:()=>{const keep={client:S.client,project:S.project}; S={...DEFAULT,...keep,hw:[{n:'',q:1,p:''}]}; save(); forceRender(); go('job'); message.success('New window');}},'New window (same client)'),h(Button,{size:'small',danger:true,onClick:()=>{S={...DEFAULT,hw:[{n:'',q:1,p:''}]}; save(); forceRender(); go('job'); message.success('Cleared');}},'Clear everything')),
          OrderDesc(orderLines(),1),
          fl.length?h('div',{className:'flags'},fl.map((f,i)=>h(Alert,{key:i,className:'flag',type:f[2]==='note'?'info':'error',showIcon:false,message:h('span',{className:'co-tag'},f[0]),description:f[1]}))):null,
)))),
      h(Button,{className:'dispbtn',type:'primary',shape:'round',onClick:()=>setDispOpen(true)},'Display'),
      h(Drawer,{title:'Display',open:dispOpen,onClose:()=>setDispOpen(false),width:320},
        h(Form,{layout:'vertical',component:'div'},
          h(Form.Item,{label:'Text size'},h(Slider,{min:14,max:24,step:1,value:disp.fs,onChange:v=>setDisp({fs:v})})),
          h(Form.Item,{label:'Line spacing'},h(Slider,{min:1.3,max:2,step:0.05,value:disp.lh,onChange:v=>setDisp({lh:v})})),
          h(Form.Item,{label:'Body font'},h(Select,{value:disp.font,onChange:v=>setDisp({font:v}),options:[{value:'source',label:'Source Sans'},{value:'inter',label:'Inter'},{value:'atkinson',label:'Atkinson Hyperlegible'}]})),
          h(Form.Item,{label:'Contrast'},h(Segmented,{block:true,value:disp.contrast,onChange:v=>setDisp({contrast:v}),options:[{value:'normal',label:'Normal'},{value:'high',label:'High'}]})),
          h(Form.Item,{label:'Theme'},h(Segmented,{block:true,value:disp.theme,onChange:v=>setDisp({theme:v}),options:[{value:'auto',label:'Auto'},{value:'light',label:'Light'},{value:'dark',label:'Dark'}]})),
          h(Button,{block:true,onClick:()=>setDisp({...DISP_DEF})},'Reset'))))));
}


export default App;

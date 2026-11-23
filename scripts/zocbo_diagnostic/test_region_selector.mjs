// Reproduce original ui.js regionFilter data-order switch with synthetic DOM.
// The JS code under test is emitted by the ACTUAL compiled Java class.
// No fake claims about contacting the original server or live regional HTML.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const sourceScan=fs.readFileSync(process.argv[2],'utf8');
const sourceClick=fs.readFileSync(process.argv[3],'utf8');

class Elem {
  constructor(tag,text,order,kind,parent=null) {
    this.tagName=tag;this.textContent=text;this.innerText=text;this.value=text;
    this.order=order;this.kind=kind;this.parent=parent;this.children=[];
    this.attrs={};if(order!==undefined)this.attrs['data-order']=order;
    this.active=(kind==='left'&&order==='02')||(kind==='panel'&&order==='02');
    this.classList={
      contains:(s)=>s==='is-active'&&this.active,
      add:(s)=>{if(s==='is-active')this.active=true;},
      remove:(s)=>{if(s==='is-active')this.active=false;}
    };
  }
  getAttribute(name){return this.attrs[name]??null;}
  closest(){return this;}
  contains(x){return this===x||this.children.includes(x);}
  querySelectorAll(){return this.children;}
  click(){
    if(this.kind==='left'){
      for(const el of left)el.active=(el===this);
      for(const p of panels)p.active=(p.order===this.order);
    }else if(this.kind==='whole'){
      selected.push(this.textContent);
    }else throw Error('unexpected click '+this.kind);
  }
}

const left=[
  new Elem('BUTTON','서울','01','left'),
  new Elem('BUTTON','대전','02','left'),
  new Elem('BUTTON','부산','03','left')
];
const panels=[
  new Elem('DIV','', '01','panel'),
  new Elem('DIV','', '02','panel'),
  new Elem('DIV','', '03','panel')
];
for(let i=0;i<left.length;i++){
  const all=new Elem('LI',left[i].textContent+' 전체',null,'whole',panels[i]);
  panels[i].children=[all,new Elem('LI','서구',null,'district',panels[i])];
}
const selected=[],events=[],errors=[];
const document={
  querySelectorAll:(selector)=>{
    if(selector==='.region .tab__button')return left;
    if(selector==='.region .tab__content')return panels;
    throw Error('unknown selector '+selector);
  },
  documentElement:{contains:()=>true}
};
const bridge={
  areaCandidates:(nonce,payload)=>{assert.equal(nonce,'test');events.push(JSON.parse(payload));},
  areaClick:(nonce,msg)=>{assert.equal(nonce,'test');events.push(msg);},
  areaError:(nonce,msg)=>{assert.equal(nonce,'test');errors.push(msg);}
};
const window={
  hitelCollectorNative:bridge,
  getComputedStyle:()=>({display:'block',visibility:'visible'})
};
const sandbox={document,window,setTimeout:(fn)=>fn(),console};
const scan=vm.runInNewContext(sourceScan,sandbox);
assert.match(scan,/mapped:3/);
assert.equal(events[0].length,3);
assert.equal(events[0][1].name,'대전');
assert.equal(events[0][1].order,'02');
const click=vm.runInNewContext(sourceClick,sandbox);
assert.match(click,/original-regionFilter-click:대전\/02/);
assert.deepEqual(selected,['대전 전체']);
assert.equal(left[1].active,true);
assert.equal(panels[1].active,true);
assert.deepEqual(errors,[]);
console.log('REGION_SELECTOR_ORIGINAL_UI_DATA_ORDER_TEST_OK',scan,click);

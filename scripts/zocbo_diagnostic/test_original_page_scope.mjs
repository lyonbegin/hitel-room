import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';

// Source-derived, sanitized server-rendered HTML fragment.
const htmlScript = [
  'jQuery(document).ready(function(){',
  'var SiteID = "H";',
  'var Grade = "1";',
  'var Subj_Code = "HI";',
  'var scl_id = "9113|9114|9117";',
  'var ExPapr_TestYear = "2022";',
  'var ExPapr_MidEndTerm = "2E";',
  'var filter_gugun = "0001";',
  'data_v = data_v + "&Rg_CitiesProvinces=" + "서울";',
  'data_v = data_v + "&Rg_District=" + "광진구            ";',
  '});'
].join('\n');
const document = {
  scripts:[{textContent:htmlScript}],
  querySelectorAll:(sel)=>{assert.match(sel,/download/);return [];}
};
const state={snapshot:null,error:null};
const sandbox={
  document,
  window:{
    location:{search:'?SiteID=H&Grade=1&ExPapr_TestYear=2022&ExPapr_MidEndTerm=2E&Subj_Code=HI&scl_id=9113%7C9114%7C9117&filter_gugun=0001'},
    hitelCollectorNative:{
      snapshot:(nonce,json)=>{assert.equal(nonce,'test');state.snapshot=JSON.parse(json);},
      snapshotError:(nonce,e)=>{state.error=e;}
    }
  },
  URLSearchParams
};
sandbox.location=sandbox.window.location;
const js=fs.readFileSync(process.argv[2],'utf8');
const result=vm.runInNewContext(js,sandbox);
console.log('ORIGINAL_PAGE_SNAPSHOT_RETURN',result,'data',state.snapshot,'error',state.error);
assert.equal(state.error,null);
assert.ok(state.snapshot,'JS must have delivered snapshot');
for(const [k,v] of Object.entries({
  site:'H',grade:'1',year:'2022',term:'2E',subject:'HI',
  schools:'9113|9114|9117',city:'서울',district:'광진구            ',filter:'0001'
}))assert.equal(state.snapshot[k],v,'Source inline capture field '+k);
console.log('ORIGINAL_PREVIOUSEXAM_SCOPE_EXTRACTION_TEST_OK');

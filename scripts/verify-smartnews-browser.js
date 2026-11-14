let chromium;
try { ({chromium}=require('playwright')); } catch {
 ({chromium}=require('/Users/uchida/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
}
const path=require('node:path');
const sdkPath=process.argv[2];
if (!sdkPath) throw new Error('Pass a downloaded official pixel.js path; all browser requests are intercepted.');
const fs=require('node:fs'), assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
 for(const blockSdk of [false,true]) {
 const context=await browser.newContext({serviceWorkers:'block'}), requests=[], errors=[];
 await context.route('**/*', route=>{
  const u=new URL(route.request().url()); requests.push(u);
  if(u.hostname==='promo.import-language.com' && route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8')});
  if(u.href==='https://cdn.smartnews-ads.com/i/pixel.js' && !blockSdk)return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(sdkPath,'utf8')});
  return route.abort();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://promo.import-language.com/?snuuid=fixture-smartnews-uuid&utm_source=smartnews&utm_medium=cpc',{waitUntil:'networkidle'});
 await page.waitForTimeout(1200);
 assert.equal(requests.filter(u=>u.hostname==='cdn.smartnews-ads.com').length,1);
 const events=requests.filter(u=>u.hostname==='i.smartnews-ads.com');
 if(!blockSdk) {
  assert.equal(events.length,1);
  assert.equal(events[0].searchParams.get('id'),'ea7ac8b73db4d3663fc7db75');
  assert.equal(events[0].searchParams.get('e'),'PageView');
  assert.equal(events[0].searchParams.get('uuid'),'fixture-smartnews-uuid');
  const cookies=await context.cookies('https://www.import-language.com');
  assert(cookies.some(c=>c.value==='fixture-smartnews-uuid' && c.domain==='.import-language.com'));
 }
 const before=requests.length;
 await page.evaluate(()=>{ const link=document.querySelector('[data-purchase-cta]'); link.addEventListener('click',e=>e.preventDefault(),{capture:true}); link.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})); });
 await page.waitForTimeout(100);
 assert.equal(requests.slice(before).filter(u=>u.hostname.endsWith('smartnews-ads.com')).length,0);
 const counts=await page.evaluate(()=>({ga:window.dataLayer.filter(x=>x[0]==='config').length,meta:window.fbq.queue.filter(x=>x[0]==='track'&&x[1]==='PageView').length,ctas:document.querySelectorAll('[data-purchase-cta]').length}));
 assert.deepEqual(counts,{ga:1,meta:1,ctas:6});assert.deepEqual(errors,[]);
 console.log('PASS',blockSdk?'SDK blocked: existing analytics and CTA intact':'Official SDK offline: one PageView, shared root cookie, no CTA event');
 await context.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

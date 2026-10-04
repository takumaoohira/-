// 実際のゲーム画面を連続撮影して動画にする。ソフトウェア描画のため実時間では撮れないので、
// ゲーム内の時間を1コマ 1/12 秒ずつ進め（徒歩は速歩 2.5 m/s 相当で経路に沿って移動、飛行は flyStep で操作入力を与える）、12fps の動画にする。
import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';import http from 'http';import path from 'path';
const root='/home/user/-/tokyo-skytree';
const srv=http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);r.end();return;}const ext=path.extname(f);r.writeHead(200,{'Content-Type':{'.html':'text/html','.json':'application/json','.jpg':'image/jpeg','.txt':'text/plain'}[ext]||'application/octet-stream'});r.end(d);});}).listen(8766);
const mode=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:Number(process.env.DSF||0.5)});page.setDefaultTimeout(600000);
await page.addInitScript(q=>{try{localStorage.setItem('skytree_quality',q)}catch(e){}},process.env.Q||'standard');
await page.route('**/three.min.js',r=>r.fulfill({body:fs.readFileSync('three.min.js'),contentType:'application/javascript'}));
await page.route('https://fonts.googleapis.com/**',r=>r.abort());
page.on('pageerror',e=>console.log('PAGEERROR',e.message));
await page.goto('http://localhost:8766/index.html');
await page.waitForFunction(()=>window.__SKY&&!document.getElementById('go').disabled,{timeout:600000});
await page.evaluate(()=>{__SKY.start();__SKY.setTime(15.5);});await page.waitForTimeout(1500);
await page.evaluate(()=>{document.getElementById('keys').style.display='none';const st=document.createElement('style');st.textContent='#poi,#toast{display:none!important}';document.head.appendChild(st);});
let n=Number(process.env.OFFSET||0);const SKIPTO=process.env.SKIPTO||'';let skipping=!!SKIPTO;const shot=async()=>{await page.screenshot({path:`${out}/f${String(n++).padStart(5,'0')}.jpg`,type:'jpeg',quality:82});};
if(mode==='walk'){
  // 経路：タワー南側（ソラマチ）→ 浅草通り → 吾妻橋 → 西詰。ゲームの経路網 routeTo で求めた節点をたどる
  const pts=await page.evaluate(()=>{const S=__SKY,N=S.NODES;const ids=Object.keys(N).filter(k=>/^ra\d+$/.test(k)).sort((a,b)=>+a.slice(2)-+b.slice(2));return ['ty_s','s_w',...ids].map(k=>[N[k].x,N[k].y,N[k].z]);});
  const seg=[];for(let i=0;i<pts.length-1;i++)seg.push(Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][2]-pts[i][2]));const L=seg.reduce((a,b)=>a+b,0);
  const step=Number(process.env.STEP||2.5)/12*Number(process.env.SKIP||8);   // 1コマあたりの移動量（SKIP コマ分をまとめて進める）
  let s=0,yaw=null;while(s<L){let i=0,a=s;while(i<seg.length-1&&a>seg[i]){a-=seg[i];i++;}const t=Math.min(1,a/seg[i]),A=pts[i],B=pts[i+1];
    const x=A[0]+(B[0]-A[0])*t,z=A[2]+(B[2]-A[2])*t;let look=Math.atan2(B[0]-A[0],-(B[2]-A[2]))*180/Math.PI;if(yaw==null)yaw=look;let d=((look-yaw+540)%360)-180;yaw+=d*0.25;
    await page.evaluate(([x,z,yaw,dt])=>{__SKY.teleport(x,0.5,z,yaw,0.04);},[x,z,yaw,Number(process.env.SKIP||8)/12]);await shot();s+=step;}
}else{
  // 飛行：上昇 → 回廊の高さで屋上・塔を観察 → 西へ高速移動 → アサヒビール本社付近へ降下 → 着地
  // [名前, コマ数, 押すキー, 速度段階, 向き(度・null で変えない), 俯角]
  const plan=[['lift',20,{Space:1},1,330,-0.45],['roofs',12,{KeyW:1},1,330,-0.5],['climb',26,{Space:1},2,330,-0.3],['west',34,{KeyW:1},2,270,-0.3],
    ['desc',30,{KeyC:1},2,270,-0.35],['look',10,{KeyW:1},0,250,-0.15],['toland',14,{KeyW:1},1,75,-0.2],['land',18,'land',0,null,-0.1]];
  await page.evaluate(()=>{__SKY.flyToggle();});
  for(const [name,frames,keys,mode,yaw,pitch] of plan){
    // キーは flySim の間だけ押す（撮影待ちの間にゲーム本体のループで余計に進まないように）
    await page.evaluate(([keys,mode,yaw,pitch])=>{const K=__SKY.keys;for(const k in K)K[k]=false;__SKY.P.pitch=pitch;if(yaw!=null)__SKY.P.yaw=yaw*Math.PI/180;__SKY.FLY.mode=mode;if(keys==='land')__SKY.flyToggle();},[keys,mode,yaw,pitch]);
    if(name===SKIPTO)skipping=false;
    for(let f=0;f<frames;f++){await page.evaluate((keys)=>{const K=__SKY.keys;if(keys!=='land')for(const k in keys)K[k]=true;__SKY.flySim(8,1/24);for(const k in K)K[k]=false;},keys);if(!skipping)await shot();}}
  console.log(await page.evaluate(()=>JSON.stringify([__SKY.P.x,__SKY.P.y,__SKY.P.z,__SKY.FLY.on,__SKY.P.fname])));
}
console.log('frames',n);await browser.close();srv.close();

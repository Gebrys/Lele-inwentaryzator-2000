const KEY='inwentaryzator-pwa-v3';
let data=[];try{let old=JSON.parse(localStorage.getItem(KEY)||'null');if(Array.isArray(old))data=old;else {let v1=JSON.parse(localStorage.getItem('inwentaryzator-pwa-v1')||'{}');data=Object.entries(v1).map(([ean,qty])=>({ean,qty:Number(qty)||1,id:Date.now()+Math.random()}));}}catch(e){}
let stream=null,reader=null,scanActive=false,torchOn=false,lastScanned='',lastScanAt=0,undoStack=[],scanLoopTimer=null,rotScanBusy=false;
const $=id=>document.getElementById(id);function snapshot(){undoStack.push(JSON.stringify(data));if(undoStack.length>50)undoStack.shift();$('undoBtn').disabled=false}
window.undo=function(){if(!undoStack.length){toast('Brak zmian do cofnięcia');return}data=JSON.parse(undoStack.pop());save();$('undoBtn').disabled=!undoStack.length;toast('Cofnięto ostatnią zmianę')};
function save(){localStorage.setItem(KEY,JSON.stringify(data));render()}
function render(){let filter=($('searchInput')?.value||'').trim();let visible=data.map((x,i)=>({...x,_i:i})).filter(x=>!filter||x.ean.includes(filter)).reverse();$('itemsCount').textContent=data.length;$('totalQty').textContent=data.reduce((s,x)=>s+(Number(x.qty)||0),0);$('inventory').innerHTML=visible.length?visible.map(x=>`<div class="item"><div class="info"><div class="ean">${escapeHtml(x.ean)}</div><div class="small">EAN · wpis ${x._i+1}</div></div><div class="qty"><button class="secondary qtyBtn" onclick="change(${x._i},-1)">−</button><input class="qtyInput" type="number" min="1" inputmode="numeric" value="${Number(x.qty)||1}" aria-label="Ilość ${escapeHtml(x.ean)}" onchange="setQty(${x._i},this.value)"/><button class="qtyBtn" onclick="change(${x._i},1)">+</button><button class="danger qtyBtn" onclick="removeItem(${x._i})">×</button></div></div>`).join(''):'<div class="empty">'+(filter?'Brak wyników.':'Spis jest pusty. Zeskanuj pierwszy produkt.')+'</div>'}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
window.change=function(i,n){snapshot();data[i].qty=Math.max(1,(Number(data[i].qty)||1)+n);save()};window.setQty=function(i,v){let n=parseInt(v,10);if(!Number.isFinite(n)||n<1)n=1;if(n!==Number(data[i].qty))snapshot();data[i].qty=n;save()};window.removeItem=function(i){snapshot();data.splice(i,1);save()};
function beep(){try{let c=new(window.AudioContext||window.webkitAudioContext)(),o=c.createOscillator(),g=c.createGain();o.frequency.value=1050;g.gain.value=.07;o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+.075)}catch(e){}}
function haptic(){try{if(navigator.vibrate)navigator.vibrate(45)}catch(e){}}
function toast(t){let x=$('toast');x.textContent=t;x.classList.add('show');setTimeout(()=>x.classList.remove('show'),1800)}
function confirmScan(code){let el=$('scanConfirm');el.textContent='✓ DODANO '+code;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),750)}
function add(code){code=(code||'').trim().replace(/\s/g,'');if(!code){toast('Wpisz kod EAN');return}snapshot();data.push({ean:code,qty:1,id:Date.now()+Math.random()});save();beep();haptic();toast('Dodano '+code);confirmScan(code);$('eanInput').value='';}
$('addEan').onclick=()=>add($('eanInput').value);$('eanInput').addEventListener('keydown',e=>{if(e.key==='Enter')add(e.target.value)});$('searchInput').addEventListener('input',render);
async function loadZXing(){if(window.ZXingBrowser)return;await loadScript('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/zxing-browser.min.js');}
function loadScript(url){return new Promise((res,rej)=>{let s=document.createElement('script');s.src=url;s.onload=res;s.onerror=()=>rej(new Error('Nie udało się pobrać biblioteki skanera'));document.head.appendChild(s)})}
async function start(){if(scanActive)return;scanActive=true;$('scanStatus').textContent='Uruchamianie aparatu…';$('video').style.display='block';$('scanOverlay').classList.add('active');$('torchBtn').classList.remove('hide');try{if(!navigator.mediaDevices?.getUserMedia)throw new Error('Ta przeglądarka nie obsługuje kamery');stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:30, max:60}},audio:false});$('video').srcObject=stream;await $('video').play();let track=stream.getVideoTracks()[0],caps=track.getCapabilities?.()||{};try{let adv=[];if(caps.focusMode&&caps.focusMode.includes('continuous'))adv.push({focusMode:'continuous'});if(caps.exposureMode&&caps.exposureMode.includes('continuous'))adv.push({exposureMode:'continuous'});if(caps.whiteBalanceMode&&caps.whiteBalanceMode.includes('continuous'))adv.push({whiteBalanceMode:'continuous'});if(caps.zoom)adv.push({zoom:Math.min(caps.zoom.max,Math.max(caps.zoom.min,1.5))});if(adv.length)await track.applyConstraints({advanced:adv});}catch(e){}$('torchBtn').disabled=!caps.torch;$('torchBtn').textContent=caps.torch?'💡 Latarka':'💡 Latarka (niedostępna)';await loadZXing();let hints=new Map();try{let H=ZXingBrowser.DecodeHintType,F=ZXingBrowser.BarcodeFormat;if(H?.TRY_HARDER)hints.set(H.TRY_HARDER,true);if(H?.ALSO_INVERTED)hints.set(H.ALSO_INVERTED,true);if(H?.PURE_BARCODE)hints.set(H.PURE_BARCODE,false);if(H?.POSSIBLE_FORMATS&&F)hints.set(H.POSSIBLE_FORMATS,[F.EAN_13,F.EAN_8,F.UPC_A,F.UPC_E,F.CODE_128,F.CODE_39,F.ITF]);if(H?.CHARACTER_SET)hints.set(H.CHARACTER_SET,'UTF-8');}catch(e){}reader=new ZXingBrowser.BrowserMultiFormatReader(hints);$('scanStatus').textContent='Kamera aktywna — kieruj na kod';startRotatedFrameScan();}catch(e){scanActive=false;$('scanOverlay').classList.remove('active');$('torchBtn').classList.add('hide');$('scanStatus').textContent='Skanowanie niedostępne. Wpisz EAN ręcznie. ('+e.message+')';toast('Nie udało się uruchomić skanera')}}
async function startRotatedFrameScan(){
  const video=$('video');
  const orientations=[0,90,270,180];
  const canvases=orientations.map(()=>document.createElement('canvas'));
  const enhanced=orientations.map(()=>document.createElement('canvas'));
  function drawRotation(canvas,angle){
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    if(angle===0){canvas.width=video.videoWidth;canvas.height=video.videoHeight;ctx.drawImage(video,0,0,canvas.width,canvas.height)}
    else{canvas.width=video.videoHeight;canvas.height=video.videoWidth;ctx.save();ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(angle*Math.PI/180);ctx.drawImage(video,-video.videoWidth/2,-video.videoHeight/2);ctx.restore()}
  }
  function makeEnhanced(source,target){
    // Upscale and locally emphasize contrast to make small, low-contrast bars easier to decode.
    const scale=1.65;target.width=Math.round(source.width*scale);target.height=Math.round(source.height*scale);
    const c=target.getContext('2d',{willReadFrequently:true});c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(source,0,0,target.width,target.height);
    const im=c.getImageData(0,0,target.width,target.height),d=im.data;
    for(let i=0;i<d.length;i+=4){let y=(.299*d[i]+.587*d[i+1]+.114*d[i+2]);y=(y-128)*1.55+128;y=Math.max(0,Math.min(255,y));d[i]=d[i+1]=d[i+2]=y;}
    c.putImageData(im,0,0);
  }
  async function tryDecode(canvas){try{return await reader.decodeFromCanvas(canvas)}catch(e){return null}}
  async function scanFrame(){
    if(!scanActive||rotScanBusy)return;
    if(video.readyState<2||!video.videoWidth){scanLoopTimer=setTimeout(scanFrame,120);return}
    rotScanBusy=true;
    try{
      for(let i=0;i<orientations.length&&scanActive;i++){
        const angle=orientations[i],canvas=canvases[i];drawRotation(canvas,angle);
        // Fast first pass on the original frame.
        let result=await tryDecode(canvas);
        // Extra sensitivity pass: enlarged grayscale/contrast image, only if the first pass fails.
        if(!result&&scanActive){makeEnhanced(canvas,enhanced[i]);result=await tryDecode(enhanced[i]);}
        if(result&&scanActive){const code=result.getText(),now=Date.now();if(code!==lastScanned||now-lastScanAt>1800){lastScanned=code;lastScanAt=now;add(code)}break}
      }
    }finally{rotScanBusy=false;if(scanActive)scanLoopTimer=setTimeout(scanFrame,60)}
  }
  scanFrame();
}
async function toggleTorch(){if(!stream)return;let track=stream.getVideoTracks()[0];try{await track.applyConstraints({advanced:[{torch:!torchOn}]});torchOn=!torchOn;$('torchBtn').textContent=torchOn?'🔦 Latarka ON':'💡 Latarka';}catch(e){toast('Latarka niedostępna w tej przeglądarce')}}
function stop(){scanActive=false;torchOn=false;if(scanLoopTimer){clearTimeout(scanLoopTimer);scanLoopTimer=null}if(reader&&reader.stop)try{reader.stop()}catch(e){}if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}$('video').srcObject=null;$('video').style.display='none';$('scanOverlay').classList.remove('active');$('torchBtn').classList.add('hide');$('scanStatus').textContent='Skanowanie zatrzymane'}
$('startScan').onclick=start;$('stopScan').onclick=stop;$('torchBtn').onclick=toggleTorch;$('export').onclick=exportCSV;
function exportCSV(){let filename=prompt('Podaj nazwę pliku CSV:','inwentaryzacja');if(filename===null)return;filename=filename.trim()||'inwentaryzacja';filename=filename.replace(/[\\/:*?"<>|]/g,'_');let rows=[['EAN','Ilość'],...data.map(x=>[x.ean,x.qty])];if(rows.length===1){toast('Spis jest pusty');return}let csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');let blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename.toLowerCase().endsWith('.csv')?filename:filename+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Plik CSV zapisany')}
$('share').onclick=async()=>{let txt=data.map(x=>x.ean+';'+x.qty).join('\n');if(navigator.share){try{await navigator.share({title:'Inwentaryzacja',text:txt})}catch(e){}}else{try{await navigator.clipboard.writeText(txt);toast('Spis skopiowany do schowka')}catch(e){toast('Udostępnianie niedostępne')}}};
$('backup').onclick=()=>{if(!data.length){toast('Spis jest pusty');return}let name=prompt('Nazwa kopii zapasowej:','backup-inwentaryzacji');if(name===null)return;let blob=new Blob([JSON.stringify({version:3,created:new Date().toISOString(),items:data},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(name.trim()||'backup-inwentaryzacji')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Kopia zapasowa pobrana')};
$('restore').onclick=()=> $('backupFile').click();$('backupFile').onchange=async e=>{let f=e.target.files?.[0];if(!f)return;try{let obj=JSON.parse(await f.text()),items=Array.isArray(obj)?obj:obj.items;if(!Array.isArray(items))throw new Error('Nieprawidłowy plik');if(!confirm(`Wczytać ${items.length} pozycji? Zastąpi to obecny spis.`))return;snapshot();data=items.map(x=>({ean:String(x.ean||''),qty:Math.max(1,Number(x.qty)||1),id:x.id||Date.now()+Math.random()})).filter(x=>x.ean);save();toast('Backup wczytany')}catch(err){toast('Nie udało się wczytać kopii')}e.target.value=''};
$('clear').onclick=()=>{if(confirm('Czy na pewno usunąć cały spis?')){snapshot();data=[];save();toast('Spis wyczyszczony')}};$('undoBtn').onclick=undo;
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));render();

// Easter egg: 5 rapid taps on total quantity
let eggTapTimes=[];function triggerEgg(){let now=Date.now();eggTapTimes=eggTapTimes.filter(t=>now-t<1800);eggTapTimes.push(now);if(eggTapTimes.length>=5){eggTapTimes=[];$('eggModal').classList.add('show');setTimeout(()=> $('eggModal').classList.remove('show'),5000)}}$('totalQty').addEventListener('click',triggerEgg);$('eggClose').onclick=()=> $('eggModal').classList.remove('show');$('eggModal').addEventListener('click',e=>{if(e.target===$('eggModal'))$('eggModal').classList.remove('show')});

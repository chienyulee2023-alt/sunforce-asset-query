const $ = (id) => document.getElementById(id);
let data = [];
let excelLoaded = false;

const IMAGE_FILES = [
  "A305-AR-727-ESR1121.jpg",
  "A305-AR-829E.jpg",
  "A308-BBA31.jpg",
  "C106-OPT1-DB9.jpg",
  "S209-ADAM-5056S.jpg"
];

const extMap = new Map();
IMAGE_FILES.forEach(fn => {
  const base = fn.replace(/\.[^.]+$/, '');
  extMap.set(base.trim().toLowerCase(), fn);
});

function safeImagePath(filename){
  return 'images/' + String(filename).split('/').map(encodeURIComponent).join('/');
}

function imageCandidates(code){
  const raw = String(code || '').trim();
  if(!raw) return [];
  const mapped = extMap.get(raw.toLowerCase());
  const list = mapped
    ? [mapped]
    : [
        raw + '.jpg',
        raw + '.jpeg',
        raw + '.png',
        raw + '.webp',
        raw + '.gif',
        raw + '.JPG',
        raw + '.JPEG',
        raw + '.PNG',
        raw + '.WEBP'
      ];
  return list.map(safeImagePath);
}

function imageHtml(code, name){
  const candidates = imageCandidates(code);
  if(!candidates.length) return '<span class="noimg">無產品圖片</span>';
  const encoded = candidates.map(x => x.replace(/"/g, '&quot;')).join('|');
  const safeName = escapeHtml(name);
  return `<img class="zoomable-img" src="${candidates[0]}" data-img-list="${encoded}" data-img-index="0" alt="${safeName}" title="點擊放大查看" onclick="openImageViewer(this)" onerror="tryNextImage(this)">`;
}

function tryNextImage(img){
  const list = (img.dataset.imgList || '').split('|').filter(Boolean);
  let idx = Number(img.dataset.imgIndex || 0) + 1;
  if(idx < list.length){
    img.dataset.imgIndex = String(idx);
    img.src = list[idx];
    return;
  }
  img.parentNode.innerHTML = '<span class="noimg">無產品圖片</span>';
}

function num(v){
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(String(v).replace(/,/g,'').trim());
  return Number.isFinite(n) ? n : 0;
}

function fmt(v){
  const n = num(v);
  return Number.isFinite(n) ? n.toLocaleString('zh-TW') : (v || '0');
}

function typeClass(v){ return String(v).includes('資產') ? 'asset' : ''; }

function escapeHtml(s){ 
  return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); 
}

const RECORD_STORAGE_KEY = 'sunforce_borrow_records_v1';

function yyyymmdd(dateStr){
  return String(dateStr || '').replace(/-/g, '');
}

function getBorrowRecords(){
  try{
    return JSON.parse(localStorage.getItem(RECORD_STORAGE_KEY) || '[]');
  }catch(e){
    return [];
  }
}

function saveBorrowRecords(records){
  localStorage.setItem(RECORD_STORAGE_KEY, JSON.stringify(records));
}

function nextBorrowNo(dateStr){
  const day = yyyymmdd(dateStr);
  const records = getBorrowRecords();
  const maxSeq = records
    .filter(r => String(r.borrowNo || '').startsWith(day))
    .map(r => Number(String(r.borrowNo || '').slice(8)))
    .filter(n => Number.isFinite(n))
    .reduce((a,b) => Math.max(a,b), 0);
  return day + String(maxSeq + 1).padStart(2, '0');
}

function refreshBorrowNo(){
  const date = $('borrowDate')?.value || new Date().toISOString().slice(0,10);
  if($('borrowNo')) $('borrowNo').value = nextBorrowNo(date);
}

function csvEscape(v){
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadFile(filename, content, mimeType){
  const blob = new Blob([content], {type: mimeType || 'text/plain;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildSlipHtml(record){
  return `<section class="export-sheet">
    <div class="export-head">
      <img src="logo.jpg" class="export-logo" alt="SunForce">
      <div class="export-title">晟福科技 借用/領用單據</div>
    </div>
    <table class="export-table">
      <tr><td>單號</td><td>${escapeHtml(record.borrowNo)}</td><td>歸還狀態</td><td>${escapeHtml(record.returnType)}</td></tr>
      <tr><td>工號</td><td>${escapeHtml(record.empNo)}</td><td>姓名</td><td>${escapeHtml(record.empName)}</td></tr>
      <tr><td>借用日期</td><td>${escapeHtml(record.borrowDate)}</td><td>物料類別</td><td>${escapeHtml(record.material)}</td></tr>
      <tr><td>用途類型</td><td colspan="3">${escapeHtml(record.purposeType || '')}</td></tr>
      <tr><td>產品標號</td><td colspan="3">${escapeHtml(record.code)}</td></tr>
      <tr><td>品名</td><td colspan="3">${escapeHtml(record.name)}</td></tr>
      <tr><td>借用數量</td><td>${escapeHtml(record.qty)}</td><td>存放位置</td><td>${escapeHtml(record.location)}</td></tr>
      <tr><td>用途說明／備註</td><td colspan="3" class="note-cell">${escapeHtml(record.note)}</td></tr>
    </table>
    <div class="export-sign"><div>申請人</div><div>倉管／管理人</div><div>主管核准</div></div>
  </section>`;
}

function exportSlipsHtml(records){
  const slips = records.map(buildSlipHtml).join('');
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>晟福科技 借用領用單據</title>
  <style>
    body{font-family:"Microsoft JhengHei",Arial,sans-serif;color:#000;background:#f4f4f4;margin:0;padding:24px;}
    .export-sheet{width:190mm;min-height:250mm;margin:0 auto 18px;background:#fff;border:2px solid #000;padding:10mm;box-sizing:border-box;page-break-after:always;}
    .export-head{display:flex;align-items:center;gap:18px;margin-bottom:12px;}
    .export-logo{width:220px;max-height:80px;object-fit:contain;}
    .export-title{flex:1;text-align:center;font-size:24px;font-weight:800;}
    .export-table{width:100%;border-collapse:collapse;font-size:15px;}
    .export-table td{border:1px solid #000;padding:9px;height:36px;vertical-align:middle;}
    .export-table td:nth-child(odd){width:22%;font-weight:800;background:#f2f2f2;text-align:center;}
    .note-cell{height:80px!important;vertical-align:top!important;}
    .export-sign{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:42px;}
    .export-sign div{border-top:1px solid #000;padding-top:8px;text-align:center;}
    @media print{body{background:#fff;padding:0}.export-sheet{margin:0 auto;border:2px solid #000;page-break-after:always}}
  </style></head><body>${slips}</body></html>`;
}

function exportBorrowRecords(){
  // 若目前借用表單已填完整，先自動寫入紀錄，避免匯出時只有空白。
  if($('modal')?.classList.contains('show') && $('borrowCode')?.value && $('empNo')?.value.trim() && $('empName')?.value.trim() && $('borrowDate')?.value && $('borrowQty')?.value){
    const item = window.selectedItem || {};
    if(Number($('borrowQty').value) <= num(item.qty)){
      saveBorrowRecord(buildBorrowRecord());
    }
  }

  const records = getBorrowRecords();
  if(!records.length){
    alert('目前還沒有借用/領用紀錄。請先填寫單據並列印，或在表單填完整後再匯出。');
    return;
  }

  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const html = exportSlipsHtml(records);
  downloadFile(`晟福科技_借用領用單據_${today}.xls`, '\ufeff' + html, 'application/vnd.ms-excel;charset=utf-8;');
}



function pick(row, names){
  for(const name of names){
    if(row[name] !== undefined && row[name] !== null && row[name] !== '') return row[name];
  }
  return '';
}

function normalizeRow(row){
  const code = pick(row, ['產品標號','產品編號','產品料號','料號','標號','品號','資產編號','Code','code']);
  const name = pick(row, ['品名','產品名稱','名稱','品名規格','規格','Name','name']);
  const qty = pick(row, ['實盤','現有數量','庫存數量','數量','實際數量','盤點數量','Qty','qty']);
  const location = pick(row, ['存放位置','位置','存放的地方','庫位','Location','location']);
  let material = pick(row, ['物料欄位','物料類別','物料','類別','分類','庫存或資產','庫存/資產','Material','material']);
  if(!material) material = String(code).trim() ? '庫存' : '';
  return {
    material: String(material || '').trim(),
    code: String(code || '').trim(),
    name: String(name || '').trim(),
    qty: qty,
    location: String(location || '').trim(),
    raw: row
  };
}




function worksheetToObjects(workbook){
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet, {defval: '', raw: false});
}

function applyRows(rows, sourceLabel){
  const box = $('results');
  data = (rows || []).map(normalizeRow).filter(x => x.code || x.name);

  $('totalCount').textContent = data.length.toLocaleString('zh-TW');
  $('resultCount').textContent = '0';
  $('availableCount').textContent = data.filter(x => num(x.qty) > 0).length.toLocaleString('zh-TW');

  const src = $('dataSource');
  if(src) src.textContent = sourceLabel || '目前資料來源：data.xlsx';

  if(!data.length){
    box.innerHTML = `<div class="empty">data.xlsx 已讀取，但沒有可顯示資料。<br><br>
    請確認 Excel 第一列有欄位名稱，例如：物料、產品編號、品名、實盤、存放位置。</div>`;
    return;
  }

  render();
}

async function loadExcel(){
  const box = $('results');
  box.innerHTML = '<div class="empty">正在讀取 data.xlsx，請稍候...</div>';

  if(typeof XLSX === 'undefined'){
    box.innerHTML = `<div class="empty">無法載入 Excel 讀取元件。<br><br>
    請確認電腦可連上網路，或稍後重新整理頁面。</div>`;
    return;
  }

  try{
    const res = await fetch('data.xlsx?ts=' + Date.now(), {cache: 'no-store'});
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const arrayBuffer = await res.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {type: 'array'});
    const rows = worksheetToObjects(workbook);
    excelLoaded = true;
    applyRows(rows, '目前資料來源：data.xlsx');
  }catch(err){
    console.error(err);
    const fallback = Array.isArray(window.EMBEDDED_INVENTORY_DATA) ? window.EMBEDDED_INVENTORY_DATA : [];
    if(fallback.length){
      applyRows(fallback, '目前資料來源：備援內建資料');
    }else{
      box.innerHTML = `<div class="empty">無法讀取 data.xlsx。<br><br>
      請確認 data.xlsx 與 index.html 放在同一層，並用 Netlify / 網頁伺服器開啟，不要直接用檔案方式開啟 index.html。</div>`;
    }
  }
}

function handleLocalExcelFile(file){
  if(!file) return;
  if(typeof XLSX === 'undefined'){
    alert('Excel 讀取元件尚未載入，請重新整理頁面後再試。');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const workbook = XLSX.read(e.target.result, {type:'array'});
      const rows = worksheetToObjects(workbook);
      applyRows(rows, '目前資料來源：手動選取的 Excel（未上傳到網站）');
      $('keyword').value = '';
      render();
    }catch(err){
      console.error(err);
      alert('Excel 讀取失敗，請確認檔案格式是 .xlsx。');
    }
  };
  reader.readAsArrayBuffer(file);
}


$('keyword').addEventListener('input', render);
$('clearBtn').addEventListener('click', () => { $('keyword').value=''; render(); $('keyword').focus(); });
if($('excelFile')) $('excelFile').addEventListener('change', (e) => handleLocalExcelFile(e.target.files[0]));

function render(){
  const kw = $('keyword').value.trim().toLowerCase();
  const box = $('results');

  if(!data.length){
    $('resultCount').textContent = '0';
    $('availableCount').textContent = '0';
    $('queryText').textContent = '尚未讀取資料';
    return;
  }

  if(!kw){
    $('resultCount').textContent = '0';
    $('availableCount').textContent = data.filter(x => num(x.qty) > 0).length.toLocaleString('zh-TW');
    $('queryText').textContent = '請先輸入關鍵字';
    box.innerHTML = '<div class="empty">請輸入產品標號或品名開始查詢 ✨</div>';
    return;
  }

  const terms = kw.split(/\s+/).filter(Boolean);
  const results = data.filter(item => {
    const hay = `${item.code} ${item.name} ${item.location} ${item.material}`.toLowerCase();
    return terms.every(t => hay.includes(t));
  }).slice(0, 120);

  $('resultCount').textContent = results.length.toLocaleString('zh-TW');
  $('availableCount').textContent = results.filter(x => num(x.qty) > 0).length.toLocaleString('zh-TW');
  $('queryText').textContent = `關鍵字：「${$('keyword').value.trim()}」`;

  if(!results.length){
    box.innerHTML = '<div class="empty">查無相關資料，請換其他關鍵字試試。</div>';
    return;
  }

  box.innerHTML = results.map((item, idx) => {
    const available = num(item.qty) > 0;
    return `<article class="card">
      <div class="photo">${imageHtml(item.code, item.name)}</div>
      <div class="body">
        <span class="tag ${typeClass(item.material)}">${escapeHtml(item.material || '未標示')}</span>
        <div class="code">${escapeHtml(item.code)}</div>
        <div class="name">${escapeHtml(item.name)}</div>
        <div class="info">
          <div><span>現有數量｜實盤</span><b>${fmt(item.qty)}</b></div>
          <div><span>存放位置</span><b>${escapeHtml(item.location || '未填寫')}</b></div>
        </div>
        <button class="borrow" ${available ? '' : 'disabled'} onclick="openBorrow(${idx})">${available ? '📝 填寫單據列印' : '無實盤數量'}</button>
      </div>
    </article>`;
  }).join('');

  window.currentResults = results;
}

function openBorrow(index){
  const item = window.currentResults[index];
  window.selectedItem = item;
  $('borrowCode').value = item.code || '';
  $('borrowName').value = item.name || '';
  $('borrowQty').value = 1;
  $('borrowQty').max = Math.max(1, Math.floor(num(item.qty)));
  $('borrowDate').valueAsDate = new Date();
  refreshBorrowNo();
  $('borrowLocation').value = item.location || '';
  $('borrowMaterial').value = item.material || '';
  $('modal').classList.add('show');
  $('modal').setAttribute('aria-hidden','false');
}

$('closeModal').onclick = closeModal;
$('modal').addEventListener('click', e => { if(e.target.id === 'modal') closeModal(); });

function closeModal(){
  $('modal').classList.remove('show');
  $('modal').setAttribute('aria-hidden','true');
}

if($('borrowDate')) $('borrowDate').addEventListener('change', refreshBorrowNo);
if($('exportRecordsBtn')) $('exportRecordsBtn').addEventListener('click', exportBorrowRecords);

function buildBorrowRecord(){
  return {
    borrowNo: $('borrowNo').value || nextBorrowNo($('borrowDate').value),
    empNo: $('empNo').value.trim(),
    empName: $('empName').value.trim(),
    borrowDate: $('borrowDate').value,
    returnType: $('returnType').value,
    purposeType: $('purposeType')?.value || '',
    material: $('borrowMaterial').value,
    code: $('borrowCode').value,
    name: $('borrowName').value,
    qty: $('borrowQty').value,
    location: $('borrowLocation').value,
    note: $('borrowNote').value.trim(),
    createdAt: new Date().toLocaleString('zh-TW', {hour12:false})
  };
}

function saveBorrowRecord(record){
  const records = getBorrowRecords();
  const existingIndex = records.findIndex(r => r.borrowNo === record.borrowNo);
  if(existingIndex >= 0){
    records[existingIndex] = {...records[existingIndex], ...record};
  }else{
    records.push(record);
  }
  saveBorrowRecords(records);
  return records;
}

function validateBorrowForm(){
  const form = $('borrowForm');
  if(!form.reportValidity()) return false;
  const item = window.selectedItem || {};
  const qty = Number($('borrowQty').value);
  if(qty > num(item.qty)){
    alert('借用數量不可大於實盤數量');
    return false;
  }
  return true;
}


function getCurrentBorrowFormData(){
  const item = window.selectedItem || {};
  return {
    '匯出時間': new Date().toLocaleString('zh-TW'),
    '工號': $('empNo') ? $('empNo').value : '',
    '姓名': $('empName') ? $('empName').value : '',
    '借用日期': $('borrowDate') ? $('borrowDate').value : '',
    '物料類別': $('borrowMaterial') ? $('borrowMaterial').value : (item.material || ''),
    '產品編號': $('borrowCode') ? $('borrowCode').value : (item.code || ''),
    '品名': $('borrowName') ? $('borrowName').value : (item.name || ''),
    '借用數量': $('borrowQty') ? $('borrowQty').value : '',
    '存放位置': $('borrowLocation') ? $('borrowLocation').value : (item.location || ''),
    '用途／備註': $('borrowNote') ? $('borrowNote').value : ''
  };
}

function downloadCurrentBorrowCsv(){
  const form = $('borrowForm');
  if(form && !form.reportValidity()) return;

  const row = getCurrentBorrowFormData();
  const headers = Object.keys(row);
  const values = headers.map(h => String(row[h] ?? '').replace(/"/g, '""'));
  const csv = '\ufeff' + headers.join(',') + '\n' + values.map(v => `"${v}"`).join(',') + '\n';
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const code = (row['產品編號'] || 'borrow').replace(/[\\/:*?"<>|]/g, '_');
  const date = (row['借用日期'] || new Date().toISOString().slice(0,10)).replace(/[\\/:*?"<>|]/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `晟福借用單_${date}_${code}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

$('printBtn').addEventListener('click', () => {
  if(!validateBorrowForm()) return;

  const old = document.querySelector('.print-page');
  if(old) old.remove();

  const record = buildBorrowRecord();
  saveBorrowRecord(record);

  const page = document.createElement('div');
  page.className = 'print-page';
  page.style.display = 'none';
  page.innerHTML = `<div class="print-sheet">
    <img src="logo.jpg" class="print-logo" alt="SunForce">
    <div class="print-title">晟福科技 借用/領用單據</div>
    <table class="print-table">
      <tr><td>單號</td><td>${escapeHtml(record.borrowNo)}</td><td>歸還狀態</td><td>${escapeHtml(record.returnType)}</td></tr>
      <tr><td>工號</td><td>${escapeHtml(record.empNo)}</td><td>姓名</td><td>${escapeHtml(record.empName)}</td></tr>
      <tr><td>借用日期</td><td>${escapeHtml(record.borrowDate)}</td><td>物料類別</td><td>${escapeHtml(record.material)}</td></tr>
      <tr><td>用途類型</td><td colspan="3">${escapeHtml(record.purposeType || '')}</td></tr>
      <tr><td>產品標號</td><td colspan="3">${escapeHtml(record.code)}</td></tr>
      <tr><td>品名</td><td colspan="3">${escapeHtml(record.name)}</td></tr>
      <tr><td>借用數量</td><td>${escapeHtml(record.qty)}</td><td>存放位置</td><td>${escapeHtml(record.location)}</td></tr>
      <tr><td>用途說明／備註</td><td colspan="3" style="height:80px;vertical-align:top">${escapeHtml(record.note)}</td></tr>
    </table>
    <div class="sign"><div>申請人</div><div>倉管／管理人</div><div>主管核准</div></div>
  </div>`;

  document.body.appendChild(page);
  refreshBorrowNo();
  window.print();
});


/* ===== Product image viewer: click, wheel zoom, drag, double-click zoom ===== */
let viewerScale = 1;
let viewerX = 0;
let viewerY = 0;
let viewerDragging = false;
let viewerStartX = 0;
let viewerStartY = 0;

function ensureImageViewer(){
  let viewer = document.getElementById('imageViewer');
  if(viewer) return viewer;

  viewer = document.createElement('div');
  viewer.id = 'imageViewer';
  viewer.className = 'image-viewer';
  viewer.setAttribute('aria-hidden', 'true');
  viewer.innerHTML = `
    <button type="button" class="image-viewer-close" aria-label="關閉圖片">×</button>
    <div class="image-viewer-tip">滾輪放大/縮小　｜　按住拖曳查看細節　｜　雙擊再放大　｜　ESC 關閉</div>
    <div class="image-viewer-stage">
      <img id="imageViewerImg" alt="放大產品圖片">
    </div>
  `;
  document.body.appendChild(viewer);

  const img = document.getElementById('imageViewerImg');
  const closeBtn = viewer.querySelector('.image-viewer-close');
  const stage = viewer.querySelector('.image-viewer-stage');

  closeBtn.addEventListener('click', closeImageViewer);

  viewer.addEventListener('click', (e) => {
    // 點黑色背景或透明區域關閉；點圖片本身不關閉。
    if(e.target === viewer || e.target === stage) closeImageViewer();
  });

  viewer.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.22 : -0.22;
    setViewerScale(viewerScale + delta);
  }, {passive:false});

  img.addEventListener('mousedown', (e) => {
    if(e.button !== 0) return;
    viewerDragging = true;
    viewerStartX = e.clientX - viewerX;
    viewerStartY = e.clientY - viewerY;
    img.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if(!viewerDragging) return;
    viewerX = e.clientX - viewerStartX;
    viewerY = e.clientY - viewerStartY;
    applyViewerTransform();
  });

  window.addEventListener('mouseup', () => {
    if(!viewerDragging) return;
    viewerDragging = false;
    img.classList.remove('dragging');
  });

  img.addEventListener('dblclick', (e) => {
    e.preventDefault();
    if(viewerScale < 2.8){
      setViewerScale(viewerScale + 1);
    }else{
      resetImageViewerTransform();
    }
  });

  return viewer;
}

function openImageViewer(imgEl){
  const viewer = ensureImageViewer();
  const viewerImg = document.getElementById('imageViewerImg');
  viewerImg.src = imgEl.currentSrc || imgEl.src;
  viewerImg.alt = imgEl.alt || '產品圖片';
  viewer.classList.add('show');
  viewer.setAttribute('aria-hidden','false');
  document.body.classList.add('viewer-open');
  resetImageViewerTransform();
}

function closeImageViewer(){
  const viewer = document.getElementById('imageViewer');
  if(!viewer) return;
  viewer.classList.remove('show');
  viewer.setAttribute('aria-hidden','true');
  document.body.classList.remove('viewer-open');
  const viewerImg = document.getElementById('imageViewerImg');
  if(viewerImg) viewerImg.src = '';
  viewerDragging = false;
}

function setViewerScale(nextScale){
  viewerScale = Math.min(8, Math.max(0.35, nextScale));
  applyViewerTransform();
}

function resetImageViewerTransform(){
  viewerScale = 1;
  viewerX = 0;
  viewerY = 0;
  applyViewerTransform();
}

function applyViewerTransform(){
  const img = document.getElementById('imageViewerImg');
  if(!img) return;
  img.style.transform = `translate(${viewerX}px, ${viewerY}px) scale(${viewerScale})`;
}

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    if(document.getElementById('imageViewer')?.classList.contains('show')){
      closeImageViewer();
      return;
    }
    if($('modal')?.classList.contains('show')) closeModal();
  }
});


loadExcel();

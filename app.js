const $ = (id) => document.getElementById(id);

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
  return `<img src="${candidates[0]}" data-img-list="${encoded}" data-img-index="0" alt="${escapeHtml(name)}" onerror="tryNextImage(this)">`;
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

function downloadText(filename, text){
  const blob = new Blob(['\ufeff' + text], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportBorrowRecords(){
  // 若目前借用表單已填完整，先自動寫入紀錄，避免匯出時只有表頭。
  if($('modal')?.classList.contains('show') && $('borrowCode')?.value && $('empNo')?.value.trim() && $('empName')?.value.trim() && $('borrowDate')?.value && $('borrowQty')?.value){
    const item = window.selectedItem || {};
    if(Number($('borrowQty').value) <= num(item.qty)){
      saveBorrowRecord(buildBorrowRecord());
    }
  }

  const records = getBorrowRecords();
  const headers = ['單號','工號','姓名','借用日期','歸還狀態','物料類別','產品標號','品名','借用數量','存放位置','用途/備註','建立時間'];
  if(!records.length){
    alert('目前還沒有借用/領用紀錄。請先填寫單據並列印，或在表單填完整後再匯出。');
  }
  const rows = records.map(r => [r.borrowNo,r.empNo,r.empName,r.borrowDate,r.returnType,r.material,r.code,r.name,r.qty,r.location,r.note,r.createdAt]);
  const csv = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
  const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
  downloadText(`晟福科技_借用領用紀錄_${today}.csv`, csv);
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



function loadExcel(){
  const box = $('results');
  const rows = Array.isArray(window.EMBEDDED_INVENTORY_DATA) ? window.EMBEDDED_INVENTORY_DATA : [];
  data = rows.map(normalizeRow).filter(x => x.code || x.name);

  $('totalCount').textContent = data.length.toLocaleString('zh-TW');
  $('resultCount').textContent = '0';
  $('availableCount').textContent = data.filter(x => num(x.qty) > 0).length.toLocaleString('zh-TW');

  const src = $('dataSource');
  if(src) src.textContent = '目前資料來源：內建資料 data.js';

  if(!data.length){
    box.innerHTML = `<div class="empty">尚未建立資料。<br><br>
    請將最新 Excel 交給我轉成 data.js，或使用可讀 Excel 的 localhost 版本。</div>`;
    return;
  }

  render();
}



$('keyword').addEventListener('input', render);
$('clearBtn').addEventListener('click', () => { $('keyword').value=''; render(); $('keyword').focus(); });

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
      <tr><td>產品標號</td><td colspan="3">${escapeHtml(record.code)}</td></tr>
      <tr><td>品名</td><td colspan="3">${escapeHtml(record.name)}</td></tr>
      <tr><td>借用數量</td><td>${escapeHtml(record.qty)}</td><td>存放位置</td><td>${escapeHtml(record.location)}</td></tr>
      <tr><td>用途／備註</td><td colspan="3" style="height:80px;vertical-align:top">${escapeHtml(record.note)}</td></tr>
    </table>
    <div class="sign"><div>申請人</div><div>倉管／管理人</div><div>主管核准</div></div>
  </div>`;

  document.body.appendChild(page);
  refreshBorrowNo();
  window.print();
});


loadExcel();

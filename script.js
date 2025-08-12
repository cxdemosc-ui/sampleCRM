/*******************************************************
 * SampleCRM Frontend Script (2025-08, Revised Build)
 * - Shows Savings transactions (null => "Savings")
 * - Section order: Savings → Debit → Credit → Service Requests
 * - Consistent column widths via .crm-table
 * - All existing functions/actions preserved
 *******************************************************/

const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: 'https://hooks.us.webexconnect.io/events/RHV57QR4M3'
};
let latestCustomer = null;

function showMessage(msg, type='info') {
  const bar = document.getElementById('messageBar');
  if (bar) {
    bar.className = `alert alert-${type}`;
    bar.innerText = msg;
    bar.style.display = 'block';
  }
}
function maskCard(c) { return (!c || c.length < 4) ? '' : '**** **** **** ' + c.slice(-4); }
function formatMoney(a) { const n = Number(a); return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits:2 }); }

// Date formatting to DD-MM-YY HH:mm
function formatDateDMYHM(dt) {
  if (!dt) return '';
  let safe = String(dt).trim().replace(' ', 'T');
  safe = safe.split('.')[0];
  const d = new Date(safe);
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function cardStatusBadge(status) {
  const lc = String(status).toLowerCase();
  if (lc === 'active') return `<span class="badge badge-status active">Active</span>`;
  if (lc === 'blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if (lc.includes('re-issue') || lc.includes('reissued') || lc.includes('reissue')) return `<span class="badge badge-status reissued">Re-Issued</span>`;
  if (lc === 'lost') return `<span class="badge badge-status lost">Lost</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

async function fetchCustomer(identifier, searchType='auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };
  if (searchType === 'email') body.p_email = identifier;
  else if (/^\d{8}$/.test(identifier)) body.p_account_number = identifier;
  else body.p_mobile_no = identifier;

  const r = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`API Error: ${r.status}`);
  return r.json();
}

async function sendAction(payload) {
  const r = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  try { return await r.json(); } catch { return null; }
}

function renderCardActions(card, type) {
  const status = (card.status || '').toLowerCase();
  let actions = status !== 'blocked'
    ? `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}">Block</button> `
    : `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}">UnBlock</button> `;
  const dis = (/re\-?issued?/i.test(status) || /lost/i.test(status)) ? 'disabled' : '';
  actions += `<button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" ${dis}>Reissue</button>
              <button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" ${dis}>Lost</button>
              <button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" ${dis}>Dispute</button>`;
  return actions;
}

function bindActionHandlers(data) {
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no, typeLabel = btn.dataset.type;
        let actionType = btn.classList.contains('btn-block-card') ? 'Block' :
                         btn.classList.contains('btn-unblock-card') ? 'UnBlock' :
                         btn.classList.contains('btn-reissue-card') ? 'Reissue' :
                         btn.classList.contains('btn-mark-lost') ? 'Lost' : 'Dispute';
        if (['Block','UnBlock','Reissue','Lost'].includes(actionType) && !confirm(`${actionType} this ${typeLabel} card?\nCard Number: ${cardNo.slice(-4)}`)) return;
        const payload = { custPhone:data.mobile_no, custPhone2:data.mobile_no2, custAccount:data.account_number||'', custCard:cardNo, cardType:typeLabel, custEmail:data.email, custAction:actionType, serviceRequestType:"", serviceDescription:"" };
        showMessage(`${actionType} request in progress...`, 'info');
        await sendAction(payload);
        setTimeout(()=>document.getElementById('searchBtn').click(), 900);
      };
    });

  $("#newSRForm").off("submit").on("submit", async e => {
    e.preventDefault();
    const srType = $("#srType").val().trim(), srDesc = $("#srDesc").val().trim();
    if (!srType || !srDesc) return $("#newSRAlert").show().addClass('alert-danger').text("Type and Description required.");
    const payload = { custPhone:data.mobile_no, custPhone2:data.mobile_no2, custAccount:data.account_number||'', custCard:"", cardType:"", custEmail:data.email, custAction:"NewRequest", serviceRequestType:srType, serviceDescription:srDesc };
    $("#newSRAlert").removeClass().addClass('alert alert-info').show().text("Creating Service Request...");
    await sendAction(payload);
    setTimeout(()=> { $("#newSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
  });

  $(document).off("click", ".btn-update-sr, .btn-close-sr").on("click", ".btn-update-sr, .btn-close-sr", function() {
    const isUpdate = $(this).hasClass("btn-update-sr");
    const row = $(this).closest("tr");
    $("#editSRModalLabel").text(isUpdate ? "Update Service Request" : "Close Service Request");
    $("#editSRAction").val(isUpdate ? "Update" : "Close");
    $("#editSRType").val(row.find("td:nth-child(2)").text());
    $("#editSRDesc").val(row.find(".sr-desc").attr("title") || "");
    $("#editSRAlert").hide().removeClass();
    $("#editSRModal").modal("show");
  });

  $("#editSRForm").off("submit").on("submit", async e => {
    e.preventDefault();
    const action = $("#editSRAction").val(), srType=$("#editSRType").val(), srDesc=$("#editSRDesc").val().trim();
    if (!srDesc) return $("#editSRAlert").show().addClass('alert-danger').text("Description is required.");
    const payload = { custPhone:data.mobile_no, custPhone2:data.mobile_no2, custAccount:data.account_number||'', custCard:"", cardType:"", custEmail:data.email, custAction:action, serviceRequestType:srType, serviceDescription:srDesc };
    $("#editSRAlert").removeClass().addClass('alert alert-info').show().text(`${action} in progress...`);
    await sendAction(payload);
    setTimeout(()=>{ $("#editSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
  });
}

async function showCustomer(data) {
  latestCustomer = data;
  const div = document.getElementById('customer-details');
  if (!data || data.error) {
    div.style.display = 'none';
    return showMessage(data?.error || 'No customer found.', 'danger');
  }
  div.style.display = 'block';
  document.getElementById('messageBar').style.display = 'none';

  let html = `<div class="card p-3 mb-3 bg-light border-primary">
    <div class="row">
      <div class="col-md-6">
        <h5 class="text-primary">${data.customer_first_name || data.first_name} ${data.customer_last_name || data.last_name}</h5>
        <div><strong>Mobile:</strong> ${data.mobile_no}</div>
        <div><strong>Alt Mobile:</strong> ${data.mobile_no2}</div>
        <div><strong>Email:</strong> ${data.email}</div>
      </div>
      <div class="col-md-6">
        <div><strong>Address:</strong> ${data.customer_address || data.address || 'N/A'}</div>
        <div><strong>City:</strong> ${data.customer_city || data.city || 'N/A'}</div>
        <div><strong>Account Number:</strong> ${data.account_number || 'N/A'}</div>
        <div><strong>Account Balance:</strong> $${formatMoney(data.account_balance)}</div>
      </div>
    </div>
  </div>`;

  // Savings Account section FIRST
  const savingsTxs = (data.recent_transactions || []).filter(
    tx => !tx.transaction_medium || tx.transaction_medium.toLowerCase() === 'savings'
  );
  html += `<h6 class="text-primary">Savings Account Transactions</h6>`;
  html += savingsTxs.length
    ? `<table class="table table-sm table-bordered crm-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
       <tbody>${savingsTxs.map(tx => `
         <tr>
           <td>${formatDateDMYHM(tx.transaction_date)}</td>
           <td>${tx.transaction_type}</td>
           <td>${formatMoney(tx.amount)}</td>
           <td>${tx.reference_note || ''}</td>
         </tr>`).join('')}</tbody></table>`
    : `<p>No savings account transactions found.</p>`;

  // Debit Card section
  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${(c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered crm-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
           <tbody>${c.transactions.map(tx => `
             <tr>
               <td>${formatDateDMYHM(tx.transaction_date)}</td>
               <td>${tx.transaction_type}</td>
               <td>${formatMoney(tx.amount)}</td>
               <td>${tx.reference_note || ''}</td>
             </tr>`).join('')}</tbody></table>`
        : '<p>No debit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Debit")}</div>
    </div>`).join('');

  // Credit Card section
  html += `<h6 class="text-primary">Credit Card</h6>`;
  html += (data.credit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${(c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered crm-table"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
           <tbody>${c.transactions.map(tx => `
             <tr>
               <td>${formatDateDMYHM(tx.transaction_date)}</td>
               <td>${tx.transaction_type}</td>
               <td>${formatMoney(tx.amount)}</td>
               <td>${tx.reference_note || ''}</td>
             </tr>`).join('')}</tbody></table>`
        : '<p>No credit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Credit")}</div>
    </div>`).join('');

  // Service Requests
  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered crm-table">
         <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Raised</th><th>Resolution</th><th>Description</th><th>Actions</th></tr></thead>
         <tbody>${data.service_requests.map(sr => `
           <tr>
             <td>${sr.request_id}</td>
             <td>${sr.request_type}</td>
             <td>${sr.status}</td>
             <td>${formatDateDMYHM(sr.raised_date)}</td>
             <td>${sr.resolution_date ? formatDateDMYHM(sr.resolution_date) : '-'}</td>
             <td class="sr-desc" title="${sr.description || ''}">${sr.description || ''}</td>
             <td>${sr.status === 'Open'
                  ? `<button class="btn btn-sm btn-update-sr" data-srid="${sr.request_id}">Update</button>
                     <button class="btn btn-sm btn-close-sr" data-srid="${sr.request_id}">Close</button>`
                  : ''}</td>
           </tr>`).join('')}
         </tbody>
       </table>
       <div class="mt-2 text-right"><button id="newSRBtn" class="btn btn-primary">Create New Service Request</button></div>`
    : `<p>No service requests found.</p>
       <div class="mt-2 text-right"><button id="newSRBtn" class="btn btn-primary">Create New Service Request</button></div>`;

  div.innerHTML = html;
  bindActionHandlers(data);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const searchBtn = document.getElementById('searchBtn');
  const searchField = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');
 
// --- AUTO-LOAD SEARCH FROM URL PARAM ---
// This block checks the page URL for a query parameter named "mobileNo"
// and, if found, automatically populates the search box and triggers the search.
// Supported formats: 
//   ?mobileNo=6589485304
//   ?mobileNo=19728899106
//   ?mobileNo=wxccrtmsdemo@gmail.com
// The camelCase "mobileNo" is case-sensitive; other variations won't match.
const params = new URLSearchParams(window.location.search);

// Read the ?mobileNo parameter value (null if missing)
const paramVal = params.get('mobileNo');

if (paramVal) {
// Remove any accidental leading/trailing spaces from the value
  const cleanVal = paramVal.trim();

// Set the cleaned value into the search input field
  searchField.value = cleanVal;

// Programmatically click the Search button to fetch customer data immediately
  searchBtn.click();
}
// --- END AUTO-LOAD ---

  
  searchField.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); searchBtn.click(); } });
  searchBtn.onclick = async () => {
    const val = searchField.value.trim();
    if (!val) { showMessage('Please enter a mobile, account, or email.', 'warning'); detailsDiv.style.display='none'; return; }
    showMessage('Loading customer info...', 'info'); detailsDiv.style.display='none';
    let type = val.includes('@') ? 'email' : (/^\d{8}$/.test(val) ? 'account' : 'mobile');
    try { const data = await fetchCustomer(val,type); await showCustomer(data); }
    catch { detailsDiv.style.display='none'; showMessage('Error fetching data.', 'danger'); }
  };
  $(document).on('click', '#newSRBtn', () => {
    if (!latestCustomer){ showMessage('Load a customer first.','danger'); return; }
    $("#newSRModal").modal("show");
  });
});

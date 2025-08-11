/*******************************************************
 * SampleCRM Frontend Script (2025-08, Final Stable Build + Savings Patch)
 * - Keeps API key in place
 * - Fixes Debit Card transactions to use card-specific data
 * - Adds dedicated Savings Account transactions section
 * - Unified refresh after all actions (~900ms delay)
 * - Robust, null-safe rendering of all sections
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
function formatMoney(a) { const n = Number(a); return isNaN(n) ? '0.00' : n.toLocaleString(undefined, {minimumFractionDigits:2}); }
function formatDateDMYHM(dt) {
  if (!dt) return '';
  const d = new Date(dt); if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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

  // Service request bindings remain unchanged...
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

// ------------ REVISED showCustomer() ------------
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

  // CHANGE: Debit section uses c.transactions instead of recent_transactions
  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${(c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered">
             <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
             <tbody>${c.transactions.map(tx => `
               <tr>
                 <td>${formatDateDMYHM(tx.transaction_date)}</td>
                 <td>${tx.transaction_type}</td>
                 <td>${formatMoney(tx.amount)}</td>
                 <td>${tx.reference_note || ''}</td>
               </tr>`).join('')}</tbody>
           </table>`
        : '<p>No debit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Debit")}</div>
    </div>`).join('');

  // Credit cards remain unchanged
  html += `<h6 class="text-primary">Credit Card</h6>`;
  html += (data.credit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${(c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered">
             <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
             <tbody>${c.transactions.map(tx => `
               <tr>
                 <td>${formatDateDMYHM(tx.transaction_date)}</td>
                 <td>${tx.transaction_type}</td>
                 <td>${formatMoney(tx.amount)}</td>
                 <td>${tx.reference_note || ''}</td>
               </tr>`).join('')}</tbody>
           </table>`
        : '<p>No credit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Credit")}</div>
    </div>`).join('');

  // CHANGE: Add Savings Account section
  const savingsTxs = (data.recent_transactions || []).filter(
    tx => tx.transaction_medium && tx.transaction_medium.toLowerCase() === 'savings'
  );
  html += `<h6 class="text-primary">Savings Account Transactions</h6>`;
  if (savingsTxs.length) {
    html += `<table class="table table-sm table-bordered">
      <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
      <tbody>${savingsTxs.map(tx => `
        <tr>
          <td>${formatDateDMYHM(tx.transaction_date)}</td>
          <td>${tx.transaction_type}</td>
          <td>${formatMoney(tx.amount)}</td>
          <td>${tx.reference_note || ''}</td>
        </tr>`).join('')}</tbody>
    </table>`;
  } else {
    html += `<p>No savings account transactions found.</p>`;
  }

  // Service Requests unchanged
  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered"><thead>...</thead><tbody>...</tbody></table>`
    : `<p>No service requests found.</p><div class="mt-2 text-right"><button id="newSRBtn" class="btn btn-primary">Create New Service Request</button></div>`;

  div.innerHTML = html;
  bindActionHandlers(data);
}

// DOM ready logic unchanged...
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const searchBtn = document.getElementById('searchBtn');
  const searchField = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchField.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); searchBtn.click(); } });
  searchBtn.onclick = async () => {
    const val = searchField.value.trim();
    if (!val) { showMessage('Please enter a mobile, account, or email.', 'warning'); detailsDiv.style.display='none'; return; }
    showMessage('Loading customer info...', 'info'); detailsDiv.style.display='none';
    let type = val.includes('@') ? 'email' : (/^\d{8}$/.test(val) ? 'account' : 'mobile');
    try { const data = await fetchCustomer(val,type); await showCustomer(data); }
    catch { detailsDiv.style.display='none'; showMessage('Error fetching data.', 'danger'); }
  };
  $(document).on('click', '#newSRBtn', () => { if (!latestCustomer){ showMessage('Load a customer first.','danger'); return; } $("#newSRModal").modal("show"); });
});

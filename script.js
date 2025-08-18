/*******************************************************
 * SampleCRM Frontend Script (2025-08, Revised Build)
 * - Shows Savings transactions (null => "Savings")
 * - Section order: Savings → Debit → Credit → Service Requests
 * - Consistent column widths via .crm-table
 * - All existing functions/actions preserved
 * - FIX: After any action (Block/Unblock/Reissue/Lost/Dispute,
 *        New SR, Update SR, Close SR) the page auto-refreshes
 *        using the last search seed (account/email/mobile).
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

/* ------------------------------------------------------------------
   NEW: Preserve last search details for reliable post-action refresh
   ------------------------------------------------------------------ */
let lastSearchVal = '';
let lastSearchType = ''; // 'account' | 'mobile' | 'email' | 'auto'

/* ------------------------------
   Helper: UI message bar helper
   ------------------------------ */
function showMessage(msg, type='info') {
  const bar = document.getElementById('messageBar');
  if (bar) {
    bar.className = `alert alert-${type}`;
    bar.innerText = msg;
    bar.style.display = 'block';
  }
}

/* ------------------------------
   Helpers: Formatting utilities
   ------------------------------ */
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

/* ------------------------------------------------------------------
   API: Customer fetch via Supabase RPC
   - FIX: Explicitly honor 'account' | 'mobile' | 'email' types
          in addition to the original auto-detection.
   ------------------------------------------------------------------ */
async function fetchCustomer(identifier, searchType='auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };

  // Explicit types first
  if (searchType === 'email') {
    body.p_email = identifier;
  } else if (searchType === 'account') {
    body.p_account_number = identifier;
  } else if (searchType === 'mobile') {
    body.p_mobile_no = identifier;
  } else {
    // Original auto-detection (kept as-is)
    if (/^\d{8}$/.test(identifier)) body.p_account_number = identifier;
    else if (String(identifier).includes('@')) body.p_email = identifier;
    else body.p_mobile_no = identifier;
  }

  const r = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`API Error: ${r.status}`);
  return r.json();
}

/* ---------------------------------------------
   API: Send action to Webex Connect hook (as-is)
   --------------------------------------------- */
async function sendAction(payload) {
  const r = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  try { return await r.json(); } catch { return null; }
}

/* ---------------------------------------------
   UI: Render card action buttons (as-is)
   --------------------------------------------- */
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

/* ------------------------------------------------------------------
   NEW: Robust refresh helpers (used after actions complete)
   - Uses lastSearchVal/Type if available, otherwise falls back to
     latestCustomer (prefers account → email → mobile).
   - Includes a short retry loop to allow backend to settle.
   ------------------------------------------------------------------ */
function getRefreshSeed() {
  if (lastSearchVal) return { val: lastSearchVal, type: lastSearchType || 'auto' };
  if (latestCustomer) {
    if (latestCustomer.account_number) return { val: latestCustomer.account_number, type: 'account' };
    if (latestCustomer.email) return { val: latestCustomer.email, type: 'email' };
    if (latestCustomer.mobile_no) return { val: latestCustomer.mobile_no, type: 'mobile' };
  }
  return null;
}

function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }

async function refreshCustomerDataWithRetry(maxAttempts = 4, gapMs = 900) {
  const seed = getRefreshSeed();
  if (!seed) {
    console.warn('No refresh seed available.');
    return;
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fetchCustomer(seed.val, seed.type);
      await showCustomer(data);
      return; // success
    } catch (e) {
      if (attempt === maxAttempts) {
        console.error('Refresh failed after attempts:', e);
        showMessage('Error refreshing data.', 'danger');
        return;
      }
      await sleep(gapMs);
    }
  }
}

/* ------------------------------------------------------------------
   ACTION BINDER:
   - Keeps your original handlers/flows intact.
   - FIX: After sendAction(), await a refresh with retry.
   - Adds minimal button disabling to prevent double clicks.
   ------------------------------------------------------------------ */
function bindActionHandlers(data) {
  // Card actions (Block/Unblock/Reissue/Lost/Dispute)
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no, typeLabel = btn.dataset.type;
        let actionType =
          btn.classList.contains('btn-block-card') ? 'Block' :
          btn.classList.contains('btn-unblock-card') ? 'UnBlock' :
          btn.classList.contains('btn-reissue-card') ? 'Reissue' :
          btn.classList.contains('btn-mark-lost') ? 'Lost' : 'Dispute';

        if (['Block','UnBlock','Reissue','Lost'].includes(actionType)) {
          const ok = confirm(`${actionType} this ${typeLabel} card?\nCard Number: ${cardNo.slice(-4)}`);
          if (!ok) return;
        }

        const payload = {
          custPhone: data.mobile_no,
          custPhone2: data.mobile_no2,
          custAccount: data.account_number || '',
          custCard: cardNo,
          cardType: typeLabel,
          custEmail: data.email,
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };

        // UX: disable button during processing
        btn.disabled = true;
        showMessage(`${actionType} request in progress...`, 'info');

        try {
          await sendAction(payload);
          // Refresh with retry to allow backend to update
          await refreshCustomerDataWithRetry(4, 1000);
          showMessage(`${actionType} completed. Data refreshed.`, 'success');
        } catch {
          showMessage(`${actionType} failed.`, 'danger');
        } finally {
          btn.disabled = false;
        }
      };
    });

  // Open SR edit/close modal from table
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

  // NEW SR form submit (kept logic; added refresh await)
  $("#newSRForm").off("submit").on("submit", async e => {
    e.preventDefault();
    const srType = $("#srType").val().trim(), srDesc = $("#srDesc").val().trim();
    if (!srType || !srDesc) {
      $("#newSRAlert").show().addClass('alert-danger').text("Type and Description required.");
      return;
    }
    const payload = {
      custPhone: data.mobile_no,
      custPhone2: data.mobile_no2,
      custAccount: data.account_number || '',
      custCard: "",
      cardType: "",
      custEmail: data.email,
      custAction: "NewRequest",
      serviceRequestType: srType,
      serviceDescription: srDesc
    };
    $("#newSRAlert").removeClass().addClass('alert alert-info').show().text("Creating Service Request...");
    try {
      await sendAction(payload);
      await refreshCustomerDataWithRetry(4, 1000);
      $("#newSRModal").modal('hide');
      showMessage('Service Request created.', 'success');
    } catch {
      $("#newSRAlert").removeClass().addClass('alert alert-danger').text("Failed to create Service Request.");
    }
  });

  // EDIT/CLOSE SR form submit (kept logic; added refresh await)
  $("#editSRForm").off("submit").on("submit", async e => {
    e.preventDefault();
    const action = $("#editSRAction").val(), srType=$("#editSRType").val(), srDesc=$("#editSRDesc").val().trim();
    if (!srDesc) {
      $("#editSRAlert").show().addClass('alert-danger').text("Description is required.");
      return;
    }
    const payload = {
      custPhone: data.mobile_no,
      custPhone2: data.mobile_no2,
      custAccount: data.account_number || '',
      custCard: "",
      cardType: "",
      custEmail: data.email,
      custAction: action,
      serviceRequestType: srType,
      serviceDescription: srDesc
    };
    $("#editSRAlert").removeClass().addClass('alert alert-info').show().text(`${action} in progress...`);
    try {
      await sendAction(payload);
      await refreshCustomerDataWithRetry(4, 1000);
      $("#editSRModal").modal('hide');
      showMessage(`Service Request ${action.toLowerCase()}d.`, 'success');
    } catch {
      $("#editSRAlert").removeClass().addClass('alert alert-danger').text(`${action} failed.`);
    }
  });
}

/* ---------------------------------------------
   UI: Render customer view (as-is)
   --------------------------------------------- */
async function showCustomer(data) {
  latestCustomer = data;
  const div = document.getElementById('customer-details');
  if (!data || data.error) {
    if (div) div.style.display = 'none';
    return showMessage(data?.error || 'No customer found.', 'danger');
  }
  if (div) div.style.display = 'block';
  const msg = document.getElementById('messageBar');
  if (msg) msg.style.display = 'none';

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

  const container = document.getElementById('customer-details');
  if (container) container.innerHTML = html;

  // Re-bind actions for the freshly rendered DOM
  bindActionHandlers(data);
}

/* ----------------------------------------------------
   PAGE BOOTSTRAP
   - Keeps your original DOMContentLoaded logic intact
   - Ensures we store lastSearchVal/Type for refresh
   ---------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // 1) Show current date/time in header (guarded)
  const currentDateEl = document.getElementById('currentDate');
  if (currentDateEl) {
    currentDateEl.textContent =
      new Date().toLocaleString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }

  // 2) Get DOM elements (guarded)
  const searchBtn = document.getElementById('searchBtn');
  const searchField = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  if (!searchBtn || !searchField || !detailsDiv) {
    console.warn('Expected search elements not found. Check IDs: searchBtn, searchMobile, customer-details.');
    return;
  }

  // 3) Enter key triggers search
  searchField.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  // 4) Main search click handler (kept; PLUS store lastSearchVal/Type)
  searchBtn.onclick = async () => {
    const val = searchField.value.trim();
    if (!val) {
      showMessage('Please enter a mobile, account, or email.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }

    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';

    // Detect type (kept as-is)
    let type = val.includes('@')
      ? 'email'
      : (/^\d{8}$/.test(val) ? 'account' : 'mobile');

    // Preserve for refresh
    lastSearchVal = val;
    lastSearchType = type;

    try {
      const data = await fetchCustomer(val, type);
      await showCustomer(data);
    } catch {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching data.', 'danger');
    }
  };

  // 5) Auto-load from URL param (case-sensitive, kept)
  const params = new URLSearchParams(window.location.search);
  const paramVal = params.get('mobileNo');
  if (paramVal) {
    searchField.value = paramVal.trim();
    // This click will also set lastSearchVal/Type via the handler above
    searchBtn.click();
  }

  // 6) Bind "Create New Service Request" button (kept)
  $(document).on('click', '#newSRBtn', () => {
    if (!latestCustomer) {
      showMessage('Load a customer first.', 'danger');
      return;
    }
    $("#newSRModal").modal("show");
  });
});

/* ----------------------------------------------------
   (Your original commented block retained for reference)
   ----------------------------------------------------
// --
// document.addEventListener('DOMContentLoaded', () => {
 // document.getElementById('currentDate').textContent =
 //   new Date().toLocaleString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
 // const searchBtn = document.getElementById('searchBtn');
 // const searchField = document.getElementById('searchMobile');
 // const detailsDiv = document.getElementById('customer-details');
 
// --- AUTO-LOAD SEARCH FROM URL PARAM ---
// This block checks the page URL for a query parameter named "mobileNo"
// and, if found, automatically populates the search box and triggers the search.
// Supported formats: 
//   ?mobileNo=6589485304
//   ?mobileNo=19728899106
//   ?mobileNo=wxccrtmsdemo@gmail.com
// The camelCase "mobileNo" is case-sensitive; other variations won't match.
//const params = new URLSearchParams(window.location.search);

// Read the ?mobileNo parameter value (null if missing)
// const paramVal = params.get('mobileNo');

// if (paramVal) {
// Remove any accidental leading/trailing spaces from the value
//  const cleanVal = paramVal.trim();

// Set the cleaned value into the search input field
//  searchField.value = cleanVal;

// Programmatically click the Search button to fetch customer data immediately
//  searchBtn.click();
//}
// --- END AUTO-LOAD ---

  
//  searchField.addEventListener('keydown', e => { if (e.key==='Enter'){ e.preventDefault(); searchBtn.click(); } });
//  searchBtn.onclick = async () => {
//    const val = searchField.value.trim();
//    if (!val) { showMessage('Please enter a mobile, account, or email.', 'warning'); detailsDiv.style.display='none'; return; }
//    showMessage('Loading customer info...', 'info'); detailsDiv.style.display='none';
//    let type = val.includes('@') ? 'email' : (/^\d{8}$/.test(val) ? 'account' : 'mobile');
//    try { const data = await fetchCustomer(val,type); await showCustomer(data); }
//    catch { detailsDiv.style.display='none'; showMessage('Error fetching data.', 'danger'); }
//  };
//  $(document).on('click', '#newSRBtn', () => {
//    if (!latestCustomer){ showMessage('Load a customer first.','danger'); return; }
//    $("#newSRModal").modal("show");
//  });
//});

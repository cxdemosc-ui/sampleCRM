/*******************************************************
 * SampleCRM Frontend Script (Revised 2025-08)
 * - Backend: Supabase (manage_service_request, update_card_status)
 * - Cards, Service Requests: Block/Unblock/Lost/Reissue/Dispute/Update/Close
 * - Automatic UI refresh, robust backend response handling
 *******************************************************/

/* ================ CONFIGURATION ================ */
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A'; // Use your real anon key
const AUTH_TOKEN = API_KEY; // If JWT auth same as anon key

const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: 'https://hooks.us.webexconnect.io/events/RHV57QR4M3',
};

let latestCustomer = null; // cache of the current customer for actions

/* ================ HELPERS ================ */
// Show alert in message bar
function showMessage(msg, type = 'info') {
  const bar = document.getElementById('messageBar');
  bar.innerText = msg;
  bar.className = `alert alert-${type}`;
  bar.style.display = 'block';
}

// Return masked card (****1234)
function maskCard(cardNo) {
  return (!cardNo || cardNo.length < 4) ? '' : '**** **** **** ' + cardNo.slice(-4);
}

// Money formatting
function formatMoney(amount) {
  const n = Number(amount);
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Date formatting
function formatDateDMYHM(dtStr) {
  if (!dtStr) return '';
  const d = new Date(dtStr);
  if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} `
       + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Card status badge
function cardStatusBadge(status) {
  const lc = String(status).toLowerCase();
  if (lc === 'active') return `<span class="badge badge-status active">Active</span>`;
  if (lc === 'blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if (lc.includes('re-issue') || lc.includes('reissued')) return `<span class="badge badge-status reissued">Re-Issued</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

/* ================ API CALLS ================ */
// Unified customer search RPC
async function fetchCustomer(identifier, searchType = 'auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };
  if (searchType === 'email') body.p_email = identifier;
  else if (/^\d{8}$/.test(identifier)) body.p_account_number = identifier;
  else body.p_mobile_no = identifier;

  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

// Send action for cards/SRs to Webex Connect (which calls Supabase)
async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  // Always safely parse to object/array/null
  try { return await resp.json(); } catch { return null; }
}

/* =========== UI: ACTIONS SECTION =========== */
// Generate card action buttons (auto includes allowed actions)
function renderCardActions(card, type) {
  const status = (card.status || '').toLowerCase();
  let actions = '';

  if (status !== 'blocked') {
    actions += `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}">Block</button> `;
  } else {
    actions += `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}">UnBlock</button> `;
  }
  // Always allow other actions except on re-issued (demo logic)
  const disabled = status === 're-issued' ? 'disabled' : '';
  actions += `
    <button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" ${disabled}>Reissue</button> 
    <button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" ${disabled}>Lost</button> 
    <button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" ${disabled}>Dispute</button>
  `;
  return actions;
}

/* =========== BIND/INVOKE ALL ACTIONS =========== */
// Called after `showCustomer()` on initial load & every refresh
function bindActionHandlers(data) {

  // --- Card Actions ---
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no;
        const typeLabel = btn.dataset.type;
        let actionType = null;

        if (btn.classList.contains('btn-block-card')) actionType = 'Block';
        else if (btn.classList.contains('btn-unblock-card')) actionType = 'UnBlock';
        else if (btn.classList.contains('btn-reissue-card')) actionType = 'Reissue';
        else if (btn.classList.contains('btn-mark-lost')) actionType = 'Lost';
        else if (btn.classList.contains('btn-dispute')) actionType = 'Dispute';

        // Confirm for destructive actions
        if (['Block', 'UnBlock', 'Reissue', 'Lost'].includes(actionType)) {
          if (!confirm(`${actionType} this ${typeLabel} card?\nCard Number: ${cardNo.slice(-4)}`)) return;
        }

        // Webhook payload
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

        showMessage(`${actionType} request in progress...`, 'info');

        const result = await sendActionToWebexConnect(payload);

        // Accept success if: non-empty array, status OK, or any object with keys
        const success = Array.isArray(result)
          ? result.length > 0
          : (result && (result.status === 'OK' || Object.keys(result).length > 0));

        let friendlyAction = (actionType === 'Block' ? 'blocked'
                              : actionType === 'UnBlock' ? 'unblocked'
                              : actionType.toLowerCase());

        if (success) {
          showMessage(`Card successfully ${friendlyAction} for card ending ${cardNo.slice(-4)}.`, 'success');
          setTimeout(() => document.getElementById('searchBtn').click(), 700);
        } else {
          showMessage(`Request sent but confirmation not in expected format. Refreshing...`, 'warning');
          setTimeout(() => document.getElementById('searchBtn').click(), 1300);
        }
      };
    });

  // --- Create Service Request Modal ---
  $("#newSRForm").off("submit").on("submit", async function(e) {
    e.preventDefault();
    const srType = $("#srType").val().trim();
    const srDesc = $("#srDesc").val().trim();
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
    $("#newSRAlert").removeClass('alert-danger').addClass('alert-info').show().text("Creating Service Request...");
    const result = await sendActionToWebexConnect(payload);

    // Check for array/object/OK/id
    const success = Array.isArray(result) ? result.length > 0
                  : result && (result.status === "OK" || result.id || Object.keys(result).length > 0);

    const reqId = Array.isArray(result) && result[0]?.request_id ? result[0].request_id : '';

    if (success) {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-success')
        .text(`Service Request${reqId ? ' #'+reqId : ''} created!`);
      setTimeout(() => { $("#newSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 700);
    } else {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-danger')
        .text("Failed to create service request.");
    }
  });

  // --- Update/Close Service Request Modal ---
  $(document).off("click", ".btn-update-sr, .btn-close-sr").on("click", ".btn-update-sr, .btn-close-sr", function() {
    const isUpdate = $(this).hasClass("btn-update-sr");
    const row = $(this).closest("tr");
    const srType = row.find("td:nth-child(2)").text();
    const srDesc = row.find(".sr-desc").attr("title") || "";
    $("#editSRModalLabel").text(isUpdate ? "Update Service Request" : "Close Service Request");
    $("#editSRAction").val(isUpdate ? "Update" : "Close");
    $("#editSRType").val(srType);
    $("#editSRDesc").val(srDesc);
    $("#editSRAlert").hide().removeClass("alert-success alert-danger alert-info").text('');
    $("#editSRModal").modal("show");
  });

  // Handler for Update/Close modal submit
  $("#editSRForm").off("submit").on("submit", async function(e) {
    e.preventDefault();
    const action = $("#editSRAction").val();
    const srType = $("#editSRType").val();
    const srDesc = $("#editSRDesc").val().trim();
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
      custAction: action, // "Update" or "Close"
      serviceRequestType: srType,
      serviceDescription: srDesc
    };
    $("#editSRAlert").removeClass('alert-danger').addClass('alert-info').show().text(`${action} in progress...`);
    const result = await sendActionToWebexConnect(payload);
    const success = Array.isArray(result) ? result.length > 0
                  : result && (result.status === "OK" || result.id || Object.keys(result).length > 0);

    if (success) {
      $("#editSRAlert").removeClass('alert-info').addClass('alert-success')
        .text(`Service Request ${action}d successfully!`);
      setTimeout(() => { $("#editSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 800);
    } else {
      $("#editSRAlert").removeClass('alert-info').addClass('alert-danger')
        .text(`${action} failed or not confirmed.`);
    }
  });
}

/* ========== CUSTOMER PROFILE RENDER ========= */
// Main render after search/refresh; re-binds all handlers
async function showCustomer(data) {
  latestCustomer = data;
  const detailsDiv = document.getElementById('customer-details');
  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.', 'danger');
    return;
  }
  detailsDiv.style.display = 'block';
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

  // Debit cards
  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${
        (data.recent_transactions || []).length 
        ? `<table class="table table-sm table-bordered"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead><tbody>${
            data.recent_transactions.map(tx => `
              <tr>
                <td>${formatDateDMYHM(tx.transaction_date)}</td>
                <td>${tx.transaction_type}</td>
                <td>${formatMoney(tx.amount)}</td>
                <td>${tx.reference_note || ''}</td>
              </tr>`).join('')
          }</tbody></table>`
        : '<p>No debit card transactions found.</p>'
      }
      <div class="card-actions">${renderCardActions(c, "Debit")}</div>
    </div>
  `).join('');

  // Credit cards
  html += `<h6 class="text-primary">Credit Card</h6>`;
  html += (data.credit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${
        (c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered"><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead><tbody>${
             c.transactions.map(tx => `
               <tr>
                 <td>${formatDateDMYHM(tx.transaction_date)}</td>
                 <td>${tx.transaction_type}</td>
                 <td>${formatMoney(tx.amount)}</td>
                 <td>${tx.reference_note || ''}</td>
               </tr>`).join('')
          }</tbody></table>`
        : '<p>No credit card transactions found.</p>'
      }
      <div class="card-actions">${renderCardActions(c, "Credit")}</div>
    </div>
  `).join('');

  // Service Requests
  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered">
         <thead><tr><th>ID</th><th>Type</th><th>Status</th><th>Raised</th><th>Resolution</th><th>Description</th><th>Actions</th></tr></thead>
         <tbody>${data.service_requests.map(sr => `
           <tr>
             <td>${sr.request_id}</td>
             <td>${sr.request_type}</td>
             <td>${sr.status}</td>
             <td>${formatDateDMYHM(sr.raised_date)}</td>
             <td>${sr.resolution_date ? formatDateDMYHM(sr.resolution_date) : '-'}</td>
             <td class="sr-desc" title="${sr.description || ''}">${sr.description || ''}</td>
             <td>
               ${sr.status === 'Open'
                  ? `<button class="btn btn-sm btn-update-sr" data-srid="${sr.request_id}">Update</button>
                     <button class="btn btn-sm btn-close-sr" data-srid="${sr.request_id}">Close</button>`
                  : ''}
             </td>
           </tr>`).join('')}
         </tbody>
       </table>
       <div class="mt-2 text-right">
         <button id="newSRBtn" class="btn btn-primary">Create New Service Request</button>
       </div>`
    : `<p>No service requests found.</p><div class="mt-2 text-right"><button id="newSRBtn" class="btn btn-primary">Create New Service Request</button></div>`;

  detailsDiv.innerHTML = html;
  bindActionHandlers(data);
}

/* ========== APP INIT ========== */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  const searchBtn = document.getElementById('searchBtn');
  const searchField = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchField.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }
  });

  searchBtn.onclick = async () => {
    const val = searchField.value.trim();
    if (!val) {
      showMessage('Please enter a mobile, account, or email.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';
    let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
    try {
      const data = await fetchCustomer(val, type);
      await showCustomer(data);
    } catch (err) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching data.', 'danger');
    }
  };

  // Show New Service Request modal
  $(document).on('click', '#newSRBtn', function () {
    if (!latestCustomer) {
      showMessage('Load a customer first.', 'danger');
      return false;
    }
    $("#newSRModal").modal("show");
  });
});

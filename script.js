/****************************************************
 * SampleCRM Frontend Script
 * Integrates:
 *  - Customer search via Supabase RPC
 *  - Display of customer profile, cards, and service requests
 *  - Card actions via Webex Connect webhook → Supabase RPC
 *  - Service Request create, update, and close flows
 *  - Automatic refresh after actions
 ****************************************************/

/* ========= CONFIGURATION ========= */
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;

/* Your actual Supabase anon key */
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

/* API Endpoints */
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: `https://hooks.us.webexconnect.io/events/RHV57QR4M3` // Webhook that calls Supabase RPCs
};

/* Cache of last fetched customer */
let latestCustomer = null;

/* ========= GENERAL HELPERS ========= */

/** Show Bootstrap alert in #messageBar */
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}

/** Mask card number to show only last 4 digits */
function maskCard(num) {
  return (!num || num.length < 4) ? '' : '**** **** **** ' + num.slice(-4);
}

/** Format number with commas & 2 decimals */
function formatMoney(amount) {
  const n = Number(amount);
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined,
    { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Format to dd-mm-yyyy hh:mm */
function formatDateDMYHM(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()} `
       + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Return HTML for status badge */
function cardStatusBadge(status) {
  const lc = String(status).toLowerCase();
  if (lc === 'active') return `<span class="badge badge-status active">Active</span>`;
  if (lc === 'blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if (lc.includes('re-issue') || lc.includes('reissued')) return `<span class="badge badge-status reissued">Re-Issued</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

/* ========= API CALLS ========= */

/** Fetch full customer data from Supabase */
async function fetchCustomer(identifier, searchType = 'auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };
  if (searchType === 'email') body.p_email = identifier;
  else if (/^\d{8}$/.test(identifier)) body.p_account_number = identifier;
  else body.p_mobile_no = identifier;

  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`API Error: ${response.status}`);
  return response.json();
}

/** Send action payload to Webex Connect webhook */
async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return resp.json().catch(() => ({}));
}

/* ========= UI HELPERS ========= */

/** Render HTML buttons for a card's possible actions */
function renderCardActions(card, type) {
  const status = card.status.toLowerCase();
  const disabled = status === 'reissue' ? 'disabled' : '';
  let actions = '';

  if (status !== 'blocked' && !disabled) {
    actions += `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">Block</button> `;
  } else if (status === 'blocked') {
    actions += `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">UnBlock</button> `;
  }
  actions += `
    <button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Reissue</button> 
    <button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Mark Lost</button> 
    <button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Dispute</button>
  `;
  return actions;
}

/* ========= ACTION HANDLERS ========= */

/** Bind handlers for card actions + SR modals */
function bindActionHandlers(data) {

  /* ---- Card Actions ---- */
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no;
        const status = btn.dataset.status;
        const typeLabel = btn.dataset.type;

        const actionType = btn.classList.contains('btn-block-card') ? 'Block'
                         : btn.classList.contains('btn-unblock-card') ? 'UnBlock'
                         : btn.classList.contains('btn-reissue-card') ? 'Reissue'
                         : btn.classList.contains('btn-mark-lost') ? 'Lost'
                         : 'Dispute';

        // Confirm destructive actions
        if (['Block', 'UnBlock', 'Reissue'].includes(actionType)) {
          if (!confirm(`${actionType} this ${typeLabel} card?\nCard Number: ${cardNo}\nStatus: ${status}`)) return;
        }

        // Payload for Webhook
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

        if (result && (result.status === 'OK' || result.length)) {
          showMessage(`${actionType} completed for card ending ${cardNo.slice(-4)}.`, 'success');
          setTimeout(() => document.getElementById('searchBtn').click(), 800);
        } else {
          showMessage(`Request sent but update confirmation not received.`, 'warning');
        }
      };
    });

  /* ---- Create Service Request ---- */
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
    if (result.status === 'OK' || result.id) {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-success').text("Service Request created!");
      setTimeout(() => { $("#newSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
    } else {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-danger').text("Failed to create service request.");
    }
  });

  /* ---- Update / Close Service Request ---- */
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
      custAction: action, // Update / Close
      serviceRequestType: srType,
      serviceDescription: srDesc
    };
    $("#editSRAlert").removeClass('alert-danger').addClass('alert-info').show().text(`${action} in progress...`);
    const result = await sendActionToWebexConnect(payload);
    if (result.status === 'OK' || result.id) {
      $("#editSRAlert").removeClass('alert-info').addClass('alert-success').text(`Service Request ${action}d successfully!`);
      setTimeout(() => { $("#editSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
    } else {
      $("#editSRAlert").removeClass('alert-info').addClass('alert-danger').text(`${action} failed.`);
    }
  });
}

/* ========= MAIN RENDER ========= */

/** Render profile, cards, and service requests for a customer */
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

  let html = `
    <div class="card p-3 mb-3 bg-light border-primary">
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
    </div>
  `;

  /* Debit Cards */
  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      ${(data.recent_transactions || []).length
        ? `<table class="table table-sm table-bordered">
             <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
             <tbody>${data.recent_transactions.map(tx => `
               <tr>
                 <td>${formatDateDMYHM(tx.transaction_date)}</td>
                 <td>${tx.transaction_type}</td>
                 <td>${formatMoney(tx.amount)}</td>
                 <td>${tx.reference_note || ''}</td>
               </tr>`).join('')}
             </tbody>
           </table>`
        : '<p>No debit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Debit")}</div>
    </div>
  `).join('');

  /* Credit Cards */
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
               </tr>`).join('')}
             </tbody>
           </table>`
        : '<p>No credit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c, "Credit")}</div>
    </div>
  `).join('');

  /* Service Requests */
  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered">
         <thead><tr><th>ID</th><th>Type</th><th>Status</th>
         <th>Raised</th><th>Resolution</th><th>Description</th><th>Actions</th></tr></thead>
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
    : `<p>No service requests found.</p>
       <div class="mt-2 text-right">
         <button id="newSRBtn" class="btn btn-primary">Create New Service Request</button>
       </div>`;

  detailsDiv.innerHTML = html;
  bindActionHandlers(data);
}

/* ========= INITIALISATION ========= */
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

  $(document).on('click', '#newSRBtn', function () {
    if (!latestCustomer) {
      showMessage('Load a customer first.', 'danger');
      return false;
    }
    $("#newSRModal").modal("show");
  });
});

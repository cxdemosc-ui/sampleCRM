// === Config ===
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: `https://hooks.us.webexconnect.io/events/RHV57QR4M3`
};

let latestCustomer = null;

// === Helpers ===
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}
function maskCard(num) {
  return (!num || num.length < 4) ? '' : '**** **** **** ' + num.slice(-4);
}
function formatMoney(amount) {
  const n = Number(amount);
  return isNaN(n) ? '0.00' : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDateDMY(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  return isNaN(d) ? 'N/A' : `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function cardStatusBadge(status) {
  const lc = String(status).toLowerCase();
  if (lc === 'active') return `<span class="badge badge-status active">Active</span>`;
  if (lc === 'blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if (lc === 'reissued' || lc === 're-isssued' || lc === 're-issue') return `<span class="badge badge-status reissued">Re-Issued</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

// === API ===
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
async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return resp.json().catch(() => ({}));
}

// === Actions Render ===
function renderCardActions(card, type) {
  const status = card.status.toLowerCase();
  const disabled = status === 'reissue' ? 'disabled' : '';
  let actions = '';
  if (status !== 'blocked' && !disabled) {
    actions += `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">Block</button> `;
  } else if (status === 'blocked') {
    actions += `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">UnBlock</button> `;
  }
  actions += `<button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Reissue</button> `;
  actions += `<button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Mark Lost</button> `;
  actions += `<button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Dispute</button>`;
  return actions;
}

// === Bind actions + SR modal logic ===
function bindActionHandlers(data) {
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no;
        const status = btn.dataset.status;
        const typeLabel = btn.dataset.type;
        const isBlock = btn.classList.contains('btn-block-card');
        const isUnblock = btn.classList.contains('btn-unblock-card');
        const isReissue = btn.classList.contains('btn-reissue-card');
        if (isBlock || isUnblock || isReissue) {
          const actionLabel = isBlock ? 'Block' : isUnblock ? 'UnBlock' : 'Reissue';
          if (!confirm(`${actionLabel} this ${typeLabel} card?\nCard Number: ${cardNo}\nStatus: ${status}`)) return;
        }
        const actionType = isBlock ? 'Block' : isUnblock ? 'UnBlock' :
                           isReissue ? 'Reissue' :
                           btn.classList.contains('btn-mark-lost') ? 'Lost' : 'Dispute';
        const payload = {
          custPhone: data.mobile_no,
          custPhone2: data.mobile_no2,
          custAccount: data.account_number,
          custCard: cardNo,
          cardType: typeLabel,
          custEmail: data.email,
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };
        showMessage(`${actionType} request in progress...`, 'info');
        const result = await sendActionToWebexConnect(payload);
        if (result.status === 'OK') {
          if (isBlock) { btn.textContent = 'UnBlock'; btn.classList.replace('btn-block-card','btn-unblock-card'); btn.classList.replace('btn-danger','btn-success'); }
          else if (isUnblock) { btn.textContent = 'Block'; btn.classList.replace('btn-unblock-card','btn-block-card'); btn.classList.replace('btn-success','btn-danger'); }
          else if (isReissue) { btn.closest('.card-section').querySelectorAll('button').forEach(b => b.disabled = true); }
          showMessage(`${actionType} request sent successfully for card ending ${cardNo.slice(-4)}.`,'success');
        } else showMessage(`Request sent but not confirmed.`, 'warning');
      };
    });

  // New SR Modal binding:
  $("#newSRModal").on('show.bs.modal', function() {
    $("#newSRAlert").hide().removeClass("alert-success alert-danger").text('');
    $("#srType").val(''); $("#srDesc").val('');
  });
  $("#newSRForm").off("submit").on("submit", async function(e){
    e.preventDefault();
    const srType = $("#srType").val();
    const srDesc = $("#srDesc").val();
    if(!srType || !srDesc) {
      $("#newSRAlert").show().addClass('alert-danger').text("Type and Description required."); return;
    }
    // Compose payload for request creation
    const payload = {
      custPhone: data.mobile_no,
      custPhone2: data.mobile_no2,
      custAccount: data.account_number,
      custCard: "",
      cardType: "",
      custEmail: data.email,
      custAction: "NewRequest",
      serviceRequestType: srType,
      serviceDescription: srDesc
    };
    $("#newSRAlert").show().removeClass('alert-danger').addClass('alert-info').text("Creating Service Request...");
    const result = await sendActionToWebexConnect(payload);
    if(result.status === 'OK' || result.id) {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-success').text("Service Request created!");
      setTimeout(()=>{$("#newSRModal").modal('hide');},1500);
      // Optionally re-fetch customer to refresh table
    } else {
      $("#newSRAlert").removeClass('alert-info').addClass('alert-danger').text("Failed to create service request.");
    }
  });
}

// === Main Render ===
async function showCustomer(data) {
  latestCustomer = data; // For modal SR creation
  const detailsDiv = document.getElementById('customer-details');
  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.','danger');
    return;
  }
  detailsDiv.style.display = 'block';
  document.getElementById('messageBar').style.display = 'none';

  let html = `
    <div class="card p-3 mb-3 bg-light border-primary">
      <div class="row">
        <div class="col-md-6 profile-left">
          <h5 class="text-primary">${data.customer_first_name} ${data.customer_last_name}</h5>
          <div><strong>Mobile:</strong> ${data.mobile_no}</div>
          <div><strong>Alt Mobile:</strong> ${data.mobile_no2}</div>
          <div><strong>Email:</strong> ${data.email}</div>
        </div>
        <div class="col-md-6 profile-right">
          <div><strong>Address:</strong> ${data.customer_address || 'N/A'}</div>
          <div><strong>City:</strong> ${data.customer_city || 'N/A'}</div>
          <div><strong>Account Number:</strong> ${data.account_number}</div>
          <div><strong>Account Balance:</strong> $${formatMoney(data.account_balance)}</div>
        </div>
      </div>
    </div>
  `;

  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c =>
    `<div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)}
      ${cardStatusBadge(c.status)}
      ${(data.recent_transactions || []).length
        ? `<table class="table table-sm table-bordered">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
            <tbody>
              ${data.recent_transactions.map(tx => `
                <tr>
                  <td>${formatDateDMY(tx.transaction_date)}</td>
                  <td>${tx.transaction_type}</td>
                  <td>${formatMoney(tx.amount)}</td>
                  <td>${tx.reference_note || ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>`
        : '<p>No account/debit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c,"Debit")}</div>
    </div>`).join('');

  html += `<h6 class="text-primary">Credit Card</h6>`;
  html += (data.credit_cards || []).map(c =>
    `<div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)}
      ${cardStatusBadge(c.status)}
      ${(c.transactions && c.transactions.length)
        ? `<table class="table table-sm table-bordered">
            <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th></tr></thead>
            <tbody>
              ${c.transactions.map(tx => `
                <tr>
                  <td>${formatDateDMY(tx.transaction_date)}</td>
                  <td>${tx.transaction_type}</td>
                  <td>${formatMoney(tx.amount)}</td>
                  <td>${tx.reference_note || ''}</td>
                </tr>`).join('')}
            </tbody>
          </table>`
        : '<p>No credit card transactions found.</p>'}
      <div class="card-actions">${renderCardActions(c,"Credit")}</div>
    </div>`).join('');

  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered">
        <thead><tr>
          <th>ID</th><th>Type</th><th>Status</th>
          <th>Raised</th><th>Resolution</th>
          <th>Description</th><th>Actions</th></tr></thead>
        <tbody>
          ${data.service_requests.map(sr => `
            <tr>
              <td>${sr.request_id}</td>
              <td>${sr.request_type}</td>
              <td>${sr.status}</td>
              <td>${sr.raised_date}</td>
              <td>${sr.resolution_date || '-'}</td>
              <td class="sr-desc" title="${sr.description || ''}">${sr.description || ''}</td>
              <td>
                ${sr.status === 'Open'
                  ? `<button class="btn btn-sm btn-info btn-update-sr" data-srid="${sr.request_id}">Update</button>
                     <button class="btn btn-sm btn-danger btn-close-sr" data-srid="${sr.request_id}">Close</button>`
                  : ''}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="mt-2 text-right"><button id="newSRBtn" type="button" class="btn btn-primary btn-demo" data-toggle="modal" data-target="#newSRModal">Create New Service Request</button></div>`
    : `<p>No service requests found.</p>
      <div class="mt-2 text-right"><button id="newSRBtn" type="button" class="btn btn-primary btn-demo" data-toggle="modal" data-target="#newSRModal">Create New Service Request</button></div>`;

  detailsDiv.innerHTML = html;
  bindActionHandlers(data);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent =
    new Date().toLocaleString('en-GB', {weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchMobile.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); } });
  searchBtn.onclick = async () => {
    const val = searchMobile.value.trim();
    if (!val) { showMessage('Please enter a mobile, account, or email.','warning'); detailsDiv.style.display = 'none'; return; }
    showMessage('Loading customer info...','info'); detailsDiv.style.display = 'none';
    let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
    try { const data = await fetchCustomer(val, type); await showCustomer(data); }
    catch { detailsDiv.style.display = 'none'; showMessage('Error fetching data.','danger'); }
  };

  // Modal SR button (delegated) -- open modal only if customer loaded
  $(document).on('click', '#newSRBtn', function(e){
    if(!latestCustomer) {
      showMessage('Load a customer first.','danger');
      return false;
    }
    $("#newSRModal").modal("show");
  });
});

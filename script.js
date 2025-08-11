// === Supabase / API Configuration ===
// Base URLs and API keys for calling Supabase RPC endpoints and Webex Connect webhook
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';       // Replace if regenerating API key
const AUTH_TOKEN = API_KEY;            // Using anon key for auth (demo-safe)

// All endpoints your CRM portal will call
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  updateCustomer: `${RPC_BASE_URL}update_customer_data_by_mobile_or_account`,
  createServiceRequest: `${RPC_BASE_URL}create_service_request`,
  updateServiceRequest: `${RPC_BASE_URL}update_service_request_status`,
  webexAction: `https://hooks.us.webexconnect.io/events/RHV57QR4M3` // Webhook endpoint
};

// === Helper Functions ===

/**
 * Show alert messages to user in messageBar area
 * @param {string} message - The text to display
 * @param {string} type - Bootstrap alert type: info, success, warning, danger
 */
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}

/**
 * Mask a card number to show only last 4 digits
 * e.g. 4000500060001101 → **** **** **** 1101
 */
function maskCard(num) {
  if (!num || num.length < 4) return '';
  return '**** **** **** ' + num.slice(-4);
}

/**
 * Fetch customer data from Supabase by mobile, account, or email
 * Automatically detects search type
 */
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

/**
 * Send an action (card/service) to Webex Connect webhook
 */
async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  // Attempt to parse JSON; if fail return raw text
  return resp.json().catch(() => ({}));
}

// === Render Card Action Buttons dynamically for a card ===
function renderCardActions(card, type) {
  const status = card.status.toLowerCase();
  const disabled = status === 'reissue' ? 'disabled' : ''; // disable actions if reissue in progress
  let actions = '';

  // Block / Unblock
  if (status !== 'blocked' && status !== 'reissue') {
    actions += `<button class="btn btn-sm btn-danger btn-block-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Block</button> `;
  } else if (status === 'blocked') {
    actions += `<button class="btn btn-sm btn-success btn-unblock-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>UnBlock</button> `;
  }

  // Other actions
  actions += `<button class="btn btn-sm btn-warning btn-reissue-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Reissue</button> `;
  actions += `<button class="btn btn-sm btn-secondary btn-mark-lost" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Mark Lost</button> `;
  actions += `<button class="btn btn-sm btn-info btn-dispute" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Dispute</button>`;

  return `<div class="card-actions mt-1">${actions}</div>`;
}

// === Bind Button Event Handlers for Actions ===
function bindActionHandlers(data) {
  // Card Actions (Block, UnBlock, Reissue, Lost, Dispute)
  document.querySelectorAll('.btn-block-card,.btn-unblock-card,.btn-reissue-card,.btn-mark-lost,.btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no;
        const status = btn.dataset.status;
        const typeLabel = btn.dataset.type.charAt(0).toUpperCase() + btn.dataset.type.slice(1);

        const isBlock = btn.classList.contains('btn-block-card');
        const isUnblock = btn.classList.contains('btn-unblock-card');
        const isReissue = btn.classList.contains('btn-reissue-card');

        // Confirmation popups
        if (isBlock || isUnblock || isReissue) {
          const actionLabel = isBlock ? 'Block' : isUnblock ? 'UnBlock' : 'Reissue';
          if (!confirm(`${actionLabel} this ${typeLabel} card?\nCard Number: ${cardNo}\nStatus: ${status}`)) return;
        }

        // Determine action keyword for backend
        const actionType =
          isBlock ? 'Block' :
          isUnblock ? 'UnBlock' :
          isReissue ? 'Reissue' :
          btn.classList.contains('btn-mark-lost') ? 'Lost' : 'Dispute';

        // Payload to send to Webex (includes cardType now)
        const payload = {
          custPhone: data.mobile_no || '',
          custPhone2: data.mobile_no2 || '',
          custAccount: data.account_number || '',
          custCard: cardNo || '',
          cardType: typeLabel, // distinguishes Debit vs Credit
          custEmail: data.email || '',
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };

        showMessage(`${actionType} request in progress...`, 'info');
        const result = await sendActionToWebexConnect(payload);

        // Handle response
        if (result.status === 'OK') {
          // UI updates after successful action
          if (isBlock) {
            btn.textContent = 'UnBlock';
            btn.classList.replace('btn-block-card','btn-unblock-card');
            btn.classList.replace('btn-danger','btn-success');
          } else if (isUnblock) {
            btn.textContent = 'Block';
            btn.classList.replace('btn-unblock-card','btn-block-card');
            btn.classList.replace('btn-success','btn-danger');
          } else if (isReissue) {
            // Disable all buttons for this card during reissue period
            btn.closest('.card-actions').querySelectorAll('button').forEach(b => b.disabled = true);
          }
          showMessage(`${actionType} request sent successfully for card ending ${cardNo.slice(-4)}.`, 'success');
        } else {
          showMessage(`Request sent but not confirmed.`, 'warning');
        }
      };
    });

  // Service Request Update
  document.querySelectorAll('.btn-update-sr').forEach(btn => {
    btn.onclick = async () => {
      const srId = btn.dataset.srid;
      const comment = prompt(`Enter comment for Service Request #${srId}:`);
      if (!comment) return;
      // TODO: Call backend update SR RPC here
      showMessage(`Service Request #${srId} updated.`, 'success');
    };
  });

  // Service Request Close
  document.querySelectorAll('.btn-close-sr').forEach(btn => {
    btn.onclick = async () => {
      const srId = btn.dataset.srid;
      if (!confirm(`Customer consent to close SR #${srId}?`)) return;
      const outcome = prompt(`Enter final outcome for SR #${srId}:`);
      if (!outcome) return;
      // TODO: Call backend close SR RPC here
      showMessage(`Service Request #${srId} closed.`, 'success');
    };
  });
}

// === Build and Display Customer Details ===
async function showCustomer(data) {
  const detailsDiv = document.getElementById('customer-details');

  // No data found
  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.', 'danger');
    return;
  }

  document.getElementById('messageBar').style.display = 'none';
  detailsDiv.style.display = 'block';

  // Build details UI
  detailsDiv.innerHTML = `
    <div class="card p-3 mb-3 bg-light border-primary">
      <h5 class="text-primary">${data.customer_first_name} ${data.customer_last_name}</h5>
      <p><strong>Mobile:</strong> ${data.mobile_no} | <strong>Alt:</strong> ${data.mobile_no2}</p>
      <p><strong>Email:</strong> ${data.email}</p>
    </div>

    <h6 class="mt-3 text-primary">Credit Cards</h6>
    ${(data.credit_cards || []).map(c =>
      `<div class="border rounded p-2 mb-2 bg-white">
         ${maskCard(c.card_number)} - ${c.status}
         ${renderCardActions(c, "Credit")}
       </div>`).join('')}

    <h6 class="mt-3 text-primary">Debit Cards</h6>
    ${(data.debit_cards || []).map(c =>
      `<div class="border rounded p-2 mb-2 bg-white">
         ${maskCard(c.card_number)} - ${c.status}
         ${renderCardActions(c, "Debit")}
       </div>`).join('')}

    <h6 class="mt-3 text-primary">Service Requests</h6>
    ${(data.service_requests || []).map(sr => `
      <div class="border rounded p-2 mb-2 bg-white">
        <div><strong>ID:</strong> ${sr.request_id}</div>
        <div><strong>Type:</strong> ${sr.request_type}</div>
        <div><strong>Status:</strong> ${sr.status}</div>
        <button class="btn btn-sm btn-info btn-update-sr" data-srid="${sr.request_id}">Update</button>
        <button class="btn btn-sm btn-danger btn-close-sr" data-srid="${sr.request_id}">Close</button>
      </div>`).join('')}
  `;

  // Bind all action handlers after UI render
  bindActionHandlers(data);
}

// === Page Init & Search Handler ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleString('en-GB',{
    weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'
  });

  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  // Allow Enter key to trigger search
  searchMobile.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }
  });

  // Search button click
  searchBtn.onclick = async () => {
    const val = searchMobile.value.trim();
    if (!val) {
      showMessage('Please enter a mobile, account, or email.','warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...','info');
    detailsDiv.style.display = 'none';

    // Detect search type
    let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
    try {
      const data = await fetchCustomer(val, type);
      await showCustomer(data);
    } catch {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching data.','danger');
    }
  };
});

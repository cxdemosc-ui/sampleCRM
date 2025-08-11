// === Supabase & Webhook Config ===
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY = 'YOUR_ANON_KEY';  // Replace with your actual anon key
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: `https://hooks.us.webexconnect.io/events/RHV57QR4M3`
};

// === UI Helpers ===
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}
function maskCard(num) {
  return (!num || num.length < 4) ? '' : '**** **** **** ' + num.slice(-4);
}

// === API Calls ===
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

async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return resp.json().catch(() => ({}));
}

// === Render Buttons For Cards ===
function renderCardActions(card, type) {
  const status = card.status.toLowerCase();
  const disabled = status === 'reissue' ? 'disabled' : '';
  let actions = '';

  if (status !== 'blocked' && !disabled) {
    actions += `<button class="btn btn-sm btn-danger btn-block-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">Block</button> `;
  } else if (status === 'blocked') {
    actions += `<button class="btn btn-sm btn-success btn-unblock-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}">UnBlock</button> `;
  }
  actions += `<button class="btn btn-sm btn-warning btn-reissue-card" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Reissue</button> `;
  actions += `<button class="btn btn-sm btn-secondary btn-mark-lost" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Mark Lost</button> `;
  actions += `<button class="btn btn-sm btn-info btn-dispute" data-type="${type}" data-no="${card.card_number}" data-status="${card.status}" ${disabled}>Dispute</button>`;
  return `<div class="card-actions mt-1">${actions}</div>`;
}

// === Bind Action Event Handlers ===
function bindActionHandlers(data) {
  document.querySelectorAll('.btn-block-card,.btn-unblock-card,.btn-reissue-card,.btn-mark-lost,.btn-dispute')
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
          custPhone: data.mobile_no || '',
          custPhone2: data.mobile_no2 || '',
          custAccount: data.account_number || '',
          custCard: cardNo || '',
          cardType: typeLabel,
          custEmail: data.email || '',
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };

        showMessage(`${actionType} request in progress...`, 'info');
        const result = await sendActionToWebexConnect(payload);
        if (result.status === 'OK') {
          if (isBlock) { btn.textContent = 'UnBlock'; btn.classList.replace('btn-block-card','btn-unblock-card'); btn.classList.replace('btn-danger','btn-success'); }
          else if (isUnblock) { btn.textContent = 'Block'; btn.classList.replace('btn-unblock-card','btn-block-card'); btn.classList.replace('btn-success','btn-danger'); }
          else if (isReissue) { btn.closest('.card-actions').querySelectorAll('button').forEach(b => b.disabled = true); }
          showMessage(`${actionType} request sent successfully for card ending ${cardNo.slice(-4)}.`, 'success');
        } else showMessage(`Request sent but not confirmed.`, 'warning');
      };
    });
}

// === Display Customer Data ===
async function showCustomer(data) {
  const detailsDiv = document.getElementById('customer-details');
  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.', 'danger');
    return;
  }
  document.getElementById('messageBar').style.display = 'none';
  detailsDiv.style.display = 'block';

  detailsDiv.innerHTML = `
    <div class="card p-3 mb-3 bg-light border-primary">
      <h5 class="text-primary">${data.customer_first_name} ${data.customer_last_name}</h5>
      <p><strong>Mobile:</strong> ${data.mobile_no} | <strong>Alt:</strong> ${data.mobile_no2}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      <p><strong>Account Number:</strong> ${data.account_number || 'N/A'}</p>
      <p><strong>Account Balance:</strong> $${data.account_balance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'}</p>
    </div>

    <h6 class="text-primary">Credit Cards</h6>
    ${(data.credit_cards || []).map(c => `<div class="border rounded p-2 mb-2 bg-white">${maskCard(c.card_number)} - ${c.status}${renderCardActions(c,"Credit")}</div>`).join('')}

    <h6 class="text-primary">Debit Cards</h6>
    ${(data.debit_cards || []).map(c => `<div class="border rounded p-2 mb-2 bg-white">${maskCard(c.card_number)} - ${c.status}${renderCardActions(c,"Debit")}</div>`).join('')}

    <h6 class="text-primary">Service Requests</h6>
    ${(data.service_requests || []).map(sr => `
      <div class="border rounded p-2 mb-2 bg-white">
        <div><strong>ID:</strong> ${sr.request_id}</div>
        <div><strong>Type:</strong> ${sr.request_type}</div>
        <div><strong>Status:</strong> ${sr.status}</div>
        <button class="btn btn-sm btn-info btn-update-sr" data-srid="${sr.request_id}">Update</button>
        <button class="btn btn-sm btn-danger btn-close-sr" data-srid="${sr.request_id}">Close</button>
      </div>`).join('')}
  `;
  bindActionHandlers(data);
}

// === Init on Page Load ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleString('en-GB',{
    weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'
  });
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
});

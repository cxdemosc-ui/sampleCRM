// === Supabase Configuration ===
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  updateCustomer: `${RPC_BASE_URL}update_customer_data_by_mobile_or_account`,
  createServiceRequest: `${RPC_BASE_URL}create_service_request`,
  updateServiceRequest: `${RPC_BASE_URL}update_service_request_status`,
  webexAction: `https://hooks.us.webexconnect.io/events/RHV57QR4M3`
};

// === Helper Functions ===
function formatDateDMY(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
}
function formatTimeHM(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function formatMoney(amount) {
  let n = Number(amount);
  if (isNaN(n)) n = 0;
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function maskCard(num) {
  if (!num || num.length < 4) return '';
  return '**** **** **** ' + num.slice(-4);
}
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}

async function fetchCustomer(identifier, searchType = 'auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };
  if (searchType === 'email') body.p_email = identifier;
  else if (/^\d{8}$/.test(identifier)) body.p_account_number = identifier;
  else body.p_mobile_no = identifier;

  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
  return await response.json();
}

function renderCardActions(card, type) {
  let actions = '';
  if (card.status !== 'blocked') {
    actions += `<button class="btn btn-demo btn-block-card" data-type="${type}" data-no="${card.card_number}">Block</button>`;
  } else {
    actions += `<button class="btn btn-demo btn-unblock-card" data-type="${type}" data-no="${card.card_number}">Unblock</button>`;
  }
  if (card.status !== 'reissue_in_progress') {
    actions += `<button class="btn btn-demo-outline btn-reissue-card" data-type="${type}" data-no="${card.card_number}">Reissue</button>`;
  }
  actions += `<button class="btn btn-demo-outline btn-mark-lost" data-type="${type}" data-no="${card.card_number}">Mark Lost</button>`;
  actions += `<button class="btn btn-demo-outline btn-dispute" data-type="${type}" data-no="${card.card_number}">Dispute</button>`;
  return actions;
}

async function sendActionToWebexConnect(payload) {
  const resp = await fetch(ENDPOINTS.webexAction, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) throw new Error(`Webhook error ${resp.status}`);

  let result;
  try {
    result = await resp.json();
  } catch {
    result = await resp.text();
  }
  return result;
}

// === Rendering Main ===
async function showCustomer(data) {
  const detailsDiv = document.getElementById('customer-details');
  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.', 'danger');
    return;
  }
  document.getElementById('messageBar').style.display = 'none';
  detailsDiv.style.display = 'block';

  // Build UI (omitted here for brevity — same as previous final version with dropdown for SR type)
  // Keeping exactly your previous HTML tables and layout…

  // CARD BUTTON ACTION HANDLERS
  detailsDiv.querySelectorAll('.btn-block-card,.btn-unblock-card,.btn-reissue-card,.btn-mark-lost,.btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const actionType =
          btn.classList.contains('btn-block-card') ? 'Block' :
          btn.classList.contains('btn-unblock-card') ? 'UnBlock' :
          btn.classList.contains('btn-reissue-card') ? 'Reissue' :
          btn.classList.contains('btn-mark-lost') ? 'Lost' :
          'Dispute';

        const payload = {
          custPhone: data.mobile_no || '',
          custPhone2: data.mobile_no2 || '',
          custAccount: data.account_number || '',
          custCard: btn.dataset.no || '',
          custEmail: data.email || '',
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };

        try {
          showMessage(`${actionType} request in progress...`, 'info');
          const result = await sendActionToWebexConnect(payload);
          if (typeof result === 'object' ? result.status === 'OK' : ('' + result).includes('OK')) {
            showMessage(`${actionType} request sent successfully for card ending ${btn.dataset.no.slice(-4)}.`, 'success');
          } else {
            showMessage(`Request sent but not confirmed by Webex. Response: ${JSON.stringify(result)}`, 'warning');
          }
        } catch (err) {
          showMessage(`Failed to send ${actionType} request.`, 'danger');
        }
      };
    });

  // SERVICE REQUEST FORM
  const newSRBtn = detailsDiv.querySelector('#newServiceRequestBtn');
  const newSRForm = detailsDiv.querySelector('#newSRForm');
  const createSRForm = detailsDiv.querySelector('#createSRForm');
  const cancelSRBtn = detailsDiv.querySelector('#cancelSRBtn');

  newSRBtn.onclick = () => { newSRForm.style.display = 'block'; newSRBtn.style.display = 'none'; };
  cancelSRBtn.onclick = () => { newSRForm.style.display = 'none'; newSRBtn.style.display = 'inline-block'; createSRForm.reset(); };

  createSRForm.onsubmit = async (e) => {
    e.preventDefault();
    const requestType = createSRForm.request_type.value.trim();
    const description = createSRForm.description.value.trim();
    if (!requestType || !description) {
      showMessage('Please fill all fields.', 'warning');
      return;
    }

    const payload = {
      custPhone: data.mobile_no || '',
      custPhone2: data.mobile_no2 || '',
      custAccount: data.account_number || '',
      custCard: '',
      custEmail: data.email || '',
      custAction: "ServiceRequest",
      serviceRequestType: requestType,
      serviceDescription: description
    };

    try {
      showMessage('Creating service request...', 'info');
      const result = await sendActionToWebexConnect(payload);
      if (typeof result === 'object' ? result.status === 'OK' : ('' + result).includes('OK')) {
        showMessage('Service request sent to Webex and created successfully.', 'success');
        createSRForm.reset();
        newSRForm.style.display = 'none';
        newSRBtn.style.display = 'inline-block';
        const val = document.getElementById('searchMobile').value.trim();
        let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
        const updatedData = await fetchCustomer(val, type);
        await showCustomer(updatedData);
      } else {
        showMessage(`Service request sent but not confirmed by Webex. Response: ${JSON.stringify(result)}`, 'warning');
      }
    } catch (err) {
      showMessage('Error creating service request.', 'danger');
    }
  };
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchMobile.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); } });

  searchBtn.onclick = async () => {
    const val = searchMobile.value.trim();
    if (!val) {
      showMessage('Please enter a mobile number, account number, or email.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';
    let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
    try {
      const data = await fetchCustomer(val, type);
      await showCustomer(data);
    } catch {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
    }
  };

  const params = new URLSearchParams(window.location.search);
  if (params.has('email')) {
    searchMobile.value = params.get('email');
    fetchCustomer(params.get('email'), 'email').then(showCustomer);
  } else if (params.has('accountNumber')) {
    searchMobile.value = params.get('accountNumber');
    searchBtn.click();
  } else if (params.has('mobileNo') || params.has('mobileno')) {
    searchMobile.value = params.get('mobileNo') || params.get('mobileno');
    searchBtn.click();
  }
});

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
  cardAction: `${RPC_BASE_URL}update_card_status`, // new placeholder endpoint
};

// --- Helper Functions ---
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

// --- API Call ---
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

// --- Render Card Actions Conditionally ---
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

// --- Rendering ---
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
    <h3>${data.customer_first_name || ''} ${data.customer_last_name || ''}</h3>
    <div class="form-row mb-3">
      <div class="col-md-4"><label>Email</label><div class="readonly-field">${data.email || ''}</div></div>
      <div class="col-md-4"><label>Mobile No 1</label><div class="readonly-field">${data.mobile_no || ''}</div></div>
      <div class="col-md-4"><label>Mobile No 2</label><div class="readonly-field">${data.mobile_no2 || ''}</div></div>
    </div>
    <div class="form-row mb-3">
      <div class="col-md-6"><label>Address</label><div class="readonly-field">${data.customer_address || ''}</div></div>
      <div class="col-md-3"><label>City</label><div class="readonly-field">${data.customer_city || ''}</div></div>
      <div class="col-md-3"><label>Account Number</label><div class="readonly-field">${data.account_number || ''}</div></div>
    </div>

    <h5>Accounts & Balances</h5>
    <table class="table table-bordered">
      <thead><tr><th>Account Number</th><th>Balance</th></tr></thead>
      <tbody>
        ${
          data.bank_accounts?.length
            ? data.bank_accounts.map(acc => `<tr><td>${acc.account_number}</td><td>${formatMoney(acc.balance)}</td></tr>`).join('')
            : '<tr><td colspan="2">No accounts found</td></tr>'
        }
      </tbody>
    </table>

    <h5>Recent Transactions</h5>
    <table class="table table-bordered">
      <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Amount</th><th>Reference Note</th></tr></thead>
      <tbody>
        ${
          data.recent_transactions?.length
            ? data.recent_transactions.map(tx => `
              <tr>
                <td>${formatDateDMY(tx.transaction_date)}</td>
                <td>${formatTimeHM(tx.transaction_date)}</td>
                <td>${tx.transaction_type || ''}</td>
                <td>${formatMoney(tx.amount)}</td>
                <td>${tx.reference_note || ''}</td>
              </tr>`).join('')
            : '<tr><td colspan="5">No transactions available</td></tr>'
        }
      </tbody>
    </table>

    <h5>Debit Cards</h5>
    ${
      data.debit_cards?.length
        ? data.debit_cards.map(dc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(dc.card_number)}</p>
            <p><strong>Status:</strong> ${dc.status || ''}</p>
            <div class="btn-group btn-action-group mt-2" role="group">
              ${renderCardActions(dc, 'debit')}
            </div>
          </div>`).join('')
        : '<p>No debit cards found</p>'
    }

    <h5>Credit Cards</h5>
    ${
      data.credit_cards?.length
        ? data.credit_cards.map(cc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(cc.card_number)}</p>
            <p><strong>Status:</strong> ${cc.status || ''}</p>
            <h6>Transactions</h6>
            ${
              cc.transactions?.length
                ? `<table class="table table-bordered">
                    <thead><tr><th>Date</th><th>Amount</th><th>Description or Merchant</th><th>Status</th></tr></thead>
                    <tbody>
                      ${cc.transactions.map(t => `
                        <tr>
                          <td>${formatDateDMY(t.transaction_date)}</td>
                          <td>${formatMoney(t.amount)}</td>
                          <td>${t.description || t.merchant_info || ''}</td>
                          <td>${t.status || ''}</td>
                        </tr>`).join('')}
                    </tbody>
                  </table>`
                : '<small>No transactions available</small>'
            }
            <div class="btn-group btn-action-group mt-2" role="group">
              ${renderCardActions(cc, 'credit')}
            </div>
          </div>`).join('')
        : '<p>No credit cards found</p>'
    }

    <h5>Service Requests</h5>
    ${
      data.service_requests?.length
        ? `<table class="table table-bordered">
            <thead><tr><th>Request No</th><th>Type</th><th>Status</th><th>Raised Date</th><th>Actions</th></tr></thead>
            <tbody>
              ${data.service_requests.map(sr => `
                <tr>
                  <td>${sr.request_id}</td>
                  <td>${sr.request_type || ''}</td>
                  <td>${sr.status || ''}</td>
                  <td>${sr.raised_date || 'N/A'}</td>
                  <td>
                    ${
                      sr.status?.toLowerCase() === 'closed'
                        ? ''
                        : `<button class="btn btn-sm btn-demo-outline btn-update-sr" data-id="${sr.request_id}">Update</button>
                           <button class="btn btn-sm btn-demo-outline btn-close-sr" data-id="${sr.request_id}">Close</button>`
                    }
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`
        : '<p>No service requests found</p>'
    }

    <button id="newServiceRequestBtn" class="btn btn-demo mt-3">Create New Service Request</button>
    <div id="newSRForm" class="mt-3" style="display:none;">
      <h5>Create New Service Request</h5>
      <form id="createSRForm">
        <div class="form-group">
          <label for="srType">Request Type</label>
          <input type="text" id="srType" name="request_type" class="form-control" required />
        </div>
        <div class="form-group">
          <label for="srDesc">Description</label>
          <textarea id="srDesc" name="description" class="form-control" rows="3" required></textarea>
        </div>
        <button type="submit" class="btn btn-demo">Submit</button>
        <button type="button" id="cancelSRBtn" class="btn btn-demo-outline ml-2">Cancel</button>
      </form>
    </div>
  `;

  // Event handlers
  detailsDiv.querySelectorAll('.btn-block-card,.btn-unblock-card,.btn-reissue-card,.btn-mark-lost,.btn-dispute').forEach(btn => {
    btn.onclick = async () => {
      const actionType = btn.classList.contains('btn-block-card') ? 'block'
                        : btn.classList.contains('btn-unblock-card') ? 'unblock'
                        : btn.classList.contains('btn-reissue-card') ? 'reissue'
                        : btn.classList.contains('btn-mark-lost') ? 'mark_lost'
                        : 'dispute';
      try {
        showMessage(`${actionType} request in progress...`, 'info');
        await fetch(ENDPOINTS.cardAction, {
          method: 'POST',
          headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            card_number: btn.dataset.no,
            action: actionType,
            card_type: btn.dataset.type
          })
        });
        showMessage(`${actionType} request submitted for card ending ${btn.dataset.no.slice(-4)}.`, 'success');
      } catch (err) {
        showMessage(`Error performing action: ${actionType}`, 'danger');
      }
    };
  });

  detailsDiv.querySelectorAll('.btn-update-sr').forEach(btn => {
    btn.onclick = () => alert(`Update service request #${btn.dataset.id} - backend to be implemented`);
  });
  detailsDiv.querySelectorAll('.btn-close-sr').forEach(btn => {
    btn.onclick = () => alert(`Close service request #${btn.dataset.id} - backend to be implemented`);
  });

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
    showMessage('Creating service request...', 'info');

    try {
      await fetch(ENDPOINTS.createServiceRequest, {
        method: 'POST',
        headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_type: requestType, description: description })
      });
      showMessage('Service request created successfully.', 'success');
      createSRForm.reset();
      newSRForm.style.display = 'none';
      newSRBtn.style.display = 'inline-block';

      const val = document.getElementById('searchMobile').value.trim();
      let type = val.includes('@') ? 'email' : /^\d{8}$/.test(val) ? 'account' : 'mobile';
      const updatedData = await fetchCustomer(val, type);
      await showCustomer(updatedData);
    } catch (err) {
      showMessage('Error creating service request.', 'danger');
    }
  };
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const currentDateEl = document.getElementById('currentDate');
  currentDateEl.textContent = new Date().toLocaleString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchMobile.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

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
    } catch (error) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
    }
  };

  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  const accountParam = params.get('accountNumber');
  const mobileParam = params.get('mobileNo') || params.get('mobileno');
  if (emailParam) {
    searchMobile.value = emailParam;
    fetchCustomer(emailParam, 'email').then(showCustomer);
  } else if (accountParam) {
    searchMobile.value = accountParam;
    searchBtn.click();
  } else if (mobileParam) {
    searchMobile.value = mobileParam;
    searchBtn.click();
  }
});

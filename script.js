// Your Supabase project info and RPC endpoints
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
// Replace with your actual full API key
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: RPC_BASE_URL + 'get_customer_full_view',
  updateCustomer: RPC_BASE_URL + 'update_customer_data_by_mobile_or_account',
  createServiceRequest: RPC_BASE_URL + 'create_service_request',     // TODO: Implement backend RPC
  updateServiceRequest: RPC_BASE_URL + 'update_service_request_status' // TODO: Implement backend RPC
};

// Helper: Format date as "DD-MM-YYYY"
function formatDateDMY(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Helper: Format time as "HH:mm" (24h)
function formatTimeHM(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Helper: Format money values with commas and 2 decimals
function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0.00';
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mask card number to show only last 4 digits
function maskCard(num) {
  if (!num || num.length < 4) return '';
  return '**** **** **** ' + num.slice(-4);
}

// Show status messages
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}

// Fetch customer by mobile or account number
async function fetchCustomer(identifier) {
  const isAccountNumber = /^\d{8}$/.test(identifier);
  const body = isAccountNumber
    ? { p_mobile_no: null, p_account_number: identifier }
    : { p_mobile_no: identifier, p_account_number: null };

  console.log('[fetchCustomer] Payload:', body);

  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
  return await response.json();
}

// Update customer info RPC call
async function updateCustomer(form, mobileNo, accountNo) {
  const updatePayload = {
    p_mobile_no: mobileNo,
    p_account_number: accountNo,
    p_address: form.address.value,
    p_city: form.city.value,
    p_mobile_no2: form.mobile_no2.value,
    p_email: form.email.value
  };

  console.log('[updateCustomer] Payload:', updatePayload);

  const response = await fetch(ENDPOINTS.updateCustomer, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updatePayload)
  });

  if (!response.ok) throw new Error(`Update API Error: ${response.status} ${response.statusText}`);
  return await response.json();
}

// Placeholder for service request creation
async function createServiceRequest(customerId, description) {
  showMessage('Creating service request (placeholder)', 'info');
  // TODO: Implement backend call here
  return true;
}

// Placeholder for updating service request status
async function updateServiceRequestStatus(requestId, status) {
  showMessage('Updating service request status (placeholder)', 'info');
  // TODO: Implement backend call here
  return true;
}

// Render customer data and bind UI events
async function showCustomer(data) {
  const detailsDiv = document.getElementById('customer-details');
  const msgDiv = document.getElementById('messageBar');

  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found', 'danger');
    return;
  }

  msgDiv.style.display = 'none';
  detailsDiv.style.display = 'block';

  const info = data.customer_info || {};
  const accounts = data.bank_accounts || [];
  let balanceDisplay = 'N/A';
  let accountNumbersDisplay = 'N/A';

  if (accounts.length > 0) {
    accountNumbersDisplay = accounts.map(acc => acc.account_number).join(', ');
  }
  if (accounts.length > 0) {
    // Format balances in table rows not in a string; we will render below in a table
    balanceDisplay = ''; // Will render balances in table rows
  } else if (data.account_number && data.balance !== undefined) {
    balanceDisplay = formatMoney(data.balance);
    accountNumbersDisplay = data.account_number;
  }

  const recentTransactions = data.recent_transactions || [];
  const debitCards = data.debit_cards || [];
  const creditCards = data.credit_cards || [];
  const serviceRequests = data.service_requests || [];

  detailsDiv.innerHTML = `
    <h5>Accounts & Balances</h5>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Account Number</th><th>Balance</th></tr></thead>
        <tbody>
          ${accounts.length > 0
            ? accounts.map(acc => `
              <tr>
                <td>${acc.account_number}</td>
                <td>${formatMoney(acc.balance)}</td>
              </tr>`).join('')
            : `<tr><td colspan="2">No accounts found</td></tr>`}
        </tbody>
      </table>
    </div>

    <form id="updateForm" class="mb-4">
      <h3>${info.first_name || ''} ${info.last_name || ''}</h3>
      <div class="form-row mb-2">
        <div class="col">
          <label>DOB</label>
          <div class="readonly-field">${formatDateDMY(info.dob)}</div>
        </div>
        <div class="col">
          <label>Account Number(s)</label>
          <div class="readonly-field">${accountNumbersDisplay}</div>
        </div>
        <div class="col">
          <label>Balance Summary</label>
          <div class="readonly-field">${balanceDisplay || 'Multiple accounts'}</div>
        </div>
      </div>

      <div class="form-group">
        <label>Email</label>
        <input name="email" type="email" class="form-control" value="${info.email || ''}" />
      </div>
      <div class="form-group">
        <label>Address</label>
        <input name="address" type="text" class="form-control" value="${info.address || ''}" />
      </div>
      <div class="form-group">
        <label>City</label>
        <input name="city" type="text" class="form-control" value="${info.city || ''}" />
      </div>
      <div class="form-group">
        <label>Mobile No 2</label>
        <input name="mobile_no2" type="text" class="form-control" value="${info.mobile_no2 || ''}" />
      </div>
      <button type="submit" class="btn btn-primary">Update Customer Info</button>
    </form>

    <h4>Recent Transactions</h4>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Amount</th><th>Reference Note</th></tr></thead>
        <tbody>
          ${recentTransactions.length > 0 ? recentTransactions.map(tx => `
            <tr>
              <td>${formatDateDMY(tx.transaction_date)}</td>
              <td>${formatTimeHM(tx.transaction_date)}</td>
              <td>${tx.transaction_type || ''}</td>
              <td>${tx.amount ?? ''}</td>
              <td>${tx.reference_note || ''}</td>
            </tr>
          `).join('') : `<tr><td colspan="5">No transactions available</td></tr>`}
        </tbody>
      </table>
    </div>

    <h4>Debit Cards</h4>
    ${debitCards.length > 0 ? debitCards.map(dc => `
      <div class="card p-3 mb-2">
        <p><strong>Card Number:</strong> ${maskCard(dc.card_number)}</p>
        <p><strong>Status:</strong> ${dc.status || ''}</p>
        <h6>Transactions</h6>
        ${dc.transactions && dc.transactions.length > 0 ? `
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead>
              <tbody>
                ${dc.transactions.map(t => `
                  <tr>
                    <td>${formatDateDMY(t.transaction_date)}</td>
                    <td>${t.reference_note || ''}</td>
                    <td>${t.amount}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<small>No transactions available</small>'}
        <div class="btn-group btn-action-group mt-2" role="group">
          <button class="btn btn-warning btn-block-card" data-type="debit" data-no="${dc.card_number}">Block</button>
          <button class="btn btn-info btn-reissue-card" data-type="debit" data-no="${dc.card_number}">Reissue</button>
          <button class="btn btn-danger btn-mark-lost" data-type="debit" data-no="${dc.card_number}">Mark Lost</button>
          <button class="btn btn-secondary btn-dispute" data-type="debit" data-no="${dc.card_number}">Dispute</button>
        </div>
      </div>
    `).join('') : '<p>No debit cards found</p>'}

    <h4>Credit Cards</h4>
    ${creditCards.length > 0 ? creditCards.map(cc => `
      <div class="card p-3 mb-2">
        <p><strong>Card Number:</strong> ${maskCard(cc.card_number)}</p>
        <p><strong>Status:</strong> ${cc.status || ''}</p>
        <h6>Transactions</h6>
        ${cc.transactions && cc.transactions.length > 0 ? `
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead>
              <tbody>
                ${cc.transactions.map(t => `
                  <tr>
                    <td>${formatDateDMY(t.transaction_date)}</td>
                    <td>${t.reference_note || ''}</td>
                    <td>${t.amount}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : '<small>No transactions available</small>'}
        <div class="btn-group btn-action-group mt-2" role="group">
          <button class="btn btn-warning btn-block-card" data-type="credit" data-no="${cc.card_number}">Block</button>
          <button class="btn btn-info btn-reissue-card" data-type="credit" data-no="${cc.card_number}">Reissue</button>
          <button class="btn btn-danger btn-mark-lost" data-type="credit" data-no="${cc.card_number}">Mark Lost</button>
          <button class="btn btn-secondary btn-dispute" data-type="credit" data-no="${cc.card_number}">Dispute</button>
        </div>
      </div>
    `).join('') : '<p>No credit cards found</p>'}

    <h4>Service Requests</h4>
    <button id="newServiceRequestBtn" class="btn btn-success mb-2">Create New Service Request</button>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Request No</th><th>Type</th><th>Status</th><th>Raised Date</th><th>Actions</th></tr></thead>
        <tbody>
          ${serviceRequests.length > 0 ? serviceRequests.map(sr => `
            <tr>
              <td>${sr.request_id}</td>
              <td>${sr.request_type || ''}</td>
              <td>${sr.status || ''}</td>
              <td>${formatDateDMY(sr.raised_date)}</td>
              <td>
                <button class="btn btn-sm btn-primary btn-update-sr" data-id="${sr.request_id}">Update</button>
                <button class="btn btn-sm btn-danger btn-close-sr" data-id="${sr.request_id}">Close</button>
              </td>
            </tr>`).join('') : `<tr><td colspan="5">No service requests found</td></tr>`}
        </tbody>
      </table>
    </div>

    <div id="newSRForm" style="display:none;">
      <h5>Create New Service Request</h5>
      <form id="createSRForm">
        <div class="form-group">
          <label for="srType">Request Type</label>
          <input id="srType" name="request_type" class="form-control" required />
        </div>
        <div class="form-group">
          <label for="srDesc">Description</label>
          <textarea id="srDesc" name="description" class="form-control" required></textarea>
        </div>
        <button type="submit" class="btn btn-success">Submit</button>
        <button type="button" id="cancelSRBtn" class="btn btn-secondary ml-2">Cancel</button>
      </form>
    </div>

    <div class="alert alert-info mt-3">
      [Placeholder for notifications to customers on changes.]
    </div>
  `;

  // Bind customer update form submission
  const updateForm = detailsDiv.querySelector('#updateForm');
  updateForm.onsubmit = async (e) => {
    e.preventDefault();
    showMessage('Updating customer info...', 'info');
    try {
      await updateCustomer(updateForm, info.mobile_no, info.account_number);
      showMessage('Customer info updated; service request created; notification sent (placeholder).', 'success');
    } catch {
      showMessage('Failed to update customer info.', 'danger');
    }
  };

  // New Service Request UI handlers
  const newSRBtn = detailsDiv.querySelector('#newServiceRequestBtn');
  const newSRFormContainer = detailsDiv.querySelector('#newSRForm');
  const createSRForm = detailsDiv.querySelector('#createSRForm');
  const cancelSRBtn = detailsDiv.querySelector('#cancelSRBtn');

  newSRBtn.onclick = () => {
    newSRFormContainer.style.display = 'block';
    newSRBtn.style.display = 'none';
  };

  cancelSRBtn.onclick = () => {
    newSRFormContainer.style.display = 'none';
    newSRBtn.style.display = 'inline-block';
    createSRForm.reset();
  };

  createSRForm.onsubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(createSRForm);
    const requestType = formData.get('request_type');
    const description = formData.get('description');
    showMessage('Creating service request...', 'info');
    try {
      await createServiceRequest(info.customer_id, `Type: ${requestType}; Desc: ${description}`);
      showMessage('Service request created and notification sent (placeholder).', 'success');
      createSRForm.reset();
      newSRFormContainer.style.display = 'none';
      newSRBtn.style.display = 'inline-block';
    } catch {
      showMessage('Failed to create service request.', 'danger');
    }
  };

  // Service request update/close placeholder buttons
  detailsDiv.querySelectorAll('.btn-update-sr').forEach(btn => {
    btn.onclick = () => alert(`Update service request #${btn.dataset.id} coming soon.`);
  });
  detailsDiv.querySelectorAll('.btn-close-sr').forEach(btn => {
    btn.onclick = () => alert(`Close service request #${btn.dataset.id} coming soon.`);
  });

  // Card action buttons placeholder
  detailsDiv.querySelectorAll('.btn-block-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute').forEach(button => {
    button.onclick = () => {
      const type = button.getAttribute('data-type');
      const no = button.getAttribute('data-no');
      const action = button.textContent;
      showMessage(`${action} request for ${type} card ending ${no.slice(-4)} submitted (placeholder).`, 'success');
    };
  });
}

// Init event handlers after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  searchMobile.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  searchBtn.onclick = async () => {
    const identifier = searchMobile.value.trim();
    if (!identifier) {
      showMessage('Please enter a mobile number or account number.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';

    try {
      const data = await fetchCustomer(identifier);
      await showCustomer(data);
    } catch (err) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
      console.error(err);
    }
  };

  // Auto-search if "mobileNo" present in URL as query param
  const params = new URLSearchParams(window.location.search);
  const urlMobile = params.get('mobileNo');
  if (urlMobile) {
    searchMobile.value = urlMobile;
    searchBtn.click();
  }
});

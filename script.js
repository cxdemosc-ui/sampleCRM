const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY = 'your_full_api_key_here';  // Insert actual key here
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: RPC_BASE_URL + 'get_customer_full_view',
  updateCustomer: RPC_BASE_URL + 'update_customer_data_by_mobile_or_account',
  createServiceRequest: RPC_BASE_URL + 'create_service_request',     // TODO implement backend
  updateServiceRequest: RPC_BASE_URL + 'update_service_request_status' // TODO implement backend
};

function formatDateDMY(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatTimeHM(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0.00';
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

async function fetchCustomer(identifier) {
  const isAccount = /^\d{8}$/.test(identifier);
  const body = isAccount ? { p_mobile_no: null, p_account_number: identifier } : { p_mobile_no: identifier, p_account_number: null };
  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`API Error ${response.status}`);
  return await response.json();
}

async function updateCustomer(form, mobileNo, accountNo) {
  const payload = {
    p_mobile_no: mobileNo,
    p_account_number: accountNo,
    p_address: form.address.value,
    p_city: form.city.value,
    p_mobile_no2: form.mobile_no2.value,
    p_email: form.email.value
  };
  const response = await fetch(ENDPOINTS.updateCustomer, {
    method: 'POST',
    headers: { apikey: API_KEY, Authorization: `Bearer ${AUTH_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Update API Error ${response.status}`);
  return await response.json();
}

async function showCustomer(data) {
  if (!data || data.error) {
    document.getElementById('customer-details').style.display = 'none';
    showMessage(data?.error ?? 'No customer found', 'danger');
    return;
  }
  const detailsDiv = document.getElementById('customer-details');
  const info = data.customer_info || {};
  const accounts = data.bank_accounts || [];
  const recentTransactions = data.recent_transactions || [];
  const debitCards = data.debit_cards || [];
  const creditCards = data.credit_cards || [];
  const serviceRequests = data.service_requests || [];

  document.getElementById('messageBar').style.display = 'none';
  detailsDiv.style.display = 'block';

  // Build HTML: customer info, then accounts table below customer info (no separate balance summary)
  detailsDiv.innerHTML = `
    <h3>${info.first_name || ''} ${info.last_name || ''}</h3>
    <div class="form-row mb-3">
      <div class="col-md-4">
        <label>DOB</label>
        <div class="readonly-field">${formatDateDMY(info.dob)}</div>
      </div>
      <div class="col-md-4">
        <label>Email</label>
        <div class="readonly-field">${info.email || ''}</div>
      </div>
      <div class="col-md-4">
        <label>Mobile No 2</label>
        <div class="readonly-field">${info.mobile_no2 || ''}</div>
      </div>
    </div>
    <div class="form-row mb-3">
      <div class="col-md-6">
        <label>Address</label>
        <div class="readonly-field">${info.address || ''}</div>
      </div>
      <div class="col-md-3">
        <label>City</label>
        <div class="readonly-field">${info.city || ''}</div>
      </div>
    </div>

    <h5>Accounts & Balances</h5>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Account Number</th><th>Balance</th></tr></thead>
        <tbody>
          ${
            accounts.length > 0
              ? accounts.map(acc => `<tr><td>${acc.account_number}</td><td>${formatMoney(acc.balance)}</td></tr>`).join('')
              : `<tr><td colspan="2">No accounts found</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <form id="updateForm" class="mb-4 mt-4">
      <div class="form-group">
        <label>Email (editable)</label>
        <input name="email" type="email" class="form-control" value="${info.email || ''}" />
      </div>
      <div class="form-group">
        <label>Address (editable)</label>
        <input name="address" type="text" class="form-control" value="${info.address || ''}" />
      </div>
      <div class="form-group">
        <label>City (editable)</label>
        <input name="city" type="text" class="form-control" value="${info.city || ''}" />
      </div>
      <div class="form-group">
        <label>Mobile No 2 (editable)</label>
        <input name="mobile_no2" type="text" class="form-control" value="${info.mobile_no2 || ''}" />
      </div>
      <button type="submit" class="btn btn-primary">Update Customer Info</button>
    </form>

    <!-- Your existing tables for transactions, cards, service requests come here unchanged -->
  `;

  // Bind update form submission
  detailsDiv.querySelector('#updateForm').onsubmit = async e => {
    e.preventDefault();
    showMessage('Updating customer info...', 'info');
    try {
      await updateCustomer(e.target, info.mobile_no, info.account_number);
      showMessage('Customer info updated; service request created; notification sent (placeholder).', 'success');
    } catch {
      showMessage('Failed to update customer info.', 'danger');
    }
  };

  // Bind other buttons etc. as you had previously...
}

document.addEventListener('DOMContentLoaded', () => {
  // Display current date top-right
  const currentDateEl = document.getElementById('currentDate');
  currentDateEl.textContent = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short' });

  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  // Enter key triggers search
  searchMobile.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  searchBtn.onclick = async () => {
    const value = searchMobile.value.trim();
    if (!value) {
      showMessage('Please enter a mobile number or account number.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';
    try {
      const data = await fetchCustomer(value);
      await showCustomer(data);
    } catch (err) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
      console.error(err);
    }
  };

  // Auto search if mobileNo in url
  const params = new URLSearchParams(window.location.search);
  const mobile = params.get('mobileNo');
  if(mobile){
    searchMobile.value = mobile;
    searchBtn.click();
  }
});

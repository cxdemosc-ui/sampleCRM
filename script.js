// Configuration for Supabase
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

const ENDPOINTS = {
  getCustomer: RPC_BASE_URL + 'get_customer_full_view',
  updateCustomer: RPC_BASE_URL + 'update_customer_data_by_mobile_or_account',
  createServiceRequest: RPC_BASE_URL + 'create_service_request',
  updateServiceRequest: RPC_BASE_URL + 'update_service_request_status',
};

// Format date as DD-MM-YYYY
function formatDateDMY(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// Format time as HH:mm (24h)
function formatTimeHM(dtStr) {
  if (!dtStr) return 'N/A';
  const d = new Date(dtStr);
  if (isNaN(d)) return 'N/A';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Format money with commas and 2 decimals
function formatMoney(amount) {
  if (amount == null || isNaN(amount)) return '0.00';
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Mask card number to only show last 4 digits
function maskCard(num) {
  if (!num || num.length < 4) return '';
  return '**** **** **** ' + num.slice(-4);
}

// Display status message
function showMessage(message, type = 'info') {
  const msgDiv = document.getElementById('messageBar');
  msgDiv.innerText = message;
  msgDiv.className = `alert alert-${type}`;
  msgDiv.style.display = 'block';
}

// Fetch customer data via RPC
async function fetchCustomer(identifier) {
  const isAccountNumber = /^\d{8}$/.test(identifier);
  const body = isAccountNumber
    ? { p_mobile_no: null, p_account_number: identifier }
    : { p_mobile_no: identifier, p_account_number: null };

  const response = await fetch(ENDPOINTS.getCustomer, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
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
    p_email: form.email.value,
  };

  const response = await fetch(ENDPOINTS.updateCustomer, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updatePayload),
  });

  if (!response.ok) throw new Error(`Update Error: ${response.status} ${response.statusText}`);

  return await response.json();
}

// Placeholder for service request creation
async function createServiceRequest(customerId, description) {
  showMessage('Creating service request (placeholder)', 'info');
  // TODO: Integrate backend call
  return true;
}

// Placeholder for service request update
async function updateServiceRequestStatus(requestId, status) {
  showMessage('Updating service request status (placeholder)', 'info');
  // TODO: Integrate backend call
  return true;
}

// Render customer data to page
async function showCustomer(data) {
  const detailsDiv = document.getElementById('customer-details');
  const msgDiv = document.getElementById('messageBar');

  if (!data || data.error) {
    detailsDiv.style.display = 'none';
    showMessage(data?.error ?? 'No customer found.', 'danger');
    return;
  }

  msgDiv.style.display = 'none';
  detailsDiv.style.display = 'block';

  const info = data.customer_info || {};
  const accounts = data.bank_accounts || [];

  const recentTransactions = data.recent_transactions || [];
  const debitCards = data.debit_cards || [];
  const creditCards = data.credit_cards || [];
  const serviceRequests = data.service_requests || [];

  // Remove balance summary, just show accounts table below customer info
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

    <h5 class="mt-4">Accounts &amp; Balances</h5>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead>
          <tr><th>Account Number</th><th>Balance</th></tr>
        </thead>
        <tbody>
          ${accounts.length > 0 
            ? accounts.map(acc => `
              <tr>
                <td>${acc.account_number}</td>
                <td>${formatMoney(acc.balance)}</td>
              </tr>
            `).join('')
            : `<tr><td colspan="2">No accounts found</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <!-- Editable customer info form -->
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

    <!-- Rest of your tables for transactions, cards, service requests as before -->
    <!-- (unchanged from your existing script) -->
  `;

  // Bind update form submission event
  const updateForm = detailsDiv.querySelector('#updateForm');
  updateForm.onsubmit = async e => {
    e.preventDefault();
    showMessage('Updating customer info...', 'info');
    try {
      await updateCustomer(updateForm, info.mobile_no, info.account_number);
      showMessage('Customer info updated; service request created; notification sent (placeholder).', 'success');
    } catch {
      showMessage('Failed to update customer info.', 'danger');
    }
  };

  // ... Bind other handlers for service requests, card actions, etc. as before ...
}

// Initialize event handlers and auto search
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');
  const currentDateEl = document.getElementById('currentDate');

  // Display current date in header
  function showCurrentDate() {
    const now = new Date();
    currentDateEl.textContent = now.toLocaleString('en-GB', {
      dateStyle: 'full', timeStyle: 'short', timeZoneName: 'short'
    });
  }
  showCurrentDate();

  // Trigger search on Enter key press
  searchMobile.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  // Handle Search button click
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
    } catch (error) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
      console.error(error);
    }
  };

  // Auto search on page load if mobileNo param in URL
  const params = new URLSearchParams(window.location.search);
  const urlMobile = params.get('mobileNo');
  if (urlMobile) {
    searchMobile.value = urlMobile;
    searchBtn.click();
  }
});

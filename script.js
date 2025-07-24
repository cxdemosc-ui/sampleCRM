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

// === API call to fetch customer data ===
async function fetchCustomer(identifier, searchType = 'auto') {
  const body = {
    p_mobile_no: null,
    p_account_number: null,
    p_email: null,
  };

  if (searchType === 'email') {
    body.p_email = identifier;
  } else if (/^\d{8}$/.test(identifier)) {
    body.p_account_number = identifier;
  } else {
    body.p_mobile_no = identifier;
  }

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

// === Show customer details in the UI ===
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

  const info = data || {};
  const accounts = info.bank_accounts || [];
  const recentTransactions = info.recent_transactions || [];
  const debitCards = info.debit_cards || [];
  const creditCards = info.credit_cards || [];
  const serviceRequests = info.service_requests || [];

  // ==== Customer Info ====
  detailsDiv.innerHTML = `
    <h3>${info.customer_first_name || ''} ${info.customer_last_name || ''}</h3>
    <div class="form-row mb-3">
      <div class="col-md-4"><label>Email</label><div class="readonly-field">${info.email || ''}</div></div>
      <div class="col-md-4"><label>Mobile No 1</label><div class="readonly-field">${info.mobile_no || ''}</div></div>
      <div class="col-md-4"><label>Mobile No 2</label><div class="readonly-field">${info.mobile_no2 || ''}</div></div>
    </div>
    <div class="form-row mb-3">
      <div class="col-md-6"><label>Address</label><div class="readonly-field">${info.customer_address || ''}</div></div>
      <div class="col-md-3"><label>City</label><div class="readonly-field">${info.customer_city || ''}</div></div>
      <div class="col-md-3"><label>Account Number</label><div class="readonly-field">${info.account_number || ''}</div></div>
    </div>

    <h5>Accounts & Balances</h5>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Account Number</th><th>Balance</th></tr></thead>
        <tbody>
          ${
            accounts.length > 0
              ? accounts.map(acc => `<tr><td>${acc.account_number}</td><td>${formatMoney(acc.balance)}</td></tr>`).join('')
              : '<tr><td colspan="2">No accounts found</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <h4>Recent Transactions</h4>
    <div class="table-responsive">
      <table class="table table-sm table-bordered">
        <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Amount</th><th>Reference Note</th></tr></thead>
        <tbody>
          ${
            recentTransactions.length > 0
              ? recentTransactions.map(tx => `<tr><td>${formatDateDMY(tx.transaction_date)}</td><td>${formatTimeHM(tx.transaction_date)}</td><td>${tx.transaction_type || ''}</td><td>${tx.amount ?? ''}</td><td>${tx.reference_note || ''}</td></tr>`).join('')
              : '<tr><td colspan="5">No transactions available</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <h4>Debit Cards</h4>
    ${
      debitCards.length > 0
        ? debitCards.map(dc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(dc.card_number)}</p>
            <p><strong>Status:</strong> ${dc.status || ''}</p>
            <h6>Transactions</h6>
            ${
              dc.transactions && dc.transactions.length > 0
                ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead><tbody>${
                    dc.transactions.map(t => `<tr><td>${formatDateDMY(t.transaction_date)}</td><td>${t.reference_note || ''}</td><td>${t.amount}</td></tr>`).join('')
                  }</tbody></table></div>`
                : '<small>No transactions available</small>'
            }
          </div>`).join('') : '<p>No debit cards found</p>'
    }

    <h4>Credit Cards</h4>
    ${
      creditCards.length > 0
        ? creditCards.map(cc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(cc.card_number)}</p>
            <p><strong>Status:</strong> ${cc.status || ''}</p>
            <h6>Transactions</h6>
            ${
              cc.transactions && cc.transactions.length > 0
                ? `<div class="table-responsive"><table class="table table-sm"><thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead><tbody>${
                    cc.transactions.map(t => `<tr><td>${formatDateDMY(t.transaction_date)}</td><td>${t.reference_note || ''}</td><td>${t.amount}</td></tr>`).join('')
                  }</tbody></table></div>`
                : '<small>No transactions available</small>'
            }
          </div>`).join('') : '<p>No credit cards found</p>'
    }

    <h4>Service Requests</h4>
    ${
      serviceRequests.length > 0
        ? `<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Request No</th><th>Type</th><th>Status</th><th>Raised Date</th></tr></thead><tbody>${
            serviceRequests.map(sr => `<tr><td>${sr.request_id}</td><td>${sr.request_type || ''}</td><td>${sr.status || ''}</td><td>${formatDateDMY(sr.raised_date)}</td></tr>`).join('')
          }</tbody></table></div>`
        : '<p>No service requests found</p>'
    }
  `;
}

// === Initialization & Event Listeners ===
document.addEventListener('DOMContentLoaded', () => {
  // Display current date & time
  const currentDateEl = document.getElementById('currentDate');
  const now = new Date();
  currentDateEl.textContent = now.toLocaleString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');

  // Handle Enter key
  searchMobile.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      searchBtn.click();
    }
  });

  // Handle search button click
  searchBtn.onclick = async () => {
    const val = searchMobile.value.trim();
    if (!val) {
      showMessage('Please enter a mobile number, account number, or email.', 'warning');
      detailsDiv.style.display = 'none';
      return;
    }
    showMessage('Loading customer info...', 'info');
    detailsDiv.style.display = 'none';

    let type = 'auto';
    if (val.includes('@')) {
      type = 'email';
    } else if (/^\d{8}$/.test(val)) {
      type = 'account';
    } else {
      type = 'mobile';
    }

    try {
      const data = await fetchCustomer(val, type);
      await showCustomer(data);
    } catch (error) {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
      console.error(error);
    }
  };

  // URL params support mobileNo & mobileno, accountNumber, email
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  const accountParam = params.get('accountNumber');
  const mobileParam = params.get('mobileNo') || params.get('mobileno');

  if (emailParam) {
    searchMobile.value = emailParam;
    fetchCustomer(emailParam, 'email')
      .then(showCustomer)
      .catch(error => {
        detailsDiv.style.display = 'none';
        showMessage('Error fetching customer data.', 'danger');
        console.error(error);
      });
  } else if (accountParam) {
    searchMobile.value = accountParam;
    searchBtn.click();
  } else if (mobileParam) {
    searchMobile.value = mobileParam;
    searchBtn.click();
  }
});

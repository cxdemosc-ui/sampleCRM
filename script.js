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

// Helper functions (formatDateDMY, formatTimeHM, formatMoney, maskCard, showMessage)
function formatDateDMY(dtStr) { /* as before */ }
function formatTimeHM(dtStr) { /* as before */ }
function formatMoney(amount) { /* as before */ }
function maskCard(num) { /* as before */ }
function showMessage(message, type = 'info') { /* as before */ }

// --- fetchCustomer ---
async function fetchCustomer(identifier, searchType = 'auto') {
  const body = { p_mobile_no: null, p_account_number: null, p_email: null };

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

// --- showCustomer ---
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

  // Customer basics
  detailsDiv.innerHTML = `
    <h3>${data.customer_first_name || ''} ${data.customer_last_name || ''}</h3>
    <div class="form-row mb-3">
      <div class="col-md-4"><label>Email</label><input class="form-control" type="email" readonly value="${data.email || ''}" /></div>
      <div class="col-md-4"><label>Mobile No 1</label><input class="form-control" readonly value="${data.mobile_no || ''}" /></div>
      <div class="col-md-4"><label>Mobile No 2</label><input class="form-control" readonly value="${data.mobile_no2 || ''}" /></div>
    </div>
    <div class="form-row mb-3">
      <div class="col-md-6"><label>Address</label><input class="form-control" readonly value="${data.customer_address || ''}" /></div>
      <div class="col-md-3"><label>City</label><input class="form-control" readonly value="${data.customer_city || ''}" /></div>
      <div class="col-md-3"><label>Account Number</label><input class="form-control" readonly value="${data.account_number || ''}" /></div>
    </div>

    <h5>Accounts & Balances</h5>
    <table class="table table-bordered">
      <thead><tr><th>Account Number</th><th>Balance</th></tr></thead>
      <tbody>
        ${
          (data.bank_accounts && data.bank_accounts.length > 0)
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
          (data.recent_transactions && data.recent_transactions.length > 0)
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
      (data.debit_cards && data.debit_cards.length > 0)
        ? data.debit_cards.map(dc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(dc.card_number)}</p>
            <p><strong>Status:</strong> ${dc.status || ''}</p>
            <h6>Transactions</h6>
            ${
              (dc.transactions && dc.transactions.length > 0)
                ? `<table class="table table-bordered">
                  <thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead>
                  <tbody>${dc.transactions.map(t => `<tr>
                    <td>${formatDateDMY(t.transaction_date)}</td>
                    <td>${t.reference_note || ''}</td>
                    <td>${formatMoney(t.amount)}</td>
                  </tr>`).join('')}</tbody>
                </table>`
                : '<small>No transactions available</small>'
            }
            <div class="btn-group btn-action-group mt-2" role="group">
              <button class="btn btn-warning btn-block-card" data-type="debit" data-no="${dc.card_number}">Block</button>
              <button class="btn btn-info btn-reissue-card" data-type="debit" data-no="${dc.card_number}">Reissue</button>
              <button class="btn btn-danger btn-mark-lost" data-type="debit" data-no="${dc.card_number}">Mark Lost</button>
              <button class="btn btn-secondary btn-dispute" data-type="debit" data-no="${dc.card_number}">Dispute</button>
            </div>
          </div>`).join('')
        : '<p>No debit cards found</p>'
    }

    <h5>Credit Cards</h5>
    ${
      (data.credit_cards && data.credit_cards.length > 0)
        ? data.credit_cards.map(cc => `
          <div class="card p-3 mb-2">
            <p><strong>Card Number:</strong> ${maskCard(cc.card_number)}</p>
            <p><strong>Status:</strong> ${cc.status || ''}</p>
            <h6>Transactions</h6>
            ${
              (cc.transactions && cc.transactions.length > 0)
                ? `<table class="table table-bordered">
                  <thead><tr><th>Date</th><th>Reference Note</th><th>Amount</th></tr></thead>
                  <tbody>${cc.transactions.map(t => `<tr>
                    <td>${formatDateDMY(t.transaction_date)}</td>
                    <td>${t.reference_note || ''}</td>
                    <td>${formatMoney(t.amount)}</td>
                  </tr>`).join('')}</tbody>
                </table>`
                : '<small>No transactions available</small>'
            }
            <div class="btn-group btn-action-group mt-2" role="group">
              <button class="btn btn-warning btn-block-card" data-type="credit" data-no="${cc.card_number}">Block</button>
              <button class="btn btn-info btn-reissue-card" data-type="credit" data-no="${cc.card_number}">Reissue</button>
              <button class="btn btn-danger btn-mark-lost" data-type="credit" data-no="${cc.card_number}">Mark Lost</button>
              <button class="btn btn-secondary btn-dispute" data-type="credit" data-no="${cc.card_number}">Dispute</button>
            </div>
          </div>`).join('')
        : '<p>No credit cards found</p>'
    }

    <h5>Service Requests</h5>
    ${
      (data.service_requests && data.service_requests.length > 0)
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
                  <button class="btn btn-sm btn-primary btn-update-sr" data-id="${sr.request_id}">Update</button>
                  <button class="btn btn-sm btn-danger btn-close-sr" data-id="${sr.request_id}">Close</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`
        : '<p>No service requests found</p>'
    }
  `;

  // Bind event handlers for card and service request buttons
  detailsDiv.querySelectorAll('.btn-block-card').forEach(btn => {
    btn.onclick = () => showMessage(`Block request for card ending ${btn.dataset.no.slice(-4)} submitted (placeholder).`, 'success');
  });
  detailsDiv.querySelectorAll('.btn-reissue-card').forEach(btn => {
    btn.onclick = () => showMessage(`Reissue request for card ending ${btn.dataset.no.slice(-4)} submitted (placeholder).`, 'success');
  });
  detailsDiv.querySelectorAll('.btn-mark-lost').forEach(btn => {
    btn.onclick = () => showMessage(`Mark Lost request for card ending ${btn.dataset.no.slice(-4)} submitted (placeholder).`, 'success');
  });
  detailsDiv.querySelectorAll('.btn-dispute').forEach(btn => {
    btn.onclick = () => showMessage(`Dispute request for card ending ${btn.dataset.no.slice(-4)} submitted (placeholder).`, 'success');
  });
  detailsDiv.querySelectorAll('.btn-update-sr').forEach(btn => {
    btn.onclick = () => alert(`Update service request #${btn.dataset.id} - not yet implemented`);
  });
  detailsDiv.querySelectorAll('.btn-close-sr').forEach(btn => {
    btn.onclick = () => alert(`Close service request #${btn.dataset.id} - not yet implemented`);
  });
}

// === Initialization: load date, setup handlers, and auto-search from URL params ===
document.addEventListener('DOMContentLoaded', () => {
  const currentDateEl = document.getElementById('currentDate');
  currentDateEl.textContent = new Date().toLocaleString('en-GB', {
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

  // Support URL parameters: email, accountNumber, mobileNo, and mobileno (case-insensitive)
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  const accountParam = params.get('accountNumber');
  const mobileParam = params.get('mobileNo') || params.get('mobileno');

  if (emailParam) {
    searchMobile.value = emailParam;
    fetchCustomer(emailParam, 'email').then(showCustomer).catch(e => {
      detailsDiv.style.display = 'none';
      showMessage('Error fetching customer data.', 'danger');
      console.error(e);
    });
  } else if (accountParam) {
    searchMobile.value = accountParam;
    searchBtn.click();
  } else if (mobileParam) {
    searchMobile.value = mobileParam;
    searchBtn.click();
  }
});

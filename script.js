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

// === Helper functions: (No changes, reuse your existing formatDateDMY, formatTimeHM, maskCard etc.) ===

// === Main fetchCustomer function ===
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

// === Complete showCustomer function: Your existing code, unchanged === (same as previous)

// === Page Initialization & URL Parameter Handling ===
document.addEventListener('DOMContentLoaded', () => {
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

    // Auto-detect type and search
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

  // URL Parameters for search: check email, accountNumber, mobileNo in priority order
  const params = new URLSearchParams(window.location.search);
  const emailParam = params.get('email');
  const accountParam = params.get('accountNumber');
  const mobileParam = params.get('mobileNo');

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

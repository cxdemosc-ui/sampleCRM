// Replace these with your actual Supabase project details
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const SUPABASE_RPC_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/get_customer_full_view`;
const SUPABASE_UPDATE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/update_customer_data_by_mobile_or_account`;
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;

async function fetchCustomer(identifier) {
  const body = /^\d{8}$/.test(identifier)
    ? { p_mobile_no: null, p_account_number: identifier }
    : { p_mobile_no: identifier, p_account_number: null };
  const res = await fetch(SUPABASE_RPC_URL, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to fetch customer');
  return await res.json();
}

async function updateCustomer(form, mobileNo, accountNo) {
  const updateFields = {
    p_mobile_no: mobileNo,
    p_account_number: accountNo,
    p_address: form.address.value,
    p_city: form.city.value,
    p_mobile_no2: form.mobile_no2.value,
    p_email: form.email.value
  };
  const res = await fetch(SUPABASE_UPDATE_URL, {
    method: 'POST',
    headers: {
      apikey: API_KEY,
      Authorization: `Bearer ${AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateFields)
  });
  if (!res.ok) throw new Error('Failed to update customer');
  return await res.json();
}

function maskCard(num) {
  if (!num || num.length < 4) return '';
  return '**** **** **** ' + num.slice(-4);
}

document.addEventListener('DOMContentLoaded', function () {
  const searchBtn = document.getElementById('searchBtn');
  const searchMobile = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');
  const msgDiv = document.getElementById('messageBar');

  async function showCustomer(customerData) {
    if (!customerData || customerData.error) {
      detailsDiv.style.display = 'none';
      msgDiv.textContent = customerData && customerData.error ? customerData.error : 'No customer found';
      msgDiv.className = 'alert alert-danger';
      msgDiv.style.display = 'block';
      return;
    }

    msgDiv.style.display = 'none';
    detailsDiv.style.display = 'block';

    const info = customerData.customer_info || {};
    detailsDiv.innerHTML = `
      <form id="updateForm" class="mb-4">
        <h3>${info.first_name || ''} ${info.last_name || ''}</h3>
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

      <hr />

      <h4>Debit Cards</h4>
      ${(customerData.debit_cards || []).map(dc => `
        <div class="card p-3 mb-2">
          <p><strong>Card Number:</strong> ${maskCard(dc.card_number)}</p>
          <p><strong>Status:</strong> ${dc.status || ''}</p>
          <div class="btn-group btn-action-group" role="group">
            <button class="btn btn-warning btn-block-card" data-type="debit" data-no="${dc.card_number}">Block</button>
            <button class="btn btn-info btn-reissue-card" data-type="debit" data-no="${dc.card_number}">Reissue</button>
            <button class="btn btn-danger btn-mark-lost" data-type="debit" data-no="${dc.card_number}">Mark Lost</button>
            <button class="btn btn-secondary btn-dispute" data-type="debit" data-no="${dc.card_number}">Raise Dispute</button>
          </div>
        </div>
      `).join('')}

      <h4>Credit Cards</h4>
      ${(customerData.credit_cards || []).map(cc => `
        <div class="card p-3 mb-2">
          <p><strong>Card Number:</strong> ${maskCard(cc.card_number)}</p>
          <p><strong>Status:</strong> ${cc.status || ''}</p>
          <div class="btn-group btn-action-group" role="group">
            <button class="btn btn-warning btn-block-card" data-type="credit" data-no="${cc.card_number}">Block</button>
            <button class="btn btn-info btn-reissue-card" data-type="credit" data-no="${cc.card_number}">Reissue</button>
            <button class="btn btn-danger btn-mark-lost" data-type="credit" data-no="${cc.card_number}">Mark Lost</button>
            <button class="btn btn-secondary btn-dispute" data-type="credit" data-no="${cc.card_number}">Raise Dispute</button>
          </div>
        </div>
      `).join('')}

      <h4>Service Requests</h4>
      <ul>
      ${(customerData.service_requests || []).map(sr =>
      `<li><b>${sr.request_type}</b> - ${sr.status} (${sr.raised_date || ''})</li>`
    ).join('')}
      </ul>

      <div class="alert alert-info mt-3">
        [Notification placeholder: All changes will trigger notifications to the customer]
      </div>
    `;

    // Form submit handling
    const updateForm = detailsDiv.querySelector('#updateForm');
    updateForm.onsubmit = async function (e) {
      e.preventDefault();
      msgDiv.textContent = 'Updating...';
      msgDiv.className = 'alert alert-info';
      msgDiv.style.display = 'block';
      try {
        await updateCustomer(updateForm, info.mobile_no, info.account_number);
        msgDiv.textContent = 'Details updated, service request created, notification sent (placeholder).';
        msgDiv.className = 'alert alert-success';
      } catch {
        msgDiv.textContent = 'Update failed.';
        msgDiv.className = 'alert alert-danger';
      }
    };

    // Card action buttons
    detailsDiv.querySelectorAll('.btn-block-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute').forEach(button => {
      button.onclick = function () {
        const type = button.getAttribute('data-type');
        const no = button.getAttribute('data-no');
        const action = button.textContent;
        msgDiv.textContent = `${action} request for ${type} card ending ${no.slice(-4)} submitted. Service request created and notification sent (placeholder).`;
        msgDiv.className = 'alert alert-success';
        msgDiv.style.display = 'block';

        // TODO: Integrate backend API to process card actions & raise service requests
      };
    });
  }

  // Search button event
  searchBtn.onclick = async function () {
    const identifier = searchMobile.value.trim();
    if (!identifier) {
      msgDiv.textContent = 'Please enter a mobile number or account number.';
      msgDiv.className = 'alert alert-warning';
      msgDiv.style.display = 'block';
      detailsDiv.style.display = 'none';
      return;
    }
    msgDiv.textContent = 'Loading...';
    msgDiv.className = 'alert alert-info';
    msgDiv.style.display = 'block';
    try {
      const data = await fetchCustomer(identifier);
      await showCustomer(data);
    } catch (err) {
      msgDiv.textContent = 'Error fetching customer data.';
      msgDiv.className = 'alert alert-danger';
      detailsDiv.style.display = 'none';
    }
  };

  // Auto search if mobileNo param is in URL
  const params = new URLSearchParams(window.location.search);
  const urlMobile = params.get('mobileNo');
  if (urlMobile) {
    searchMobile.value = urlMobile;
    searchBtn.click();
  }
});

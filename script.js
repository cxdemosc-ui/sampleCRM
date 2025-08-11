/*******************************************************
 * SampleCRM Final Frontend Script (2025-08, Fixed)
 * - Full refresh logic for all actions
 * - Proper SR Close handling
 * - Reissue disables Block/Lost
 *******************************************************/

const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const API_KEY = 'YOUR_SUPABASE_ANON_KEY';
const AUTH_TOKEN = API_KEY;
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: 'https://hooks.us.webexconnect.io/events/RHV57QR4M3',
};
let latestCustomer = null;

/* Helpers */
function showMessage(msg, type='info') {
  const bar = document.getElementById('messageBar');
  if (bar) {
    bar.className = `alert alert-${type}`;
    bar.textContent = msg;
    bar.style.display = 'block';
  }
}
function maskCard(num) { return (!num||num.length<4)?'':'**** **** **** ' + num.slice(-4); }
function formatMoney(a) { const n=Number(a); return isNaN(n)?'0.00':n.toLocaleString(undefined,{minimumFractionDigits:2}); }
function formatDateDMYHM(dt) {
  if (!dt) return '';
  const d = new Date(dt); if (isNaN(d)) return '';
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function cardStatusBadge(status) {
  const lc = String(status).toLowerCase();
  if (lc==='active') return `<span class="badge badge-status active">Active</span>`;
  if (lc==='blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if (lc.includes('re-issue') || lc.includes('reissued') || lc.includes('reissue')) return `<span class="badge badge-status reissued">Re-Issued</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

/* API calls */
async function fetchCustomer(identifier, searchType='auto') {
  const body={p_mobile_no:null, p_account_number:null, p_email:null};
  if (searchType==='email') body.p_email=identifier;
  else if (/^\d{8}$/.test(identifier)) body.p_account_number=identifier;
  else body.p_mobile_no=identifier;
  const r = await fetch(ENDPOINTS.getCustomer,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${AUTH_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if (!r.ok) throw new Error(`API Error ${r.status}`);
  return r.json();
}
async function sendAction(payload) {
  const r=await fetch(ENDPOINTS.webexAction,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  try { return await r.json(); } catch { return null; }
}

/* Render card actions with proper disable logic */
function renderCardActions(card, type) {
  const status = (card.status || '').toLowerCase();
  let html = '';
  if (status !== 'blocked') html += `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}">Block</button> `;
  else html += `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}">UnBlock</button> `;

  const dis = (status === 're-issued' || status === 'reissued' || status.includes('reissue')) ? 'disabled' : '';
  html += `<button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" ${dis}>Reissue</button>
           <button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" ${dis}>Lost</button>
           <button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" ${dis}>Dispute</button>`;
  return html;
}

/* Bind Handlers */
function bindActionHandlers(data) {
  // Card Actions
  document.querySelectorAll('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .forEach(btn => {
      btn.onclick = async () => {
        const cardNo = btn.dataset.no;
        const typeLabel = btn.dataset.type;
        let actionType = 
          btn.classList.contains('btn-block-card') ? 'Block' :
          btn.classList.contains('btn-unblock-card') ? 'UnBlock' :
          btn.classList.contains('btn-reissue-card') ? 'Reissue' :
          btn.classList.contains('btn-mark-lost') ? 'Lost' : 'Dispute';

        if (['Block','UnBlock','Reissue','Lost'].includes(actionType)) {
          if (!confirm(`${actionType} this ${typeLabel} card?\nEnds ${cardNo.slice(-4)}`)) return;
        }
        const payload = {
          custPhone: data.mobile_no,
          custPhone2: data.mobile_no2,
          custAccount: data.account_number || '',
          custCard: cardNo,
          cardType: typeLabel,
          custEmail: data.email,
          custAction: actionType,
          serviceRequestType: "",
          serviceDescription: ""
        };
        showMessage(`${actionType} request in progress...`, 'info');
        await sendAction(payload);
        setTimeout(() => document.getElementById('searchBtn').click(), 900);
      };
    });

  // New Service Request Form
  $("#newSRForm").off("submit").on("submit", async function(e) {
    e.preventDefault();
    const srType = $("#srType").val().trim();
    const srDesc = $("#srDesc").val().trim();
    if (!srType || !srDesc) {
      $("#newSRAlert").show().addClass('alert-danger').text("Type and Description required.");
      return;
    }
    const payload = {
      custPhone: data.mobile_no, custPhone2: data.mobile_no2, custAccount: data.account_number || '',
      custCard: "", cardType: "", custEmail: data.email,
      custAction: "NewRequest", serviceRequestType: srType, serviceDescription: srDesc
    };
    $("#newSRAlert").removeClass().addClass('alert alert-info').show().text("Creating Service Request...");
    await sendAction(payload);
    setTimeout(() => { $("#newSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
  });

  // SR Update / Close Modal Open
  $(document).off("click", ".btn-update-sr, .btn-close-sr").on("click", ".btn-update-sr, .btn-close-sr", function() {
    const isUpdate = $(this).hasClass("btn-update-sr");
    const row = $(this).closest("tr");
    $("#editSRModalLabel").text(isUpdate ? "Update Service Request" : "Close Service Request");
    $("#editSRAction").val(isUpdate ? "Update" : "Close");
    $("#editSRType").val(row.find("td:nth-child(2)").text());
    $("#editSRDesc").val(row.find(".sr-desc").attr("title") || "");
    $("#editSRAlert").hide().removeClass();
    $("#editSRModal").modal("show");
  });

  // SR Update / Close Form submit
  $("#editSRForm").off("submit").on("submit", async function(e) {
    e.preventDefault();
    const action = $("#editSRAction").val();
    const srType = $("#editSRType").val();
    const srDesc = $("#editSRDesc").val().trim();
    if (!srDesc) {
      $("#editSRAlert").show().addClass('alert-danger').text("Description is required.");
      return;
    }
    // ❗ Adjust 'custAction' value to exactly what backend expects for Close
    const payload = {
      custPhone: data.mobile_no, custPhone2: data.mobile_no2, custAccount: data.account_number || '',
      custCard: "", cardType: "", custEmail: data.email,
      custAction: action, // 'Update' or 'Close'
      serviceRequestType: srType, serviceDescription: srDesc
    };
    $("#editSRAlert").removeClass().addClass('alert alert-info').show().text(`${action} in progress...`);
    await sendAction(payload);
    setTimeout(() => { $("#editSRModal").modal('hide'); document.getElementById('searchBtn').click(); }, 900);
  });
}

/* Render Customer Details */
async function showCustomer(data) {
  latestCustomer = data;
  const div = document.getElementById('customer-details');
  if (!data || data.error) {
    div.style.display = 'none'; showMessage(data?.error || 'No customer found.', 'danger'); return;
  }
  div.style.display = 'block'; document.getElementById('messageBar').style.display = 'none';

  let html = `<div class="card p-3 mb-3 bg-light border-primary">
    <div class="row">…</div>
  </div>`;

  html += `<h6 class="text-primary">Debit Card</h6>`;
  html += (data.debit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      <div class="card-actions">${renderCardActions(c, "Debit")}</div>
    </div>`).join('');

  html += `<h6 class="text-primary">Credit Card</h6>`;
  html += (data.credit_cards || []).map(c => `
    <div class="border rounded p-2 mb-2 bg-white card-section">
      ${maskCard(c.card_number)} ${cardStatusBadge(c.status)}
      <div class="card-actions">${renderCardActions(c, "Credit")}</div>
    </div>`).join('');

  html += `<h6 class="text-primary">Service Requests</h6>`;
  html += (data.service_requests || []).length
    ? `<table class="table table-sm table-bordered"><tbody>${
        data.service_requests.map(sr => `
          <tr>
            <td>${sr.request_id}</td><td>${sr.request_type}</td><td>${sr.status}</td>
            <td class="sr-desc" title="${sr.description||''}">${sr.description||''}</td>
            <td>${sr.status==='Open'
                ? `<button class="btn btn-sm btn-update-sr">Update</button>
                   <button class="btn btn-sm btn-close-sr">Close</button>`
                : ''}</td>
          </tr>`).join('')
      }</tbody></table>`
    : `<p>No service requests found.</p>`;

  div.innerHTML = html;
  bindActionHandlers(data);
}

/* Init */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('currentDate').textContent = new Date().toLocaleString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const searchBtn = document.getElementById('searchBtn');
  const searchField = document.getElementById('searchMobile');
  const detailsDiv = document.getElementById('customer-details');
  searchField.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); searchBtn.click(); }});
  searchBtn.onclick = async () => {
    const val = searchField.value.trim();
    if (!val) { showMessage('Please enter a mobile, account, or email.', 'warning'); detailsDiv.style.display = 'none'; return; }
    showMessage('Loading customer info...', 'info'); detailsDiv.style.display = 'none';
    let type = val.includes('@') ? 'email' : (/^\d{8}$/.test(val) ? 'account' : 'mobile');
    try { const data = await fetchCustomer(val, type); await showCustomer(data); }
    catch { detailsDiv.style.display = 'none'; showMessage('Error fetching data.', 'danger'); }
  };
  $(document).on('click', '#newSRBtn', () => {
    if (!latestCustomer) { showMessage('Load a customer first.', 'danger'); return; }
    $("#newSRModal").modal("show");
  });
});

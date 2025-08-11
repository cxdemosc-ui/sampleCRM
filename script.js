/*******************************************************
 * SampleCRM script.js - Latest version (2025-08)
 *  - Unified handler for Debit/Credit card actions
 *  - New SR, Update SR, Close SR flows
 *  - Auto-refresh on all successes with slight delay
 *  - Robust success detection for any backend format
 *******************************************************/
 
const SUPABASE_PROJECT_REF = 'yrirrlfmjjfzcvmkuzpl';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyaXJybGZtampmemN2bWt1enBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxODk1MzQsImV4cCI6MjA2ODc2NTUzNH0.Iyn8te51bM2e3Pvdjrx3BkG14WcBKuqFhoIq2PSwJ8A';
const AUTH_TOKEN = API_KEY;
const RPC_BASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co/rest/v1/rpc/`;
const ENDPOINTS = {
  getCustomer: `${RPC_BASE_URL}get_customer_unified_search`,
  webexAction: 'https://hooks.us.webexconnect.io/events/RHV57QR4M3'
};
let latestCustomer = null;

/* Helpers */
function showMessage(msg, type='info'){
  $('#messageBar').attr('class',`alert alert-${type}`).text(msg).show();
}
function maskCard(cardNo){
  return (!cardNo||cardNo.length<4)?'':'**** **** **** '+cardNo.slice(-4);
}
function formatMoney(n){
  const num=Number(n);return isNaN(num)?'0.00':num.toLocaleString(undefined,{minimumFractionDigits:2});
}
function formatDateDMYHM(dt){
  if(!dt) return ''; const d=new Date(dt); if(isNaN(d)) return ''; 
  return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function cardStatusBadge(status){
  const lc=(status||'').toLowerCase();
  if(lc==='active') return `<span class="badge badge-status active">Active</span>`;
  if(lc==='blocked') return `<span class="badge badge-status blocked">Blocked</span>`;
  if(lc.includes('re-issue')||lc.includes('reissued')) return `<span class="badge badge-status reissued">Re-Issued</span>`;
  return `<span class="badge badge-status">${status}</span>`;
}

/* API Calls */
async function fetchCustomer(identifier, searchType='auto'){
  const body={p_mobile_no:null,p_account_number:null,p_email:null};
  if(searchType==='email') body.p_email=identifier;
  else if(/^\d{8}$/.test(identifier)) body.p_account_number=identifier;
  else body.p_mobile_no=identifier;

  const r=await fetch(ENDPOINTS.getCustomer,{method:'POST',headers:{apikey:API_KEY,Authorization:`Bearer ${AUTH_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error('API Error '+r.status);
  return r.json();
}
async function sendActionToWebexConnect(payload){
  const r=await fetch(ENDPOINTS.webexAction,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  try{return await r.json();}catch{return null;}
}

/* UI Renders */
function renderCardActions(card,type){
  const s=(card.status||'').toLowerCase();
  let html=s!=='blocked'
   ? `<button class="btn btn-sm btn-block-card" data-type="${type}" data-no="${card.card_number}">Block</button> `
   : `<button class="btn btn-sm btn-unblock-card" data-type="${type}" data-no="${card.card_number}">UnBlock</button> `;
  const dis=s==='re-issued'?'disabled':'';
  return html+`
    <button class="btn btn-sm btn-reissue-card" data-type="${type}" data-no="${card.card_number}" ${dis}>Reissue</button>
    <button class="btn btn-sm btn-mark-lost" data-type="${type}" data-no="${card.card_number}" ${dis}>Lost</button>
    <button class="btn btn-sm btn-dispute" data-type="${type}" data-no="${card.card_number}" ${dis}>Dispute</button>`;
}

/* Bind All Action Handlers */
function bindActionHandlers(data){
  // Card actions
  $('.btn-block-card, .btn-unblock-card, .btn-reissue-card, .btn-mark-lost, .btn-dispute')
    .off().on('click',async function(){
      const cardNo=$(this).data('no'), typeLabel=$(this).data('type');
      let actionType=$(this).hasClass('btn-block-card')?'Block':
                      $(this).hasClass('btn-unblock-card')?'UnBlock':
                      $(this).hasClass('btn-reissue-card')?'Reissue':
                      $(this).hasClass('btn-mark-lost')?'Lost':'Dispute';
      if(['Block','UnBlock','Reissue','Lost'].includes(actionType))
        if(!confirm(`${actionType} this ${typeLabel} card?\nEnds ${cardNo.slice(-4)}`)) return;
      const payload={custPhone:data.mobile_no,custPhone2:data.mobile_no2,custAccount:data.account_number||'',custCard:cardNo,cardType:typeLabel,custEmail:data.email,custAction:actionType,serviceRequestType:"",serviceDescription:""};
      showMessage(`${actionType} request in progress...`,'info');
      const res=await sendActionToWebexConnect(payload);
      const success=res!==null && res!==undefined;
      const fa=actionType==='Block'?'blocked':actionType==='UnBlock'?'unblocked':actionType.toLowerCase();
      showMessage(success?`Card successfully ${fa} (ends ${cardNo.slice(-4)}).`:`Request sent; confirmation not parsed.` , success?'success':'warning');
      setTimeout(()=>$('#searchBtn').click(),600);
    });

  // New SR
  $('#newSRForm').off().on('submit',async function(e){
    e.preventDefault();
    const srType=$('#srType').val().trim(), srDesc=$('#srDesc').val().trim();
    if(!srType||!srDesc) return $('#newSRAlert').show().addClass('alert-danger').text("Type and Description required.");
    const payload={custPhone:data.mobile_no,custPhone2:data.mobile_no2,custAccount:data.account_number||'',custCard:"",cardType:"",custEmail:data.email,custAction:"NewRequest",serviceRequestType:srType,serviceDescription:srDesc};
    $('#newSRAlert').removeClass().addClass('alert alert-info').show().text("Creating Service Request...");
    const res=await sendActionToWebexConnect(payload);
    const success=(Array.isArray(res)&&res.length>0)|| (res && (res.status==='OK'||res.id||Object.keys(res).length>0));
    if(success){ $('#newSRAlert').removeClass('alert-info').addClass('alert-success').text("Request created!");
      setTimeout(()=>{$('#newSRModal').modal('hide');$('#searchBtn').click();},600);
    } else { $('#newSRAlert').removeClass('alert-info').addClass('alert-danger').text("Failed to create SR."); }
  });

  // Update/Close SR buttons
  $(document).off("click",".btn-update-sr,.btn-close-sr").on("click",".btn-update-sr,.btn-close-sr",function(){
    const upd=$(this).hasClass("btn-update-sr");
    const row=$(this).closest("tr"); 
    $('#editSRModalLabel').text(upd?"Update Service Request":"Close Service Request");
    $('#editSRAction').val(upd?"Update":"Close");
    $('#editSRType').val(row.find("td:nth-child(2)").text());
    $('#editSRDesc').val(row.find(".sr-desc").attr("title")||"");
    $('#editSRAlert').hide().removeClass();
    $('#editSRModal').modal('show');
  });

  // Edit SR form submit
  $('#editSRForm').off().on('submit',async function(e){
    e.preventDefault();
    const action=$('#editSRAction').val(), srType=$('#editSRType').val(), srDesc=$('#editSRDesc').val().trim();
    if(!srDesc) return $('#editSRAlert').show().addClass('alert-danger').text("Description is required.");
    const payload={custPhone:data.mobile_no,custPhone2:data.mobile_no2,custAccount:data.account_number||'',custCard:"",cardType:"",custEmail:data.email,custAction:action,serviceRequestType:srType,serviceDescription:srDesc};
    $('#editSRAlert').removeClass().addClass('alert alert-info').show().text(`${action} in progress...`);
    const res=await sendActionToWebexConnect(payload);
    const success=(Array.isArray(res)&&res.length>0)|| (res && (res.status==='OK'||res.id||Object.keys(res).length>0));
    if(success){ $('#editSRAlert').removeClass('alert-info').addClass('alert-success').text(`Service Request ${action}d!`);
      setTimeout(()=>{$('#editSRModal').modal('hide');$('#searchBtn').click();},700);
    } else { $('#editSRAlert').removeClass('alert-info').addClass('alert-danger').text(`${action} failed.`);}
  });
}

/* Main render */
async function showCustomer(data){
  latestCustomer=data;
  const div=$('#customer-details');
  if(!data||data.error) return div.hide(), showMessage(data?.error||'No customer found.','danger');
  div.show(); $('#messageBar').hide();
  let html=`<div class="card p-3 mb-3 bg-light border-primary">...`; 
  // (render debit/credit/service-requests exactly as in previous version, calling renderCardActions())
  // then:
  div.html(html); 
  bindActionHandlers(data);
}

/* Init */
$(document).ready(function(){
  $('#currentDate').text(new Date().toLocaleString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}));
  $('#searchMobile').on('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#searchBtn').click();}});
  $('#searchBtn').on('click',async()=>{
    const val=$('#searchMobile').val().trim();
    if(!val) return showMessage('Please enter a mobile, account, or email.','warning'), $('#customer-details').hide();
    showMessage('Loading...','info'); $('#customer-details').hide();
    const type=val.includes('@')?'email':(/^\d{8}$/.test(val)?'account':'mobile');
    try{const data=await fetchCustomer(val,type); showCustomer(data);}catch(err){$('#customer-details').hide(); showMessage('Error fetching data.','danger');}
  });
  $(document).on('click','#newSRBtn',function(){ if(!latestCustomer) return showMessage('Load a customer first.','danger'); $('#newSRModal').modal('show');});
});

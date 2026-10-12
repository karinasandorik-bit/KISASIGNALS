// Gmail API adapter for pg-delivery-recovery.mjs.
// Uses a scoped OAuth access token. No production SMTP fallback or unsafe resend.
const endpoint='https://gmail.googleapis.com/gmail/v1/users/me/messages';
export function gmailLookup({token,fetchImpl=fetch,recipient}){
 if(!token)throw Error('GMAIL_OAUTH_REQUIRED');
 return async(reportId)=>{
  if(!/^OWL-[A-Z0-9-]{8,120}$/.test(reportId))throw Error('INVALID_REPORT_ID');
  const q='in:sent subject:"'+reportId+'"';
  const res=await fetchImpl(endpoint+'?maxResults=100&q='+encodeURIComponent(q),{headers:{authorization:'Bearer '+token}});
  if(!res.ok)throw Error('GMAIL_LOOKUP_FAILED_'+res.status);
  const {messages=[],nextPageToken}=await res.json();
  // Cannot conclude exactly one until all result pages are accounted for.
  if(nextPageToken)throw Error('GMAIL_RESULT_PAGINATION_UNVERIFIED');
  const matched=[];
  for(const item of messages){
   const x=await fetchImpl(endpoint+'/'+encodeURIComponent(item.id)+'?format=full',{headers:{authorization:'Bearer '+token}});
   if(!x.ok)throw Error('GMAIL_READBACK_FAILED_'+x.status);
   const m=await x.json();
   const headers=m.payload?.headers||[];
   const get=n=>String(headers.find(h=>h.name?.toLowerCase()===n)?.value||'');
   const subject=get('subject'),to=get('to');
   if(subject.includes(reportId)&&(!recipient||to.includes(recipient))&&m.labelIds?.includes('SENT'))matched.push({id:item.id,subject});
  }
  return matched;
 };
}

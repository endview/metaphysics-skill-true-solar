import golden from './native-golden.json' with {type:'json'};
const window=()=>({kind:'interval',raw_input:'Synthetic observation interval',source_ref:'synthetic:window',
  start:'2024-06-01T12:00:00+08:00',end:'2024-07-01T12:00:00+08:00',timezone:'Asia/Taipei',include_start:true,include_end:false,
  calendar_basis:'gregorian',boundary_profile:'fixed_24h'});
export function reviewInput(method,changes={}) {
  return {request_id:'synthetic-request',new_event:true,event_reason:'A new synthetic test event, not a consultation',
    question:'Review the supplied calculation structure, not a forecast',criteria:'Exact structural correspondence',
    analysis_scope:method==='bazi'?'structural_review':'calculation_review',
    window:method==='bazi'?{kind:'cycle',raw_input:'Synthetic natal structure',source_ref:'synthetic:natal',
      cycle_id:'natal',calendar_basis:'provided_pillars',boundary_profile:'provided_only',precision:'natal'}:window(),
    method_inputs:method==='bazi'?{pillars:golden.pillars,review_chart_id:'synthetic_chart',candidate_id:'synthetic_candidate',
      source:{verification_status:'user_declared',source_ref:'synthetic:declaration'}}:
      {native_method:'numbers-v2',numbers:[8,8,6],number_grouping_confirmed:true,time_basis:'civil',
        timing_profile:{profile:'stage-within-horizon-v1',unit:'days'}},
    ...(method==='meihua'?{time_request:{source_kind:'user_specified',source_ref:'synthetic:clock',
      raw_input:'2024-06-01T12:00+08:00',timezone:'Asia/Taipei'}}:{}),...changes};
}

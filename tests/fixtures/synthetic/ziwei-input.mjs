export function ziweiInput() {
  return {schema_version:'ziwei.input.v2',profile_id:'ziwei-core-true-solar-v2',
    birth:{algorithm_gender:'female',source_grade:'B1',civil:{date:'2000-01-01',local_time:'12:00',timezone:'Asia/Taipei',utc_offset:'+08:00',location:{name:'Synthetic location',longitude_deg:121}},
      true_solar:{status:'resolved',verification_status:'user_declared',resolved_candidates:[{selector_id:'synthetic-birth',date:'2000-01-01',local_time:'11:50'}]}},
    target:{civil:{date:'2024-06-01',timezone:'Asia/Taipei',location:{name:'Synthetic location',longitude_deg:121}},
      true_solar:{status:'resolved',verification_status:'user_declared',resolved_candidates:[{selector_id:'synthetic-target',date:'2024-06-01'}]}}};
}
export function ziweiReview() {
  return {request_id:'synthetic-ziwei-review',new_event:true,event_reason:'Independent synthetic test',question:'Review synthetic natal chart structure',criteria:'Structure only',analysis_scope:'structural_review',
    window:{kind:'cycle',raw_input:'Synthetic natal',source_ref:'synthetic:natal',cycle_id:'natal',calendar_basis:'declared_true_solar',boundary_profile:'provided_only',precision:'natal'},
    method_inputs:{native_input:ziweiInput()}};
}

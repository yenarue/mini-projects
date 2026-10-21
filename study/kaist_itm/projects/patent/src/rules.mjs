export function compareValue(expected,actual){return expected==null||actual==null||expected===''||actual===''?'판단 불가':expected===actual?'일치':'불일치'}
export function robotDecision(caseId,event){if(caseId==='R01')return {hold:['서류 수거'],keep:['장난감 정리']};if(caseId==='R02')return {hold:[],keep:['청소 지속'],ask:!!event};return {hold:['B 지점 착륙'],keep:['경로 보정 검토']}}
export function feedbackOutcome(response,persistent){return {learn:response!=='무응답'&&persistent,explicitProhibitionsPreserved:true}}

export function knowledgeJudgment(node,phase,environment,changeKind='behavior',scopeVerified=false,useAt='2026-10-17'){
 const changed=phase==='changed'&&changeKind==='behavior';
 const management=changed&&['k001','recovery'].includes(node)?'재검증 필요':'활성';
 const result=(judgment,reason,action)=>({management,judgment,reason,action});
 if(!useAt||environment==='unknown')return result('확인 필요','사용 시점 또는 SDK 버전 정보가 부족합니다.','사용 시점·SDK 버전 확인 요청');
 if(node==='k002'&&(phase!=='verified'||changeKind!=='behavior'))return {management:'검증 대기',judgment:'확인 필요',reason:'대체 설명은 아직 등록·검증되지 않았습니다.',action:'대체 지식 검증 요청'};
 if(changed&&['k001','recovery'].includes(node)&&!(scopeVerified&&environment==='sdk2'))return result('확인 필요','변경의 영향 범위와 적용 조건을 재검증하고 있습니다. 오류로 확정한 것이 아닙니다.','조건 범위 확인·담당자 검증 요청');
 const fits=node==='logs'||node==='k002'&&environment==='sdk3'||node!=='k002'&&environment==='sdk2';
 if(fits)return result('사용 가능',changed?'SDK 2.x 범위가 변경 영향을 받지 않는다는 근거를 확인한 것으로 가정합니다.':node==='logs'?'재연결 동작과 무관한 로그 수집 절차로, 시연의 두 환경에서 유지합니다.':'사용 시점의 SDK 환경이 확인된 적용 조건에 부합합니다.','검색·AI 답변의 근거로 제공');
 return result('사용 불가','이 사용 요청의 SDK 환경은 해당 지식의 적용 조건과 맞지 않습니다. 지식 자체를 삭제하거나 사용 중지하지 않습니다.',node==='k001'&&phase==='verified'&&changeKind==='behavior'?'K-001 제외 → K-002 자동 재연결 설명 제공':node==='recovery'?'기존 복구 단계 제외 → 해당 환경용 수정 요청':'현재 지식 제외 → 환경에 맞는 대체 지식 탐색');
}

export function basicAttemptProblem(record,availableIds=null){
 const ids=record.question_ids||record.questionIds||[],answers=record.answers||[];
 if(!Array.isArray(ids)||!ids.length||new Set(ids.map(String)).size!==ids.length)return 'invalid-question-set';
 if(Number(record.question_count||ids.length)!==ids.length)return 'changed-question-count';
 if(availableIds&&ids.some(id=>!availableIds.has(String(id))))return 'question-no-longer-available';
 if(!Array.isArray(answers))return 'invalid-answers';
 const answered=answers.map(a=>String(a.questionId||a.question_id||''));
 if(new Set(answered).size!==answered.length||answered.some(id=>!ids.map(String).includes(id)))return 'answers-do-not-match-quiz';
 const set=new Set(answered);let prefix=0;while(prefix<ids.length&&set.has(String(ids[prefix])))prefix++;
 if(ids.slice(prefix).some(id=>set.has(String(id))))return 'answered-after-gap';
 const current=Number(record.current_question_index??record.currentIndex??0);
 if(!Number.isInteger(current)||current<0||current>=ids.length||current>prefix||current<Math.max(0,prefix-1))return 'skipped-question';
 if(record.status==='completed'&&prefix!==ids.length)return 'incomplete-completion';
 return null;
}

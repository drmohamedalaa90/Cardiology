import fs from 'node:fs';
const required=['modules.html','progress.html','profile.html','settings.html','study.html','challenge.html','competitions.html','notifications.html','learning-expert.html','assets/js/acl-shared-shell.js','assets/js/modules.js','assets/js/modules-catalogue-ui.js','assets/js/progress-dashboard-v1.js','assets/js/learning-mode.js','assets/js/study-hub-v1.js','assets/css/acl-shared-shell.css','assets/css/modules-intelligence-v1.css','assets/css/progress-dashboard-v1.css','assets/css/learning-expert-shell-v1.css'];
let failed=false;
for(const file of required){if(!fs.existsSync(file)){console.error(`MISSING: ${file}`);failed=true;}}
const shell=fs.readFileSync('assets/js/acl-shared-shell.js','utf8');
for(const page of ['modules.html','progress.html','study.html','challenge.html','competitions.html','notifications.html','profile.html','settings.html']){if(!shell.includes(page)){console.error(`DRAWER LINK MISSING: ${page}`);failed=true;}}
const modules=fs.readFileSync('modules.html','utf8');
for(const asset of ['assets/js/modules.js','assets/js/modules-catalogue-ui.js']){if(!modules.includes(asset)){console.error(`MODULES ASSET NOT REFERENCED: ${asset}`);failed=true;}}
const progress=fs.readFileSync('progress.html','utf8');
if(!progress.includes('progress-dashboard-v1.js')){console.error('PROGRESS DASHBOARD ASSET NOT REFERENCED');failed=true;}
const learning=fs.readFileSync('learning-expert.html','utf8');
for(const id of ['quizArea','answerFeedbackHost','submitAnswer','nextQuestion','progressFill','questionCount','saveStatus','learningFlashcardModal']){if(!learning.includes(`id="${id}"`)){console.error(`LEARNING DOM CONTRACT MISSING: ${id}`);failed=true;}}
if(shell.includes('href="${root}learning.html?edition=${edition}"')){console.error('LEGACY STUDY HUB LINK DETECTED');failed=true;}
if(failed){console.error('\nACL preflight FAILED.');process.exit(1);}console.log('ACL preflight passed. Required pages, assets, navigation and learning DOM contracts are present.');
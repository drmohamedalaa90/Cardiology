import fs from 'node:fs';

const required = [
  'modules.html',
  'progress.html',
  'profile.html',
  'settings.html',
  'study.html',
  'challenge.html',
  'competitions.html',
  'notifications.html',
  'learning-expert.html',
  'assets/js/acl-shared-shell.js',
  'assets/js/modules-auth-bootstrap-20260820.js',
  'assets/js/modules-live-core-20260820.js',
  'assets/js/learning-mode.js',
  'assets/js/study-hub-v1.js',
  'assets/css/acl-shared-shell.css',
  'assets/css/learning-expert-shell-v1.css'
];

let failed = false;

for (const file of required) {
  if (!fs.existsSync(file)) {
    console.error(`MISSING: ${file}`);
    failed = true;
  }
}

const shell = fs.readFileSync('assets/js/acl-shared-shell.js', 'utf8');

for (const page of [
  'modules.html',
  'progress.html',
  'study.html',
  'challenge.html',
  'competitions.html',
  'notifications.html',
  'profile.html',
  'settings.html'
]) {
  if (!shell.includes(page)) {
    console.error(`DRAWER LINK MISSING: ${page}`);
    failed = true;
  }
}

const modules = fs.readFileSync('modules.html', 'utf8');
const bootstrap = fs.readFileSync(
  'assets/js/modules-auth-bootstrap-20260820.js',
  'utf8'
);

if (!modules.includes('assets/js/modules-auth-bootstrap-20260820.js')) {
  console.error('MODULES AUTH BOOTSTRAP NOT REFERENCED');
  failed = true;
}

if (!bootstrap.includes('modules-live-core-20260820.js')) {
  console.error('MODULES LIVE CORE NOT IMPORTED BY BOOTSTRAP');
  failed = true;
}

const learning = fs.readFileSync('learning-expert.html', 'utf8');

for (const id of [
  'quizArea',
  'answerFeedbackHost',
  'submitAnswer',
  'nextQuestion',
  'progressFill',
  'questionCount',
  'saveStatus',
  'learningFlashcardModal'
]) {
  if (!learning.includes(`id="${id}"`)) {
    console.error(`LEARNING DOM CONTRACT MISSING: ${id}`);
    failed = true;
  }
}

if (!learning.includes('assets/js/learning-mode.js')) {
  console.error('LEARNING ENGINE NOT REFERENCED');
  failed = true;
}

if (failed) {
  console.error('\nACL preflight FAILED.');
  process.exit(1);
}

console.log(
  'ACL preflight passed. Current module runtime, navigation, and Learning DOM contracts are valid.'
);

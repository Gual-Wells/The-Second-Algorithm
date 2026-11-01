// Compatibility entry for the existing hidden local supervisor. API inference is
// exclusively cloud-owned; a local takeover always uses Codex subscription auth.
import {runQuestionCodex} from './question-codex-worker.mjs';
try{console.log(JSON.stringify(await runQuestionCodex()));}catch(error){console.error(error.message);process.exitCode=1;}

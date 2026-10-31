import { WorkerEntrypoint } from 'cloudflare:workers';
import { runCloudQuestions } from './question-cloud-adapter.mjs';

// A native service binding can execute this project only. No public job endpoint.
export class AlgorithmAPIExecutor extends WorkerEntrypoint {
  async run() { return runCloudQuestions(this.env); }
}

export default {
  fetch() { return new Response('Not found', { status: 404 }); }
};

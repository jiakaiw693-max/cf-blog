import { handleUpdates } from './updates.mjs';

export default {
  fetch(request, env, context) {
    const path = new URL(request.url).pathname;
    if (path === '/api/updates' || path === '/api/updates/') return handleUpdates(request, context);
    return env.ASSETS.fetch(request);
  }
};

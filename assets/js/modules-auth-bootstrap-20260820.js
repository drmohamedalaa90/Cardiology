import { supabaseClient } from './supabase-client.js';

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getRestoredSession() {
  for (let i = 0; i < 12; i += 1) {
    try {
      const { data, error } = await supabaseClient.auth.getSession();
      if (error) console.warn('ACL session restore', error);
      if (data?.session?.user) return data.session;
    } catch (error) {
      console.warn('ACL session restore retry', error);
    }
    await wait(i < 3 ? 150 : 300);
  }
  return null;
}

const session = await getRestoredSession();
if (!session) {
  location.replace('login.html');
} else {
  await import('./modules-live-core-20260820.js?v=8');
}

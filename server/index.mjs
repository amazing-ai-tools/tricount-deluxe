import { createAppServer } from './http.mjs';
import { loadState, saveState } from './storage.mjs';

const port = Number(process.env.PORT ?? 8123);
const dataFile = process.env.TRICOUNT_DATA_FILE ?? '/var/lib/tricount-deluxe/state.json';
const allowedOrigins = (process.env.TRICOUNT_ALLOWED_ORIGINS ?? 'https://tricount-deluxe.app.amazing-ai.tools')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const state = await loadState(dataFile);
const server = createAppServer({
  state,
  allowedOrigins,
  save: (nextState) => saveState(dataFile, nextState),
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Tricount Deluxe API listening on 127.0.0.1:${port}`);
});

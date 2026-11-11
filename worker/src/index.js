/*
  listening log

  Cloudflare runs this once a minute (its fastest schedule). Each run checks
  Lanyard CHECKS times, about GAP ms apart, so a song change is caught within
  ~15s and short songs / quick skips still get logged. New plays go to the
  front of a list in Workers KV (newest first, capped at MAX). The site
  fetches GET / to show "recently played".

  A "play" is a track + its start time, so the same song twice shows twice.
  KV is only written when something new starts, so it stays well inside the
  free plan's daily write limit. Waiting between checks doesn't use CPU time.
*/
const MAX = 50;
const KEY = "history";
const CHECKS = 4;
const GAP = 14000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nowPlaying(env) {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${env.DISCORD_ID}`, {
      headers: { "user-agent": "listening-log-worker" },
    });
    if (!res.ok) return null;
    const { success, data } = await res.json();
    if (!success || !data.listening_to_spotify || !data.spotify) return null;
    const sp = data.spotify;
    return {
      id: sp.track_id,
      song: sp.song,
      artist: sp.artist,
      album: sp.album,
      art: sp.album_art_url,
      start: sp.timestamps?.start ?? Date.now(),
      end: sp.timestamps?.end ?? null,
    };
  } catch {
    return null;
  }
}

const samePlay = (a, b) => a && b && a.id === b.id && Math.abs(a.start - b.start) < 5000;

async function record(env) {
  // read once per run, then keep the list in memory between checks
  let history = (await env.LOG.get(KEY, "json")) || [];
  for (let i = 0; i < CHECKS; i++) {
    const play = await nowPlaying(env);
    if (play && !samePlay(history[0], play)) {
      history = [play, ...history].slice(0, MAX);
      await env.LOG.put(KEY, JSON.stringify(history));
    }
    if (i < CHECKS - 1) await sleep(GAP);
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
};

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(record(env));
  },

  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (request.method !== "GET") return new Response("method not allowed", { status: 405, headers: CORS });
    // cacheTtl 30 is the shortest KV allows; keeps reads fresh after a write
    const history = (await env.LOG.get(KEY, { type: "json", cacheTtl: 30 })) || [];
    return new Response(JSON.stringify(history), {
      headers: {
        ...CORS,
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=10",
      },
    });
  },
};

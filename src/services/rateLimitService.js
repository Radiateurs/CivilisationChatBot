function nowSec() {
  return Math.floor(Date.now() / 1000);
}

module.exports = function createRateLimiter(db) {
  return {
    nowSec,

    async canSend(fromCiv, toCiv) {
      const rule = await db.rules.getBetween(fromCiv, toCiv);
      if (!rule) return { ok: false, reason: "No diplomacy rule set for that pair yet." };

      const usage = await db.usage.getLastSent(fromCiv, toCiv);
      if (!usage || !usage.last_sent_at) return { ok: true, rule };

      const t = nowSec();
      const elapsed = t - usage.last_sent_at;

      if (elapsed >= rule.interval_seconds) return { ok: true, rule };

      const wait = rule.interval_seconds - elapsed;
      return { ok: false, rule, reason: `Rate limit: try again in ${wait} seconds.`, waitSeconds: wait };
    },

    async recordSend(fromCiv, toCiv, body) {
      const t = nowSec();
      await db.usage.upsertLastSent(fromCiv, toCiv, t);
      await db.messages.insert(fromCiv, toCiv, t, body);
    }
  };
};

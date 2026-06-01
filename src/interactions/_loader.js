const fs = require("fs");
const path = require("path");

function loadInteractionHandlers() {
  const handlers = {
    buttons: new Map(),
    modals: new Map()
  };

  function walk(dir, type) {
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walk(fullPath, type);
        continue;
      }

      if (!entry.endsWith(".js") || entry.startsWith("_")) continue;

      const handler = require(fullPath);

      if (!handler.customIdPrefix || typeof handler.execute !== "function") {
        console.warn(`[INTERACTION LOADER] Skipping invalid handler: ${fullPath}`);
        continue;
      }

      handlers[type].set(handler.customIdPrefix, handler);
    }
  }

  walk(path.join(__dirname, "buttons"), "buttons");
  walk(path.join(__dirname, "modals"), "modals");

  return handlers;
}

function findHandler(map, customId) {
  for (const [prefix, handler] of map.entries()) {
    if (customId.startsWith(prefix)) return handler;
  }
  return null;
}

module.exports = {
  loadInteractionHandlers,
  findHandler
};
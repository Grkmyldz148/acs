/* @acs/runtime — CJS entry. Loads the ESM bundle. */
module.exports = (async () => (await import("./runtime.mjs")))();

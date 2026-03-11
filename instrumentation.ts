export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { ensureTables } = await import("./lib/db");
      await ensureTables();
      console.log("[startup] DB tables ready");
    } catch (err) {
      // Log but don't crash — the app can still serve pages without DB writes
      console.error("[startup] DB setup failed (views won't be tracked):", err);
    }
  }
}

import app from "./app";
import { logger } from "./lib/logger";
import { startTelegramAutoSync } from "./lib/telegramSync";
import { syncAccountUrls } from "./lib/accountUrlSync";
import { statsHealthCheck } from "./lib/statsHealthCheck";
import { ocrScanExistingAccounts } from "./lib/ocrScanAccounts";
import { startDataPruning } from "./lib/dataPruning";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startTelegramAutoSync();
  startDataPruning();
  syncAccountUrls("startup").catch((e) =>
    logger.error({ err: e }, "accountUrlSync failed on startup"),
  );
  statsHealthCheck().catch((e) =>
    logger.error({ err: e }, "statsHealthCheck failed on startup"),
  );
  // Delay OCR scan slightly so the server is fully up and OCR worker is warmed
  setTimeout(() => {
    ocrScanExistingAccounts().catch((e) =>
      logger.error({ err: e }, "ocrScanExistingAccounts failed on startup"),
    );
  }, 15_000);
});

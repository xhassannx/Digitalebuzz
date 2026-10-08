import { getSimpleFlowApp } from "@/lib/simple-flow-catalog";

/** Build initial JSON config for a simple-flow step including `_canvasActionId` for canvas sync. */
export function defaultConfigJsonForSimpleAction(appId: string, actionId: string): string {
  const meta = getSimpleFlowApp(appId);
  const base = { ...(meta?.defaultConfig ?? {}) } as Record<string, unknown>;
  base._canvasActionId = actionId;

  if (appId === "delay") {
    if (actionId === "delay-for") {
      base.days = 0;
      base.hours = 0;
      base.minutes = 1;
      base.seconds = 0;
      base.delayForUnit = "minutes";
      base.delayForValue = 1;
      delete base.delayUntil;
    } else if (actionId === "delay-until") {
      base.delayUntil = "";
    }
  }

  return JSON.stringify(base, null, 2);
}

function safeParse(json: string): Record<string, unknown> {
  try {
    const o = JSON.parse(json || "{}");
    return o && typeof o === "object" && !Array.isArray(o) ? (o as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * When changing canvas action on an existing step, reset to defaults but keep integration connection when possible.
 */
export function mergeConfigWhenChangingAction(
  appId: string,
  newActionId: string,
  previousConfigJson: string
): string {
  const prev = safeParse(previousConfigJson);
  const fresh = safeParse(defaultConfigJsonForSimpleAction(appId, newActionId));
  const preserveKeys = [
    "connectionId",
    "driveId",
    "spreadsheetId",
    "copySpreadsheetId",
    "worksheetId",
    "calendarId",
    "phoneNumberId",
    "firstName",
    "lastName",
    "email",
    "phone",
    "name",
    "assignTo",
    "source",
    "searchByIdOrPhone",
    "contactIdOrPhone",
  ];
  for (const k of preserveKeys) {
    if (prev[k] !== undefined && prev[k] !== null && prev[k] !== "") {
      fresh[k] = prev[k];
    }
  }
  return JSON.stringify(fresh, null, 2);
}

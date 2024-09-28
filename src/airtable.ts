import Airtable, { FieldSet, Records, Table } from "airtable";
import { isDeploy } from "./run_settings";
import { LocalMarket } from "./types";
import { slackConsoleError } from "./system_health";

const apiKey = process.env.AIRTABLE_WEB_TOKEN;
const baseId = process.env.AIRTABLE_BASE_ID;

if (!apiKey || !baseId) {
  throw new Error("Missing Airtable API credentials");
}

// Configure Airtable with your API key and endpoint URL
Airtable.configure({
  endpointUrl: "https://api.airtable.com",
  apiKey: apiKey,
});

// Access the base using the base ID
const base = Airtable.base(baseId);

// Determine table based on deployment environment
const tableName = isDeploy ? "Prod" : "Dev";
const table: Table<FieldSet> = base(tableName);

// Fetch tracked questions
export const fetchTrackedQuestions = async (): Promise<
  LocalMarket[] | undefined
> => {
  try {
    console.log("\nFetching tracked questions from Airtable...");
    const records = await table
      .select({
        filterByFormula: `{tracked} = TRUE()`,
        fields: [
          "_id",
          "url",
          "lastslacktime",
          "lastslackhourwindow",
          "tracked",
          "last_track_status_slack_time",
        ],
      })
      .all();

    console.log(`Fetched ${records.length} records from Airtable.`);

    const trackedMarkets: LocalMarket[] = records.map((record) => ({
      _id: record.get("_id") as string,
      url: record.get("url") as string,
      lastslacktime: record.get("lastslacktime")
        ? new Date(record.get("lastslacktime") as string)
        : undefined,
      lastslackhourwindow: record.get("lastslackhourwindow") as number,
      tracked: record.get("tracked") as boolean,
      last_track_status_slack_time: record.get("last_track_status_slack_time")
        ? new Date(record.get("last_track_status_slack_time") as string)
        : undefined,
    }));

    return trackedMarkets;
  } catch (error) {
    slackConsoleError(
      `Error fetching tracked questions from Airtable: ${error}`
    );
  }
};

// Update last slack info
export const updateLastSlackInfo = async (
  url: string,
  timeWindow: number,
  last_report_sent: string
): Promise<void> => {
  try {
    console.log(`Updating last slack info for URL: ${url}`);
    const records = await table
      .select({
        filterByFormula: `{url} = '${url}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      await table.update(record.id, {
        lastslacktime: new Date().toISOString(),
        lastslackhourwindow: timeWindow,
        last_report_sent: last_report_sent,
      });
      console.log("Updated lastslacktime and lastslackhourwindow in Airtable.");
    } else {
      console.error(`No record found with url: ${url}`);
    }
  } catch (error) {
    slackConsoleError(`Error updating lastslacktime in Airtable: ${error}`);
  }
};

// Update new tracked slack info
export const updateNewTrackedSlackInfo = async (url: string): Promise<void> => {
  try {
    const records = await table
      .select({
        filterByFormula: `{url} = '${url}'`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      await table.update(record.id, {
        last_track_status_slack_time: new Date().toISOString(),
      });
      console.log(`Updated last_track_status_slack_time in Airtable.`);
    } else {
      console.error(`No record found with url: ${url}`);
    }
  } catch (error) {
    slackConsoleError(
      `Error updating last_track_status_slack_time in Airtable: ${error}`
    );
  }
};

// Keep the Airtable connection awake
export const keepAwakeHack = async (): Promise<void> => {
  try {
    await table.select({ maxRecords: 1 }).firstPage();
    console.log("Pinged Airtable to stay awake.");
  } catch (error) {
    slackConsoleError(`Error pinging Airtable to stay awake: ${error}`);
  }
};

// Copy data from Prod to Dev table
export const copyProdToDev = async (): Promise<void> => {
  if (!isDeploy) {
    console.log("copyProdToDev is not applicable in development environment.");
    return;
  }
  try {
    const prodTable = base("Markets");
    const devTable = base("Markets_Dev");

    // Fetch all records from Prod table
    const records = await prodTable.select().all();

    // Delete all records from Dev table in batches of 10
    const devRecords = await devTable.select().all();
    const devRecordIds = devRecords.map((record) => record.id);
    while (devRecordIds.length > 0) {
      await devTable.destroy(devRecordIds.splice(0, 10));
    }

    // Copy records to Dev table in batches
    for (let i = 0; i < records.length; i += 10) {
      const batch = records.slice(i, i + 10);
      const newRecords = batch.map((record) => ({ fields: record.fields }));
      await devTable.create(newRecords);
    }

    console.log("Copied data from Prod to Dev Airtable table.");
  } catch (error) {
    slackConsoleError(
      `Error copying data from Prod to Dev Airtable table: ${error}`
    );
  }
};

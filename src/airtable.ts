import Airtable, { FieldSet, Records, Table } from "airtable";
import { isDeploy } from "./run_settings.js";
import { LocalMarket } from "./types.js";
import { slackConsoleError } from "./system_health.js";
import { getSlug, normalizeUrl } from "./util.js";
import chalk from "chalk";
import { getMarket, getMarketBySlug } from "./manifold_api.js";

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
          "Name",
          "lastslacktime",
          "lastslackhourwindow",
          "tracked",
          "last_track_status_slack_time",
        ],
      })
      .all();

    console.log(`Fetched ${records.length} records from Airtable.`);

    // Iterate over records to check for missing 'Name' field
    for (const record of records) {
      const url = normalizeUrl(record.get("url") as string);
      const name = record.get("Name");
      if (!name && url) {
        console.log(
          chalk.yellow(
            `Name is missing for URL: ${url}. Fetching market data...`
          )
        );

        // Fetch the market data
        const market = await getMarketBySlug(getSlug(url));
        if (market) {
          const marketName = market.question;

          // Update the 'Name' field in Airtable
          await table.update(record.id, {
            Name: marketName,
          });
          console.log(
            chalk.green(
              `Updated 'Name' field in Airtable with name`,
              chalk.dim(`"${marketName}".`)
            )
          );
        } else {
          console.error(
            chalk.red(`Failed to fetch market data for URL: ${url}`)
          );
        }
      }
    }

    // Map records to LocalMarket[]
    const trackedMarkets: LocalMarket[] = records.map((record) => ({
      _id: record.get("_id") as string,
      url: normalizeUrl(record.get("url") as string),
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
    const normalizedUrl = normalizeUrl(url);
    console.log(
      chalk.dim(`Updating last slack info for URL: ${normalizedUrl}`)
    );
    const records = await table
      .select({
        filterByFormula: `SEARCH("${normalizedUrl}", {url}) > 0`,
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
      console.log(
        chalk.green(
          "Updated lastslacktime and lastslackhourwindow in Airtable."
        )
      );
    } else {
      console.error(chalk.red(`No record found with url: ${normalizedUrl}`));
    }
  } catch (error) {
    slackConsoleError(`Error updating lastslacktime in Airtable: ${error}`);
  }
};

// Update new tracked slack info
export const updateNewTrackedSlackInfo = async (url: string): Promise<void> => {
  try {
    const normalizedUrl = normalizeUrl(url);
    const records = await table
      .select({
        filterByFormula: `SEARCH("${normalizedUrl}", {url}) > 0`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      await table.update(record.id, {
        last_track_status_slack_time: new Date().toISOString(),
      });
      console.log(
        chalk.green(
          `Updated last_track_status_slack_time in Airtable for ${normalizedUrl}.`
        )
      );
    } else {
      console.error(chalk.red(`No record found with url: ${normalizedUrl}`));
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

// Update market name in Airtable
export const updateMarketNameInAirtable = async (
  url: string,
  marketName: string
): Promise<void> => {
  try {
    const normalizedUrl = normalizeUrl(url);
    const records = await table
      .select({
        filterByFormula: `SEARCH("${normalizedUrl}", {url}) > 0`,
        maxRecords: 1,
      })
      .firstPage();

    if (records.length > 0) {
      const record = records[0];
      await table.update(record.id, {
        Name: marketName,
      });
      console.log(
        chalk.green(`Updated 'Name' field in Airtable for ${normalizedUrl}.`)
      );
    } else {
      console.error(chalk.red(`No record found with url: ${normalizedUrl}`));
    }
  } catch (error) {
    slackConsoleError(`Error updating 'Name' field in Airtable: ${error}`);
  }
};

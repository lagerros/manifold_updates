import { Client } from 'pg';
import { isDeploy } from './run_settings';
import { LocalMarket } from './types';
import { slackConsoleError } from './system_health';

const prod_markets_name = 'markets'
const dev_markets_name = 'markets_dev'
const markets_table_name = isDeploy ? prod_markets_name : dev_markets_name;
const env_name = isDeploy ? 'prod' : 'dev'


const client = new Client({
  connectionString: process.env['DATABASE_URL'],
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect(err => {
  if (err) {
    slackConsoleError(`Failed to connect to the ${env_name} database! ${err.stack}`);
  } else {
    console.log(`Successfully connected to the ${env_name} database.`);
    // Here you can proceed to execute queries on the database
  }
});

export const fetchTrackedQuestions = async (): Promise<LocalMarket[]|undefined> => {
  const queryText = `SELECT _id, url, lastslacktime, lastslackhourwindow, tracked, last_track_status_slack_time FROM ${markets_table_name} WHERE tracked = true`;
  try {
    const res = await client.query(queryText);
    const trackedMarkets: LocalMarket[] = res.rows.map(row => ({
      _id: row._id,
      url: row.url,
      lastslacktime: row.lastslacktime,
      lastslackhourwindow: row.lastslackhourwindow,
      tracked: row.tracked,
      last_track_status_slack_time: row.last_track_status_slack_time
    }));
    return trackedMarkets;
  } catch (error) {
    slackConsoleError(`Error fetching tracked questions  ${error}`);
  }
};

export const updateLastSlackInfo = async (url: string, timeWindow: number, last_report_sent: string): Promise<void> => {
  const queryText = `
    UPDATE ${markets_table_name}
    SET lastslacktime = NOW(), lastslackhourwindow = $1, last_report_sent = $3
    WHERE url = $2
  `;
  try {
    const result = await client.query(queryText, [timeWindow, url, last_report_sent]);
    console.log('Updated lastslacktime and lastslackhourwindow in the database.', result);
  } catch (error) {
    slackConsoleError(`Error updating lastslacktime and lastslackhourwindow in the database: ${error}`);
  }
};


export const updateNewTrackedSlackInfo = async (url: string): Promise<void> => {
  const queryText = `
    UPDATE ${markets_table_name}
    SET last_track_status_slack_time = NOW()
    WHERE url = $1
  `;
  try {
    await client.query(queryText, [url]);
    console.log(`Updated last_track_status_slack_time in the ${env_name} database.`);
  } catch (error) {
    slackConsoleError(`Error updating last_track_status_slack_time in the database: ${error}`);
  }
};

export const updateLocalMarket = async (id: string, lastslacktime: Date, lastslackhourwindow: number, last_report_sent: string): Promise<void> => {
  const queryText = `
    UPDATE ${markets_table_name}
    SET lastslacktime = $1, lastslackhourwindow = $2, last_report_sent = $3
    WHERE _id = $4
    `
  try {
    await client.query(queryText, [lastslacktime, lastslackhourwindow, last_report_sent, id]);
    console.log(`Local market updated in the ${env_name} database.`);
  } catch (error) {
    slackConsoleError(`Error updating local market in the ${env_name} database: ${error}`);
  }
};

export const keepAwakeHack = async (): Promise<void> => {
  const queryText = `SELECT _id FROM ${markets_table_name} WHERE tracked = true`
  try {
    await client.query(queryText);
    console.log('Pinged db to stay awake.');
  } catch (error) {
    slackConsoleError(`Error pinging db to stay awake: ${error}`);
  }
}

export const copyProdToDev = async (): Promise<void> => {
  const queryText = `TRUNCATE ${dev_markets_name};
    INSERT INTO ${dev_markets_name} SELECT * FROM markets;`
  try {
    await client.query(queryText);
    console.log('Copied prod markets db data to markets_dev.');
  } catch (error) {
    slackConsoleError(`Error copying prod markets data to dev: ${error}`);
  }
}
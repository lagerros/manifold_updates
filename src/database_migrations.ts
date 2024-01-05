import { client, env_name, markets_table_name } from './database';
import {devAlertsChannelId, devWebhook} from './run_settings';
import {sendDevSlackUpdate} from './slack';

export const runMigrations = async () => {
  const createTableCommand = `
    CREATE TABLE IF NOT EXISTS log_table_${env_name} (
      id SERIAL PRIMARY KEY,
      message TEXT,
      timestamp TIMESTAMP
    );
  `;

  const createFunctionCommand = `
    CREATE OR REPLACE FUNCTION check_lastslacktime()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.lastslacktime IS NULL THEN
        INSERT INTO log_table_${env_name} (message, timestamp) VALUES ('lastslacktime was set to NULL', NOW());
        PERFORM pg_notify('new_entry', row_to_json(NEW)::text);
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `;

  const createTriggerCommand = `
    DROP TRIGGER IF EXISTS lastslacktime_trigger ON ${markets_table_name};
    CREATE TRIGGER lastslacktime_trigger
    AFTER UPDATE OF lastslacktime ON ${markets_table_name}
    FOR EACH ROW EXECUTE PROCEDURE check_lastslacktime();
  `;

  try {
    await client.query(createTableCommand);
    await client.query(createFunctionCommand);
    await client.query(createTriggerCommand);
    console.log('Done with migrations')
  } catch (error) {
    console.error(`Error creating migration table: ${error}`);
  }
};

// bug hunting..... 
client.query('LISTEN new_entry');
client.on('notification', async (msg) => {
  if (msg.channel === 'new_entry') {
    const payload = msg.payload;
    if (payload) {
      const logEntry = JSON.parse(payload);
      console.log(`lastslacktime was set to NULL. Log entry: ${logEntry.message}`)
      if (devWebhook) {
        await sendDevSlackUpdate(devWebhook, { channelId: devAlertsChannelId, message: `lastslacktime was set to NULL. Log entry: ${logEntry.message}` });
      }
    }
  }
});

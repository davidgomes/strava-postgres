import { Pool } from "pg";

if (!process.env.PG_CONNECTION_STRING) {
    console.error(
        "The PG_CONNECTION_STRING environment variable must be defined.",
    );
}

const pool = new Pool({
    connectionString: process.env.PG_CONNECTION_STRING,
});

const client = await pool.connect();

try {
    await client.query(`
		ALTER TABLE activities 
		ADD COLUMN IF NOT EXISTS outdoor_temp double precision;
	`);
    console.log(
        "Column 'outdoor_temp' has been added to the activities table.",
    );
} catch (error) {
    console.error("Error adding outdoor_temp column:", error);
} finally {
    client.release();
}

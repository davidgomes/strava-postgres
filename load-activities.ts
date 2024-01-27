import strava from "strava-v3";
const { Pool } = require("pg");

import { parseArgs, type ParseArgsConfig } from 'node:util';

const CLI_OPTIONS: ParseArgsConfig["options"] = {
  "update-existing": {
    type: 'boolean',
    default: false,
  },
};

const {
  values: cliOptionValues,
  positionals,
} = parseArgs({ options: CLI_OPTIONS, allowPositionals: true });

if (positionals.length !== 1) {
  console.error(
      "This script must be called with 1 positional argument, which should be the access token for the Strava API. You can retrieve this with 'bun get-access-token.ts'.",
  );
}

const STRAVA_ACCESS_TOKEN = positionals[0];

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
    let pageNum = 1;
    let isPaging = true;
    const PER_PAGE = 200;

    while (isPaging) {
        const apiData = await strava.athlete.listActivities({
            access_token: STRAVA_ACCESS_TOKEN,
            per_page: PER_PAGE,
            page: pageNum,
        });
        
        if (apiData.length === 0) {
          break;
        }

        console.log(`Page ${pageNum} (${apiData.length} activities found)`);

        for (var i = 0; i < apiData.length; i++) {
            const activity = apiData[i];

            const { rows } = await client.query(
                "select count(*) from activities where id = $1",
                [activity.id],
            );

            const activityIdx = (pageNum-1) * PER_PAGE + i + 1; // 1-indexed activity count
            if (rows[0].count === "1" && !cliOptionValues["update-existing"]) {
              // If we're not updating existing activities, we ignore them.
              continue;
            } else if (rows[0].count === "1" && cliOptionValues["update-existing"]) {
                console.log(
                    `[Activity ${activityIdx}] Found activity that's already tracked, updating.`,
                );
                await client.query("delete from activities where id = $1", [
                    activity.id,
                ]);
            } else {
                console.log(
                    `[Activity ${activityIdx}] Inserting brand new activity.`,
                );
            }

            const queryText = `INSERT INTO activities (
                    "resource_state",
                    "athlete.id",
                    "athlete.resource_state",
                    "name",
                    "distance",
                    "moving_time",
                    "elapsed_time",
                    "total_elevation_gain",
                    "type",
                    "sport_type",
                    "workout_type",
                    "id",
                    "start_date",
                    "start_date_local",
                    "timezone",
                    "utc_offset",
                    "location_city",
                    "location_state",
                    "location_country",
                    "achievement_count",
                    "kudos_count",
                    "comment_count",
                    "athlete_count",
                    "photo_count",
                    "map.id",
                    "map.summary_polyline",
                    "map.resource_state",
                    "trainer",
                    "commute",
                    "manual",
                    "private",
                    "visibility",
                    "flagged",
                    "gear_id",
                    "start_latlng",
                    "end_latlng",
                    "average_speed",
                    "max_speed",
                    "average_cadence",
                    "average_temp",
                    "has_heartrate",
                    "average_heartrate",
                    "max_heartrate",
                    "heartrate_opt_out",
                    "display_hide_heartrate_option",
                    "elev_high",
                    "elev_low",
                    "upload_id",
                    "upload_id_str",
                    "external_id",
                    "from_accepted_tag",
                    "pr_count",
                    "total_photo_count",
                    "has_kudoed")
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6,
                    $7,
                    $8,
                    $9,
                    $10,
                    $11,
                    $12,
                    $13,
                    $14,
                    $15,
                    $16,
                    $17,
                    $18,
                    $19,
                    $20,
                    $21,
                    $22,
                    $23,
                    $24,
                    $25,
                    $26,
                    $27,
                    $28,
                    $29,
                    $30,
                    $31,
                    $32,
                    $33,
                    $34,
                    $35,
                    $36,
                    $37,
                    $38,
                    $39,
                    $40,
                    $41,
                    $42,
                    $43,
                    $44,
                    $45,
                    $46,
                    $47,
                    $48,
                    $49,
                    $50,
                    $51,
                    $52,
                    $53,
                    $54
                )`;

            const values = [
                activity.resource_state,
                activity.athlete.id,
                activity.athlete.resource_state,
                activity.name,
                activity.distance,
                activity.moving_time,
                activity.elapsed_time,
                activity.total_elevation_gain,
                activity.type,
                activity.sport_type,
                activity.workout_type,
                activity.id,
                activity.start_date,
                activity.start_date_local,
                activity.timezone,
                activity.utc_offset,
                activity.location_city,
                activity.location_state,
                activity.location_country,
                activity.achievement_count,
                activity.kudos_count,
                activity.comment_count,
                activity.athlete_count,
                activity.photo_count,
                activity.map.id,
                activity.map.summary_polyline,
                activity.map.resource_state,
                activity.trainer,
                activity.commute,
                activity.manual,
                activity.private,
                activity.visibility,
                activity.flagged,
                activity.gear_id,
                JSON.stringify(activity.start_latlng),
                JSON.stringify(activity.end_latlng),
                activity.average_speed,
                activity.max_speed,
                activity.average_cadence,
                activity.average_temp,
                activity.has_heartrate,
                activity.average_heartrate,
                activity.max_heartrate,
                activity.heartrate_opt_out,
                activity.display_hide_heartrate_optio,
                activity.elev_high,
                activity.elev_low,
                activity.upload_id,
                activity.upload_id_str,
                activity.external_id,
                activity.from_accepted_tag,
                activity.pr_count,
                activity.total_photo_count,
                activity.has_kudoed,
            ];

            try {
                await client.query(queryText, values);
            } catch (err) {
                console.error("Error inserting activity", err);
            }
        }

        isPaging = apiData.length > 0;
        pageNum++;
    }
} finally {
    client.release();
}

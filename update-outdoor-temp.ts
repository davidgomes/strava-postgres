import axios from "axios";
import { Pool } from "pg";

interface WeatherData {
    hourly: {
        time: string[];
        temperature_2m: number[];
    };
}

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
    const res = await client.query(
        "SELECT id, start_latlng, start_date, elapsed_time FROM activities WHERE outdoor_temp IS NULL",
    );
    const activities = res.rows;

    for (const activity of activities) {
        const { id, start_latlng, start_date, elapsed_time } = activity;

        if (start_latlng && start_latlng.length === 2) {
            const [latitude, longitude] = start_latlng;
            let weatherData: WeatherData | null = null;

            const startDate = new Date(start_date);
            const endDate = new Date(startDate.getTime() + elapsed_time * 1000);
            const daysAgo =
                (new Date().getTime() - startDate.getTime()) /
                (1000 * 60 * 60 * 24);

            let apiEndpoint: string;
            let params: any;

            if (daysAgo > 3) {
                apiEndpoint = "https://archive-api.open-meteo.com/v1/era5";
                params = {
                    latitude,
                    longitude,
                    start_date: startDate.toISOString().split("T")[0],
                    end_date: endDate.toISOString().split("T")[0],
                    hourly: "temperature_2m",
                };
            } else {
                apiEndpoint = "https://api.open-meteo.com/v1/forecast";
                params = {
                    latitude,
                    longitude,
                    past_days: 3,
                    hourly: "temperature_2m",
                };
            }

            try {
                const response = await axios.get(apiEndpoint, { params });
                weatherData = response.data;
            } catch (error) {
                console.error(
                    `Error fetching weather data for activity ID ${id}:`,
                    error,
                );
                continue;
            }

            if (
                weatherData &&
                weatherData.hourly &&
                weatherData.hourly.temperature_2m.length > 0
            ) {
                const temperaturesDuringActivity =
                    weatherData.hourly.time.reduce(
                        (acc: number[], time: string, index: number) => {
                            const hourTimestamp = new Date(time).getUTCHours();
                            let activityStartHours = startDate.getUTCHours();
                            let activityEndHours = endDate.getUTCHours();

                            if (
                                hourTimestamp >= activityStartHours &&
                                hourTimestamp <= activityEndHours
                            ) {
                                acc.push(
                                    weatherData.hourly.temperature_2m[index],
                                );
                            }
                            return acc;
                        },
                        [],
                    );

                const outdoorTemp =
                    temperaturesDuringActivity.length > 0
                        ? parseFloat(
                              (
                                  temperaturesDuringActivity.reduce(
                                      (acc, curr) => acc + curr,
                                      0,
                                  ) / temperaturesDuringActivity.length
                              ).toFixed(2),
                          )
                        : null;

                if (outdoorTemp !== null) {
                    await client.query(
                        "UPDATE activities SET outdoor_temp = $1 WHERE id = $2",
                        [outdoorTemp, id],
                    );
                } else {
                    console.warn(
                        `No relevant temperature data available for activity ID ${id}`,
                    );
                }
            } else {
                console.warn(
                    `No temperature data available for activity ID ${id}`,
                );
            }
        }
    }
} catch (error) {
    console.error("Error fetching activities:", error);
} finally {
    client.release();
}

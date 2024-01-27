import strava from "strava-v3";
import prompts from "prompts";

if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
    console.error(
        "The environment variables STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be defined.",
    );
    process.exit(1);
}

const client_id = process.env.STRAVA_CLIENT_ID;
const client_secret = process.env.STRAVA_CLIENT_SECRET;

async function simplePrompt(question: string) {
    const response = await prompts({
        type: "text",
        name: "answer",
        message: question,
    });

    return response.answer;
}

strava.config({
    access_token: "",
    redirect_uri: "http://localhost/exchange_token",
    client_id: client_id,
    client_secret: client_secret,
});

// do Manual Oauth dance : Get user to go to link in browser, authorize and copy response URL
const oauthURL = strava.oauth.getRequestAccessURL({
    scope: "activity:write,activity:read,activity:read_all",
});
console.log(`Go to URL ${oauthURL} and authorize application`);
console.log(
    "Once you have authorized, you will be redirected to a 'localhost' address (don't worry if you see a 'This site can’t be reached' message)",
);
const auth_code_url = await simplePrompt(
    "Copy the whole URL of the page from the browser and paste it here : ",
);

// Extract authorization code (TODO verify scope)
const authorizationCodeMatches = auth_code_url.match(/code=([^&]+)/);
if (!authorizationCodeMatches) {
    console.error("unable to find auth code in provided URL");
    process.exit(1);
}
const authorizationCode = authorizationCodeMatches[1];

try {
    const accessTokenData = await strava.oauth.getToken(authorizationCode);
    console.log(
        `Successfully retrieved access token: ${accessTokenData.access_token}`,
    );
} catch (e) {
    console.error(`Failed to obtain access token: ${e}`);
    process.exit(1);
}

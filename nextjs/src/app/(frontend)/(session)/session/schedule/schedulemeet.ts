// TODO : Look into this code.

import { calendar_v3, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

/**
 * Create an OAuth2 client for Google API authentication
 * @param accessToken User's access token
 * @returns Authenticated OAuth2 client
 */
const getAuthClient = (accessToken: string): OAuth2Client => {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
  );

  oAuth2Client.setCredentials({ access_token: accessToken });
  return oAuth2Client;
};

/**
 * Schedule a Google Meet using Google Calendar API
 * @param accessToken Google OAuth access token of the user
 * @param startDateTime Start date and time of the meeting in ISO format
 * @param endDateTime End date and time of the meeting in ISO format
 * @param attendeeEmails Array of attendee email addresses
 * @param title Meeting title/summary
 * @param description Optional meeting description
 * @returns Created event details including Google Meet link
 */
export async function scheduleGoogleMeet(
  accessToken: string,
  startDateTime: string,
  endDateTime: string,
  attendeeEmails: string[],
  title: string,
  description: string = ""
) {
  try {
    // Get authenticated client
    const auth = getAuthClient(accessToken);

    // Initialize Google Calendar API
    const calendar = google.calendar({ version: "v3", auth });

    // Format attendees for Google Calendar API
    const attendees = attendeeEmails.map((email) => ({ email }));

    // Create event with Google Meet conferencing
    const event: calendar_v3.Schema$Event = {
      summary: title,
      description: description,
      start: {
        dateTime: startDateTime,
        timeZone: "UTC", // Consider parameterizing this
      },
      end: {
        dateTime: endDateTime,
        timeZone: "UTC", // Consider parameterizing this
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `meet_${Date.now()}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    };

    // Insert event to calendar
    const { data } = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1, // Required for Google Meet integration
      requestBody: event,
    });

    return {
      success: true,
      eventId: data.id,
      meetLink: data.conferenceData?.entryPoints?.[0]?.uri || null,
      eventDetails: data,
    };
  } catch (error) {
    console.error("Error scheduling Google Meet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

// Helper function to create a simple scheduled meeting
export async function createMeeting(
  accessToken: string,
  date: Date,
  durationMinutes: number = 60,
  emails: string[],
  title: string,
  description?: string
) {
  const startDateTime = date.toISOString();
  const endDateTime = new Date(
    date.getTime() + durationMinutes * 60000
  ).toISOString();

  return await scheduleGoogleMeet(
    accessToken,
    startDateTime,
    endDateTime,
    emails,
    title,
    description
  );
}

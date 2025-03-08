import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/utils/middlewareutils";
import prisma from "@/lib/prisma";
import { calendar_v3, google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { v4 } from "uuid";
import axios from "axios";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Extract string parameters
    const title = formData.get("title") as string;
    const date = formData.get("date") as string;
    const name = formData.get("name") as string;
    const email = formData.get("email") as string;

    // Extract resume file
    const resumeFile = formData.get("resume") as File;

    // Validate inputs
    if (!title || !date || !name || !email || !resumeFile) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if the file is a PDF
    if (!resumeFile.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Resume must be a PDF file" },
        { status: 400 }
      );
    }

    // Parse the date string into a Date object
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Expected format: YYYY-MM-DDTHH:MM" },
        { status: 400 }
      );
    }

    // Create an end time (1 hour after start time by default)
    const endDateObj = new Date(dateObj);
    endDateObj.setHours(endDateObj.getHours() + 1);

    // Format dates for Google Calendar API
    const dateTime = dateObj.toISOString();
    const endDateTime = endDateObj.toISOString();

    // Process the resume file
    // const resumeBytes = await resumeFile.arrayBuffer();
    // const buffer = Buffer.from(resumeBytes);
    // const fileName = `${Date.now()}_${resumeFile.name}`;

    // Here you would typically save the buffer to a storage solution
    // For example: await uploadToStorage(buffer, fileName);

    const verifcation = await verifyUser(req);

    if (!verifcation) {
      return NextResponse.json({ error: "User not verified" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: {
        interviuId: verifcation.interviuId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 400 });
    }

    const { access_token: accessToken, refresh_token: refreshToken } = user;

    if (!accessToken) {
      return NextResponse.json(
        { error: "User not authenticated with Google" },
        { status: 401 }
      );
    }

    const getAuthClient = async (): Promise<OAuth2Client> => {
      const oAuth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URL
      );

      // Set the initial credentials
      oAuth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      // Check if token needs refresh and handle it
      try {
        // Don't use getAccessToken as it doesn't actually validate the token
        // Instead, make a simple API call to validate
        const oauth2 = google.oauth2({
          auth: oAuth2Client,
          version: "v2",
        });

        // Test API call to verify token validity
        await oauth2.userinfo.get();
      } catch (error: any) {
        console.log("Token error, attempting refresh:", error.message);

        if (!refreshToken) {
          throw new Error(
            "No refresh token available. User needs to re-authenticate."
          );
        }

        try {
          // Explicitly trigger a token refresh
          const { credentials } = await oAuth2Client.refreshAccessToken();
          console.log("Token refreshed successfully");

          // Update the client with new credentials
          oAuth2Client.setCredentials(credentials);

          // Update the token in database
          if (credentials.access_token && verifcation.interviuId) {
            await prisma.user.update({
              where: { interviuId: verifcation.interviuId },
              data: {
                access_token: credentials.access_token,
                expiry_date: credentials.expiry_date,
              },
            });
            console.log("Database updated with new token");
          }
        } catch (refreshError: any) {
          console.error("Failed to refresh token:", refreshError.message);
          throw new Error(
            "Authentication failed. Please re-authenticate with Google."
          );
        }
      }

      return oAuth2Client;
    };

    let auth;
    try {
      auth = await getAuthClient();
    } catch (authError: any) {
      console.error("Authentication error:", authError.message);
      return NextResponse.json(
        {
          error:
            "Google Calendar authentication failed. Please reconnect your Google account.",
        },
        { status: 401 }
      );
    }

    const calendar = google.calendar({ version: "v3", auth });
    const attendees = [{ email }];

    const event: calendar_v3.Schema$Event = {
      summary: title,
      description: "Interview with " + name,
      start: {
        dateTime: dateTime,
        timeZone: "Asia/Kolkata", // Using proper IANA timezone format instead of "IST"
      },
      end: {
        dateTime: endDateTime,
        timeZone: "Asia/Kolkata", // Using proper IANA timezone format instead of "IST"
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

    try {
      const { data } = await calendar.events.insert({
        calendarId: "primary",
        conferenceDataVersion: 1, // Required for Google Meet integration
        requestBody: event,
      });

      const sessionId = v4();

      const sessionDetails = await prisma.session.create({
        data: {
          session_id: sessionId,
          title,
          date_created: new Date(),
          start_time: null,
          scheduled_datetime: new Date(date).getTime(),
          participant_email: email,
          participant_name: name,
          link: data.hangoutLink || data.htmlLink,
          user_interviuId: verifcation.interviuId,
        },
      });

      if (!sessionDetails) {
        return NextResponse.json(
          {
            error: "Failed to schedule session with Google Calendar",
            details: "Failed to save session details",
          },
          { status: 500 }
        );
      }

      try {
        const formData = new FormData();
        formData.append("pdf_file", resumeFile);
        //   formData.append("additional_prompt", "");

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_AI_SERVER_BASE_URL}/extract_pdf_text`,
          formData
        );

        const resumeData = data.text;

        await prisma.session.update({
          where: { session_id: sessionId },
          data: {
            resume_text: resumeData,
          },
        });
      } catch (e) {
        console.error(e);
      }

      // Return meeting link in the response
      return NextResponse.json({
        message: "Session scheduled successfully",
        data: {
          title,
          date,
          name,
          email,
          meetingLink: data.hangoutLink || data.htmlLink,
        },
      });
    } catch (e: any) {
      console.error(
        "Google Calendar API error details:",
        e.response?.data?.error || e.message
      );
      return NextResponse.json(
        {
          error: "Failed to schedule session with Google Calendar",
          details: e.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("Error processing form data:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: error.message },
      { status: 500 }
    );
  }
}

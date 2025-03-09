import { NextRequest, NextResponse } from "next/server";
const { google } = require("googleapis");

export async function GET(req: NextRequest) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
  );

  // Generate the OAuth URL, specifying offline access and forcing consent
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',  // This will get us a refresh token
    scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
    prompt: 'consent'  // Forces the approval prompt every time, ensuring refresh token is provided
  });

  return NextResponse.json({ authUrl });
}

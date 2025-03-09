import prisma from "@/lib/prisma";
import { decodeJwt } from "@/utils/utils";
import { NextRequest, NextResponse } from "next/server";
import { v4 } from "uuid";
import jwt from "njwt";
const { google } = require("googleapis");

const GET = async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URL
  );

  try {
    // Request tokens with offline access to receive a refresh token
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    
    console.log("Received tokens:", JSON.stringify({
      access_token: tokens.access_token ? "Present" : "Missing",
      refresh_token: tokens.refresh_token ? "Present" : "Missing",
      id_token: tokens.id_token ? "Present" : "Missing",
      expiry_date: tokens.expiry_date
    }));

    const userDetails = decodeJwt(tokens?.id_token);

    if (!userDetails) {
      return NextResponse.json(
        { message: "Error decoding token" },
        { status: 500 }
      );
    }

    const userExists = await prisma.user.findFirst({
      where: {
        email: userDetails.email,
      },
    });

    if (userExists) {
      // Update token information if refresh token is present
      if (tokens?.refresh_token) {
        await prisma.user.update({
          where: {
            id: userExists.id
          },
          data: {
            refresh_token: tokens.refresh_token,
            access_token: tokens.access_token,
            id_token: tokens.id_token,
            expiry_date: tokens.expiry_date,
            date_updated: new Date(),
          }
        });
      }
      
      const userJwt = await jwt.create(
        {
          interviuId: userExists.interviuId,
        },
        process.env.JWT_SECRET,
        "HS256"
      );

      return NextResponse.redirect(
        `${process.env.APP_BASE_URL}/saveuser?token=${userJwt.compact()}`
      );
    }

    const interviuId = v4();

    const user = await prisma.user.create({
      data: {
        id_token: tokens?.id_token,
        access_token: tokens?.access_token,
        refresh_token: tokens?.refresh_token || null, // Handle case where refresh token might be undefined
        scope: tokens?.scope,
        date_created: new Date(),
        date_updated: new Date(),
        expiry_date: tokens?.expiry_date,
        token_type: tokens?.token_type,
        status: "active",
        email: userDetails.email,
        name: userDetails.name,
        picture: userDetails.picture,
        userId: userDetails.userId,
        interviuId: interviuId,
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Error creating user" },
        { status: 500 }
      );
    }

    const userJwt = await jwt.create(
      {
        interviuId: interviuId,
      },
      process.env.JWT_SECRET,
      "HS256"
    );

    return NextResponse.redirect(
      `${process.env.APP_BASE_URL}/saveuser?token=${userJwt.compact()}`
    );
  } catch (error) {
    console.error("OAuth error:", error);
    return NextResponse.json(
      { message: "Error during OAuth process", error: String(error) },
      { status: 500 }
    );
  }
};

export { GET };

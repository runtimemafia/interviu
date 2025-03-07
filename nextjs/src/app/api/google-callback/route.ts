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

  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

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
    const userJwt =  await jwt.create(
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

  // TODO : make the user login

  const interviuId = v4();

  const user = await prisma.user.create({
    data: {
      id_token: tokens?.id_token,
      access_token: tokens?.access_token,
      refresh_token: tokens?.refresh_token,
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

  // return NextResponse.(`/saveuser?token=${userJwt.compact()}`);
  // return NextResponse.rewrite(`/saveuser?token=${userJwt.compact()}`);

  return NextResponse.redirect(
    `${process.env.APP_BASE_URL}/saveuser?token=${userJwt.compact()}`
  );
};

export { GET };

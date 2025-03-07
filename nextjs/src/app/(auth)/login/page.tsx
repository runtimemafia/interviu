"use server";

import Image from "next/image";
import Link from "next/link";

const { google } = require("googleapis");

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URL
);

// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/drive",
];

const url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: "offline",

  // If you only need one scope, you can pass it as a string
  scope: scopes,
});

const Login = () => {
  return (
    <>
      <div className="h-screen flex flex-col items-center justify-center">
        <h1 className="text-[1.3em]">Login into <span className="font-bold">Interviu</span></h1>
        <Link href={url} className="flex py-2 px-4 mt-4 border rounded-full hover:bg-gray-100 hover:border-gray-300 cursor-pointer">
          <Image 
          className="h-[1.5em] w-[1.5em] mr-2"
          src="/googlelogo.png" alt="" height={20} width={20} />
          <p>Login with Google</p>
        </Link>
      </div>
    </>
  );
};

export default Login;

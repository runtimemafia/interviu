import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { v4 } from "uuid";


const GET = async (req: NextRequest) => {

    const newSessionID = v4();

    const newSession = await prisma.session.create({
        data: {
            session_id: newSessionID,
            status: "active",
            date_created: new Date(),
            date_updated: new Date(),
        }
    })

    if(!newSession){
        return NextResponse.json({error: "Failed to create new session"}, {status: 500});
    }

    return NextResponse.json({session_id: newSession.session_id}, {status: 200});

};

export {GET};
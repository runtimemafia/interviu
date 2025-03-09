import prisma from "@/lib/prisma";
import { verifyUser } from "@/utils/middlewareutils";
import { NextRequest, NextResponse } from "next/server";
import { v4 } from "uuid";


const GET = async (req: NextRequest) => {

    const user = await verifyUser(req);

    if(!user){
        return NextResponse.json({error: "Unauthorized"}, {status: 401});
    }


    const newSessionID = v4();

    const newSession = await prisma.session.create({
        data: {
            session_id: newSessionID,
            status: "active",
            date_created: new Date(),
            date_updated: new Date(),
            user_interviuId: user.interviuId
        }
    })

    if(!newSession){
        return NextResponse.json({error: "Failed to create new session"}, {status: 500});
    }

    return NextResponse.json({session_id: newSession.session_id}, {status: 200});

};

export {GET};
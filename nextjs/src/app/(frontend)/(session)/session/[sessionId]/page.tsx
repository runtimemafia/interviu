"use client";

interface SessionIdProps {
    params: {
        sessionId: string;
    }
}

const SessionId = ({ params }: SessionIdProps) => {
    const { sessionId } = params;
    
    return (
        <>
            <h1>Session ID: {sessionId}</h1>
        </>
    );
};

export default SessionId;

"use client";

import { redirect, useRouter, useSearchParams } from 'next/navigation';

const SaveUser = () => {

    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const router = useRouter();


    try{
        localStorage.setItem('token', token || "");
    }catch(e){
        console.error(e);
    }

    router.push("/dashboard");


    return (
        <>
            <p>Saving user token...</p>
        </>
    )
}

export default SaveUser;
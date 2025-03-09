"use client";

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

const SaveUser = () => {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const router = useRouter();

    useEffect(() => {
        try{
            localStorage.setItem('token', token || "");
        }catch(e){
            console.error(e);
        }
        
        router.push("/dashboard");
    }, [token, router]);

    return (
        <div>
            <h1>Save User</h1>
        </div>
    );

}

const SaveUserContent = () => {

    return (
        <>
        <Suspense fallback={<p>Loading...</p>} >
            <SaveUser />
            </Suspense>
        </>
    )
}

export default SaveUserContent;
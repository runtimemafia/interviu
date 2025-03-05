"use client";

import useAppStore from "@/lib/zustand/appStore";
import { getSupportedMimeType } from "@/utils/videoutils";
import { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";

const ClientLayout = () => {

    const {setSupportedMimeType} = useAppStore();

    useEffect(() => {
        const mimeType = getSupportedMimeType();
        setSupportedMimeType(mimeType);
    }, []);

    return (
        <>
        <Toaster
            toastOptions={{
                className: '!bg-black !text-[--color-text]',
            }}
        />
        </>
    );
}

export default ClientLayout;
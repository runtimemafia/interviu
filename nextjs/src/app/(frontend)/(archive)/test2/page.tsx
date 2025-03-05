import Link from 'next/link';

const Test2 = () => {
    return (
        <div className="p-4">
            <h1 className="text-xl font-bold">Test Page</h1>
            <div className="mt-4">
                <Link href="/screen-recorder" className="text-blue-500 hover:underline">
                    Go to Screen Recorder
                </Link>
            </div>
        </div>
    );
};

export default Test2;
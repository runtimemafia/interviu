"use client";

import React from 'react';
import ScreenRecorder from '@/components/ScreenRecorder';

const ScreenRecorderPage = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Screen Recording Tool</h1>
      <ScreenRecorder />
    </div>
  );
};

export default ScreenRecorderPage;

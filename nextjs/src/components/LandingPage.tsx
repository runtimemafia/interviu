"use client";

import React, { useEffect } from "react";
import { Brain, Video, BarChart3, Shield } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import useUserStore from "@/lib/zustand/userStore";

export function LandingPage() {
  const { isLoggedIn, setIsLoggedIn } = useUserStore();

  useEffect(() => {
    api
      .get("/auth/verifyuser")
      .then((res) => {
        setIsLoggedIn(true);
      })
      .catch((err) => {
        if (isLoggedIn) {
          setIsLoggedIn(false);
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-primary-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Brain className="h-8 w-8 text-secondary-600" />
              <span className="ml-2 text-xl font-bold text-primary-900">
                Interviu
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {!isLoggedIn ? (
                <Link
                  href="/login"
                  className="text-primary-600 hover:text-primary-900 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Login
                </Link>
              ) : (
                <Link
                  href="/dashboard"
                  className="bg-secondary-600 hover:bg-secondary-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main>
        {/* Hero Section */}
        <div className="relative bg-white overflow-hidden">
          <div className="max-w-7xl mx-auto">
            <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
              <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
                <div className="sm:text-center lg:text-left">
                  <h1 className="text-4xl tracking-tight font-extrabold text-primary-900 sm:text-5xl md:text-6xl">
                    <span className="block">Transform your</span>
                    <span className="block text-secondary-600">
                      interview process
                    </span>
                  </h1>
                  <p className="mt-3 text-base text-primary-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                    Leverage AI-powered insights to make better hiring
                    decisions. Get real-time feedback, analytics, and
                    comprehensive candidate assessments.
                  </p>
                  <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                    <div className="rounded-md shadow">
                      <Link
                        href={isLoggedIn ? "/dashboard" : "/login"}
                        className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-secondary-600 hover:bg-secondary-700 md:py-4 md:text-lg md:px-10"
                      >
                        Get Started
                      </Link>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-12 bg-primary-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:text-center">
              <h2 className="text-base text-secondary-600 font-semibold tracking-wide uppercase">
                Features
              </h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-primary-900 sm:text-4xl">
                Everything you need to conduct better interviews
              </p>
            </div>

            <div className="mt-10">
              <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-3 md:gap-x-8 md:gap-y-10">
                {[
                  {
                    name: "AI-Powered Analysis",
                    description:
                      "Get real-time insights on candidate responses, body language, and speaking patterns.",
                    icon: Brain,
                  },
                  {
                    name: "Integration with Google Meet",
                    description:
                      "Seamless integration with Google Meet, more platforms coming soon.",
                    icon: Video,
                  },
                  {
                    name: "Comprehensive Analytics",
                    description:
                      "Detailed reports and analytics to help you make data-driven hiring decisions.",
                    icon: BarChart3,
                  },
                ].map((feature) => (
                  <div key={feature.name} className="relative">
                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-secondary-500 text-white">
                      <feature.icon className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="ml-16 text-lg leading-6 font-medium text-primary-900">
                      {feature.name}
                    </p>
                    <p className="mt-2 ml-16 text-base text-primary-500">
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-white">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 md:flex md:items-center md:justify-between lg:px-8">
          <div className="flex justify-center space-x-6 md:order-2">
            <Shield className="h-6 w-6 text-primary-400" />
          </div>
          <div className="mt-8 md:mt-0 md:order-1">
            <p className="text-center text-base text-primary-400">
              &copy; 2025 Interviu. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

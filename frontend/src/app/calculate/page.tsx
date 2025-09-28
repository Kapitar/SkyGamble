"use client";
import { useState, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { Info, Clock, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { Flight } from "@/types/FlightType";

export default function CalculatePage() {
  const searchParams = useSearchParams();
  const flightsParam = searchParams.get("flights");
  const flights: Flight[] = flightsParam
    ? JSON.parse(decodeURIComponent(flightsParam))
    : [];
  
  useEffect(() => {
    
  }, []);

  return (
    <div className="container mx-auto px-4 mt-6">
      <div className="text-center text-indigo-500 mb-6">
        <h1 className="text-7xl font-bold">96%</h1>
        <p className="text-3xl">Success Rate</p>
      </div>

      {flights.map((flight, index) => (
        <FlightResultCard
          key={index}
          airline={{ name: flight.airline, code: flight.airline }}
          ctaLabel="Learn more"
          segments={[
            {
              time: "10:00pm",
              date: "Sat, Oct 4",
              city: "Atlanta",
              airport: flight.departureAirport,
            },
            {
              time: "11:29pm",
              date: "Sat, Oct 4",
              city: "Tampa",
              airport: flight.arrivalAirport,
            },
          ]}
          notices={[
            {
              tone: "warn",
              label: "87% chance to miss next flight",
              icon: <Info className="h-4 w-4" />,
            },
          ]}
          subNote={
            <div className="text-sm text-gray-600">
              Your flight is expected to be delayed by X minutes. Due to the
              tight connection, there is a high chance of missing your next
              flight. Please consider rebooking to allow more time between
              flights.
            </div>
          }
        />
      ))}
    </div>
  );
}
type Segment = {
  time: string;
  date: string;
  city: string;
  airport: string;
};

type Notice = {
  label: string;
  icon?: React.ReactNode;
  meta?: string;
  tone?: "info" | "warn" | "short";
};

type FlightResultCardProps = {
  className?: string;
  airline: { name: string; code?: string };
  ctaLabel?: string;
  segments: [Segment, Segment];
  notices?: Notice[];
  subNote?: React.ReactNode;
};

function FlightResultCard({
  className,
  airline,
  ctaLabel = "Learn more",
  segments,
  notices = [],
  subNote,
}: FlightResultCardProps) {
  return (
    <section
      className={
        "relative rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5 mb-5" +
        (className ?? "")
      }
    >
      {/* header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <AirlineAvatar code={airline.code} name={airline.name} />
          <div>
            <p className="text-base font-semibold leading-6">{airline.name}</p>
          </div>
        </div>

        <button
          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          type="button"
        >
          {ctaLabel}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* timeline */}
      <div className="mt-4">
        {segments.map((s, idx) => (
          <Fragment key={idx}>
            <div className="grid grid-cols-[20px_auto] gap-3">
              {/* dot & line */}
              <div className="relative flex flex-col items-center">
                <div className="z-10 h-2 w-2 rounded-full bg-slate-400" />
                {idx < segments.length - 1 && (
                  <div className="absolute top-2 bottom-0 w-0.5 bg-slate-200" />
                )}
              </div>

              {/* content */}
              <div className={idx < segments.length - 1 ? "pb-6" : ""}>
                <p className="text-[15px] font-semibold leading-5">
                  {s.time}{" "}
                  <span className="font-normal text-slate-500">{s.date}</span>
                </p>
                <p className="text-[15px] font-medium leading-6">{s.city}</p>
                <p className="text-sm text-slate-500">{s.airport}</p>
              </div>
            </div>
          </Fragment>
        ))}
      </div>

      {/* notices */}
      {(notices?.length ?? 0) > 0 && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {notices.map((n, i) => (
              <Badge key={i} tone={n.tone}>
                {n.icon}
                <span className="ml-1">{n.label}</span>
                {n.meta && (
                  <span className="ml-2 text-slate-700">{n.meta}</span>
                )}
              </Badge>
            ))}
          </div>

          {subNote && <div className="mt-2">{subNote}</div>}
        </div>
      )}
    </section>
  );
}

function AirlineAvatar({ code, name }: { code?: string; name: string }) {
  const label = code ?? name.slice(0, 2).toUpperCase();
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
      {label}
    </div>
  );
}

function Badge({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warn" | "short";
}) {
  const styles = {
    info: "bg-indigo-100 text-indigo-900",
    warn: "bg-rose-100 text-rose-900",
    short: "bg-violet-100 text-violet-900",
  } as const;

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
        styles[tone]
      }
    >
      {children}
    </span>
  );
}

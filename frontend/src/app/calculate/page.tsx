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

  const times = [0, 30, 90, 180, 300];

  const [results, setResults] = useState<number[][]>([]);
  const [expectedTime, setExpectedTime] = useState<number[]>([]);
  const [successPercent, setSuccessPercent] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSuccessRate, setTotalSuccessRate] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          "http://localhost:8000/api/flights/predict",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              flights: flights,
            }),
          }
        );
        const data = await response.json();
        setResults(data.results);
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    let calculatedExpectedTime: number[] = [];

    let c: number[] = [];
    let successRate = 1;
    for (let flightNumber = 0; flightNumber < results.length; flightNumber++) {
      let probDistr = results[flightNumber];
      let expectedTime = 0;
      let summa = 0;
      console.log(probDistr);
      probDistr[0] *= 1.2
      if (probDistr[1] < 0.15) {
        probDistr[1] *= 0.1;
      }
      if (probDistr[2] < 0.2) {
        probDistr[2] = 0.05;
      }
      probDistr[2] *= 0.9
      if (probDistr[3] < 0.25) {
        probDistr[3] = 0.03;
      }
      probDistr[3] *= 0.8
      if (probDistr[4] < 0.3) {
        probDistr[4] = 0.01;
      }
      probDistr[4] *= 0.7
      for (let i = 0; i < 5; i++) {
        summa += probDistr[i];
      }
      for (let i = 0; i < 5; i++) {
        probDistr[i] /= summa;
        expectedTime += probDistr[i] * times[i];
      }
      console.log(expectedTime);
      calculatedExpectedTime.push(expectedTime);

      if (flightNumber < results.length - 1) {
        let nextFlight = flights[flightNumber + 1];
        let currentFlight = flights[flightNumber];
        let transitOverhead = 30;
        if (nextFlight.departureAirport != currentFlight.arrivalAirport) {
          transitOverhead = 150;
        }

        let layover =
          Math.abs(
            new Date(nextFlight.departureDateTime).getTime() -
              new Date(currentFlight.arrivalDateTime).getTime()
          ) /
          (1000 * 60);

        let upperBound = layover - transitOverhead;
        let chance = 0;
        for (let i = 0; i < 5; i++) {
          if (times[i] <= upperBound) {
            chance += probDistr[i];
          }
        }
        console.log("Chance: " + chance * 100);
        c.push(Math.round(chance * 100));
        successRate *= chance;
      }
    }
    setSuccessPercent(c);
    setTotalSuccessRate(Math.round(successRate * 100));
    setExpectedTime(calculatedExpectedTime);
  }, [results]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 mt-6">
      <div className="text-center text-indigo-500 mb-6">
        <h1 className="text-7xl font-bold">{totalSuccessRate}%</h1>
        <p className="text-3xl">Success Rate</p>
      </div>

      {flights.map((flight, index) => (
        <FlightResultCard
          key={index}
          airline={{ name: flight.airline, code: flight.airline }}
          ctaLabel="Learn more"
          segments={[
            {
              time: new Date(flight.departureDateTime).toLocaleTimeString(
                "en-US",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }
              ),
              expected:
                expectedTime[index] >= 30
                  ? new Date(
                      new Date(flight.departureDateTime).getTime() +
                        expectedTime[index] * 60 * 1000
                    ).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : undefined,
              date: new Date(flight.departureDateTime).toLocaleDateString(
                "en-US",
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }
              ),
              city: "Atlanta",
              airport: flight.departureAirport,
            },
            {
              time: new Date(flight.arrivalDateTime).toLocaleTimeString(
                "en-US",
                {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                }
              ),
              expected:
                expectedTime[index] >= 30
                  ? new Date(
                      new Date(flight.arrivalDateTime).getTime() +
                        expectedTime[index] * 60 * 1000
                    ).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: true,
                    })
                  : undefined,
              date: new Date(flight.arrivalDateTime).toLocaleDateString(
                "en-US",
                {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                }
              ),
              city: "Tampa",
              airport: flight.arrivalAirport,
            },
          ]}
          notices={
            index != flights.length - 1
              ? [
                  {
                    label: `${successPercent[index]}% chance of making next flight`,
                    icon: <Info className="h-4 w-4" />,
                    chance: successPercent[index],
                  },
                ]
              : undefined
          }
          subNote={
            index != flights.length - 1 ? (
              <div className="text-sm text-gray-600">
                {successPercent[index] >= 80 && "Your trip looks reliable — a high probability of success with minimal concerns."}
                {successPercent[index] >= 60 && successPercent[index] < 80 && "Your trip is moderately reliable — some risk of delays or missed connections, but generally manageable."}
                {successPercent[index] < 60 && "Your trip has a high risk — consider alternate routes or allowing more buffer time between layovers."}
              </div>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
type Segment = {
  time: string;
  expected?: string;
  date: string;
  city: string;
  airport: string;
};

type Notice = {
  label: string;
  icon?: React.ReactNode;
  chance: number;
  meta?: string;
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
                  {s.expected ? (
                    <>
                      <span className="line-through decoration-red-500 text-gray-500">
                        {s.time}
                      </span>
                      <span className="ml-2">{s.expected}</span>
                    </>
                  ) : (
                    <span>{s.time}</span>
                  )}{" "}
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
              <Badge key={i} chance={n.chance}>
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
  chance,
}: {
  children: React.ReactNode;
  chance: number;
}) {
  const styles = {
    danger: "bg-red-100 text-red-900",
    warn: "bg-yellow-100 text-yellow-900",
    success: "bg-indigo-100 text-indigo-900",
  };

  let tone = styles.success;
  if (chance >= 60 && chance < 80) {
    tone = styles.warn;
  } else if (chance < 60) {
    tone = styles.danger;
  }

  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold " +
        tone
      }
    >
      {children}
    </span>
  );
}

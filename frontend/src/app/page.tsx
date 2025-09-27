"use client";

import { useState } from "react";
import Image from "next/image";
import { BoardingPass } from "@/components/BoardingPass";

export default function Page() {
  const [airline, setAirline] = useState("Lorem Airlines");
  const [flightNumber, setFlightNumber] = useState("FR 0123");
  const [departureAirport, setDepartureAirport] = useState("JFK");
  const [arrivalAirport, setArrivalAirport] = useState("CDG");
  const [departureDateTime, setDepartureDateTime] =
    useState("2025-01-25T17:50");
  const [arrivalDateTime, setArrivalDateTime] = useState("2025-01-26T07:20");

  return (
    <div className="container mx-auto px-4 mt-10">
      <div className="flex justify-center text-center mb-10">
        <div className="w-196">
          <h1 className="text-6xl font-bold">
            Never miss your flight with{" "}
            <span className="text-indigo-600">Sky Gamble</span>
          </h1>
          <p className="text-lg mt-4">
            Plug in your flight, and we’ll predict your risk of arriving late at
            the gate—using live delays, security wait times, airport layout, and
            historic data. Simple. Private. Fast.
          </p>
          <button className="px-5 py-2.5 mt-4 bg-indigo-600 text-white text-md rounded-2xl">
            Upload your ticket
          </button>
        </div>
        {/* <Image src="/image.jpg" alt="missing-plane" width={500} height={100} /> */}
      </div>
      <BoardingPass
        airline={airline}
        flightNumber={flightNumber}
        departureAirport={departureAirport}
        arrivalAirport={arrivalAirport}
        departureDateTime={new Date(departureDateTime)}
        arrivalDateTime={new Date(arrivalDateTime)}
        edit={{
          airline: setAirline,
          flightNumber: setFlightNumber,
          departureAirport: (v: string) => setDepartureAirport(v.toUpperCase()),
          arrivalAirport: (v: string) => setArrivalAirport(v.toUpperCase()),
          departureDateTime: setDepartureDateTime,
          arrivalDateTime: setArrivalDateTime,
        }}
      />
    </div>
  );
}

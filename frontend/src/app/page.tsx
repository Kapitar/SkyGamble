"use client";

import { useState } from "react";
import { BoardingPass } from "@/components/BoardingPass";
import { Flight } from "@/types/FlightType";

export default function Page() {
  const [flights, setFlights] = useState<Flight[]>([
    {
      airline: "",
      flightNumber: "",
      departureAirport: "",
      arrivalAirport: "",
      departureDateTime: new Date("2025-01-25T17:50"),
      arrivalDateTime: new Date("2025-01-26T07:20"),
    },
  ]);

  const addTicket = () => {
    setFlights([
      ...flights,
      {
        airline: "",
        flightNumber: "",
        departureAirport: "",
        arrivalAirport: "",
        departureDateTime: new Date(),
        arrivalDateTime: new Date(),
      },
    ]);
  };

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
        </div>
        {/* <Image src="/image.jpg" alt="missing-plane" width={500} height={100} /> */}
      </div>

      {flights.map((flight, index) => (
        <BoardingPass
          key={index}
          airline={flight.airline || ""}
          flightNumber={flight.flightNumber || ""}
          departureAirport={flight.departureAirport || ""}
          arrivalAirport={flight.arrivalAirport || ""}
          departureDateTime={flight.departureDateTime || new Date()}
          arrivalDateTime={flight.arrivalDateTime || new Date()}
          addFlight={addTicket}
          edit={{
            airline: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].airline = v;
              setFlights(newFlights);
            },
            flightNumber: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].flightNumber = v;
              setFlights(newFlights);
            },
            departureAirport: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].departureAirport = v.toUpperCase();
              setFlights(newFlights);
            },
            arrivalAirport: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].arrivalAirport = v.toUpperCase();
              setFlights(newFlights);
            },
            departureDateTime: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].departureDateTime = new Date(v);
              setFlights(newFlights);
            },
            arrivalDateTime: (v: string) => {
              const newFlights = [...flights];
              newFlights[index].arrivalDateTime = new Date(v);
              setFlights(newFlights);
            },
          }}
        />
      ))}
    </div>
  );
}

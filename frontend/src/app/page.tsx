"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BoardingPass from "@/components/BoardingPass";
import Notification from "@/components/Notification";
import { Flight } from "@/types/FlightType";

export default function Page() {
  const router = useRouter();
  const [flights, setFlights] = useState<Flight[]>([
    {
      airline: "",
      flightNumber: "",
      departureAirport: "",
      arrivalAirport: "",
      departureDateTime: new Date(),
      arrivalDateTime: new Date(),
    },
  ]);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");

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

  const removeTicket = (index: number) => {
    const newFlights = [...flights];
    newFlights.splice(index, 1);
    setFlights(newFlights);
  };

  const handleCalculateRisk = () => {
    const flightsParam = encodeURIComponent(JSON.stringify(flights));
    router.push(`/calculate?flights=${flightsParam}`);
  };

  return (
    <div className="container mx-auto px-4 mt-10">
      {!!errorMessage && (
        <Notification type="error">{errorMessage}</Notification>
      )}
      {!!loadingMessage && (
        <Notification type="loading">{loadingMessage}</Notification>
      )}
      {!!successMessage && (
        <Notification type="success">{successMessage}</Notification>
      )}
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
          index={index}
          removeTicket={removeTicket}
          setLoadingMessage={setLoadingMessage}
          setSuccessMessage={setSuccessMessage}
          setErrorMessage={setErrorMessage}
          canBeRemoved={flights.length > 1 && index !== flights.length - 1}
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
            departureDateTime: (v: Date) => {
              const newFlights = [...flights];
              newFlights[index].departureDateTime = v;
              setFlights(newFlights);
            },
            arrivalDateTime: (v: Date) => {
              const newFlights = [...flights];
              newFlights[index].arrivalDateTime = v;
              setFlights(newFlights);
            },
          }}
        />
      ))}

      <div className="flex justify-center">
        <button
          onClick={handleCalculateRisk}
          className="px-5 py-2.5 mt-4 bg-indigo-600 text-white text-md rounded-2xl"
        >
          Calculate the risk
        </button>
      </div>
    </div>
  );
}

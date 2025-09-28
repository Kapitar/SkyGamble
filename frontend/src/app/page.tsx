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

  const fetchTicket = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const supportedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/pdf",
      ];

      if (!supportedTypes.includes(file.type)) {
        setErrorMessage(
          "Unsupported file type. Please upload PDF, PNG, JPG, or JPEG files."
        );
        return;
      }

      const formData = new FormData();
      const lowercaseFileName = file.name.toLowerCase();
      const processedFile = new File([file], lowercaseFileName, {
        type: file.type,
      });

      formData.append("file", processedFile);
      setLoadingMessage("Uploading and processing ticket...");
      fetch("http://localhost:8000/api/flights/upload", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          console.log("Success:", data);
          let assignedTickets: Flight[] = [];
          for (let ticket of data) {
            console.log(ticket);
            if (!ticket.relevant) {
              setLoadingMessage("");
              setErrorMessage("No relevant flight information found.");
              setTimeout(() => setErrorMessage(""), 3000);
              return;
            }

            let createdTicket: Flight = {
              airline: ticket.airline_iata || "",
              arrivalAirport: ticket.arrival_airport || "",
              departureAirport: ticket.departure_airport || "",
              departureDateTime:
                new Date(ticket.departure_datetime_local) || new Date(),
              arrivalDateTime:
                new Date(ticket.arrival_datetime_local) || new Date(),
              flightNumber: ticket.flight_number || "",
            };
            assignedTickets.push(createdTicket);
            setLoadingMessage("");
            setSuccessMessage("Ticket processed successfully!");
            setTimeout(() => setSuccessMessage(""), 3000);
          }
          setFlights(assignedTickets);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
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
          <form>
            <input
              type="file"
              id="ticketFile"
              name="ticketFile"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={fetchTicket}
              className="hidden"
            />
            <label
              htmlFor="ticketFile"
              className="px-5 py-2.5 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-md rounded-2xl cursor-pointer inline-block transition-colors"
            >
              Upload your itinerary
            </label>
            <p className="text-sm mt-1 text-gray-600">
              Only accepts PDF, PNG, JPG, JPEG
            </p>
          </form>
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

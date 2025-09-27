import { ReactNode } from "react";
import { Flight } from "@/types/FlightType";

type ExtendedFlight = Flight & {
  index?: number;
  canBeRemoved?: boolean;
  setLoadingMessage: (msg: string) => void;
  setSuccessMessage: (msg: string) => void;
  setErrorMessage: (msg: string) => void;
  removeTicket?: (index: number) => void;
  addFlight: () => void;
};

export default function BoardingPass({
  airline,
  flightNumber,
  departureAirport,
  arrivalAirport,
  departureDateTime,
  arrivalDateTime,
  edit,
  index,
  canBeRemoved,
  addFlight,
  removeTicket,
  setLoadingMessage,
  setSuccessMessage,
  setErrorMessage,
}: ExtendedFlight) {
  const toLocalInput = (d: Date) =>
    new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

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
          if (!data.relevant) {
            setLoadingMessage("");
            setErrorMessage("No relevant flight information found.");
            setTimeout(() => setErrorMessage(""), 3000);
            return;
          }
          edit?.airline(data.segments[0].airline_iata || "");
          edit?.arrivalAirport(data.segments[0].arrival_airport || "");
          edit?.departureAirport(data.segments[0].departure_airport || "");
          edit?.departureDateTime(
            new Date(data.segments[0].departure_datetime_local) || new Date()
          );
          edit?.arrivalDateTime(
            new Date(data.segments[0].arrival_datetime_local) || new Date()
          );
          edit?.flightNumber(data.segments[0].flight_number || "");
          setLoadingMessage("");
          setSuccessMessage("Ticket processed successfully!");
          setTimeout(() => setSuccessMessage(""), 3000);
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    }
  };

  return (
    <section className="relative rounded-[22px] overflow-visible shadow-2xl bg-white mb-16">
      <div className="bg-indigo-600 text-white px-4 sm:px-6 py-3 sm:py-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="tracking-[0.25em] text-[11px] md:text-xs font-semibold">
          BOARDING PASS
        </h2>
        <span className="text-sm sm:text-base font-medium opacity-95 truncate max-w-full sm:max-w-[60%]">
          {airline}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_18rem]">
        <div className="relative p-4 sm:p-6 md:p-8">
          <Notch side="left" className="hidden md:block" />
          <WorldMap className="absolute inset-0 opacity-[0.05] pointer-events-none" />

          <div className="sm:hidden flex flex-col items-stretch gap-3">
            <div className="min-w-0 text-center">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                From:
              </label>
              <BigInput
                value={departureAirport}
                onChange={(v) => edit?.departureAirport(v)}
                ariaLabel="Departure airport"
              />
            </div>
            <div className="min-w-0 text-center">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                To:
              </label>
              <BigInput
                value={arrivalAirport}
                onChange={(v) => edit?.arrivalAirport(v)}
                accent
                ariaLabel="Arrival airport"
              />
            </div>
          </div>

          <div className="hidden sm:grid grid-cols-3 items-end gap-2 sm:gap-4">
            <div className="min-w-0 flex flex-col">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                From:
              </label>
              <BigInput
                value={departureAirport}
                onChange={(v) => edit?.departureAirport(v)}
                accent
                ariaLabel="Departure airport"
              />
            </div>
            <div className="flex items-center justify-center pb-1 justify-self-center">
              <RouteIcon />
            </div>
            <div className="min-w-0 flex flex-col">
              <label className="text-[11px] uppercase tracking-wide text-slate-500">
                To:
              </label>
              <BigInput
                value={arrivalAirport}
                onChange={(v) => edit?.arrivalAirport(v)}
                accent
                ariaLabel="Arrival airport"
              />
            </div>
          </div>

          <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-sm">
            <KVRow label="Departs">
              <input
                type="datetime-local"
                className="w-full rounded-md text-black border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={toLocalInput(departureDateTime)}
                onChange={(e) =>
                  edit?.departureDateTime(new Date(e.target.value))
                }
              />
            </KVRow>
            <KVRow label="Arrives">
              <input
                type="datetime-local"
                className="w-full rounded-md text-black border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={toLocalInput(arrivalDateTime)}
                onChange={(e) =>
                  edit?.arrivalDateTime(new Date(e.target.value))
                }
              />
            </KVRow>
          </div>

          <form>
            <input
              type="file"
              id={`ticketFile-${index}`}
              name="ticketFile"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={fetchTicket}
              className="hidden"
            />
            <label
              htmlFor={`ticketFile-${index}`}
              className="px-5 py-2.5 mt-4 bg-indigo-600 hover:bg-indigo-700 text-white text-md rounded-2xl cursor-pointer inline-block transition-colors"
            >
              Upload a ticket
            </label>
          </form>
          <p className="text-sm mt-1 text-gray-600">
            Only accepts PDF, PNG, JPG, JPEG
          </p>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed border-slate-300" />
          <Notch side="middle" />
        </div>

        <aside className="bg-slate-50 p-4 sm:p-6 border-t md:border-t-0 md:border-l border-slate-200 relative">
          <Notch side="right" className="hidden md:block" />

          <div className="grid grid-cols-1 gap-3 text-sm">
            <KVRow label="Airline">
              <input
                className="w-full rounded-md text-black border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={airline}
                onChange={(e) => edit?.airline(e.target.value)}
              />
            </KVRow>
            <KVRow label="Flight">
              <input
                className="w-full rounded-md text-black border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={flightNumber}
                onChange={(e) => edit?.flightNumber(e.target.value)}
              />
            </KVRow>
          </div>

          <div className="mt-4 sm:mt-6">
            <Barcode />
          </div>
        </aside>
      </div>

      <button
        type="button"
        aria-label={canBeRemoved ? "Remove" : "Add"}
        onClick={canBeRemoved ? () => removeTicket?.(index!) : addFlight}
        className={`
          absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2
          h-14 w-14 rounded-full
          ${
            canBeRemoved
              ? "bg-red-600 hover:bg-red-700"
              : "bg-indigo-600 hover:bg-indigo-700"
          } text-white
          shadow-xl border-2 border-white
          flex items-center justify-center z-10
          focus:outline-none focus:ring-2 ${
            canBeRemoved ? "focus:ring-red-400" : "focus:ring-indigo-400"
          } focus:ring-offset-2
          active:scale-95 transition
          cursor-pointer
        `}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7">
          <path
            fill="currentColor"
            d={
              canBeRemoved
                ? "M6 6l12 12m0-12L6 18" // X cross
                : "M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" // Plus
            }
            stroke={canBeRemoved ? "currentColor" : "none"}
            strokeWidth={canBeRemoved ? "2" : "0"}
            strokeLinecap={canBeRemoved ? "round" : "butt"}
          />
        </svg>
      </button>
    </section>
  );
}

function KVRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function BigInput({
  value,
  onChange,
  accent,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  accent?: boolean;
  ariaLabel: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      maxLength={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${
        accent ? "text-indigo-600" : ""
      } text-4xl sm:text-5xl md:text-6xl font-black leading-none tracking-wider bg-transparent border-b-2 border-slate-300 focus:border-indigo-500 outline-none w-[6ch] text-center md:text-left`}
      style={{ textTransform: "uppercase" }}
    />
  );
}

function RouteIcon() {
  return (
    <div className="flex items-center gap-2 text-slate-400">
      <span className="block h-0.5 w-16 bg-current rounded" />
      <PlaneIcon className="w-6 h-6" />
      <span className="block h-0.5 w-16 bg-current rounded" />
    </div>
  );
}

function PlaneIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      <path d="M12.5 28.5l4.7-3.4 7.5 1.8 8-5.8c1.5-1 3.1.8 1.9 2.2l-6 7 1.8 7.6-3.5 2-3.1-6.3-6.2 4.5c-.7.5-1.6.3-2.1-.4l-1.4-2c-.5-.7-.3-1.6.4-2.1l6.2-4.5-6.2-1.5c-.6-.2-1-.8-1-1.4v-1.3c0-.6.3-1.1.8-1.4z" />
    </svg>
  );
}

function WorldMap({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 600"
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="wm" x1="0" x2="1">
          <stop offset="0%" stopColor="#000" stopOpacity=".6" />
          <stop offset="100%" stopColor="#000" stopOpacity=".4" />
        </linearGradient>
      </defs>
      <rect width="1200" height="600" fill="transparent" />
      <g fill="url(#wm)">
        <path d="M149 197l28 3 21-7 15 7 19-6 19 6-10 17 15 11-5 12-21-3-5 10-18-3-6-11-25 1-13-12 6-25z" />
        <path d="M427 214l18-8 17 4 13 12 12-8 14 5 6 13-10 12 7 13-14 7-17-4-9-14-14-2-13-11 0-19z" />
        <path d="M706 240l22-11 21 5 12 10 25-3 10 10-7 16-30 4-8 12-23-6-12-14-10-9 0-14z" />
        <path d="M958 254l23-9 20 2 13 10 18-3 15 7 5 11-7 10-22 2-11 11-19-2-18-10-10-12 3-17z" />
      </g>
    </svg>
  );
}

function Notch({
  side,
  className = "",
}: {
  side: "left" | "middle" | "right";
  className?: string;
}) {
  const base =
    "absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-indigo-50/60 rounded-full shadow-inner";
  if (side === "middle") {
    return <div className="absolute inset-y-0 left-1/2 -translate-x-1/2" />;
  }
  return (
    <div
      className={`${base} ${className} ${
        side === "left" ? "-left-3" : "-right-3"
      }`}
      aria-hidden
    />
  );
}

function Barcode() {
  return (
    <div className="h-16 sm:h-20 w-full rounded-md bg-white border border-slate-300 overflow-hidden">
      <div
        className="h-full w-full bg-[length:6px_100%]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgb(30 41 59) 0 2px, transparent 2px 6px)",
        }}
        aria-label="barcode"
      />
    </div>
  );
}

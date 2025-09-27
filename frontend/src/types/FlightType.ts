export type Flight = {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureDateTime: Date;
  arrivalDateTime: Date;
  edit?: {
    airline: (v: string) => void;
    flightNumber: (v: string) => void;
    departureAirport: (v: string) => void;
    arrivalAirport: (v: string) => void;
    departureDateTime: (v: string) => void;
    arrivalDateTime: (v: string) => void;
  };
}
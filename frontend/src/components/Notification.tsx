interface NotificationProps {
  children: React.ReactNode;
  type: "success" | "error" | "loading";
}

export default function Notification({ children, type }: NotificationProps) {
  let bgColor = "bg-indigo-600";
  if (type === "error") {
    bgColor = "bg-red-600";
  } else if (type === "success") {
    bgColor = "bg-green-600";
  }

  const LoadingSpinner = () => (
    <svg
      className="animate-spin h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const ErrorIcon = () => (
    <svg
      className="h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M8 8l8 8m0-8l-8 8"
      />
    </svg>
  );

  const SuccessIcon = () => (
    <svg
      className="h-5 w-5 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4"
      />
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );

  return (
    <div className="fixed bottom-8 right-8 z-999">
      <div
        className={`${bgColor} text-white px-4 py-2.5 min-w-32 text-center rounded-xl shadow-lg flex gap-x-2 items-center`}
      >
        {type === "loading" && <LoadingSpinner />}
        {type === "success" && <SuccessIcon />}
        {type === "error" && <ErrorIcon />}
        {children}
      </div>
    </div>
  );
}

interface ErrorAlertProps {
  message: string;
}

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div
      role="alert"
      className="mb-4 px-3 py-2 border border-red-600 bg-red-50 text-red-800 text-sm"
    >
      {message}
    </div>
  );
}

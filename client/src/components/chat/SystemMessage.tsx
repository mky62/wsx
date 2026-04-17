interface SystemMessageProps {
  text: string;
}

export default function SystemMessage({ text }: SystemMessageProps) {
  return (
    <p className="text-center text-sm italic text-gray-300">
      {text}
    </p>
  );
}
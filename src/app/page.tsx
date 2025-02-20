import { ArrowRight } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen ">
      <div className="flex flex-row border border-gray-500 rounded-xl p-2 gap-2">
      <a href="/assistant">Go To Assistant</a>
      <ArrowRight />
      </div>
      
    </div>
  );
}

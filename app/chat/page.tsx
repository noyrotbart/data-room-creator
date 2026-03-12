import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/");
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />
      <ChatClient />
    </div>
  );
}

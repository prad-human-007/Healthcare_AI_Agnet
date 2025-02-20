import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.NEXT_PUBLIC_REALTIME_MODEL_NAME,
      voice: "alloy",
      instructions: `You are a receptionist at doctors office`,
      input_audio_transcription: {
        model: "whisper-1",
      },
      tools: [
        {
            type: "function",
            name: "add_calender_event",
            description: "Add an event to the calender",
            parameters: {
                type: "object",
                properties: {
                date: { type: "string" },
                time: { type: "string" },
                patient_name: { type: "string" },
                },
                required: ["date", "time", "event_name"],
            },
        },
        {
            type: "function",
            name: "number_of_appointments",
            description: "Get the number of appointments for a given date",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string" },
              },
              required: ["date"],
            },
        },
      ],
    }),
  });
  const { client_secret } = await r.json();

  if (client_secret) {
    console.log("Client secret: ", client_secret);
  } else {
    return NextResponse.json(
      { error: "Error in generating client secret" },
      { status: 500 }
    );
  }

  return NextResponse.json({ client_secret });
}

'use client'

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface Msg {
    type: string
    event_id: string
    item_id: string;
    transcript: string;
}

type AgentState = "preconnected" | "connecting" | "connected";
interface AgentInput {
  type: "message";
  role: 'system' | 'user' | 'assistant';
  content: {
    type: "input_text";
    text: string;
  }[];
}

interface Appointment {
    date: string;
    time: string;
    patient_name: string;
}

export default function Page() {

    const audioRef = useRef<HTMLAudioElement>(null);
    const [agentState, setAgentState] = useState("preconnected");
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [messages, setMessages] = useState<Msg[]>([]);
    const [token, setToken] = useState<string | null>(null);
    const peerConectionRef = useRef<RTCPeerConnection | null>(null);
    const localMediaStreamRef = useRef<MediaStream | null>(null);
    const datachannelRef = useRef<RTCDataChannel | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const [appointments, setAppointments] = useState<Appointment[]>([]);


    function addMessage(e: MessageEvent) {
        // console.log("Message: ", e)
        const data = JSON.parse(e.data);
        if(data && data.type === "conversation.item.created") {
            if(data.item.type === 'function_call') 
                console.log("Function Call Detected ")
            console.log("CREATED CONVERSATION:", data.item.id, "PREV MSG ", data.previous_item_id, data)
            setMessages((prev) => [...prev, {
                    type: "User", 
                    event_id: data.event_id,
                    item_id: data.item.id, 
                    transcript: ""
                }]
            )
        }
        if(data && data.type === "conversation.item.input_audio_transcription.completed") {
            // console.log("Msg Id:", data.item_id, "User Msg: ", data.transcript, data)
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg.item_id === data.item_id ? { ...msg, type: 'User', transcript: (msg.transcript + data.transcript) || '---'} : msg
                )
            );
        }
        if(data && data.type === "response.audio_transcript.delta") {
            
            // console.log("Resp Id:", data.response_id, "Response Msg: ", data.delta, data)
            setMessages((prevMessages) =>
                prevMessages.map((msg) =>
                    msg.item_id === data.item_id ? { ...msg, type: 'Agent', transcript: msg.transcript + data.delta } : msg
                )
            );
        }
        if(data && data.type === "response.output_item.done") {
            if(data.item.type === 'function_call') {
                console.log("Function Call Detected ", data)
                const {date, time, patient_name} = JSON.parse(data.item.arguments)
                console.log("Appointment Details: ", date, time, patient_name)
                if(data && time && patient_name)
                    createAppointment(data.item.call_id, date, time, patient_name)
            }
        }
        if(data && data.type === "error") {
            console.log("ERROR", data)
        }
    }

    function createAppointment(call_id: string, date: string, time: string, patient_name: string) {
        setAppointments((prev) => [...prev, {date, time, patient_name }] )
        if(datachannelRef.current && datachannelRef.current.readyState === "open") {
            const event = {
                type: "conversation.item.create",
                item: {
                    type: "function_call_output",
                    call_id: call_id,
                    output: {
                        date: date,
                        time: time,
                        patient_name: patient_name
                    }
                }
            }
            datachannelRef.current.send(JSON.stringify(event));
            console.log("Sent appointment response:", event);
            
            const event2 = {
                type: "response.create",
            }
            datachannelRef.current.send(JSON.stringify(event2));
            console.log("Sent response create request:", event2);
        }
        else {
            console.warn("DataChannel is not open");
        }

    }

    function agentSpeak(input: AgentInput[] | null = null) {
        if (datachannelRef.current && datachannelRef.current.readyState === "open") {
            const event = {
                event_id: "convo_end",
                type: "response.create",
                response: {
                    modalities: ["text", "audio"], // Get both text and audio
                    output_audio_format: "pcm16",
                    temperature: 0.8,
                    max_output_tokens: 1024,
                    input: input
                }
            };
            datachannelRef.current.send(JSON.stringify(event));
            console.log("Sent disconnect request:", event);
        } else {
            console.warn("DataChannel is not open");
        }
    }

    function disconnect() {
        if (peerConectionRef.current) {
            peerConectionRef.current.close();
        }
        if (localMediaStreamRef.current) {
            localMediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        if (stream) {
            stream.getTracks().forEach((t) => t.stop());
        }
        setMessages([]);
        setAgentState("preconnected");
    }

    async function init() {
        
        if(!audioRef.current) return;  
        try {
            // Get an ephemeral key from your server
            console.log("Fetching token")
            setAgentState("connecting");
            const tokenResponse = await fetch("/api/openai-session", { 
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                  }
            });
            if(!tokenResponse.ok) { 
                setAgentState('preconnected'); 
                if(tokenResponse.status === 401) { alert("Unauthorized") }
                if(tokenResponse.status === 402) { alert("No credits")}
                return;
            }
            
            
            const data = await tokenResponse.json();
            console.log("Token response:", data);
            const EPHEMERAL_KEY = data.client_secret.value;

            console.log("Ephemeral key:", EPHEMERAL_KEY);
            // Create a peer connection
            peerConectionRef.current = new RTCPeerConnection();
            peerConectionRef.current.onconnectionstatechange = () => {
                if(peerConectionRef.current) {
                    if (peerConectionRef.current.connectionState === "connected") {
                        setAgentState("connected");
                    }
                }
            }

            // Set up to play remote audio from the model
            peerConectionRef.current.ontrack = (e: RTCTrackEvent) => {
                if (audioRef.current) {
                    audioRef.current.srcObject = e.streams[0];
                }
                setStream(e.streams[0]);
            };

            // Add local audio track for microphone input in the browser
            localMediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
            peerConectionRef.current.addTrack(localMediaStreamRef.current.getTracks()[0]);
            console.log("Added local audio track", localMediaStreamRef.current.getTracks()[0]);

            // Set up data channel for sending and receiving events
            datachannelRef.current = peerConectionRef.current.createDataChannel("oai-events");
            datachannelRef.current.addEventListener("message", (e) => {
                addMessage(e);
            });
            datachannelRef.current.onopen = () => {
              agentSpeak();
            }

            // Start the session using SDP
            const offer = await peerConectionRef.current.createOffer();
            await peerConectionRef.current.setLocalDescription(offer);

            const baseUrl = "https://api.openai.com/v1/realtime";
            const model = process.env.NEXT_PUBLIC_REALTIME_MODEL_NAME;
            const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
                method: "POST",
                body: offer.sdp,
                headers: {
                    Authorization: `Bearer ${EPHEMERAL_KEY}`,
                    "Content-Type": "application/sdp",
                },
            });

            const answer: RTCSessionDescriptionInit = {
                type: 'answer',
                sdp: await sdpResponse.text(),
            };
            await peerConectionRef.current.setRemoteDescription(answer);

            console.log("Peer connection established", peerConectionRef.current);
        } catch (error) {
            console.error("Error initializing WebRTC session:", error);
        }
    }

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <div className="mt-10 w-full max-w-2xl mx-auto p-4">
            {/* Control Buttons */}
            {
                agentState === "preconnected" && (
                    <Button 
                        className={`rounded-xl connect-button uppercase border border-gray-500 [box-shadow:0.0rem_0.25rem_#000] ${false? 'translate-x-[+0.25rem] translate-y-[+0.25rem] [box-shadow:0.0rem_0.0rem_#000] bg-blue-600': 'bg-blue-500'} hover:bg-blue-600`}
                        onClick={init}>
                        Start Interview
                    </Button>
                )
            }
            {
                
                agentState === "connecting" && (
                    <div>
                        <p>Connecting...</p>
                    </div>
                )
            }
            {
                agentState === "connected" && (
                    <div className="rounded-xl flex flex-row gap-2 items-center justify-center">
                        <Button className=" bg-red-500" onClick={disconnect}>
                            Disconnect
                        </Button>
                    </div>
                )
            }

            {/* Messages */}
            <div className="mt-5 overflow-y-auto h-96 max-w-2xl w-full bg-white bg-opacity-30 shadow-2xl p-4 mt-2 rounded-lg">
                <div className="">
                    {messages.map((m) => (
                        <div className={`flex flex-col  gap-1 border-b-2 p-3`} key={m.event_id}>
                            <h3 className={`text-lg ${m.type == 'Agent'? 'text-red-600 ': 'text-black text-right'}`}>{m.type} Message</h3>
                            <p className={`flex text-gray-600 italic ${m.type == 'Agent'? '': 'text-right justify-end '}`}>{ m.transcript || "Loading..."}</p>
                            <div className={`w-full `}></div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Appointments */}
            <div className="mt-10">
                <h2>Appointments</h2>
                <ul>
                    {appointments.map((app, idx) => (
                        <li key={idx}>
                            <p>{app.patient_name} - {app.date} - {app.time}</p>
                        </li>
                    ))}
                </ul>   
            </div>

            <audio ref={audioRef} autoPlay />
        </div>
    );
}
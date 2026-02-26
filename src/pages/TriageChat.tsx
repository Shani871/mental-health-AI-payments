import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, AlertTriangle, ShieldAlert, Bot, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type Message = {
  id: string;
  role: "user" | "model";
  content: string;
};

export default function TriageChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "model",
      content: "Hello. I am the MindTriage AI assistant. I'm here to help understand what you're experiencing so we can connect you with the right support. \n\n**Please note: I am an AI, not a doctor. I cannot diagnose conditions or provide medical treatment. If you are in immediate danger or experiencing a medical emergency, please call your local emergency services immediately.**\n\nHow have you been feeling over the past two weeks?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isEmergency, setIsEmergency] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const emergencyKeywords = ["suicide", "kill myself", "end it all", "want to die", "hurt myself"];
      if (emergencyKeywords.some((kw) => userMsg.toLowerCase().includes(kw))) {
        setIsEmergency(true);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "model",
            content: "**EMERGENCY ALERT:** It sounds like you are going through an incredibly difficult time. Please know that you are not alone and help is available right now. **Please call 988 (Suicide & Crisis Lifeline) or go to the nearest emergency room immediately.**",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const chatHistory = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      }));

      chatHistory.push({ role: "user", parts: [{ text: userMsg }] });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: chatHistory as any,
        config: {
          systemInstruction: `You are a mental health triage assistant. Your goal is to gently ask questions to understand the user's emotional state, similar to a PHQ-9 or GAD-7 screening, but in a conversational way.
          
CRITICAL RULES:
1. You are NOT a doctor or licensed therapist.
2. DO NOT diagnose the user (e.g., never say "You have depression").
3. DO NOT prescribe or recommend specific medical treatments.
4. ONLY recommend speaking with a licensed therapist.
5. If the user expresses thoughts of self-harm, suicide, or severe distress, you MUST immediately advise them to contact emergency services (e.g., 988) and stop the assessment.
6. Keep responses empathetic, concise, and professional.`,
        }
      });

      const aiText = response.text || "I'm sorry, I couldn't process that. Could you please rephrase?";
      
      if (aiText.toLowerCase().includes("emergency") || aiText.toLowerCase().includes("988")) {
        setIsEmergency(true);
      }

      setMessages((prev) => [...prev, { id: Date.now().toString(), role: "model", content: aiText }]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "model", content: "I'm sorry, I encountered an error connecting to the service. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <Bot className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">AI Triage Assistant</h2>
            <p className="text-xs text-slate-500">Confidential & Secure</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Not medical advice
        </div>
      </div>

      <AnimatePresence>
        {isEmergency && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-red-50 border-b border-red-100 px-6 py-4 flex items-start gap-3"
          >
            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-red-900">Emergency Resources</h3>
              <p className="text-sm text-red-800 mt-1">
                If you are in immediate danger, please call <strong>911</strong> or go to the nearest emergency room. 
                For the Suicide & Crisis Lifeline, call or text <strong>988</strong>.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-4 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-indigo-600" : "bg-slate-200"
              }`}
            >
              {msg.role === "user" ? (
                <User className="w-5 h-5 text-white" />
              ) : (
                <Bot className="w-5 h-5 text-slate-600" />
              )}
            </div>
            <div
              className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-tr-sm"
                  : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
              }`}
            >
              <div className={`prose prose-sm max-w-none ${msg.role === "user" ? "prose-invert" : ""}`}>
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-slate-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              <span className="text-sm text-slate-500">Analyzing response...</span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message here..."
            disabled={isLoading}
            className="w-full bg-slate-50 border border-slate-300 rounded-full pl-6 pr-14 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-shadow"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        <p className="text-center text-[10px] text-slate-400 mt-3">
          AI-generated responses may be inaccurate. Do not use for medical emergencies.
        </p>
      </div>
    </div>
  );
}

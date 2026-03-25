import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, HeartPulse, HelpCircle, Clock, Search, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { type BrowserSpeechRecognition, getSpeechRecognitionConstructor, speakText, stopSpeaking } from "../lib/voice";

type Role = "user" | "assistant";
type Message = {
  id: string;
  role: Role;
  text: string;
};

const SUGGESTIONS = [
  { text: "I need someone to talk to", icon: HeartPulse },
  { text: "How does this platform work?", icon: HelpCircle },
  { text: "What are your hours?", icon: Clock },
  { text: "Find a therapist", icon: Search },
];

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", text: "Hello! I'm the MindTriage supportive assistant. How are you feeling today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const dictatedTextRef = useRef("");
  const seedInputRef = useRef("");
  const recognitionSupported = Boolean(getSpeechRecognitionConstructor());

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      stopSpeaking();
    };
  }, []);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    
    if (isLoading) return;
    
    const userMessage: Message = { id: Date.now().toString(), role: "user", text };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create conversation history for the API
      const conversationHistory = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.text
      }));

      const systemPrompt = `You are a helpful, empathetic, and professional mental health support assistant for "MindTriage" (also known as MindBridge Health Platform). 
Your goal is to provide supportive, helpful responses, check in on user well-being, and clarify what kind of help they might need.
Do NOT attempt to diagnose or treat medical conditions. Encourage users to speak to a licensed therapist on the platform for clinical help.
Keep your responses concise, readable, and highly empathetic.

When the user asks ANYTHING about this project/platform, you MUST know everything about it based on the following context:

PROJECT CONTEXT:
MindTriage is a full-stack mental health SaaS.
Key Features include:
- Phase 1: JWT auth, role-based guards, rate limiting, global API responses.
- Phase 2: Therapist profiles, slot management, Redis slot locking, booking lifecycle.
- Phase 3: Payments (Razorpay, Stripe-style), invoices, refunds, commission engine.
- Phase 4: AI Triage (structured PHQ-9/GAD-7 assessment), Risk classification, emergency alerts, encrypted AI chat history, daily mood tracking.
- Phase 5: Zoom meetings, attendance tracking, email reminders, SMS mock service, in-app notifications.
- Phase 6: Metrics, Docker + Nginx setup.
- Voice Assistant: Custom voice dictation, navigation, and form-filling (accessible via the microphone icon).
- Risk Prediction: Python machine learning model predicting depression/anxiety risks based on user inputs.
- Tech Stack: React, Vite, TailwindCSS (Frontend), Spring Boot / Node.js Express (Backend), SQLite/MySQL (Database), Python (Model), NVIDIA LLM APIs instead of Ollama.
- User Roles: USER (patient), THERAPIST, and ADMIN.

If users ask about what this app is, its tech stack, its components, features, or how it works, answer confidently using the context above. For non-project questions, offer empathetic mental health support.`;

      const nvidiaMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.text
        }))
      ];

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          model: "meta/llama-3.1-70b-instruct",
          messages: nvidiaMessages,
          temperature: 0.7,
          top_p: 1,
          max_tokens: 1024,
          stream: false
        })
      });

      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      
      const botReply = data?.choices?.[0]?.message?.content || "I couldn't generate a response.";
      
      const botMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: "assistant", 
        text: botReply 
      };
      
      setMessages(prev => [...prev, botMessage]);
      if (speechEnabled) {
        speakText(botReply, { rate: 1.02 });
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [
        ...prev, 
        { id: (Date.now() + 1).toString(), role: "assistant", text: "I'm sorry, I'm having trouble connecting to the chat service. Please try again later." }
      ]);
      if (speechEnabled) {
        speakText("I'm sorry, I'm having trouble connecting to the chat service. Please try again later.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const startVoiceInput = () => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) return;

    recognitionRef.current?.abort();

    dictatedTextRef.current = "";
    seedInputRef.current = input.trim();
    setIsListening(true);

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = dictatedTextRef.current;
      let interimTranscript = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalTranscript = `${finalTranscript} ${transcript}`.trim();
        } else {
          interimTranscript = `${interimTranscript} ${transcript}`.trim();
        }
      }

      dictatedTextRef.current = finalTranscript;
      setInput([seedInputRef.current, finalTranscript, interimTranscript].filter(Boolean).join(" ").trim());
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setInput([seedInputRef.current, dictatedTextRef.current].filter(Boolean).join(" ").trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-20 right-0 w-[calc(100vw-3rem)] sm:w-[440px] md:w-[460px] h-[650px] max-h-[82vh] bg-white rounded-[28px] shadow-2xl flex flex-col overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-600 to-teal-500 p-5 flex items-center justify-between text-white shrink-0 shadow-sm relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md shadow-inner">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight tracking-tight">MindTriage AI</h3>
                    <div className="flex items-center gap-1.5 opacity-90 mt-0.5">
                      <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse shadow-[0_0_8px_rgba(110,231,183,0.8)]"></span>
                      <p className="text-xs font-medium">Online & voice ready</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setSpeechEnabled((current) => {
                        const nextValue = !current;
                        if (!nextValue) stopSpeaking();
                        return nextValue;
                      });
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all focus:ring-2 focus:ring-white/30 outline-none"
                    aria-label="Toggle spoken replies"
                  >
                    {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition-all focus:ring-2 focus:ring-white/30 outline-none"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Chat Area */}
              <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 hover:scrollbar-thumb-slate-300 scrollbar-track-transparent">
                {messages.map((msg) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`flex gap-3 max-w-[92%] sm:max-w-[88%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                        msg.role === "user" ? "bg-slate-200" : "bg-teal-100 text-teal-700"
                      }`}>
                        {msg.role === "user" ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-5 h-5" />}
                      </div>
                      <div className={`px-4 py-3 rounded-[18px] text-[15px] leading-relaxed shadow-sm overflow-hidden ${
                        msg.role === "user" 
                          ? "bg-teal-600 text-white rounded-tr-sm" 
                          : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm ring-1 ring-slate-900/5 text-left"
                      }`}>
                        {msg.role === "assistant" ? (
                           <div className="markdown-body break-words text-[15px]">
                             <ReactMarkdown>
                               {msg.text}
                             </ReactMarkdown>
                           </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words">{msg.text}</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                
                {isLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                    <div className="flex gap-3 max-w-[92%] flex-row">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm bg-teal-100 text-teal-700">
                        <Bot className="w-5 h-5" />
                      </div>
                      <div className="px-5 py-4 rounded-[18px] bg-white border border-slate-100 rounded-tl-sm flex items-center gap-1.5 shadow-sm ring-1 ring-slate-900/5">
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                        <div className="w-2 h-2 bg-teal-400 rounded-full animate-bounce"></div>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* Suggestions (only show if no user interaction yet) */}
              {messages.length === 1 && !isLoading && (
                <div className="px-5 pb-3 bg-slate-50/50 flex gap-2 overflow-x-auto scrollbar-none shrink-0 py-1">
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s.text)}
                      className="whitespace-nowrap flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-teal-300 hover:bg-teal-50 rounded-xl text-[13px] font-medium text-slate-600 hover:text-teal-700 transition-all shadow-sm active:scale-95"
                    >
                      <s.icon className="w-3.5 h-3.5" />
                      {s.text}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
                  className="relative flex items-center"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    data-voice="chat message|message"
                    className="w-full pl-5 pr-[100px] py-3.5 bg-slate-50 border border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 rounded-2xl outline-none text-[15px] transition-all shadow-sm focus:bg-white placeholder:text-slate-400"
                    disabled={isLoading}
                  />
                  <div className="absolute right-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isLoading || !recognitionSupported}
                      onClick={() => (isListening ? stopVoiceInput() : startVoiceInput())}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all ${
                        isListening 
                          ? "bg-rose-100 text-rose-600 animate-pulse" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50"
                      }`}
                      aria-label="Use voice input"
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoading}
                      data-voice="send message|send"
                      className="w-9 h-9 flex items-center justify-center bg-teal-600 hover:bg-teal-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-all shadow-sm active:scale-95"
                    >
                      <Send className="w-4 h-4 ml-0.5" />
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Button */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`w-[60px] h-[60px] rounded-full shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex items-center justify-center text-white transition-all z-50 ${
            isOpen ? "bg-slate-800 hover:bg-slate-700 rotate-90" : "bg-teal-600 hover:bg-teal-700 hover:shadow-[0_8px_30px_rgba(13,148,136,0.3)]"
          }`}
        >
          {isOpen ? <X className="w-6 h-6 -rotate-90 transition-transform duration-300" /> : <MessageCircle className="w-7 h-7" />}
        </motion.button>
      </div>
    </>
  );
}

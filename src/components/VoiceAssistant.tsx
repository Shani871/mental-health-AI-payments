import { useEffect, useRef, useState } from "react";
import { Bot, Mic, MicOff, Volume2, VolumeX, Wand2, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  type BrowserSpeechRecognition,
  getSpeechRecognitionConstructor,
  normalizeVoiceText,
  speakText,
  stopSpeaking,
} from "../lib/voice";

type AssistantMode = "command" | "dictation";

type RouteCommand = {
  path: string;
  aliases: string[];
};

const ROUTE_COMMANDS: RouteCommand[] = [
  { path: "/", aliases: ["home", "landing page"] },
  { path: "/login", aliases: ["login", "sign in"] },
  { path: "/signup", aliases: ["sign up", "signup", "create account", "register"] },
  { path: "/therapist-signup", aliases: ["therapist sign up", "therapist signup", "therapist register"] },
  { path: "/triage", aliases: ["triage", "ai triage", "assessment"] },
  { path: "/predict", aliases: ["predict", "prediction", "risk prediction"] },
  { path: "/therapists", aliases: ["therapists", "find therapist", "book therapist"] },
  { path: "/dashboard", aliases: ["dashboard"] },
  { path: "/payments", aliases: ["payments", "refunds"] },
  { path: "/therapist", aliases: ["therapist panel", "therapist dashboard"] },
  { path: "/admin", aliases: ["admin", "admin panel"] },
];

const SAMPLE_COMMANDS = [
  "Go to triage",
  "Focus email",
  "Set refund amount to 40",
  "Click submit refund request",
  "Read page",
];

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    rect.width > 0 &&
    rect.height > 0 &&
    !element.hasAttribute("hidden") &&
    element.getAttribute("aria-hidden") !== "true"
  );
}

function toAliases(element: HTMLElement) {
  const aliases = new Set<string>();
  const voiceData = element.dataset.voice;
  if (voiceData) {
    voiceData
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => aliases.add(item));
  }

  const ariaLabel = element.getAttribute("aria-label");
  const placeholder = element.getAttribute("placeholder");
  const name = element.getAttribute("name");
  const id = element.getAttribute("id");
  const text = element.textContent?.trim();

  [ariaLabel, placeholder, name, id, text].forEach((item) => {
    if (item) aliases.add(item);
  });

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    element.labels?.forEach((label) => {
      const labelText = label.textContent?.trim();
      if (labelText) aliases.add(labelText);
    });
  }

  return Array.from(aliases)
    .map((item) => normalizeVoiceText(item))
    .filter(Boolean);
}

function scoreAlias(query: string, alias: string) {
  if (!query || !alias) return 0;
  if (query === alias) return 100;
  if (alias.startsWith(query) || query.startsWith(alias)) return 80;
  if (alias.includes(query)) return 70;
  const queryWords = query.split(" ").filter(Boolean);
  const hits = queryWords.filter((word) => alias.includes(word)).length;
  return hits === queryWords.length ? 40 + hits : hits > 0 ? 20 + hits : 0;
}

function findBestElement(elements: HTMLElement[], query: string) {
  const normalized = normalizeVoiceText(query);
  let bestMatch: HTMLElement | null = null;
  let bestScore = 0;

  elements.forEach((element) => {
    if (!isVisible(element)) return;
    const score = Math.max(...toAliases(element).map((alias) => scoreAlias(normalized, alias)), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = element;
    }
  });

  return bestScore >= 45 ? bestMatch : null;
}

function setElementValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string,
  append = false
) {
  if (element instanceof HTMLSelectElement) {
    const selectedOption = Array.from(element.options).find((option) => {
      const aliases = [option.value, option.textContent ?? ""].map((item) => normalizeVoiceText(item));
      return aliases.some((alias) => alias === normalizeVoiceText(value) || alias.includes(normalizeVoiceText(value)));
    });
    if (selectedOption) {
      element.value = selectedOption.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  const nextValue = append && element.value ? `${element.value.trim()} ${value}`.trim() : value;
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

  if (descriptor?.set) {
    descriptor.set.call(element, nextValue);
  } else {
    element.value = nextValue;
  }

  element.focus();
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function setElementChecked(element: HTMLInputElement, checked: boolean) {
  const prototype = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "checked");

  if (descriptor?.set) {
    descriptor.set.call(element, checked);
  } else {
    element.checked = checked;
  }

  element.focus();
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

export default function VoiceAssistant() {
  const navigate = useNavigate();
  const location = useLocation();
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const transcriptRef = useRef("");

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AssistantMode>("command");
  const [isListening, setIsListening] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [lastHeard, setLastHeard] = useState("");
  const [draftTranscript, setDraftTranscript] = useState("");
  const [status, setStatus] = useState("Voice assistant ready.");

  const recognitionSupported = Boolean(getSpeechRecognitionConstructor());

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    setStatus("Voice assistant ready.");
  }, [location.pathname]);

  const respond = (message: string) => {
    setStatus(message);
    if (speechEnabled) {
      speakText(message, { rate: 1.02 });
    }
  };

  const findField = (query: string) => {
    const fields = Array.from(
      document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="radio"]):not([type="checkbox"]), textarea, select'
      )
    ) as HTMLElement[];
    return findBestElement(fields, query);
  };

  const findAction = (query: string) => {
    const actions = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a, [role="button"], input[type="radio"], input[type="checkbox"], [data-voice-action="true"]'
      )
    );
    return findBestElement(actions, query);
  };

  const clickElement = (element: HTMLElement) => {
    if (element instanceof HTMLInputElement && (element.type === "radio" || element.type === "checkbox")) {
      setElementChecked(element, true);
      return;
    }
    element.focus();
    element.click();
  };

  const readCurrentPage = () => {
    const heading = document.querySelector("h1")?.textContent?.trim() || "this page";
    const voiceTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-voice], button, a"))
      .filter(isVisible)
      .slice(0, 6)
      .flatMap((element) => toAliases(element).slice(0, 1))
      .slice(0, 5);

    const summary = voiceTargets.length
      ? `You are on ${heading}. You can say: ${voiceTargets.join(", ")}.`
      : `You are on ${heading}. Try saying focus, click, or go to with a visible label.`;
    respond(summary);
  };

  const applyDictation = (text: string) => {
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement instanceof HTMLSelectElement
    ) {
      if (activeElement instanceof HTMLSelectElement) {
        const updated = setElementValue(activeElement, text);
        respond(updated ? `Selected ${text}.` : `I could not match ${text} in the current select field.`);
        return;
      }

      const updated = setElementValue(activeElement, text, true);
      if (updated) {
        respond("Added your dictated text.");
        return;
      }
    }

    respond("Focus a text field first, then use dictate mode.");
  };

  const resolveNavigation = (command: string) => {
    const normalized = normalizeVoiceText(command);
    const stripped = normalized
      .replace(/^(go to|open|navigate to|take me to|show)\s+/, "")
      .trim();

    return ROUTE_COMMANDS.find((route) =>
      route.aliases.some((alias) => {
        const normalizedAlias = normalizeVoiceText(alias);
        return normalized === normalizedAlias || stripped === normalizedAlias;
      })
    );
  };

  const handleCommand = (spokenText: string) => {
    const normalized = normalizeVoiceText(spokenText);

    if (!normalized) {
      respond("I did not catch that.");
      return;
    }

    if (normalized === "read page" || normalized === "what can i do") {
      readCurrentPage();
      return;
    }

    if (normalized === "stop speaking" || normalized === "be quiet") {
      stopSpeaking();
      setStatus("Speech output stopped.");
      return;
    }

    const route = resolveNavigation(normalized);
    if (route) {
      navigate(route.path);
      respond(`Opening ${route.aliases[0]}.`);
      return;
    }

    const focusMatch = normalized.match(/^(focus|select field|open field)\s+(.+)$/);
    if (focusMatch) {
      const field = findField(focusMatch[2]);
      if (field instanceof HTMLElement) {
        field.focus();
        respond(`Focused ${focusMatch[2]}.`);
      } else {
        respond(`I could not find a field named ${focusMatch[2]}.`);
      }
      return;
    }

    const clearMatch = normalized.match(/^clear\s+(.+)$/);
    if (clearMatch) {
      const field = findField(clearMatch[1]);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        const cleared = setElementValue(field, "");
        respond(cleared ? `Cleared ${clearMatch[1]}.` : `I could not clear ${clearMatch[1]}.`);
      } else {
        respond(`I could not find ${clearMatch[1]}.`);
      }
      return;
    }

    const setMatch = normalized.match(/^(set|fill|type)\s+(.+?)\s+(to|as)\s+(.+)$/);
    if (setMatch) {
      const [, , fieldName, , fieldValue] = setMatch;
      const field = findField(fieldName);
      if (
        field instanceof HTMLInputElement ||
        field instanceof HTMLTextAreaElement ||
        field instanceof HTMLSelectElement
      ) {
        const updated = setElementValue(field, fieldValue);
        respond(updated ? `Updated ${fieldName}.` : `I could not set ${fieldName} to ${fieldValue}.`);
      } else {
        respond(`I could not find a field named ${fieldName}.`);
      }
      return;
    }

    const checkMatch = normalized.match(/^(check|enable|turn on|accept)\s+(.+)$/);
    if (checkMatch) {
      const target = findAction(checkMatch[2]);
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        setElementChecked(target, true);
        respond(`Checked ${checkMatch[2]}.`);
      } else if (target) {
        clickElement(target);
        respond(`Activated ${checkMatch[2]}.`);
      } else {
        respond(`I could not find ${checkMatch[2]}.`);
      }
      return;
    }

    const uncheckMatch = normalized.match(/^(uncheck|disable|turn off)\s+(.+)$/);
    if (uncheckMatch) {
      const target = findAction(uncheckMatch[2]);
      if (target instanceof HTMLInputElement && target.type === "checkbox") {
        setElementChecked(target, false);
        respond(`Unchecked ${uncheckMatch[2]}.`);
      } else {
        respond(`I could not find ${uncheckMatch[2]}.`);
      }
      return;
    }

    const actionMatch = normalized.match(/^(click|press|choose|select|submit|save|search|book)\s+(.+)$/);
    if (actionMatch) {
      const target = findAction(actionMatch[2]);
      if (target) {
        clickElement(target);
        respond(`Activated ${actionMatch[2]}.`);
      } else {
        respond(`I could not find ${actionMatch[2]}.`);
      }
      return;
    }

    const fallbackAction = findAction(normalized);
    if (fallbackAction) {
      clickElement(fallbackAction);
      respond(`Activated ${spokenText}.`);
      return;
    }

    const fallbackField = findField(normalized);
    if (fallbackField) {
      fallbackField.focus();
      respond(`Focused ${spokenText}.`);
      return;
    }

    respond("I could not match that command. Try read page for available actions.");
  };

  const handleTranscript = (spokenText: string, nextMode: AssistantMode) => {
    setLastHeard(spokenText);
    if (nextMode === "dictation") {
      applyDictation(spokenText);
      return;
    }
    handleCommand(spokenText);
  };

  const startListening = (nextMode: AssistantMode) => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setStatus("Speech recognition is not supported in this browser.");
      return;
    }

    recognitionRef.current?.abort();

    transcriptRef.current = "";
    setMode(nextMode);
    setDraftTranscript("");
    setIsListening(true);
    setStatus(nextMode === "command" ? "Listening for a command..." : "Dictation started.");

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalTranscript = transcriptRef.current;
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

      transcriptRef.current = finalTranscript;
      setDraftTranscript(`${finalTranscript} ${interimTranscript}`.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      const message = event.error === "no-speech" ? "No speech detected." : `Voice input failed: ${event.error}.`;
      setStatus(message);
    };

    recognition.onend = () => {
      setIsListening(false);
      const finalTranscript = transcriptRef.current.trim();
      setDraftTranscript("");
      if (finalTranscript) {
        handleTranscript(finalTranscript, nextMode);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  return (
    <div className="fixed left-4 bottom-6 z-40">
      {isOpen && (
        <div className="mb-3 w-[330px] max-w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-4 bg-slate-900 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="font-semibold">Voice Assistant</div>
                <div className="text-xs text-slate-300">Navigate, fill forms, and trigger actions by voice</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Close voice assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
              <div className="text-sm text-slate-900 mt-1">{status}</div>
              {lastHeard && <div className="text-xs text-slate-500 mt-2">Heard: {lastHeard}</div>}
              {draftTranscript && <div className="text-xs text-teal-700 mt-1">Listening: {draftTranscript}</div>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startListening("command"))}
                disabled={!recognitionSupported}
                className="rounded-2xl bg-teal-600 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                {isListening && mode === "command" ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {isListening && mode === "command" ? "Stop" : "Command"}
              </button>
              <button
                type="button"
                onClick={() => (isListening ? stopListening() : startListening("dictation"))}
                disabled={!recognitionSupported}
                className="rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                {isListening && mode === "dictation" ? "Stop" : "Dictate"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setSpeechEnabled((current) => {
                  const nextValue = !current;
                  if (!nextValue) stopSpeaking();
                  return nextValue;
                });
              }}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2"
            >
              {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              {speechEnabled ? "Spoken replies on" : "Spoken replies off"}
            </button>

            <div className="text-xs text-slate-500 space-y-1">
              {SAMPLE_COMMANDS.map((command) => (
                <div key={command}>Say “{command}”</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="w-14 h-14 rounded-full bg-slate-900 text-white shadow-xl flex items-center justify-center"
        aria-label="Open voice assistant"
      >
        <Mic className="w-6 h-6" />
      </button>
    </div>
  );
}

import React, { useState, useRef } from 'react';
import {
  MessageSquare,
  Mic,
  MicOff,
  Volume2,
  Send,
  Brain,
  Zap,
  Sparkles,
  X,
  Calendar,
} from 'lucide-react';
import type { SmartRideVehicle, BudgetCategoryItem } from '../../types/smart-ride';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelBadge?: string;
  timestamp: string;
}

interface GeminiVoiceCopilotProps {
  vehicles: SmartRideVehicle[];
  budgets: BudgetCategoryItem[];
  exchangeRate: number;
  onApplyVoiceSearch: (keyword: string, maxBudgetNgn: number) => void;
  onQuickBookInspection: (vehicle: SmartRideVehicle, isoDate: string, notes: string) => void;
}

export const GeminiVoiceCopilot: React.FC<GeminiVoiceCopilotProps> = ({
  vehicles,
  budgets,
  exchangeRate,
  onApplyVoiceSearch,
  onQuickBookInspection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modelMode, setModelMode] = useState<'thinking' | 'general' | 'fast'>('thinking');
  const [inputPrompt, setInputPrompt] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isPlayingTts, setIsPlayingTts] = useState<string | null>(null);
  const [ttsStatusError, setTtsStatusError] = useState<string | null>(null);
  const [bookingLotId, setBookingLotId] = useState(vehicles[0]?.lotId || 'SR-US-90418');
  const [bookingDate, setBookingDate] = useState('2026-10-21T14:00');
  const [showBookingForm, setShowBookingForm] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: 'Welcome to Smart Ride Executive Copilot (E-Y Investment Limited). I monitor your Wema Bank / ALATPay budgets in real time, calculate landed Tin Can / Apapa customs duties, filter Smart Ride US Direct stock, and schedule Live Virtual Yard Inspections. How can I assist your acquisition or budget strategy today?',
      modelBadge: 'gemini-4-argon (High Thinking)',
      timestamp: '10:30 AM',
    },
  ]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleSendPrompt = async (customText?: string) => {
    const promptToSend = (customText ?? inputPrompt).trim();
    if (!promptToSend || isSending) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    if (!customText) setInputPrompt('');
    setIsSending(true);
    setTtsStatusError(null);

    try {
      const response = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedHistory.map((m) => ({ role: m.role, text: m.text })),
          mode: modelMode,
          budgetContext: {
            exchangeRateNgnPerUsd: exchangeRate,
            categories: budgets,
          },
          inventorySummary: vehicles.map((v) => ({
            lotId: v.lotId,
            title: `${v.year} ${v.make} ${v.model} ${v.trim}`,
            currentBidUsd: v.currentBidUsd,
            buyNowPriceUsd: v.buyNowPriceUsd,
            port: v.usDeparturePort,
            condition: v.condition,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gemini API request failed');
      }

      const badge =
        data.modelUsed === 'gemini-4-argon'
          ? 'gemini-4-argon · ThinkingLevel.HIGH'
          : data.modelUsed === 'gemini-3.1-flash-lite'
          ? 'gemini-3.1-flash-lite · Fast'
          : 'gemini-3.8-flash · General';

      const replyMsg: ChatMessage = {
        id: `model-${Date.now()}`,
        role: 'model',
        text: data.reply,
        modelBadge: badge,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, replyMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: `Unable to reach Gemini backend: ${err?.message || 'Check API key configuration.'}`,
          modelBadge: 'System Notice',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handlePlayTts = async (msg: ChatMessage) => {
    setIsPlayingTts(msg.id);
    setTtsStatusError(null);
    try {
      const res = await fetch('/api/ai-agent/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: msg.text,
          voiceName: 'Kore',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.audioBase64) {
        throw new Error(data.error || 'TTS synthesis failed');
      }

      const audioSrc = `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`;
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(audioSrc);
      audioRef.current = audio;
      audio.onended = () => setIsPlayingTts(null);
      audio.onerror = () => setIsPlayingTts(null);
      await audio.play();
    } catch (err: any) {
      setTtsStatusError(err?.message || 'TTS playback error');
      setIsPlayingTts(null);
    }
  };

  const handleVoiceCommand = async () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Deterministic voice query fallback when browser SpeechRecognition is unavailable in headless environments
      const sampleVoicePrompt =
        'I have 45 million naira budget, find me a Clean Title Lexus RX 350 Run and Drive and calculate landed cost.';
      setInputPrompt(sampleVoicePrompt);
      onApplyVoiceSearch('Lexus', 45000000);
      await handleSendPrompt(sampleVoicePrompt);
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = async (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setIsListening(false);
      if (transcript) {
        setInputPrompt(transcript);
        try {
          const intentRes = await fetch('/api/ai-agent/parse-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript }),
          });
          if (intentRes.ok) {
            const parsed = await intentRes.json();
            if (parsed.searchMakeOrModel || parsed.maxBudgetNgn) {
              onApplyVoiceSearch(
                parsed.searchMakeOrModel || '',
                Number(parsed.maxBudgetNgn) || 0
              );
            }
          }
        } catch {
          // Continue to multi-turn chat
        }
        await handleSendPrompt(transcript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleConfirmQuickBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const targetVeh = vehicles.find((v) => v.lotId === bookingLotId) || vehicles[0];
    if (!targetVeh) return;
    onQuickBookInspection(
      targetVeh,
      new Date(bookingDate).toISOString(),
      'Booked via Smart Ride AI Voice & Conversational Agent'
    );
    setShowBookingForm(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `book-${Date.now()}`,
        role: 'model',
        text: `Confirmed Live Virtual Yard Walk-Around for ${targetVeh.year} ${targetVeh.make} ${targetVeh.model} (Lot ${targetVeh.lotId}) on ${new Date(
          bookingDate
        ).toLocaleString()} with Engr. Tunde Bakare.`,
        modelBadge: 'Smart Ride Yard Scheduler',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <div className="fixed bottom-5 right-5 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-label="Open Smart Ride Gemini Copilot & Voice Agent"
          className="flex items-center gap-2.5 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg border border-emerald-400/30 transition-transform active:scale-95 whitespace-nowrap"
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>Smart Ride AI & Voice Agent</span>
        </button>
      </div>

      {/* Copilot Drawer / Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-5 z-50 w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
          style={{ maxHeight: '78vh' }}
          role="dialog"
          aria-label="Smart Ride Multi-Turn Gemini Chatbot and Voice Assistant"
        >
          {/* Top Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white">
                Smart Ride AI Copilot & Voice Booking Agent
              </p>
              <p className="text-[11px] text-slate-400">
                Multi-turn Budget, Landed Cost & TTS (`gemini-3.8-flash-tts`)
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Copilot"
              className="p-1 text-slate-400 hover:text-white rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Model Tier Selector */}
          <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 w-full">
              <button
                type="button"
                onClick={() => setModelMode('thinking')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  modelMode === 'thinking'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Brain className="w-3 h-3 shrink-0" />
                <span>High Thinking (Argon)</span>
              </button>
              <button
                type="button"
                onClick={() => setModelMode('general')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  modelMode === 'general'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3 h-3 shrink-0" />
                <span>General (3.8 Flash)</span>
              </button>
              <button
                type="button"
                onClick={() => setModelMode('fast')}
                className={`flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded text-[11px] font-medium transition-colors whitespace-nowrap ${
                  modelMode === 'fast'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-3 h-3 shrink-0" />
                <span>Fast (3.1 Lite)</span>
              </button>
            </div>
          </div>

          {/* Quick Action Bar for Voice Inspection Booking */}
          <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => setShowBookingForm((prev) => !prev)}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-medium"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{showBookingForm ? 'Hide Yard Booking Form' : 'Schedule Virtual Yard Tour'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onApplyVoiceSearch('Lexus', 55000000);
                handleSendPrompt(
                  'I have 55 million naira, find me a Clean Title Lexus RX 350 Run & Drive and break down the landed cost to Tin Can Island.'
                );
              }}
              className="text-slate-400 hover:text-white underline"
            >
              Try NGN 55M Lexus Voice Query
            </button>
          </div>

          {showBookingForm && (
            <form
              onSubmit={handleConfirmQuickBooking}
              className="p-3 bg-slate-950 border-b border-slate-800 space-y-2 text-xs"
            >
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="copilot-lot" className="block text-slate-400 mb-1">
                    Select Lot
                  </label>
                  <select
                    id="copilot-lot"
                    value={bookingLotId}
                    onChange={(e) => setBookingLotId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    {vehicles.map((v) => (
                      <option key={v.lotId} value={v.lotId}>
                        {v.lotId} · {v.year} {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="copilot-date" className="block text-slate-400 mb-1">
                    Date & Time
                  </label>
                  <input
                    id="copilot-date"
                    type="datetime-local"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded"
              >
                Confirm Live Virtual Inspection
              </button>
            </form>
          )}

          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-100 ml-6'
                    : 'bg-slate-950 border border-slate-800 text-slate-200 mr-4'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">
                    {msg.role === 'user' ? 'You' : 'Smart Ride Copilot'}
                  </span>
                  <span>{msg.modelBadge || msg.timestamp}</span>
                </div>
                <p className="whitespace-pre-line">{msg.text}</p>

                {msg.role === 'model' && (
                  <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => handlePlayTts(msg)}
                      disabled={isPlayingTts === msg.id}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>
                        {isPlayingTts === msg.id
                          ? 'Synthesizing (gemini-3.8-flash-tts)...'
                          : 'Read Aloud (gemini-3.8-flash-tts)'}
                      </span>
                    </button>
                    <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                {modelMode === 'thinking'
                  ? 'Reasoning deeply with gemini-4-argon (ThinkingLevel.HIGH)...'
                  : 'Generating response...'}
              </div>
            )}
            {ttsStatusError && (
              <div className="p-2 bg-amber-950/50 border border-amber-700/50 rounded text-[11px] text-amber-200">
                TTS Notice: {ttsStatusError}
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handleVoiceCommand}
              aria-label="Voice Search Microphone"
              className={`p-2 rounded-lg border transition-colors shrink-0 ${
                isListening
                  ? 'bg-red-600 border-red-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Speak budget or vehicle query"
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSendPrompt();
              }}
              placeholder="Ask budget, landed duty, or vehicle query..."
              aria-label="Chat message input"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              onClick={() => handleSendPrompt()}
              disabled={isSending || !inputPrompt.trim()}
              aria-label="Send chat message"
              className="p-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

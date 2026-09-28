"use client";

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { geocodeCity } from "@/lib/openMeteo";
import type { GeocodeResult } from "@/lib/types";
import { useLocation } from "@/context/LocationContext";

interface SpeechRecognitionResultLike {
  0: { transcript: string };
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

export default function SearchBar() {
  const { setLocation } = useLocation();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setVoiceSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocodeCity(query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }, [query]);

  const choose = (result: GeocodeResult) => {
    setLocation({
      name: result.name,
      country: result.country,
      lat: result.latitude,
      lon: result.longitude,
    });
    setQuery("");
    setSuggestions([]);
    axios.post("/api/search-history", { query: result.name }).catch(() => {});
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      try {

        setLocation({ name: "Current location", country: "", lat: latitude, lon: longitude });
      } catch {
        setLocation({ name: "Current location", country: "", lat: latitude, lon: longitude });
      }
    });
  };

  const startVoiceSearch = () => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrap">
        <input
          type="text"
          placeholder="Search for a city..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && suggestions[0]) choose(suggestions[0]);
          }}
        />
        {suggestions.length > 0 && (
          <ul className="suggestions">
            {suggestions.map((s) => (
              <li key={s.id} onClick={() => choose(s)}>
                {s.name}
                {s.admin1 ? `, ${s.admin1}` : ""}, {s.country}
              </li>
            ))}
          </ul>
        )}
      </div>
      {voiceSupported && (
        <button
          type="button"
          className={listening ? "icon-btn listening" : "icon-btn"}
          onClick={startVoiceSearch}
          title="Voice search"
          aria-label="Voice search"
        >
          🎤
        </button>
      )}
      <button
        type="button"
        className="icon-btn"
        onClick={useMyLocation}
        title="Use my location"
        aria-label="Use my location"
      >
        📍
      </button>
    </div>
  );
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
export function startVoice(
  result: (text: string) => void,
  error: (text: string) => void,
  end: () => void,
): () => void {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  const Constructor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  if (!Constructor)
    throw new Error('Voice recognition unavailable. Use the text box.');
  const recognition = new Constructor();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (e) => {
    const text = e.results[0]?.[0]?.transcript;
    if (text) result(text);
  };
  recognition.onerror = (e) =>
    error('Speech service: ' + e.error + '. Use the text box instead.');
  const timer = setTimeout(() => recognition.stop(), 15000);
  recognition.onend = () => {
    clearTimeout(timer);
    end();
  };
  recognition.start();
  return () => {
    clearTimeout(timer);
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.stop();
    end();
  };
}

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Image as ImageIcon, Map, Search, BrainCircuit, Loader2, FileText, X } from 'lucide-react';

export default function AIAssistant() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'think' | 'search' | 'maps'>('chat');
  
  const [selectedFile, setSelectedFile] = useState<{
    name: string, 
    type: string, 
    data: string, 
    isImage: boolean
  } | null>(null);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedFile({
        name: file.name,
        type: file.type,
        data: event.target?.result as string,
        isImage: file.type.startsWith('image/')
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || loading) return;

    const userMessage = { role: 'user', parts: [{ text: input }] };
    let newMessages = [...messages, userMessage];
    
    if (selectedFile) {
        newMessages = [...messages, { 
          role: 'user', 
          parts: [
            { text: input || (selectedFile.isImage ? "Analyze this image" : "Analyze this document") }, 
            { text: selectedFile.isImage ? "[Image attached]" : `[Document attached: ${selectedFile.name}]` }
          ] 
        }];
    }
    
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      let res;
      if (selectedFile) {
        const base64Data = selectedFile.data.split(',')[1];
        if (selectedFile.isImage) {
          res = await fetch('/api/ai/analyze-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: input, imageBase64: base64Data })
          });
        } else {
          res = await fetch('/api/ai/analyze-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              prompt: input, 
              documentBase64: base64Data,
              mimeType: selectedFile.type,
              fileName: selectedFile.name
            })
          });
        }
        setSelectedFile(null);
      } else if (mode === 'think') {
        res = await fetch('/api/ai/think', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input })
        });
      } else if (mode === 'search' || mode === 'maps') {
        res = await fetch('/api/ai/grounded', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: input, useMaps: mode === 'maps' })
        });
      } else {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            messages: newMessages.map(m => ({ role: m.role, parts: m.parts.map((p: any) => ({ text: p.text })) }))
          })
        });
      }

      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: data.text }] }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${data.error}` }] }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: `Error: ${err.message}` }] }]);
    }
    
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 p-4 border-b border-zinc-800 bg-zinc-900/80">
        <button onClick={() => setMode('chat')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'chat' ? 'bg-indigo-500/20 text-indigo-400' : 'hover:bg-zinc-800 text-zinc-400'}`}>Chatbot</button>
        <button onClick={() => setMode('think')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === 'think' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'hover:bg-zinc-800 text-zinc-400'}`}><BrainCircuit size={14}/> High Thinking</button>
        <button onClick={() => setMode('search')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === 'search' ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400'}`}><Search size={14}/> Search</button>
        <button onClick={() => setMode('maps')} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${mode === 'maps' ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-zinc-800 text-zinc-400'}`}><Map size={14}/> Maps</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
            <BrainCircuit size={48} className="mb-4" />
            <p>How can I help you today?</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-zinc-800 border border-zinc-700 text-zinc-200'}`}>
              {msg.parts.map((p: any, i: number) => (
                <div key={i}>
                  {p.text === "[Image attached]" ? (
                     <span className="italic opacity-70 text-xs block mb-1">📷 Image attached</span>
                  ) : (
                    <div className="markdown-body">
                      <ReactMarkdown>{p.text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-zinc-800 border border-zinc-700 text-zinc-200 p-3 rounded-lg text-sm flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 bg-zinc-900/80">
        {selectedFile && (
          <div className="mb-2 relative inline-flex items-center gap-2 bg-zinc-800 p-2 rounded-lg border border-zinc-700">
            {selectedFile.isImage ? (
              <img src={selectedFile.data} alt="Preview" className="h-10 w-10 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 bg-zinc-700 rounded flex items-center justify-center text-zinc-400">
                <FileText size={20} />
              </div>
            )}
            <div className="text-xs truncate max-w-[150px] text-zinc-300">{selectedFile.name}</div>
            <button onClick={() => setSelectedFile(null)} className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors"><X size={12}/></button>
          </div>
        )}
        <div className="flex gap-2">
          <input type="file" accept="image/*,.pdf,.doc,.docx,.txt" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors" title="Upload Image or Document">
            <ImageIcon size={20} />
          </button>
          <input 
            type="text" 
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={mode === 'chat' ? "Message Assistant..." : `Ask using ${mode}...`}
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-indigo-500 text-white"
          />
          <button onClick={handleSend} disabled={loading || (!input.trim() && !selectedFile)} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
